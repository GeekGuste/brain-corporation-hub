import { Injectable, inject, signal } from '@angular/core';

import { ServiceSuivi } from './service-suivi';

/**
 * Etat de la session d'administration, partage entre la coque du back-office
 * et ses ecrans.
 *
 * Il existe parce que la coque affiche le formulaire de connexion et que les
 * ecrans, eux, decouvrent qu'une session a expire en recevant un 401. Sans ce
 * point commun, chacun gererait sa propre idee de « connecte », et ils
 * finiraient par diverger.
 */
@Injectable({ providedIn: 'root' })
export class EtatAdministration {
  private readonly service = inject(ServiceSuivi);

  readonly connecte = signal(false);
  readonly verifiee = signal(false);

  verifier(): void {
    this.service.session().subscribe((ouverte) => {
      this.connecte.set(ouverte);
      this.verifiee.set(true);
    });
  }

  /** Appele par un ecran qui recoit un 401 : la session a expire. */
  signalerExpiration(): void {
    this.connecte.set(false);
  }
}
