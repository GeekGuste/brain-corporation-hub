import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { Stripe, StripeElements } from '@stripe/stripe-js';

import libelles from '../../../content/fr/inscription.json';
import type {
  CategorieTitre,
  DemandeInscription,
  Prefecture,
  ReponseInscription,
  StatutResidence,
} from '../../core/inscription/modele-inscription';
import { ServiceInscription } from '../../core/inscription/service-inscription';

/** Les quatre ecrans successifs du parcours. */
type Etape = 'formulaire' | 'paiement' | 'confirmee' | 'attenteWebhook';

/**
 * Formulaire d'inscription qualifie et paiement (CLAUDE.md §6 et §9).
 *
 * Partis pris :
 *
 *   UNE seule page, avec des sections qui apparaissent au fur et a mesure,
 *   plutot qu'un assistant a etapes. Le public est souvent peu a l'aise avec
 *   les outils numeriques (CLAUDE.md §13) : un assistant cache ce qui reste a
 *   faire et perd celui qui revient en arriere.
 *
 *   Aucune creation de compte, conformement au §13.
 *
 *   La validation du navigateur est un confort. La seule qui compte est celle
 *   du serveur, et ses messages par champ sont reinjectes ici (CLAUDE.md §15).
 *
 *   AUCUNE donnee de carte ne passe par ce composant ni par notre serveur : le
 *   Payment Element de Stripe est un cadre isole, et le navigateur parle
 *   directement a Stripe avec le « client_secret » (CLAUDE.md §6 et §15).
 *
 *   Le retour de Stripe au navigateur ne confirme RIEN. Il declenche une
 *   interrogation du statut cote serveur pendant quelques secondes, le temps
 *   que le webhook fasse foi. Si le webhook tarde, on affiche « paiement
 *   recu, votre confirmation arrive par email » : un visiteur qui ferme son
 *   onglet recevra quand meme son email (CLAUDE.md §9).
 */
