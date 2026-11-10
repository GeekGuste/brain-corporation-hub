import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

import { CONFIGURATION_EXECUTION_PAR_DEFAUT } from './app/core/config/runtime-config';
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
 * Domaine des URL absolues, le meme que celui des canoniques.
 *
 * Il vaut TOUJOURS le domaine de production, y compris en preprod
 * (CLAUDE.md §12.3). Lu au lancement du conteneur, jamais au build : une seule
 * image sert les deux environnements.
 */
const urlDeBase = (
  process.env['SITE_CANONICAL_BASE_URL'] ??
  CONFIGURATION_EXECUTION_PAR_DEFAUT.urlCanoniqueDeBase
).replace(/\/$/, '');

/**
 * URL absolue d'une page, construite EXACTEMENT comme la canonique du service
 * SEO : l'accueil garde sa barre oblique finale, les autres non. Une canonique
 * et une entree de sitemap qui divergent d'une barre oblique designent deux
 * adresses differentes pour un moteur de recherche.
 */
function urlAbsolue(chemin: string): string {
  return chemin ? `${urlDeBase}/${chemin}` : `${urlDeBase}/`;
}

/**
 * robots.txt et sitemap.xml sont servis ici, et non deposes en fichiers
 * statiques : ils different entre preprod et production, alors que l'image
 * Docker est la meme.
 *
 * Ils sont declares AVANT express.static, pour qu'aucun fichier depose un jour
 * dans public/ ne vienne les masquer silencieusement.
 */
app.get('/robots.txt', (_req, res) => {
  // AUCUN « Disallow », nulle part, et c'est un choix raisonne (CLAUDE.md §12.4).
  //
  // La page de suivi et la preprod entiere sortent en « noindex ». Or un robot
  // a qui l'on interdit le crawl ne lit jamais le noindex : l'URL peut alors
  // rester listee, sans titre ni description, ce qui est exactement ce qu'on
  // voulait eviter. Interdire le crawl ET poser un noindex est la faute
  // classique ; on choisit le noindex, donc on laisse crawler.
  //
  // Ce qui protege reellement la preprod est le mot de passe Plesk, et la page
  // de suivi son authentification. Le robots.txt n'a jamais protege personne :
  // il est public et lu par tout le monde.
  const lignes = ['User-agent: *', 'Allow: /'];

  // Le sitemap n'est annonce que depuis la production. L'annoncer depuis la
  // preprod reviendrait a lui designer les URL de production, depuis un
  // domaine qui ne doit rien indexer.
  if (siteIndexable) {
    lignes.push('', `Sitemap: ${urlDeBase}/sitemap.xml`);
  }

  res.type('text/plain; charset=utf-8').send(`${lignes.join('\n')}\n`);
});

app.get('/sitemap.xml', (_req, res) => {
  // La liste vient de seo/routes.config.json, la meme source que les routes
  // Angular : ajouter une page l'y fait entrer toute seule, et la page de
  // suivi en reste exclue parce qu'elle est declaree non indexable
  // (CLAUDE.md §12).
  const entrees = configurationRoutes.pages
    .filter((page) => page.indexable)
    .map((page) => `  <url>\n    <loc>${echapperXml(urlAbsolue(page.chemin))}</loc>\n  </url>`)
    .join('\n');

  // Ni lastmod, ni changefreq, ni priority. Les deux derniers sont ignores par
  // les moteurs, et le premier serait une date inventee tant que rien ne suit
  // la derniere modification reelle de chaque page.
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${entrees}\n` +
    '</urlset>\n';

  res.type('application/xml; charset=utf-8').send(xml);
});

/** Les caracteres que XML ne tolere pas dans un texte. */
function echapperXml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
