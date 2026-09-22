import { Routes } from '@angular/router';

import { pageParCle } from './core/config/site-routes';

/**
 * Les chemins ne sont jamais ecrits ici : ils viennent de
 * seo/routes.config.json (CLAUDE.md §12 et §16). Le referenceur pourra les
 * ajuster sans toucher a ce fichier.
 *
 * Aucune route « ** » : une URL inconnue ne correspond a aucune route, Angular
 * ne rend rien, et le serveur repond un vrai 404. Une redirection vers
 * l'accueil produirait un faux 200 sur une page qui n'existe pas.
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
];
