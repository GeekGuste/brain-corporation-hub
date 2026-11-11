/**
 * Decoupe un texte en morceaux dont certains sont des liens.
 *
 * POURQUOI
 * -----------------------------------------------------------------------------
 * Les textes legaux du client citent une adresse de courriel, l'adresse de la
 * CNIL et renvoient a la politique de confidentialite. Ces trois choses doivent
 * etre cliquables : sur un telephone, personne ne recopie « www.cnil.fr » a la
 * main, et une politique qu'on ne peut pas atteindre n'informe personne.
 *
 * Mais les fichiers de contenu ne doivent contenir AUCUNE balise : le client
 * remplace son texte sans savoir ce qu'est une ancre, et un texte qui contient
 * du HTML devrait etre assaini avant affichage. Les liens sont donc RECONNUS
 * dans le texte au moment du rendu, et le texte reste du texte (CLAUDE.md §3).
 *
 * CE QUI EST RECONNU
 * -----------------------------------------------------------------------------
 * Une adresse de courriel, une adresse web, et une phrase designee par
 * l'appelant pour un lien interne au site (« Politique de confidentialite »).
 * Rien d'autre : pas de gras, pas d'italique, pas de titre. Ce n'est pas un
 * langage de balisage, c'est de la detection de trois motifs.
 */

export type MorceauDeTexte =
  | { readonly type: 'texte'; readonly valeur: string }
  | { readonly type: 'courriel'; readonly valeur: string; readonly href: string }
  | { readonly type: 'web'; readonly valeur: string; readonly href: string }
  | { readonly type: 'interne'; readonly valeur: string; readonly chemin: string };

/** Phrase a transformer en lien vers une page du site. */
export interface LienInterne {
  /** Le texte exact a reconnaitre, tel qu'il est ecrit dans le contenu. */
  readonly phrase: string;
  /** Chemin de la page, venu de la configuration des routes. */
  readonly chemin: string;
}

/**
 * Courriels et adresses web.
 *
 * Les points ne sont avales que lorsqu'ils sont suivis de caracteres de nom de
 * domaine : le point final d'une phrase (« ... a contact@exemple.fr. ») reste
 * donc dans le texte et n'entre pas dans le lien.
 */
const MOTIFS_LIENS =
  /([\w.+-]+@[\w-]+(?:\.[\w-]+)+)|((?:https?:\/\/|www\.)[\w-]+(?:\.[\w-]+)+(?:\/[^\s,;)]*)?)/g;

/**
 * Decoupe un texte. Le resultat contient toujours au moins un morceau, et la
 * concatenation des valeurs redonne exactement le texte d'entree : rien n'est
 * perdu ni ajoute.
 */
export function decouperLiens(texte: string, interne?: LienInterne): readonly MorceauDeTexte[] {
  // Deux passes : d'abord la phrase du lien interne, qui est une chaine exacte,
  // puis les motifs de courriel et d'adresse web dans ce qui reste de texte.
  // L'inverse ne marcherait pas : le second decoupage repasserait sur les
  // morceaux deja faits.
  const apresInterne = interne?.phrase
    ? decouperPhrase(texte, interne.phrase, interne.chemin)
    : [{ type: 'texte', valeur: texte } as MorceauDeTexte];

  return apresInterne.flatMap((morceau) =>
    morceau.type === 'texte' ? decouperMotifs(morceau.valeur) : [morceau],
  );
}

/** Isole chaque occurrence d'une phrase exacte. */
function decouperPhrase(texte: string, phrase: string, chemin: string): MorceauDeTexte[] {
  const morceaux: MorceauDeTexte[] = [];
  let depuis = 0;

  for (let trouve = texte.indexOf(phrase); trouve !== -1; trouve = texte.indexOf(phrase, depuis)) {
    if (trouve > depuis) {
      morceaux.push({ type: 'texte', valeur: texte.slice(depuis, trouve) });
    }
    morceaux.push({ type: 'interne', valeur: phrase, chemin });
    depuis = trouve + phrase.length;
  }

  if (depuis < texte.length) {
    morceaux.push({ type: 'texte', valeur: texte.slice(depuis) });
  }
  return morceaux;
}

/** Isole les courriels et les adresses web. */
function decouperMotifs(texte: string): MorceauDeTexte[] {
  const morceaux: MorceauDeTexte[] = [];
  let depuis = 0;

  // L'expression porte le drapeau g : on repart d'un index neuf a chaque appel,
  // sinon deux paragraphes de suite se decouperaient de travers.
  MOTIFS_LIENS.lastIndex = 0;

  for (let trouve = MOTIFS_LIENS.exec(texte); trouve; trouve = MOTIFS_LIENS.exec(texte)) {
    if (trouve.index > depuis) {
      morceaux.push({ type: 'texte', valeur: texte.slice(depuis, trouve.index) });
    }

    const [valeur, courriel] = trouve;
    morceaux.push(
      courriel
        ? { type: 'courriel', valeur, href: `mailto:${valeur}` }
        : {
            type: 'web',
            valeur,
            // « www.cnil.fr » est ecrit sans protocole dans le texte du client.
            // Sans protocole, le navigateur le prendrait pour un chemin relatif.
            href: valeur.startsWith('http') ? valeur : `https://${valeur}`,
          },
    );
    depuis = trouve.index + valeur.length;
  }

  if (depuis < texte.length) {
    morceaux.push({ type: 'texte', valeur: texte.slice(depuis) });
  }
  return morceaux.length > 0 ? morceaux : [{ type: 'texte', valeur: texte }];
}
