import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import libelles from '../../../../content/fr/suivi.json';
import { EtatAdministration } from '../../../core/suivi/etat-administration';
import { ServiceSuivi, type InscriptionSuivie } from '../../../core/suivi/service-suivi';

/**
 * Suivi des inscriptions (CLAUDE.md §5.7).
 *
 * DEUX actions d'ecriture, et deux seulement : marquer qu'un stagiaire a suivi
 * ou non la formation, et supprimer une inscription une fois la formation
 * marquee comme suivie. Toute autre modification, corriger un email ou editer
 * une donnee, est hors perimetre V1 : il n'y a donc aucun formulaire
 * d'edition ici, et c'est volontaire.
 *
 * La page affiche le BARREAU REQUIS, calcule depuis la prefecture. Elle ne
 * propose, ne nomme et n'affecte jamais un avocat : ce choix est humain et
 * manuel (CLAUDE.md §6). Le gestionnaire constitue les cohortes a la main.
 *
 * Aucune donnee de carte n'est affichee, parce qu'il n'y en a nulle part (§15).
 */
@Component({
  selector: 'app-suivi-inscriptions',
  imports: [],
  templateUrl: './suivi-inscriptions.html',
  styleUrl: './suivi-inscriptions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuiviInscriptions {
  private readonly service = inject(ServiceSuivi);
  private readonly etat = inject(EtatAdministration);

  protected readonly t = libelles;

  protected readonly inscriptions = signal<readonly InscriptionSuivie[]>([]);
  protected readonly chargement = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly exportEnCours = signal(false);

  /** Inscription dont la suppression attend confirmation. */
  protected readonly suppressionAConfirmer = signal<InscriptionSuivie | null>(null);

  protected readonly total = computed(() => this.inscriptions().length);

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);
    this.message.set(null);

    this.service.inscriptions().subscribe((liste) => {
      this.chargement.set(false);

      if (liste === null) {
        // La session a expire pendant la consultation : la coque reprend la
        // main et redemande les identifiants.
        this.etat.signalerExpiration();
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

      this.inscriptions.update((liste) => liste.filter((ligne) => ligne.id !== inscription.id));
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
