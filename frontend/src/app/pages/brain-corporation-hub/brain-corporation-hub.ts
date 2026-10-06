import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import contenu from '../../../content/fr/brain-corporation-hub.json';
import type { ContenuDePage } from '../../core/content/modele-contenu';
import { Seo } from '../../core/seo/seo';
import { PageContenu } from '../../shared/page-contenu/page-contenu';

@Component({
  selector: 'app-brain-corporation-hub',
  imports: [PageContenu],
  templateUrl: './brain-corporation-hub.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrainCorporationHub {
  protected readonly contenu = contenu as unknown as ContenuDePage;

  constructor() {
    inject(Seo).appliquer('brain-corporation-hub');
  }
}
