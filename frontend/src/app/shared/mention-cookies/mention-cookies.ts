import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';

import navigation from '../../../content/fr/navigation.json';
import { cheminDePage } from '../../core/config/site-routes';
import { TexteAvecLiens } from '../texte-avec-liens/texte-avec-liens';

/**
 * Mention d'INFORMATION sur les cookies. Ce n'est pas un bandeau de
 * consentement, et c'est voulu.
 *
 * Le site ne depose que des cookies strictement necessaires : la session de la
 * page de suivi, et ceux de notre prestataire de paiement, qui servent a
 * detecter la fraude et ne se chargent que lorsque le cadre de paiement
 * s'affiche. Aucune mesure d'audience, aucune publicite, aucun suivi d'un site
 * a l'autre.
 *
 * Ces cookies-la sont dispenses de consentement. Demander un accord dont on
 * n'a pas besoin serait trompeur, et un bouton « Refuser » qui ne refuse rien
 * l'est davantage. La mention informe, elle ne demande rien : un seul bouton,
 * qui ne fait que la ranger.
 *
 * ELLE NE S'AFFICHE QUE DANS LE NAVIGATEUR, jamais au rendu serveur. Le
 * contraire ferait apparaitre la mention une fraction de seconde chez un
 * visiteur qui l'a deja rangee, le temps que le navigateur relise son choix.
 * Sans JavaScript, la mention ne s'affiche pas, et c'est sans consequence :
 * aucun cookie ne demande d'accord, et la meme information figure dans la
 * politique de confidentialite, liee depuis le pied de chaque page.
 */
@Component({
  selector: 'app-mention-cookies',
  imports: [TexteAvecLiens],
  templateUrl: './mention-cookies.html',
  styleUrl: './mention-cookies.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MentionCookies {
  /** Cle de rangement. Changer sa valeur fait reapparaitre la mention a tous. */
  private static readonly CLE = 'bch-mention-cookies-lue';

  protected readonly t = navigation.mentionCookies;

  protected readonly lienPolitique = {
    phrase: 'Politique de confidentialité',
    chemin: cheminDePage('politique-confidentialite'),
  };

  protected readonly affichee = signal(false);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) {
      return;
    }

    // Toute lecture de localStorage peut lever : navigation privee, stockage
    // bloque par le navigateur ou par une politique d'entreprise. Dans ce cas
    // la mention s'affiche, ce qui est le comportement le moins surprenant.
    let dejaLue = false;
    try {
      dejaLue = localStorage.getItem(MentionCookies.CLE) === 'oui';
    } catch {
      dejaLue = false;
    }
    this.affichee.set(!dejaLue);
  }

  protected ranger(): void {
    this.affichee.set(false);
    try {
      localStorage.setItem(MentionCookies.CLE, 'oui');
    } catch {
      // Le stockage est indisponible : la mention reviendra au prochain
      // chargement. C'est un desagrement, pas une panne.
    }
  }
}
