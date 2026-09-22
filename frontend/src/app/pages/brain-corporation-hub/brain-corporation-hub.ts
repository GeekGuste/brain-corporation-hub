import { Component, inject } from '@angular/core';

import { Seo } from '../../core/seo/seo';

@Component({
  selector: 'app-brain-corporation-hub',
  templateUrl: './brain-corporation-hub.html',
})
export class BrainCorporationHub {
  constructor() {
    inject(Seo).appliquer('brain-corporation-hub');
  }
}
