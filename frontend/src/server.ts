import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import configurationRoutes from './seo/routes.config.json' with { type: 'json' };

const browserDistFolder = join(import.meta.dirname, '../browser');

const cheminsDeclares = configurationRoutes.pages.map((page) => ({
  chemin: page.chemin ? `/${page.chemin}` : '/',
  // Vrai pour les pages a ecrans enfants, comme le back-office. Sans cette
  // distinction, /lignes-rouges/n-importe-quoi passerait pour une page valide
  // et repondrait 200.
  enfants: 'enfants' in page && page.enfants === true,
}));

const app = express();

/**
 * Noms d'hotes autorises, lus au lancement du conteneur.
 *
 * Angular refuse de rendre une page pour un hote inconnu : c'est une protection
 * contre la falsification de l'en-tete Host. La liste differe entre preprod et
 * production alors que l'image est la meme, elle ne peut donc pas etre figee
 * dans angular.json au build (CLAUDE.md §11).
 *
 * Elle sert aussi le §12.5 : le site ne doit repondre ni sur l'IP du serveur,
 * ni sur le nom d'hote de l'hebergeur.
 */
const hotesAutorises = (process.env['SITE_ALLOWED_HOSTS'] ?? 'localhost,127.0.0.1')
  .split(',')
  .map((hote) => hote.trim())
  .filter(Boolean);

const angularApp = new AngularNodeAppEngine({
  allowedHosts: hotesAutorises,
  // Apache termine le HTTPS et transmet X-Forwarded-Host. Sans cette option,
  // Angular voit l'hote interne du conteneur. La liste ci-dessus reste le
  // garde-fou : un en-tete falsifie ne passe pas.
  trustProxyHeaders: true,
});

/**
 * Le serveur tourne derriere Apache, lui-meme derriere Plesk (CLAUDE.md §11).
 * Sans cette confiance declaree, req.protocol vaut « http » alors que le
 * visiteur est en HTTPS, et les URL generees sont fausses.
 */
app.set('trust proxy', true);

/**
 * Indexation pilotee par l'environnement (CLAUDE.md §12).
 *
 * En preprod et en local, SITE_INDEXABLE n'est pas « true » : tout ce que sert
 * ce processus part avec un en-tete noindex, nofollow. La protection etanche
 * reste le mot de passe Plesk sur le domaine de preprod ; cet en-tete est la
 * ceinture par-dessus les bretelles.
 *
 * Volontairement, aucun « Disallow: / » ne l'accompagnera : un robot qui n'a
 * pas le droit de crawler ne lit jamais le noindex.
 */
const siteIndexable = process.env['SITE_INDEXABLE'] === 'true';
app.use((_req, res, next) => {
  if (!siteIndexable) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

/**
 * robots.txt et sitemap.xml sont servis ici, et non deposes en fichiers
 * statiques : ils different entre preprod et production, alors que l'image
 * Docker est la meme. Ils sont ecrits a l'etape 10.
 */

/**
 * Fichiers statiques du bundle navigateur.
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Un chemin correspond-il a une page declaree ?
 *
 * La liste vient de seo/routes.config.json, la meme source que les routes
 * Angular : ajouter une page ne demande donc rien ici (CLAUDE.md §12).
 *
 * Les sous-chemins ne sont acceptes que pour les pages qui ont reellement des
 * ecrans enfants, et qui le declarent. Les accepter partout ferait repondre
 * 200 a /lignes-rouges/n-importe-quoi.
 */
function cheminConnu(chemin: string): boolean {
  const normalise = chemin.replace(/\/+$/, '') || '/';
  return cheminsDeclares.some(
    (connu) =>
      normalise === connu.chemin ||
      (connu.enfants && normalise.startsWith(`${connu.chemin}/`)),
  );
}

app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => {
      if (!response) {
        return next();
      }

      // Angular rend toujours en 200, y compris la page « non trouvee » de la
      // route generique. On remet le vrai code ici : une page d'erreur servie
      // en 200 ferait entrer des URL fantomes dans l'index des moteurs, et un
      // lien casse ne se verrait jamais dans les outils de mesure
      // (CLAUDE.md §12).
      const finale = cheminConnu(req.path)
        ? response
        : new Response(response.body, { status: 404, headers: response.headers });

      return writeResponseToNodeResponse(finale, res);
    })
    .catch(next);
});

/**
 * Le port est impose par l'environnement : 3000 en production, 3001 en
 * preprod, publies sur 127.0.0.1 uniquement (CLAUDE.md §11).
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Serveur SSR a l'ecoute sur http://localhost:${port}`);
  });
}

/**
 * Point d'entree utilise par la CLI Angular pendant le developpement.
 */
export const reqHandler = createNodeRequestHandler(app);
