import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ContenuDePage } from '../../core/content/modele-contenu';
import { Motif } from '../motif/motif';
import { Visuel } from '../visuel/visuel';

/**
 * Rend une page editoriale a partir d'un fichier de content/fr/.
 *
 * Un seul composant pour les trois pages publiques : la structure est la meme,
 * seuls les textes et le motif changent. Remplacer un texte du client se fait
 * en editant le JSON, sans toucher a ce composant ni a son gabarit
 * (CLAUDE.md §12).
 */
@Component({
  selector: 'app-page-contenu',
  imports: [Motif, Visuel, NgTemplateOutlet],
  templateUrl: './page-contenu.html',
  styleUrl: './page-contenu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageContenu {
  readonly contenu = input.required<ContenuDePage>();

  /**
   * Resserre le bandeau de tete.
   *
   * Utilise par l'accueil, dont le bandeau n'a ni faits pratiques ni bouton :
   * a hauteur pleine, il occupait le premier ecran sans rien y mettre. La page
   * de vente, elle, garde le bandeau large, parce que c'est la que le prix et
   * l'appel a l'action sont annonces.
   */
  readonly bandeauCompact = input<boolean>(false);
}
