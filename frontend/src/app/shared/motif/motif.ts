import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Les motifs disponibles. Un par page, plus les pictogrammes des piliers. */
export type NomDeMotif =
  | 'seuil'
  | 'anticipation'
  | 'exigence'
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
 *     CSS, donc le remplacement de la charte n'oblige a rien redessiner
 *     (CLAUDE.md §14).
 *
 * Le motif est un systeme de FILETS, parce que le nom de la marque est une
 * idee visuelle : une ligne rouge est un seuil. Les trois declinaisons donnent
 * une identite commune aux trois pages.
 *
 * Rien n'y est affirme : aucun chiffre, aucun axe, aucune legende. Ce sont des
 * motifs, pas des graphiques (CLAUDE.md §3).
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
   * Les motifs decoratifs sont masques aux lecteurs d'ecran. Les pictogrammes
   * accompagnent toujours un titre visible : les annoncer n'apporterait rien.
   */
  readonly titreAccessible = input<string | null>(null);
}
