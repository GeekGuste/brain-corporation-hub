import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import navigation from '../content/fr/navigation.json';
import { cheminDePage } from './core/config/site-routes';
import type { EmplacementLogo } from './core/content/modele-contenu';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Libelles de l'ossature, lus dans content/fr/navigation.json. */
  protected readonly navigation = navigation;

  /**
   * Emplacement du logo. Tant que le fichier n'est pas fourni, la marque
   * s'affiche en texte dans un espace de meme hauteur : la mise en page ne
   * bougera pas le jour ou le logo arrivera (CLAUDE.md §14).
   */
  // Type declare explicitement : lu depuis un JSON, « fichier » serait sinon
  // infere comme le type litteral null, et le gabarit refuserait de le lire le
  // jour ou le fichier sera renseigne.
  protected readonly logo = navigation.logo as unknown as EmplacementLogo;

  /** Chemins resolus depuis seo/routes.config.json, jamais ecrits en dur. */
  protected readonly liens = navigation.liens.map((lien) => ({
    ...lien,
    chemin: cheminDePage(lien.cle),
  }));

  protected readonly anneeCourante = new Date().getFullYear();
}
