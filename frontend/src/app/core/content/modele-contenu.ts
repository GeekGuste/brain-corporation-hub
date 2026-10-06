/**
 * Forme des fichiers de contenu de content/fr/.
 *
 * Les textes sont fournis par le client et integres tels quels (CLAUDE.md §3).
 * Ces types decrivent seulement leur STRUCTURE, jamais leur formulation : un
 * texte remplace ne demande aucune modification de code.
 */

import type { NomDeMotif } from '../../shared/motif/motif';

export type BlocContenu =
  | { readonly type: 'paragraphe'; readonly texte: string }
  | { readonly type: 'liste'; readonly elements: readonly string[] }
  | { readonly type: 'exergue'; readonly texte: string };

/**
 * Une carte dans une section. Sert aux trois piliers de l'accueil et aux deux
 * publics de la page Lignes Rouges : un titre de niveau 3, un texte court, et
 * un pictogramme facultatif.
 *
 * Le niveau de titre du document du client est preserve : une carte rend un h3.
 */
export interface CarteContenu {
  readonly titre: string;
  readonly texte: string;
  readonly pictogramme?: NomDeMotif;
}

export interface SectionContenu {
  /**
   * Niveau de titre, 2 ou 3, tel qu'il figure dans le document du client.
   * Un seul h1 par page, pas de saut de niveau (CLAUDE.md §12).
   */
  readonly niveau: 2 | 3;
  readonly titre: string;
  readonly blocs: readonly BlocContenu[];
  /** Sous-parties rendues en colonnes plutot qu'a la suite. */
  readonly cartes?: readonly CarteContenu[];
}

/**
 * Emplacement de visuel declare dans un fichier de contenu.
 *
 * Tant que « fichier » vaut null, l'illustration du site occupe la place.
 */
export interface VisuelDePage {
  readonly fichier: string | null;
  readonly texteAlternatif: string;
  readonly largeur: number | null;
  readonly hauteur: number | null;
  /** Illustration de repli, et identite visuelle de la page. */
  readonly motif: NomDeMotif;
}

/** Un chiffre cle affiche en tete de la page de vente. */
export interface FaitCle {
  readonly libelle: string;
  readonly valeur: string;
}

export interface ContenuDePage {
  /** Accroche au-dessus du titre principal. Reprise du document du client. */
  readonly surtitre: string;
  /** Le h1 unique de la page. */
  readonly titre: string;
  /** Paragraphes de chapeau, avant la premiere section. */
  readonly introduction: readonly string[];
  readonly sections: readonly SectionContenu[];
  readonly visuel: VisuelDePage;
  /** Faits pratiques affiches dans le bandeau de tete. Page de vente seulement. */
  readonly faitsCles?: readonly FaitCle[];
  /** Bouton d'appel a l'action du bandeau de tete. */
  readonly appelAction?: { readonly libelle: string; readonly ancre: string };
}

/**
 * Emplacement du logo dans l'en-tete.
 *
 * La charte n'est pas encore fournie : tant que « fichier » vaut null, la
 * marque s'affiche en texte dans un espace de meme hauteur. La hauteur
 * d'affichage n'est pas ici, c'est une decision visuelle qui vit dans
 * styles/_theme.scss (CLAUDE.md §14).
 */
export interface EmplacementLogo {
  /** Chemin sous public/, par exemple « logo/brain-corporation-hub.svg ». */
  readonly fichier: string | null;
  /** Largeur intrinseque du fichier, en pixels. Reserve la place avant chargement. */
  readonly largeur: number | null;
  /** Hauteur intrinseque du fichier, en pixels. */
  readonly hauteur: number | null;
  readonly texteAlternatif: string;
}

/** Modalites pratiques de la formation. Bloc produit d'apres CLAUDE.md §4. */
export interface ModalitesFormation {
  readonly titre: string;
  readonly elements: readonly { readonly libelle: string; readonly valeur: string }[];
  readonly mentionTva: string;
}
