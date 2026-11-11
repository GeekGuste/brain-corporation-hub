import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import libelles from '../../../../content/fr/suivi.json';
import { EtatAdministration } from '../../../core/suivi/etat-administration';
import {
  ServiceSuivi,
  type DestinataireNotification,
} from '../../../core/suivi/service-suivi';

/**
 * Adresses prevenues d'un paiement confirme.
 *
 * Ajout hors contrat initial, demande explicitement et accepte en V1.
 *
 * Ce sont des adresses INTERNES, celles des gestionnaires et des commerciaux.
 * Ce ne sont pas des donnees de stagiaires, et elles ne relevent donc pas de la
 * minimisation du §6, qui porte sur les personnes inscrites.
 *
 * Deux actions seulement, ajouter et retirer. Pas de modification : corriger
 * une adresse revient a retirer puis ajouter, et une liste de six lignes ne
 * justifie pas un formulaire d'edition.
 */
@Component({
  selector: 'app-suivi-notifications',
  imports: [ReactiveFormsModule],
  templateUrl: './suivi-notifications.html',
  styleUrl: './suivi-notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuiviNotifications {
  private readonly service = inject(ServiceSuivi);
  private readonly etat = inject(EtatAdministration);
  private readonly fb = inject(FormBuilder);

  protected readonly t = libelles;

  protected readonly destinataires = signal<readonly DestinataireNotification[]>([]);
  protected readonly chargement = signal(false);
  protected readonly ajoutEnCours = signal(false);
  protected readonly message = signal<string | null>(null);

  /** Adresse dont le retrait attend confirmation. */
  protected readonly retraitAConfirmer = signal<DestinataireNotification | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    libelle: ['', [Validators.maxLength(100)]],
  });

  constructor() {
    this.charger();
  }

  protected charger(): void {
    this.chargement.set(true);

    this.service.destinataires().subscribe((liste) => {
      this.chargement.set(false);

      if (liste === null) {
        this.etat.signalerExpiration();
        return;
      }

      this.destinataires.set(liste);
    });
  }

  protected ajouter(): void {
    if (this.formulaire.invalid) {
      this.formulaire.markAllAsTouched();
      return;
    }

    this.message.set(null);
    this.ajoutEnCours.set(true);

    const { email, libelle } = this.formulaire.getRawValue();

    this.service.ajouteDestinataire(email.trim(), libelle.trim() || null).subscribe((resultat) => {
      this.ajoutEnCours.set(false);

      if (resultat === 'invalide') {
        this.message.set(this.t.notifications.erreurs.invalide);
        return;
      }

      if (resultat === 'deja-present') {
        this.message.set(this.t.notifications.erreurs.dejaPresent);
        return;
      }

      if (resultat === 'echec') {
        this.message.set(this.t.notifications.erreurs.action);
        return;
      }

      this.formulaire.reset();
      // Insere au bon endroit plutot que de tout recharger : la liste est
      // triee par adresse cote serveur, on respecte le meme ordre.
      this.destinataires.update((liste) =>
        [...liste, resultat].sort((a, b) => a.email.localeCompare(b.email)),
      );
    });
  }

  protected demanderRetrait(destinataire: DestinataireNotification): void {
    this.retraitAConfirmer.set(destinataire);
  }

  protected annulerRetrait(): void {
    this.retraitAConfirmer.set(null);
  }

  protected confirmerRetrait(): void {
    const cible = this.retraitAConfirmer();
    if (!cible) return;

    this.message.set(null);

    this.service.retireDestinataire(cible.id).subscribe((reussi) => {
      this.retraitAConfirmer.set(null);

      if (!reussi) {
        this.message.set(this.t.notifications.erreurs.action);
        return;
      }

      this.destinataires.update((liste) => liste.filter((ligne) => ligne.id !== cible.id));
    });
  }

  protected dateCourte(valeur: string): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(valeur));
  }
}
