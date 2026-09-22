import routesConfig from '../../../seo/routes.config.json';

/** Une page publique declaree dans seo/routes.config.json. */
export interface PageDuSite {
  /** Cle stable, jamais modifiee : elle relie la page a son contenu et a ses metadonnees. */
  readonly cle: string;
  /** Chemin d'URL, sans barre oblique initiale. Modifiable par le referenceur. */
  readonly chemin: string;
  /** Faux pour une page qui ne doit jamais entrer dans le sitemap ni etre indexee. */
  readonly indexable: boolean;
}

/**
 * Les URL du site, telles que declarees dans le fichier de configuration.
 * Aucun chemin n'est ecrit en dur ailleurs dans l'application (CLAUDE.md §12).
 */
export const PAGES_DU_SITE: readonly PageDuSite[] = routesConfig.pages;

/** Retrouve une page par sa cle. Leve si la cle n'existe pas : une faute de frappe doit casser le build, pas produire une page muette. */
export function pageParCle(cle: string): PageDuSite {
  const page = PAGES_DU_SITE.find((p) => p.cle === cle);
  if (!page) {
    throw new Error(`Page inconnue dans routes.config.json : « ${cle} »`);
  }
  return page;
}

/** Chemin absolu d'une page, barre oblique initiale comprise. */
export function cheminDePage(cle: string): string {
  return `/${pageParCle(cle).chemin}`.replace(/\/$/, '') || '/';
}
