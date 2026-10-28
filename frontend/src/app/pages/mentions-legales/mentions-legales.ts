import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import contenu from '../../../content/fr/mentions-legales.json';
import type { ContenuPageLegale } from '../../core/content/modele-contenu';
import { Seo } from '../../core/seo/seo';
import { PageLegale } from '../../shared/page-legale/page-legale';

/**
 * Mentions legales.
 *
 * La page ne fait qu'une chose : passer son fichier de contenu au gabarit
 * commun des pages legales. Les textes appartiennent au client
 * (CLAUDE.md §3 et §16).
 */
@Component({
  selector: 'app-mentions-legales',
  imports: [PageLegale],
  template: '<app-page-legale [contenu]="contenu" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionsLegales {
  protected readonly contenu = contenu as unknown as ContenuPageLegale;

  constructor() {
    inject(Seo).appliquer('mentions-legales');
  }
}
