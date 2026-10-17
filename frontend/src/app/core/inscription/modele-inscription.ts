/**
 * Formes echangees avec l'API d'inscription.
 *
 * Elles refletent exactement les contrats de
 * backend/src/BrainHub.Api/Inscriptions/ContratsInscription.cs. Toute
 * divergence est un bogue : c'est le seul endroit du front qui connait la forme
 * de l'API.
 */

export type StatutResidence = 'ResidentEnFrance' | 'ResidentALEtranger';

export interface SousCategorieTitre {
  readonly id: number;
  readonly libelle: string;
}

export interface CategorieTitre {
  readonly code: string;
  readonly famille: string;
  /** Vrai pour la seule famille AUT : une precision libre devient obligatoire. */
  readonly precisionLibreObligatoire: boolean;
  readonly sousCategories: readonly SousCategorieTitre[];
}

/**
 * Une prefecture de la liste normalisee.
 *
 * Le tribunal et le barreau viennent avec, pour afficher le rattachement des le
 * choix de la prefecture sans second appel. Aucun nom d'avocat n'y figure : le
 * systeme nomme un barreau, jamais une personne (CLAUDE.md §6).
 */
export interface Prefecture {
  readonly departement: string;
  readonly nomDepartement: string;
  readonly prefecture: string;
  readonly tribunalJudiciaire: string;
  readonly barreauRequis: string;
}

export interface DemandeInscription {
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
  readonly telephone: string | null;
  readonly statutResidence: StatutResidence;
  readonly categorieCode: string;
  readonly sousCategorieId: number | null;
  readonly precisionAutreSituation: string | null;
  readonly departementPrefecture: string;
  readonly paysResidenceActuelle: string | null;
  readonly dateArriveePrevisionnelle: string | null;
  readonly communeOuCodePostalProjete: string | null;
  /** Mis a vrai seulement apres confirmation explicite du visiteur. */
  readonly doublonEmailConfirme: boolean;
}

export interface ReponseInscription {
  readonly id: string;
  readonly statut: string;
  readonly prefectureLibelle: string;
  readonly tribunalJudiciaireReference: string;
  readonly barreauRequis: string;
  readonly montantCentimes: number;
  readonly devise: string;
}

/**
 * Issue d'une tentative d'envoi, telle que le composant la traite.
 *
 * Le doublon n'est pas une erreur : c'est une question posee au visiteur
 * (CLAUDE.md §6), d'ou un cas a part entiere.
 */
export type ResultatEnvoi =
  | { readonly type: 'creee'; readonly inscription: ReponseInscription }
  | { readonly type: 'doublon' }
  | { readonly type: 'invalide'; readonly erreurs: Record<string, readonly string[]> }
  | { readonly type: 'echec'; readonly cle: 'reseau' | 'serveur' };
