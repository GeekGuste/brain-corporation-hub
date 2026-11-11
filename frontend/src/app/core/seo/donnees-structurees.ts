import config from '../../../seo/donnees-structurees.config.json';
import seoConfig from '../../../seo/seo.config.json';

/**
 * Fabriques de donnees structurees JSON-LD (CLAUDE.md §12).
 *
 * Elles decrivent aux moteurs de recherche qui publie le site et ce qui y est
 * vendu. Les valeurs viennent de seo/donnees-structurees.config.json : aucun
 * libelle n'est ecrit ici, le referenceur ajustera le fichier sans toucher au
 * code.
 *
 * REGLE ABSOLUE DE CES DONNEES : elles doivent decrire ce que la page montre
 * reellement. Une donnee structuree qui annonce ce qui n'est pas affiche est
 * une faute aux yeux des moteurs, et un mensonge aux yeux du visiteur. C'est
 * pourquoi la foire aux questions est construite a partir des questions
 * affichees, et non d'une liste recopiee.
 */

/** Un objet JSON-LD, tel qu'il part dans la page. */
export type DonneeStructuree = Record<string, unknown>;

/**
 * L'editeur du site.
 *
 * Pose sur toutes les pages indexables. Sans adresse ni telephone : ils ne
 * sont pas fournis et arriveront avec les mentions legales. Sans « sameAs »
 * non plus : nous ne connaissons aucun compte officiel de la marque, et en
 * deviner un dirigerait les moteurs vers un compte qui n'est pas le sien.
 */
export function organisation(urlDeBase: string): DonneeStructuree {
  const { organisation: o } = config;

  return {
    '@type': 'Organization',
    name: o.nom,
    url: `${urlDeBase}/`,
    logo: `${urlDeBase}${o.cheminLogo}`,
    email: o.email,
    areaServed: o.zoneDesservie,
    inLanguage: o.langue,
  };
}

/**
 * La formation vendue.
 *
 * AUCUNE DATE : la regle de constitution des cohortes n'est pas tranchee
 * (CLAUDE.md §16). La formation est donc decrite par sa duree et sa modalite,
 * ce qui suffit aux moteurs et reste vrai en toute circonstance.
 *
 * La description est lue dans seo.config.json : une seule source, donc la
 * description structuree ne peut pas diverger de celle du resultat de
 * recherche.
 */
export function formation(urlDeBase: string, urlDeLaPage: string): DonneeStructuree {
  const { formation: f, organisation: o } = config;
  const metadonnees = seoConfig.pages as Record<string, { description: string } | undefined>;
  const description = metadonnees[f.cle]?.description ?? '';

  return {
    '@type': 'Course',
    name: f.nom,
    description,
    url: urlDeLaPage,
    inLanguage: o.langue,
    provider: {
      '@type': 'Organization',
      name: o.nom,
      url: `${urlDeBase}/`,
    },
    offers: {
      '@type': 'Offer',
      price: f.prix,
      priceCurrency: f.devise,
      category: 'Paid',
      availability: 'https://schema.org/InStock',
      url: urlDeLaPage,
    },
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: f.modalite,
      courseWorkload: f.duree,
    },
  };
}

/**
 * La foire aux questions.
 *
 * Construite a partir des questions REELLEMENT AFFICHEES sur la page, passees
 * en argument. C'est une exigence des moteurs : une question structuree qui ne
 * figure pas dans la page est une infraction, et elle fait perdre l'affichage
 * enrichi pour la page entiere.
 */
export function questionsFrequentes(
  questions: readonly { readonly question: string; readonly reponse: string }[],
): DonneeStructuree {
  return {
    '@type': 'FAQPage',
    mainEntity: questions.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.reponse,
      },
    })),
  };
}
