import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Rend absolus, pendant le rendu serveur, les appels que le navigateur fait en
 * relatif.
 *
 * POURQUOI C'EST INDISPENSABLE
 *
 * Le navigateur appelle « /api/referentiels/prefectures » : une URL relative,
 * qu'il resout contre la page courante, et qu'Apache achemine vers le
 * conteneur de l'API (CLAUDE.md §11).
 *
 * Pendant le rendu serveur, le meme code tourne dans Node. Une URL relative n'y
 * a aucune base : la requete echoue avant de partir. Sans cet intercepteur, une
 * page qui depend de l'API est rendue VIDE, ou avec son message d'erreur, et
 * c'est ce HTML-la que recoivent les moteurs de recherche. Pour la page
 * publique du referentiel, qui est indexable et n'est QUE des donnees, cela
 * reviendrait a publier une page d'erreur.
 *
 * Le conteneur de rendu joint directement celui de l'API par le reseau interne
 * de Docker, sans repasser par Apache : c'est plus court, et cela fonctionne
 * meme si le domaine public n'est pas joignable depuis le serveur.
 *
 * Le prefixe « /api » est RETIRE au passage, exactement comme le fait Apache :
 * l'API expose ses routes a la racine.
 */
export function intercepteurApiServeur(base: string): HttpInterceptorFn {
  const PREFIXE = '/api';

  return (requete, suivant) => {
    if (!requete.url.startsWith(PREFIXE)) {
      return suivant(requete);
    }

    const sansPrefixe = requete.url.slice(PREFIXE.length) || '/';
    return suivant(requete.clone({ url: `${base}${sansPrefixe}` }));
  };
}
