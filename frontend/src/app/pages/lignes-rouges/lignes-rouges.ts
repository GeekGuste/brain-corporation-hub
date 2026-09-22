import { Component, inject } from '@angular/core';

import { Seo } from '../../core/seo/seo';

@Component({
  selector: 'app-lignes-rouges',
  templateUrl: './lignes-rouges.html',
})
export class LignesRouges {
  constructor() {
    inject(Seo).appliquer('lignes-rouges');
  }
}
