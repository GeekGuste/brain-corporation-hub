import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Les motifs disponibles. */
export type NomDeMotif =
  | 'seuil'
  | 'anticipation'
  | 'exigence'
  | 'territoire'
  | 'methode'
  | 'creuset'
  | 'cycle'
  | 'ambition'
  | 'echeances'
  | 'suivi'
  | 'cout'
  | 'picto-vigilance'
  | 'picto-intervenants'
  | 'picto-pedagogie';

/**
 * Illustrations du site, dessinees en SVG et ecrites dans le gabarit.
 *
 * Pourquoi du SVG dans le code plutot que des fichiers images :
 *   - aucune requete reseau, aucun octet a telecharger, ce qui compte pour un
 *     public parfois en connexion lente (CLAUDE.md §13) ;
 *   - net a toutes les tailles et sur tous les ecrans ;
 *   - les couleurs viennent du theme par « currentColor » et par les variables
 *     CSS, donc le meme dessin fonctionne sur fond clair comme sur l'encre
 *     profonde du bandeau, et le remplacement de la charte n'oblige a rien
 *     redessiner (CLAUDE.md §14).
 *
 * Le motif commun est celui du SEUIL, parce que le nom de la marque est une
 * idee visuelle : une ligne rouge est une limite. Les declinaisons donnent une
 * identite commune aux trois pages.
 *
 * Rien n'y est affirme : aucun chiffre, aucun axe, aucune legende, aucune carte
 * reelle. Ce sont des motifs, pas des graphiques (CLAUDE.md §3).
 */
@Component({
  selector: 'app-motif',
  templateUrl: './motif.html',
  styleUrl: './motif.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'd-block' },
})
export class Motif {
  readonly nom = input.required<NomDeMotif>();

  /**
   * Cases retenues du motif territorial : un bloc contigu, qui figure un
   * ressort de cour d'appel. Les coordonnees sont ici et non dans le gabarit
   * pour que le dessin reste lisible.
   */
  private static readonly CASES_RETENUES = new Set([
    '1:2', '1:3', '1:4',
    '2:2', '2:3', '2:4',
  ]);

  protected estRetenue(ligne: number, colonne: number): boolean {
    return Motif.CASES_RETENUES.has(`${ligne}:${colonne}`);
  }

  /**
   * Barres du motif du creuset. La hauteur de chacune est une mesure, le seuil
   * rouge est le niveau exige, et seules les barres qui le franchissent sont
   * dessinees en plein. Les valeurs sont posees ici, et non calculees : un
   * dessin doit etre relu a l'oeil, pas deduit d'une formule.
   */
  protected readonly barresCreuset = [
    { x: 36, sommet: 200 },
    { x: 78, sommet: 110 },
    { x: 120, sommet: 262 },
    { x: 162, sommet: 88 },
    { x: 204, sommet: 228 },
    { x: 246, sommet: 152 },
    { x: 288, sommet: 68 },
    { x: 330, sommet: 240 },
    { x: 372, sommet: 178 },
    { x: 414, sommet: 118 },
  ].map((barre) => ({
    ...barre,
    hauteur: 320 - barre.sommet,
    // Le seuil est a 140 : au-dessus, la mesure est retenue.
    retenue: barre.sommet < 140,
  }));

  /** Rangs et colonnes du motif de suivi. */
  protected readonly rangsSuivi = [0, 1, 2, 3, 4];
  protected readonly colonnesSuivi = [0, 1, 2, 3, 4, 5, 6, 7];

  /**
   * Opacite d'un repere du motif de suivi. Trois intensites qui se repartissent
   * de maniere irreguliere : des points de vigilance suivis dans le temps, pas
   * une grille reguliere, et surtout pas la capture d'un ecran de logiciel. Le
   * tableau de bord est un support remis en formation, jamais une
   * fonctionnalite du site (CLAUDE.md §4).
   */
  protected opaciteSuivi(rang: number, colonne: number): number {
    return [0.3, 0.12, 0.08][(rang * 3 + colonne * 2) % 3];
  }

  /** Blocs empiles du motif du cout. Aucun chiffre, seulement deux volumes. */
  protected readonly blocsCoutFaible = [272, 244, 216];
  protected readonly blocsCoutEleve = [272, 244, 216, 188, 160, 132, 104, 76, 48];

  /** Hachures de la periode d'incertitude du motif des echeances. */
  protected readonly hachuresEcheances = [0, 1, 2, 3, 4, 5, 6, 7];
}