@Component({
  selector: 'app-formulaire-inscription',
  imports: [ReactiveFormsModule],
  templateUrl: './formulaire-inscription.html',
  styleUrl: './formulaire-inscription.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormulaireInscription {
  private readonly service = inject(ServiceInscription);
  private readonly fb = inject(FormBuilder);
  private readonly navigateur = isPlatformBrowser(inject(PLATFORM_ID));

  /** Libelles, lus dans content/fr/inscription.json (CLAUDE.md §13). */
  protected readonly t = libelles;

  protected readonly categories = signal<readonly CategorieTitre[]>([]);
  protected readonly prefectures = signal<readonly Prefecture[]>([]);
  protected readonly referentielsEnEchec = signal(false);

  protected readonly etape = signal<Etape>('formulaire');
  protected readonly envoiEnCours = signal(false);
  protected readonly doublonAConfirmer = signal(false);
  protected readonly inscription = signal<ReponseInscription | null>(null);

  /** Messages du serveur, par nom de champ. */
  protected readonly erreursServeur = signal<Record<string, readonly string[]>>({});

  /** Message global, quand l'echec n'est imputable a aucun champ. */
  protected readonly erreurGlobale = signal<string | null>(null);

  // --- Paiement --------------------------------------------------------------
  private readonly conteneurPaiement =
    viewChild<ElementRef<HTMLElement>>('conteneurPaiement');

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private montageLance = false;

  protected readonly paiementPret = signal(false);
  protected readonly paiementEnCours = signal(false);
  protected readonly erreurPaiement = signal<string | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    telephone: ['', [Validators.maxLength(30)]],
    statutResidence: ['' as StatutResidence | '', [Validators.required]],
    categorieCode: ['', [Validators.required]],
    sousCategorieId: [''],
    precisionAutreSituation: ['', [Validators.maxLength(500)]],
    departementPrefecture: ['', [Validators.required]],
    paysResidenceActuelle: ['', [Validators.maxLength(100)]],
    dateArriveePrevisionnelle: [''],
    communeOuCodePostalProjete: ['', [Validators.maxLength(100)]],
  });

  // ---------------------------------------------------------------------------
  // Etat derive, pour les champs conditionnels
  // ---------------------------------------------------------------------------
  private readonly residenceChoisie = signal<StatutResidence | ''>('');
  private readonly categorieChoisie = signal('');
  private readonly departementChoisi = signal('');

  protected readonly resideALEtranger = computed(
    () => this.residenceChoisie() === 'ResidentALEtranger',
  );

  protected readonly residenceRenseignee = computed(() => this.residenceChoisie() !== '');

  protected readonly categorieCourante = computed(() =>
    this.categories().find((categorie) => categorie.code === this.categorieChoisie()),
  );

  /** La famille AUT impose une precision en texte libre (CLAUDE.md §6). */
  protected readonly precisionLibreRequise = computed(
    () => this.categorieCourante()?.precisionLibreObligatoire === true,
  );

  protected readonly sousCategories = computed(
    () => this.categorieCourante()?.sousCategories ?? [],
  );

  protected readonly prefectureCourante = computed(() =>
    this.prefectures().find(
      (prefecture) => prefecture.departement === this.departementChoisi(),
    ),
  );

  /** Montant affiche, formate depuis les centimes renvoyes par l'API. */
  protected readonly montantAffiche = computed(() => {
    const courante = this.inscription();
    if (!courante) return '';
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: courante.devise.toUpperCase(),
    }).format(courante.montantCentimes / 100);
  });

  constructor() {
    this.service.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.referentielsEnEchec.set(true),
    });

    this.service.prefectures().subscribe({
      next: (prefectures) => this.prefectures.set(prefectures),
      error: () => this.referentielsEnEchec.set(true),
    });

    // Le cadre de paiement n'existe qu'une fois l'inscription creee. Cet effet
    // attend qu'il apparaisse dans le gabarit pour y monter le Payment Element.
    effect(() => {
      const hote = this.conteneurPaiement()?.nativeElement;
      const courante = this.inscription();
      if (!this.navigateur || !hote || !courante || this.montageLance) return;
      this.montageLance = true;
      void this.monterPaiement(hote, courante);
    });
  }

  // ---------------------------------------------------------------------------
  // Reactions aux choix
  // ---------------------------------------------------------------------------

  protected surChangementResidence(): void {
    this.residenceChoisie.set(this.formulaire.controls.statutResidence.value);
  }

  protected surChangementCategorie(): void {
    this.categorieChoisie.set(this.formulaire.controls.categorieCode.value);
    // La sous-categorie appartenait a l'ancienne famille : la garder enverrait
    // une inscription incoherente, que le serveur refuserait.
    this.formulaire.controls.sousCategorieId.setValue('');
  }

  protected surChangementPrefecture(): void {
    this.departementChoisi.set(this.formulaire.controls.departementPrefecture.value);
  }

  // ---------------------------------------------------------------------------
  // Erreurs
  // ---------------------------------------------------------------------------

  protected messageErreur(champ: string): string | null {
    const duServeur = this.erreursServeur()[champ]?.[0];
    if (duServeur) return duServeur;

    const controle = this.formulaire.get(champ);
    if (!controle || !controle.touched || controle.valid) return null;

    if (controle.hasError('required')) return this.t.erreurs.requis;
    if (controle.hasError('email')) return this.t.erreurs.emailInvalide;
    return this.t.erreurs.requis;
  }

  protected enErreur(champ: string): boolean {
    return this.messageErreur(champ) !== null;
  }

  // ---------------------------------------------------------------------------
  // Envoi du formulaire
  // ---------------------------------------------------------------------------

  protected envoyer(doublonConfirme = false): void {
    this.erreurGlobale.set(null);
    this.erreursServeur.set({});

    const precision = this.formulaire.controls.precisionAutreSituation;
    if (this.precisionLibreRequise() && !precision.value.trim()) {
      precision.markAsTouched();
      this.erreursServeur.set({ precisionAutreSituation: [this.t.erreurs.requis] });
      return;
    }

    if (this.resideALEtranger() && !this.formulaire.controls.paysResidenceActuelle.value.trim()) {
      this.formulaire.controls.paysResidenceActuelle.markAsTouched();
      this.erreursServeur.set({ paysResidenceActuelle: [this.t.erreurs.requis] });
      return;
    }

    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }

    this.envoiEnCours.set(true);
    this.doublonAConfirmer.set(false);

    this.service.creer(this.construireDemande(doublonConfirme)).subscribe((resultat) => {
      this.envoiEnCours.set(false);

      switch (resultat.type) {
        case 'creee':
          // L'inscription existe, au statut « en attente de paiement ». Rien
          // n'est confirme et aucun email n'est parti (CLAUDE.md §9).
          this.inscription.set(resultat.inscription);
          this.etape.set('paiement');
          break;

        case 'doublon':
          // Pas une erreur : une question (CLAUDE.md §6).
          this.doublonAConfirmer.set(true);
          break;

        case 'invalide':
          this.erreursServeur.set(this.normaliser(resultat.erreurs));
          this.formulaire.markAllAsTouched();
          break;

        case 'echec':
          this.erreurGlobale.set(
            resultat.cle === 'paiementIndisponible'
              ? this.t.paiement.erreurs.indisponible
              : this.t.erreurs[resultat.cle],
          );
          break;
      }
    });
  }

  protected annulerDoublon(): void {
    this.doublonAConfirmer.set(false);
    this.formulaire.controls.email.setValue('');
    this.formulaire.controls.email.markAsUntouched();
  }

  // ---------------------------------------------------------------------------
  // Paiement
  // ---------------------------------------------------------------------------

  /**
   * Charge Stripe et monte le Payment Element.
   *
   * La bibliotheque est importee a la demande et non au chargement de la page :
   * elle ne sert qu'a ceux qui vont jusqu'au paiement, et le public est parfois
   * en connexion lente (CLAUDE.md §13).
   */
  private async monterPaiement(hote: HTMLElement, courante: ReponseInscription): Promise<void> {
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      this.stripe = await loadStripe(courante.clePubliable);
      if (!this.stripe) throw new Error('Stripe ne s est pas charge.');

      this.elements = this.stripe.elements({
        clientSecret: courante.clientSecret,
        locale: 'fr',
      });

      this.elements.create('payment').mount(hote);
      this.paiementPret.set(true);
    } catch {
      this.erreurPaiement.set(this.t.paiement.erreurs.chargement);
    }
  }

  protected async payer(): Promise<void> {
    if (!this.stripe || !this.elements || this.paiementEnCours()) return;

    this.paiementEnCours.set(true);
    this.erreurPaiement.set(null);

    // « if_required » : on reste dans la page. Les moyens de paiement qui
    // imposeraient une redirection sont de toute facon exclus a la creation du
    // PaymentIntent, cote serveur (CLAUDE.md §9.4).
    const resultat = await this.stripe.confirmPayment({
      elements: this.elements,
      redirect: 'if_required',
    });

    if (resultat.error) {
      // Message de Stripe, deja traduit et comprehensible. On garde le cadre
      // monte : le visiteur corrige et reessaie sans tout resaisir.
      this.erreurPaiement.set(resultat.error.message ?? this.t.paiement.erreurs.refuse);
      this.paiementEnCours.set(false);
      return;
    }

    // Stripe dit que le paiement est passe. Cela ne confirme RIEN de notre
    // cote : seul le webhook fait foi.
    void this.attendreConfirmation();
  }

  /**
   * Interroge le statut pendant quelques secondes apres le retour de Stripe
   * (CLAUDE.md §9.6).
   *
   * Si le webhook tarde, on n'invente pas une confirmation : on dit que le
   * paiement est recu et que la confirmation arrive par email, ce qui est vrai
   * meme si le visiteur ferme son onglet.
   */
  private async attendreConfirmation(): Promise<void> {
    const courante = this.inscription();
    if (!courante) return;

    const DELAI = 1500;
    const ESSAIS = 8;

    for (let essai = 0; essai < ESSAIS; essai += 1) {
      await new Promise((resoudre) => setTimeout(resoudre, DELAI));

      const statut = await new Promise<string | null>((resoudre) =>
        this.service.statut(courante.id).subscribe(resoudre),
      );

      if (statut === 'Confirmee') {
        this.paiementEnCours.set(false);
        this.etape.set('confirmee');
        return;
      }

      if (statut === 'PaiementEchoue') {
        this.paiementEnCours.set(false);
        this.erreurPaiement.set(this.t.paiement.erreurs.refuse);
        return;
      }
    }

    this.paiementEnCours.set(false);
    this.etape.set('attenteWebhook');
  }

  // ---------------------------------------------------------------------------
  // Outils
  // ---------------------------------------------------------------------------

  private construireDemande(doublonConfirme: boolean): DemandeInscription {
    const valeurs = this.formulaire.getRawValue();
    const alEtranger = this.resideALEtranger();

    return {
      nom: valeurs.nom.trim(),
      prenom: valeurs.prenom.trim(),
      email: valeurs.email.trim(),
      telephone: vider(valeurs.telephone),
      statutResidence: valeurs.statutResidence as StatutResidence,
      categorieCode: valeurs.categorieCode,
      sousCategorieId: valeurs.sousCategorieId ? Number(valeurs.sousCategorieId) : null,
      precisionAutreSituation: this.precisionLibreRequise()
        ? vider(valeurs.precisionAutreSituation)
        : null,
      departementPrefecture: valeurs.departementPrefecture,

      // Les trois champs de l'etranger ne partent que s'ils s'appliquent : la
      // minimisation se joue aussi a l'envoi (CLAUDE.md §6).
      paysResidenceActuelle: alEtranger ? vider(valeurs.paysResidenceActuelle) : null,
      dateArriveePrevisionnelle: alEtranger ? vider(valeurs.dateArriveePrevisionnelle) : null,
      communeOuCodePostalProjete: alEtranger ? vider(valeurs.communeOuCodePostalProjete) : null,

      doublonEmailConfirme: doublonConfirme,
    };
  }

  /**
   * ASP.NET Core renvoie ses cles de validation en casse d'origine. Le
   * formulaire, lui, nomme ses controles en minuscule initiale.
   */
  private normaliser(
    erreurs: Record<string, readonly string[]>,
  ): Record<string, readonly string[]> {
    const normalisees: Record<string, readonly string[]> = {};
    for (const [cle, messages] of Object.entries(erreurs)) {
      normalisees[cle.charAt(0).toLowerCase() + cle.slice(1)] = messages;
    }
    return normalisees;
  }
}

/** Chaine vide ou blanche devient nulle : « absent » n'a qu'une seule forme. */
function vider(valeur: string): string | null {
  const nettoye = valeur.trim();
  return nettoye.length > 0 ? nettoye : null;
}
