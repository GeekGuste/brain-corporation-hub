import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Motif, type NomDeMotif } from '../motif/motif';

/**
 * Emplacement de visuel.
 *
 * Tant que le client n'a pas fourni ses images, c'est l'illustration
 * vectorielle du site qui occupe la place, surmontee d'une etiquette
 * « visuel provisoire » : personne ne peut la confondre avec un visuel
 * definitif, ni l'oublier avant la mise en ligne.
 *
 * L'espace est reserve dans les deux cas, au meme rapport : la mise en page ne
 * bougera pas le jour du remplacement.
 *
 * Pour poser une image definitive : deposer le fichier dans frontend/public/,
 * puis renseigner « fichier », « largeur », « hauteur » et « texteAlternatif »
 * dans le fichier de contenu de la page. L'etiquette disparait d'elle-meme.
 * Rien a modifier dans le code (CLAUDE.md §14).
 *
 * Ces illustrations sont dessinees pour le projet. Aucune photographie de
 * personne n'est fabriquee : sur un sujet comme le droit au sejour, un visage
 * presente comme un formateur ou un stagiaire serait un faux.
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

  /** Texte alternatif de l'image. Parametrable (CLAUDE.md §14). */
  readonly texteAlternatif = input<string>('');

  /** Illustration affichee en attendant l'image definitive. */
  readonly motif = input.required<NomDeMotif>();

  /** Rapport largeur sur hauteur, pour reserver la place. */
  readonly rapport = input<string>('4 / 3');

  /** Dimensions intrinseques du fichier, si connues. Evitent le sursaut. */
  readonly largeur = input<number | null>(null);
  readonly hauteur = input<number | null>(null);

  /** Vrai pour le visuel de tete : il se charge immediatement, pas en differe. */
  readonly premierEcran = input<boolean>(false);

  /**
   * Fond sur lequel le visuel est pose.
   *
   * Le corps de page alterne des bandes blanches et des bandes de papier froid.
   * Un visuel « papier » sur une bande de papier disparaitrait, d'ou ce
   * reglage : le cadre prend la valeur opposee a celle de sa bande.
   *
   *   papier : sur une bande blanche (le cas courant) ;
   *   blanc  : sur une bande de papier ;
   *   encre  : sur l'encre profonde du bandeau de tete, ou le dessin s'inverse.
   */
  readonly fond = input<'papier' | 'blanc' | 'encre'>('papier');

  /** Etiquette de l'emplacement provisoire. */
  readonly etiquetteProvisoire = input<string>('Visuel provisoire, à remplacer');
}
