import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { decouperLiens, type LienInterne } from './decoupe-liens';

/**
 * Affiche un texte dont les adresses de courriel, les adresses web et une
 * phrase designee deviennent des liens.
 *
 * Le contenu reste du TEXTE dans les fichiers de content/fr/ : aucune balise a
 * ecrire, rien a assainir, et le client remplace sa phrase sans rien savoir du
 * HTML (CLAUDE.md §3). Voir decoupe-liens.ts pour ce qui est reconnu.
 */
@Component({
  selector: 'app-texte-avec-liens',
  imports: [RouterLink],
  templateUrl: './texte-avec-liens.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TexteAvecLiens {
  readonly texte = input.required<string>();

  /**
   * Phrase a transformer en lien vers une page du site, par exemple
   * « Politique de confidentialite ». Facultative : la plupart des textes n'en
   * contiennent pas.
   */
  readonly lienInterne = input<LienInterne | undefined>(undefined);

  protected readonly morceaux = computed(() =>
    decouperLiens(this.texte(), this.lienInterne()),
  );
}
