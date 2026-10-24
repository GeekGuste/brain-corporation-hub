import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import libelles from '../../../content/fr/suivi.json';
import { cheminDePage } from '../../core/config/site-routes';
import { Seo } from '../../core/seo/seo';
import { EtatAdministration } from '../../core/suivi/etat-administration';
import { ServiceSuivi } from '../../core/suivi/service-suivi';

/**
 * Coque du back-office.
 *
 * Elle porte la connexion et le menu, et laisse ses ecrans dans la sortie de
 * routeur. Tant que la session n'est pas ouverte, aucun ecran n'est rendu :
 * la porte est unique, ici.
 *
 * PERIMETRE. Les deux ecrans actuels sont ceux du contrat : le suivi des
 * inscriptions (CLAUDE.md §5.7) et le referentiel territorial en lecture seule
 * (§5.8). Le back-office de gestion decrit au §8, moteur de cohortes,
 * planification des creneaux, tableaux editables, administration du
 * referentiel, reste HORS PERIMETRE et ne doit pas etre ajoute ici sans
 * instruction explicite.
 */
@Component({
  selector: 'app-suivi',
  imports: [ReactiveFormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './suivi.html',
  styleUrl: './suivi.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Suivi {
  private readonly service = inject(ServiceSuivi);
  private readonly fb = inject(FormBuilder);
  private readonly navigateur = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly etat = inject(EtatAdministration);
  protected readonly t = libelles;

  protected readonly connexionEnCours = signal(false);
  protected readonly connexionEchouee = signal(false);

  /** Chemin de base du back-office, jamais ecrit en dur (CLAUDE.md §12). */
  protected readonly base = cheminDePage('suivi');

  protected readonly formulaire = this.fb.nonNullable.group({
    identifiant: ['', [Validators.required]],
    motDePasse: ['', [Validators.required]],
  });

  constructor() {
    inject(Seo).appliquer('suivi');

    // Rien a faire cote serveur : la page est vide sans session, et son rendu
    // n'a aucun interet pour le referencement puisqu'elle est en noindex.
    if (this.navigateur) {
      this.etat.verifier();
    }
  }

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
        this.etat.connecte.set(true);
      }
    });
  }

  protected seDeconnecter(): void {
    this.service.deconnexion().subscribe(() => this.etat.connecte.set(false));
  }
}
