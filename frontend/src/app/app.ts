import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import navigation from '../content/fr/navigation.json';
import { cheminDePage } from './core/config/site-routes';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  /** Libelles de l'ossature, lus dans content/fr/navigation.json. */
  protected readonly navigation = navigation;

  /** Chemins resolus depuis seo/routes.config.json, jamais ecrits en dur. */
  protected readonly liens = navigation.liens.map((lien) => ({
    ...lien,
    chemin: cheminDePage(lien.cle),
  }));

  protected readonly anneeCourante = new Date().getFullYear();
}
