import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import contenu from '../../../content/fr/accueil.json';
import type { ContenuDePage } from '../../core/content/modele-contenu';
import { Seo } from '../../core/seo/seo';
import { PageContenu } from '../../shared/page-contenu/page-contenu';

@Component({
  selector: 'app-accueil',
  imports: [PageContenu],
  templateUrl: './accueil.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Accueil {
  /** Textes du client, lus dans content/fr/accueil.json. */
  protected readonly contenu = contenu as unknown as ContenuDePage;

  constructor() {
    inject(Seo).appliquer('accueil');
  }
}
