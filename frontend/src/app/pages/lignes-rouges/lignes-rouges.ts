import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import contenu from '../../../content/fr/lignes-rouges.json';
import type { ContenuDePage } from '../../core/content/modele-contenu';
import { Seo } from '../../core/seo/seo';
import { PageContenu } from '../../shared/page-contenu/page-contenu';

/** Bloc d'inscription. Produit d'apres CLAUDE.md §4, pas fourni par le client. */
interface BlocInscription {
  readonly titre: string;
  readonly recapitulatif: string;
  readonly mentionTva: string;
  readonly attente: string;
}

@Component({
  selector: 'app-lignes-rouges',
  imports: [PageContenu],
  templateUrl: './lignes-rouges.html',
  styleUrl: './lignes-rouges.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LignesRouges {
  /** Textes du client, lus dans content/fr/lignes-rouges.json. */
  protected readonly contenu = contenu as unknown as ContenuDePage;

  /**
   * Recapitulatif et mention de TVA, affiches au point de paiement.
   *
   * Ce bloc ne vient PAS du document du client : il est produit d'apres
   * CLAUDE.md §4. La mention de TVA est obligatoire en auto-entreprise et doit
   * figurer la ou le visiteur decide de payer.
   */
  protected readonly inscription = contenu.inscription as unknown as BlocInscription;

  constructor() {
    inject(Seo).appliquer('lignes-rouges');
  }
}
