import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import seoConfig from '../../../seo/seo.config.json';
import {
  CONFIGURATION_EXECUTION,
  type ConfigurationExecution,
} from '../config/runtime-config';
import { cheminDePage, pageParCle } from '../config/site-routes';

interface MetadonneesDePage {
  readonly titre: string;
  readonly description: string;
  readonly ogTitre: string;
  readonly ogDescription: string;
}

/**
 * Pose le titre, la meta description, la canonique, l'Open Graph et la Twitter
 * Card d'une page, a partir de seo/seo.config.json.
 *
 * Aucun libelle n'est ecrit ici : le plan du referenceur remplacera le fichier
 * de configuration sans qu'on touche au code (CLAUDE.md §12).
 */
@Injectable({ providedIn: 'root' })
export class Seo {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly config: ConfigurationExecution = inject(CONFIGURATION_EXECUTION);

  appliquer(clePage: string): void {
    const page = pageParCle(clePage);
    const metadonnees = this.metadonneesDe(clePage);
    const commun = seoConfig.commun;
    const urlCanonique = this.urlCanonique(clePage);

    this.title.setTitle(`${metadonnees.titre}${commun.separateurDeTitre}${commun.nomDuSite}`);
    this.meta.updateTag({ name: 'description', content: metadonnees.description });

    // Une page non indexable, ou un environnement non indexable (preprod,
    // local), sort en noindex. La preprod reste par ailleurs protegee par mot
    // de passe dans Plesk, seule protection etanche (CLAUDE.md §12).
    const indexable = page.indexable && this.config.indexable;
    this.meta.updateTag({
      name: 'robots',
      content: indexable ? 'index, follow' : 'noindex, nofollow',
    });

    this.poserCanonique(urlCanonique);

    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: commun.nomDuSite });
    this.meta.updateTag({ property: 'og:locale', content: commun.locale });
    this.meta.updateTag({ property: 'og:title', content: metadonnees.ogTitre });
    this.meta.updateTag({ property: 'og:description', content: metadonnees.ogDescription });
    this.meta.updateTag({ property: 'og:url', content: urlCanonique });

    // Le trafic viendra beaucoup des reseaux sociaux (CLAUDE.md §12).
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: metadonnees.ogTitre });
    this.meta.updateTag({ name: 'twitter:description', content: metadonnees.ogDescription });

    // L'image de partage n'est pas encore fournie par le client : tant qu'elle
    // manque, aucune balise d'image n'est emise plutot qu'une URL inventee.
  }

  /**
   * URL canonique d'une page, toujours sur le domaine de production, y compris
   * depuis la preprod (CLAUDE.md §12.3).
   */
  urlCanonique(clePage: string): string {
    const base = this.config.urlCanoniqueDeBase.replace(/\/$/, '');
    const chemin = cheminDePage(clePage);
    // L'accueil garde sa barre oblique finale : c'est la forme attendue d'une
    // canonique de racine, et cela evite deux URL pour la meme page.
    return chemin === '/' ? `${base}/` : `${base}${chemin}`;
  }

  private metadonneesDe(clePage: string): MetadonneesDePage {
    const pages = seoConfig.pages as Record<string, MetadonneesDePage | undefined>;
    const metadonnees = pages[clePage];
    if (!metadonnees) {
      throw new Error(`Aucune metadonnee dans seo.config.json pour la page « ${clePage} »`);
    }
    return metadonnees;
  }

  private poserCanonique(url: string): void {
    let lien = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!lien) {
      lien = this.document.createElement('link');
      lien.setAttribute('rel', 'canonical');
      this.document.head.appendChild(lien);
    }
    lien.setAttribute('href', url);
  }
}
