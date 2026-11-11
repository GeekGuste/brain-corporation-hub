import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import libelles from '../../../content/fr/referentiel-territorial.json';
import { Seo } from '../../core/seo/seo';
import { TableauReferentiel } from '../../shared/tableau-referentiel/tableau-referentiel';

/**
 * Page PUBLIQUE du referentiel territorial (CLAUDE.md §5.8).
 *
 * Elle encadre le tableau partage de ce qui est propre au public : le bandeau,
 * ce que la grille n'est pas, et la mention de verification. Le tableau
 * lui-meme sert aussi a l'ecran d'administration : c'est la meme grille, elle
 * n'existe qu'une fois.
 *
 * Consultation uniquement. L'interface d'administration du referentiel est
 * hors perimetre V1 (CLAUDE.md §8).
 */
@Component({
  selector: 'app-referentiel-territorial',
  imports: [TableauReferentiel],
  templateUrl: './referentiel-territorial.html',
  styleUrl: './referentiel-territorial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferentielTerritorial {
  protected readonly t = libelles;

  constructor() {
    inject(Seo).appliquer('referentiel-territorial');
  }
}
