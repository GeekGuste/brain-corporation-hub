import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import libelles from '../../../content/fr/inscription.json';
import type {
  CategorieTitre,
  DemandeInscription,
  Prefecture,
  ReponseInscription,
  StatutResidence,
} from '../../core/inscription/modele-inscription';
import { ServiceInscription } from '../../core/inscription/service-inscription';

/**
 * Formulaire d'inscription qualifie (CLAUDE.md §6).
 *
 * Partis pris :
 *
 *   UNE seule page, avec des sections qui apparaissent au fur et a mesure,
 *   plutot qu'un assistant a etapes. Le public est souvent peu a l'aise avec
 *   les outils numeriques (CLAUDE.md §13) : un assistant cache ce qui reste a
 *   faire et perd celui qui revient en arriere. Ici, tout ce qui s'applique est
 *   visible, et seul ce qui ne s'applique pas est masque.
 *
 *   Aucune creation de compte, conformement au §13.
 *
 *   La validation du navigateur est un confort. La seule qui compte est celle
 *   du serveur, et ses messages par champ sont reinjectes dans le formulaire
 *   (CLAUDE.md §15).
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

  /** Libelles, lus dans content/fr/inscription.json (CLAUDE.md §13). */
  protected readonly t = libelles;

  protected readonly categories = signal<readonly CategorieTitre[]>([]);
  protected readonly prefectures = signal<readonly Prefecture[]>([]);
  protected readonly referentielsEnEchec = signal(false);

  protected readonly envoiEnCours = signal(false);
  protected readonly doublonAConfirmer = signal(false);
  protected readonly inscriptionCreee = signal<ReponseInscription | null>(null);

  /** Messages du serveur, par nom de champ. */
  protected readonly erreursServeur = signal<Record<string, readonly string[]>>({});

  /** Message global, quand l'echec n'est imputable a aucun champ. */
  protected readonly erreurGlobale = signal<string | null>(null);

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
  // Les valeurs du formulaire sont relues dans des signaux, mis a jour par les
  // evenements du gabarit : c'est ce qui permet a un composant OnPush et
  // zoneless de reagir sans souscription manuelle.

  private readonly residenceChoisie = signal<StatutResidence | ''>('');
  private readonly categorieChoisie = signal('');
  private readonly departementChoisi = signal('');

  protected readonly resideALEtranger = computed(
    () => this.residenceChoisie() === 'ResidentALEtranger',
  );

  /** Vrai une fois la residence choisie : c'est elle qui ouvre la suite. */
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

  /** Rattachement affiche des le choix de la prefecture. */
  protected readonly prefectureCourante = computed(() =>
    this.prefectures().find(
      (prefecture) => prefecture.departement === this.departementChoisi(),
    ),
  );

  constructor() {
    this.service.categories().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.referentielsEnEchec.set(true),
    });

    this.service.prefectures().subscribe({
      next: (prefectures) => this.prefectures.set(prefectures),
      error: () => this.referentielsEnEchec.set(true),
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

  /** Message a afficher sous un champ, serveur d'abord, navigateur ensuite. */
  protected messageErreur(champ: string): string | null {
    const duServeur = this.erreursServeur()[champ]?.[0];
    if (duServeur) {
      return duServeur;
    }

    const controle = this.formulaire.get(champ);
    if (!controle || !controle.touched || controle.valid) {
      return null;
    }

    if (controle.hasError('required')) {
      return this.t.erreurs.requis;
    }
    if (controle.hasError('email')) {
      return this.t.erreurs.emailInvalide;
    }
    return this.t.erreurs.requis;
  }

  protected enErreur(champ: string): boolean {
    return this.messageErreur(champ) !== null;
  }

  // ---------------------------------------------------------------------------
  // Envoi
  // ---------------------------------------------------------------------------

  protected envoyer(doublonConfirme = false): void {
    this.erreurGlobale.set(null);
    this.erreursServeur.set({});

    // La precision libre n'est obligatoire que pour la famille AUT : la regle
    // est posee ici, au moment de l'envoi, et revalidee par le serveur.
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
          this.inscriptionCreee.set(resultat.inscription);
          break;

        case 'doublon':
          // Pas une erreur : une question. Le visiteur confirme ou corrige
          // l'adresse (CLAUDE.md §6).
          this.doublonAConfirmer.set(true);
          break;

        case 'invalide':
          this.erreursServeur.set(this.normaliser(resultat.erreurs));
          this.formulaire.markAllAsTouched();
          break;

        case 'echec':
          this.erreurGlobale.set(this.t.erreurs[resultat.cle]);
          break;
      }
    });
  }

  protected annulerDoublon(): void {
    this.doublonAConfirmer.set(false);
    this.formulaire.controls.email.setValue('');
    this.formulaire.controls.email.markAsUntouched();
  }

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
