import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { cheminDePage } from '../../core/config/site-routes';
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
  imports: [Motif, Visuel, NgTemplateOutlet, RouterLink],
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

  /**
   * Le fragment de l'appel a l'action, sans son diese.
   *
   * Le fichier de contenu ecrit « #inscription », parce que c'est la forme
   * qu'on reconnait. Le routeur, lui, veut « inscription » : il ajoute le
   * diese lui-meme. On ne peut pas utiliser href="#inscription" : la page
   * declare <base href="/">, et une URL reduite a un fragment se resout contre
   * l'URL DE BASE, ce qui menait a l'accueil.
   */
  /** Chemin vers le produit phare, jamais ecrit en dur (CLAUDE.md §12). */
  protected readonly versLignesRouges = cheminDePage('lignes-rouges');

  protected readonly ancre = computed(() =>
    this.contenu().appelAction?.ancre.replace(/^#/, '') ?? '',
  );
}
