import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import libelles from '../../../content/fr/suivi.json';
import { Seo } from '../../core/seo/seo';
import { ServiceSuivi, type InscriptionSuivie } from '../../core/suivi/service-suivi';

/**
 * Page de suivi des inscriptions (CLAUDE.md §5.7).
 *
 * DEUX actions d'ecriture, et deux seulement :
 *   - marquer qu'un stagiaire a suivi ou non la formation ;
 *   - supprimer une inscription, bouton visible UNIQUEMENT une fois la
 *     formation marquee comme suivie.
 *
 * Toute autre modification, corriger un email ou editer une donnee, est hors
 * perimetre V1. Il n'y a donc aucun formulaire d'edition ici, et c'est
 * volontaire.
 *
 * La page affiche le BARREAU REQUIS, calcule depuis la prefecture. Elle ne
 * propose, ne nomme et n'affecte jamais un avocat : ce choix est humain et
 * manuel (CLAUDE.md §6). Le gestionnaire constitue les cohortes a la main, a
 * partir de cette liste.
 *
 * Aucune donnee de carte n'est affichee, parce qu'il n'y en a nulle part
 * (CLAUDE.md §15).
 */
@Component({
  selector: 'app-suivi',
  imports: [ReactiveFormsModule],
  templateUrl: './suivi.html',
  styleUrl: './suivi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Suivi {
  private readonly service = inject(ServiceSuivi);
  private readonly fb = inject(FormBuilder);
  private readonly navigateur = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly t = libelles;

  protected readonly connecte = signal(false);
  protected readonly sessionVerifiee = signal(false);
  protected readonly connexionEnCours = signal(false);
  protected readonly connexionEchouee = signal(false);

  protected readonly inscriptions = signal<readonly InscriptionSuivie[]>([]);
  protected readonly chargement = signal(false);
  protected readonly message = signal<string | null>(null);

  protected readonly exportEnCours = signal(false);

  /** Inscription dont la suppression attend confirmation. */
  protected readonly suppressionAConfirmer = signal<InscriptionSuivie | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    identifiant: ['', [Validators.required]],
    motDePasse: ['', [Validators.required]],
  });

  protected readonly total = computed(() => this.inscriptions().length);

  constructor() {
    inject(Seo).appliquer('suivi');

    // Rien a faire cote serveur : la page est vide sans session, et son rendu
    // n'a aucun interet pour le referencement puisqu'elle est en noindex.
    if (this.navigateur) {
      this.service.session().subscribe((ouverte) => {
        this.sessionVerifiee.set(true);
        this.connecte.set(ouverte);
        if (ouverte) {
          this.charger();
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------

  protected seConnecter(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }

    this.connexionEnCours.set(true);
    this.connexionEchouee.set(false);

    const { identifiant, motDePasse } = this.formulaire.getRawValue();

    this.service.connexion(identifiant, motDePasse).subscribe((reussie) => {
      this.connexionEnCours.set(false);
      this.connexionEchouee.set(!reussie);

      if (reussie) {
        // Le mot de passe ne reste pas en memoire une seconde de plus que
        // necessaire.
        this.formulaire.reset();
        this.connecte.set(true);
        this.charger();
      }
    });
  }

  protected seDeconnecter(): void {
    this.service.deconnexion().subscribe(() => {
      this.connecte.set(false);
      this.inscriptions.set([]);
      this.suppressionAConfirmer.set(null);
    });
  }

  // ---------------------------------------------------------------------------
  // Consultation
  // ---------------------------------------------------------------------------

  protected charger(): void {
    this.chargement.set(true);
    this.message.set(null);

    this.service.inscriptions().subscribe((liste) => {
      this.chargement.set(false);

      if (liste === null) {
        // La session a expire pendant la consultation.
        this.connecte.set(false);
        this.message.set(this.t.erreurs.session);
        return;
      }

      this.inscriptions.set(liste);
    });
  }

  protected exporter(): void {
    this.exportEnCours.set(true);

    this.service.exporte().subscribe((fichier) => {
      this.exportEnCours.set(false);

      if (!fichier) {
        this.message.set(this.t.erreurs.export);
        return;
      }

      // Le nom de fichier est pose par le serveur dans l'en-tete, mais un Blob
      // telecharge ne le reprend pas : on le reconstruit a l'identique.
      const horodatage = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
      const url = URL.createObjectURL(fichier);
      const lien = document.createElement('a');
      lien.href = url;
      lien.download = `inscriptions-${horodatage}.csv`;
      lien.click();
      URL.revokeObjectURL(url);
    });
  }

  // ---------------------------------------------------------------------------
  // Les deux seules actions d'ecriture
  // ---------------------------------------------------------------------------

  protected marquerPresence(inscription: InscriptionSuivie, suivie: boolean | null): void {
    this.message.set(null);

    this.service.posePresence(inscription.id, suivie).subscribe((reussi) => {
      if (!reussi) {
        this.message.set(this.t.erreurs.action);
        return;
      }

      // Mise a jour locale plutot qu'un rechargement complet : la liste peut
      // etre longue, et le gestionnaire marque souvent plusieurs lignes a la
      // suite.
      this.inscriptions.update((liste) =>
        liste.map((ligne) =>
          ligne.id === inscription.id ? { ...ligne, formationSuivie: suivie } : ligne,
        ),
      );
    });
  }

  protected demanderSuppression(inscription: InscriptionSuivie): void {
    this.suppressionAConfirmer.set(inscription);
  }

  protected annulerSuppression(): void {
    this.suppressionAConfirmer.set(null);
  }

  protected confirmerSuppression(): void {
    const inscription = this.suppressionAConfirmer();
    if (!inscription) return;

    this.message.set(null);

    this.service.supprime(inscription.id).subscribe((resultat) => {
      this.suppressionAConfirmer.set(null);

      if (resultat === 'non-suivie') {
        this.message.set(this.t.suppression.indisponible);
        return;
      }

      if (resultat === 'echec') {
        this.message.set(this.t.erreurs.action);
        return;
      }

      this.inscriptions.update((liste) =>
        liste.filter((ligne) => ligne.id !== inscription.id),
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Affichage
  // ---------------------------------------------------------------------------

  protected residence(code: string): string {
    return code === 'ResidentALEtranger'
      ? this.t.residence.ResidentALEtranger
      : this.t.residence.ResidentEnFrance;
  }

  protected dateCourte(valeur: string | null): string {
    if (!valeur) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(valeur));
  }
}
