import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import libelles from '../../../content/fr/non-trouvee.json';
import { cheminDePage } from '../../core/config/site-routes';
import { Seo } from '../../core/seo/seo';

/**
 * Page affichee quand une URL ne correspond a aucune route.
 *
 * Elle ne REDIRIGE PAS. Une redirection vers une autre page donnerait un 200
 * sur une adresse qui n'existe pas : les moteurs de recherche indexeraient des
 * URL fantomes, et un lien casse ne se verrait jamais dans les outils de
 * mesure (CLAUDE.md §12). Le serveur repond donc un vrai 404, et c'est cette
 * page qui s'affiche dedans.
 *
 * Le visiteur n'est pas laisse sans issue pour autant : la page mene a la
 * formation et a l'accueil.
 */
@Component({
  selector: 'app-non-trouvee',
  imports: [RouterLink],
  templateUrl: './non-trouvee.html',
  styleUrl: './non-trouvee.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NonTrouvee {
  protected readonly t = libelles;

  /** Chemins resolus depuis la configuration, jamais ecrits en dur. */
  protected readonly versFormation = cheminDePage('lignes-rouges');
  protected readonly versAccueil = cheminDePage('accueil');

  constructor() {
    inject(Seo).appliquerNonTrouvee();
  }
}
