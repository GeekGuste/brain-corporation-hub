import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Motif, type NomDeMotif } from '../motif/motif';

/**
 * Emplacement de visuel.
 *
 * Tant que le client n'a pas fourni ses photographies (CLAUDE.md §17), c'est
 * l'illustration vectorielle du site qui occupe la place. L'espace est reserve
 * dans les deux cas, au meme rapport : la mise en page ne bougera pas le jour
 * de la livraison.
 *
 * Pour poser une photographie : deposer le fichier dans frontend/public/, puis
 * renseigner « fichier » et « texteAlternatif » dans le fichier de contenu de
 * la page. Rien a modifier dans le code (CLAUDE.md §14).
 *
 * Aucune photographie n'est inventee ni empruntee a une banque d'images : sur
 * un sujet comme le droit au sejour, un visage d'inconnu presente comme un
 * formateur ou un stagiaire serait un faux.
 */
@Component({
  selector: 'app-visuel',
  imports: [Motif],
  templateUrl: './visuel.html',
  styleUrl: './visuel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Visuel {
  /** Chemin sous public/, ou null tant que le client n'a rien fourni. */
  readonly fichier = input<string | null>(null);

  /** Texte alternatif de la photographie. Parametrable (CLAUDE.md §14). */
  readonly texteAlternatif = input<string>('');

  /** Illustration affichee en attendant la photographie. */
  readonly motif = input.required<NomDeMotif>();

  /** Rapport largeur sur hauteur, pour reserver la place. */
  readonly rapport = input<string>('16 / 10');

  /** Dimensions intrinseques du fichier, si connues. Evitent le sursaut. */
  readonly largeur = input<number | null>(null);
  readonly hauteur = input<number | null>(null);

  /** Vrai pour le visuel de tete : il se charge immediatement, pas en differe. */
  readonly premierEcran = input<boolean>(false);
}
