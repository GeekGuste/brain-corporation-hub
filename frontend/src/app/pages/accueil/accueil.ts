import { Component, inject } from '@angular/core';

import { Seo } from '../../core/seo/seo';

@Component({
  selector: 'app-accueil',
  templateUrl: './accueil.html',
})
export class Accueil {
  constructor() {
    inject(Seo).appliquer('accueil');
  }
}
