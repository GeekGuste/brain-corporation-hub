import { Routes } from '@angular/router';

import { pageParCle } from './core/config/site-routes';

/**
 * Les chemins ne sont jamais ecrits ici : ils viennent de
 * seo/routes.config.json (CLAUDE.md §12 et §16). Le referenceur pourra les
 * ajuster sans toucher a ce fichier.
 */
export const routes: Routes = [
  {
    path: pageParCle('accueil').chemin,
    loadComponent: () => import('./pages/accueil/accueil').then((m) => m.Accueil),
  },
  {
    path: pageParCle('brain-corporation-hub').chemin,
    loadComponent: () =>
      import('./pages/brain-corporation-hub/brain-corporation-hub').then(
        (m) => m.BrainCorporationHub,
      ),
  },
  {
    path: pageParCle('lignes-rouges').chemin,
    loadComponent: () =>
      import('./pages/lignes-rouges/lignes-rouges').then((m) => m.LignesRouges),
  },
  {
    // Page PUBLIQUE du referentiel (CLAUDE.md §5.8). Consultation seule :
    // l'interface d'administration du referentiel est hors perimetre V1 (§8).
    path: pageParCle('referentiel-territorial').chemin,
    loadComponent: () =>
      import('./pages/referentiel-territorial/referentiel-territorial').then(
        (m) => m.ReferentielTerritorial,
      ),
  },
  {
    // Pages legales (CLAUDE.md §16). Les trois partagent le meme gabarit : la
    // page ne fait que passer son fichier de contenu, les textes appartiennent
    // au client.
    path: pageParCle('mentions-legales').chemin,
    loadComponent: () =>
      import('./pages/mentions-legales/mentions-legales').then((m) => m.MentionsLegales),
  },
  {
    path: pageParCle('politique-confidentialite').chemin,
    loadComponent: () =>
      import('./pages/politique-confidentialite/politique-confidentialite').then(
        (m) => m.PolitiqueConfidentialite,
      ),
  },
  {
    path: pageParCle('conditions-generales-de-vente').chemin,
    loadComponent: () =>
      import('./pages/conditions-generales-de-vente/conditions-generales-de-vente').then(
        (m) => m.ConditionsGeneralesDeVente,
      ),
  },
  {
    // Back-office. La coque porte la connexion et le menu, ses ecrans sont des
    // routes filles. En noindex et absent de la navigation : on y accede par
    // son URL, derriere mot de passe (CLAUDE.md §5.7).
    //
    // Les ecrans actuels sont ceux du contrat. Le back-office de gestion du §8,
    // cohortes, creneaux, tableaux editables, administration du referentiel,
    // reste HORS PERIMETRE.
    path: pageParCle('suivi').chemin,
    loadComponent: () => import('./pages/suivi/suivi').then((m) => m.Suivi),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/suivi/inscriptions/suivi-inscriptions').then(
            (m) => m.SuiviInscriptions,
          ),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./pages/suivi/notifications/suivi-notifications').then(
            (m) => m.SuiviNotifications,
          ),
      },
      {
        path: 'referentiel',
        loadComponent: () =>
          import('./pages/suivi/referentiel/suivi-referentiel').then((m) => m.SuiviReferentiel),
      },
    ],
  },
  {
    // Toute autre URL. La page s'affiche DANS un vrai 404, pose par le serveur
    // de rendu : une redirection vers une page existante donnerait un 200 sur
    // une adresse qui n'existe pas, et des URL fantomes entreraient dans
    // l'index (CLAUDE.md §12). Le visiteur n'est pas laisse sans issue pour
    // autant, la page mene a la formation et a l'accueil.
    path: '**',
    loadComponent: () => import('./pages/non-trouvee/non-trouvee').then((m) => m.NonTrouvee),
  },
];
