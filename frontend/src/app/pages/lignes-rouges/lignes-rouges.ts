import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import contenu from '../../../content/fr/lignes-rouges.json';
import type { ContenuDePage } from '../../core/content/modele-contenu';
import { Seo } from '../../core/seo/seo';
import { FormulaireInscription } from '../../shared/formulaire-inscription/formulaire-inscription';
import { LogoLignesRouges } from '../../shared/logo-lignes-rouges/logo-lignes-rouges';
import { PageContenu } from '../../shared/page-contenu/page-contenu';

/** Une question de la foire aux questions. */
interface QuestionFaq {
  readonly question: string;
  readonly reponse: string;
}

/**
 * Foire aux questions.
 *
 * Redigee a partir de deux documents du client, le document de contenus et le
 * script des emissions video. A FAIRE RELIRE PAR LUI avant mise en ligne :
 * c est de la parole de juriste, transposee d un dialogue televise vers un
 * format de site.
 */
interface BlocFaq {
  readonly titre: string;
  readonly questions: readonly QuestionFaq[];
}

/** Bloc d'inscription. Produit d'apres CLAUDE.md §4, pas fourni par le client. */
interface BlocInscription {
  readonly titre: string;
  readonly recapitulatif: string;
  readonly mentionTva: string;
}

@Component({
  selector: 'app-lignes-rouges',
  imports: [PageContenu, FormulaireInscription, LogoLignesRouges],
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

  /**
   * Foire aux questions, placee AVANT le formulaire : elle traite les
   * objections qui empechent de s inscrire, elle doit donc se lire avant le
   * moment de decider.
   */
  protected readonly faq = contenu.faq as unknown as BlocFaq;

  constructor() {
    inject(Seo).appliquer('lignes-rouges');
  }
}
