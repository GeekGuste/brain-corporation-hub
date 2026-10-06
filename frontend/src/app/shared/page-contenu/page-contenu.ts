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
  imports: [Motif, Visuel],
  templateUrl: './page-contenu.html',
  styleUrl: './page-contenu.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageContenu {
  readonly contenu = input.required<ContenuDePage>();
}
