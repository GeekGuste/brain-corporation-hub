import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import navigation from '../../../content/fr/navigation.json';
import { cheminDePage } from '../../core/config/site-routes';
import type { ContenuPageLegale } from '../../core/content/modele-contenu';
import { TexteAvecLiens } from '../texte-avec-liens/texte-avec-liens';

/**
 * Rend une page legale a partir d'un fichier de content/fr/.
 *
 * Un seul composant pour les trois : politique de confidentialite, mentions
 * legales, conditions generales de vente. La structure est la meme, seuls les
 * textes changent, et ces textes appartiennent au client (CLAUDE.md §3).
 *
 * Deliberement sobre : pas de bandeau sur l'encre profonde, pas de visuel, pas
 * d'appel a l'action. Une page legale se lit, elle ne vend rien. Ce qui compte
 * est la lisibilite : une mesure de lecture courte, des titres numerotes comme
 * dans le document du client, et un sommaire, parce que dix sections sur un
 * telephone font une page tres longue (CLAUDE.md §13).
 */
@Component({
  selector: 'app-page-legale',
  imports: [RouterLink, TexteAvecLiens],
  templateUrl: './page-legale.html',
  styleUrl: './page-legale.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLegale {
  readonly contenu = input.required<ContenuPageLegale>();

  /**
   * Libelles du gabarit, lus dans navigation.json : ils appartiennent a
   * l'interface, pas aux textes du client, et ils seraient recopies trois fois
   * dans les fichiers de contenu.
   */
  protected readonly t = navigation.pagesLegales;

  /**
   * La phrase « Politique de confidentialite » devient un lien vers la page
   * correspondante partout ou elle apparait dans un texte. Les mentions RGPD
   * du client et les conditions de vente y renvoient toutes les deux, et le
   * chemin n'est jamais ecrit en dur (CLAUDE.md §12).
   */
  protected readonly lienPolitique = {
    phrase: 'Politique de confidentialité',
    chemin: cheminDePage('politique-confidentialite'),
  };

  /** Les sections, chacune dotee d'une ancre deduite de son titre. */
  protected readonly sections = computed(() =>
    this.contenu().sections.map((section) => ({
      ...section,
      ancre: ancreDe(section.titre),
    })),
  );
}

/**
 * Ancre d'une section, deduite de son titre.
 *
 * Deduite et non ecrite dans le fichier de contenu : le client remplace un
 * titre sans avoir a penser a une ancre. Les accents sont decomposes puis
 * retires, pour que « Securite et confidentialite » donne la meme ancre que
 * « Sécurité et confidentialité » : une URL partagee ne doit pas dependre d'un
 * accent.
 */
function ancreDe(titre: string): string {
  return titre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
