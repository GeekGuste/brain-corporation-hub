import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import contenu from '../../../content/fr/conditions-generales-de-vente.json';
import type { ContenuPageLegale } from '../../core/content/modele-contenu';
import { Seo } from '../../core/seo/seo';
import { PageLegale } from '../../shared/page-legale/page-legale';

/**
 * Conditions generales de vente.
 *
 * La page ne fait qu'une chose : passer son fichier de contenu au gabarit
 * commun des pages legales. Les textes appartiennent au client
 * (CLAUDE.md §3 et §16).
 */
@Component({
  selector: 'app-conditions-generales-de-vente',
  imports: [PageLegale],
  template: '<app-page-legale [contenu]="contenu" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionsGeneralesDeVente {
  protected readonly contenu = contenu as unknown as ContenuPageLegale;

  constructor() {
    inject(Seo).appliquer('conditions-generales-de-vente');
  }
}
