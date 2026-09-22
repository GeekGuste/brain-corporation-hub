import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Rendu serveur a chaque requete, et non prerendu au build.
 *
 * Le prerendu figerait dans le HTML des valeurs qui dependent de
 * l'environnement (URL canonique, indexabilite) au moment de la construction
 * de l'image. Or la meme image doit tourner en preprod et en production
 * (CLAUDE.md §11). Le rendu serveur laisse ces valeurs etre lues au lancement
 * du conteneur.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
