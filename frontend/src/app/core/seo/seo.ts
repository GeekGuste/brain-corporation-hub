import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

import seoConfig from '../../../seo/seo.config.json';
import {
  CONFIGURATION_EXECUTION,
  type ConfigurationExecution,
} from '../config/runtime-config';
import { cheminDePage, pageParCle } from '../config/site-routes';
import { organisation, type DonneeStructuree } from './donnees-structurees';

interface MetadonneesDePage {
  readonly titre: string;
  readonly description: string;
  /**
   * Open Graph et Twitter Card. FACULTATIFS : ils decrivent une page partagee
   * sur un reseau social, ce qui n a pas de sens pour une page de gestion en
   * noindex. A defaut, le titre et la description de la page sont repris, ce
   * qui evite de les recopier dans le fichier de configuration.
   */
  readonly ogTitre?: string;
  readonly ogDescription?: string;
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

  /**
   * Metadonnees de la page « non trouvee ».
   *
   * Elle n'a pas de route a elle, donc pas d'URL canonique : poser une
   * canonique sur une adresse qui n'existe pas dirait au moteur de recherche
   * que cette page est la version de reference de quelque chose. Elle est en
   * revanche toujours en noindex, quel que soit l'environnement : une page
   * d'erreur n'a rien a faire dans un index (CLAUDE.md §12).
   */
  appliquerNonTrouvee(): void {
    const metadonnees = this.metadonneesDe('non-trouvee');
    const commun = seoConfig.commun;

    this.title.setTitle(`${metadonnees.titre}${commun.separateurDeTitre}${commun.nomDuSite}`);
    this.meta.updateTag({ name: 'description', content: metadonnees.description });
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
  }

  /**
   * @param donneesEnPlus donnees structurees propres a la page, par exemple
   * la formation et la foire aux questions sur la page de vente. L'editeur du
   * site, lui, est pose sur toutes les pages sans qu'on le demande.
   */
  appliquer(clePage: string, donneesEnPlus: readonly DonneeStructuree[] = []): void {
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
    this.meta.updateTag({ property: 'og:title', content: metadonnees.ogTitre ?? metadonnees.titre });
    this.meta.updateTag({ property: 'og:description', content: metadonnees.ogDescription ?? metadonnees.description });
    this.meta.updateTag({ property: 'og:url', content: urlCanonique });

    // Le trafic viendra beaucoup des reseaux sociaux (CLAUDE.md §12).
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: metadonnees.ogTitre ?? metadonnees.titre });
    this.meta.updateTag({ name: 'twitter:description', content: metadonnees.ogDescription ?? metadonnees.description });

    this.poserImageDePartage();

    // Les donnees structurees ne sont posees que sur une page indexable. Les
    // emettre sur la preprod ou sur la page de suivi n'aurait aucun effet
    // utile, et decrirait un contenu qu'on demande par ailleurs d'ignorer.
    if (indexable) {
      this.poserDonneesStructurees([organisation(this.urlDeBase()), ...donneesEnPlus]);
    } else {
      this.retirerDonneesStructurees();
    }
  }

  /**
   * Domaine des URL absolues, sans barre oblique finale.
   *
   * Public : les fabriques de donnees structurees en ont besoin pour batir
   * leurs URL, et c'est la seule facon de garantir qu'elles emploient le meme
   * domaine que les canoniques.
   */
  urlDeBase(): string {
    return this.config.urlCanoniqueDeBase.replace(/\/$/, '');
  }

  /**
   * Ecrit le bloc JSON-LD dans l'en-tete du document.
   *
   * UN SEUL bloc, remplace a chaque navigation : plusieurs scripts cumules
   * decriraient la page precedente en meme temps que la courante.
   *
   * Les chevrons sont echappes avant ecriture. Le contenu vient de nos
   * fichiers, mais un « </script> » glisse un jour dans un texte fermerait la
   * balise et casserait la page : l'echappement coute un appel et supprime la
   * question.
   */
  private poserDonneesStructurees(elements: readonly DonneeStructuree[]): void {
    const graphe = { '@context': 'https://schema.org', '@graph': elements };
    const script = this.scriptDonneesStructurees(true);
    script!.textContent = JSON.stringify(graphe).replace(/</g, '\\u003c');
  }

  private retirerDonneesStructurees(): void {
    this.scriptDonneesStructurees(false)?.remove();
  }

  /**
   * Retrouve le bloc JSON-LD, et le cree s'il manque quand on le demande.
   * Designe par un identifiant stable, pour qu'il n'en existe jamais deux.
   */
  private scriptDonneesStructurees(creerSiAbsent: boolean): HTMLScriptElement | null {
    const existant = this.document.head.querySelector<HTMLScriptElement>(
      'script[type="application/ld+json"]',
    );
    if (existant || !creerSiAbsent) {
      return existant;
    }

    const script = this.document.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    this.document.head.appendChild(script);
    return script;
  }

  /**
   * Image affichee quand un lien du site est colle sur un reseau social ou
   * dans une messagerie. Le trafic viendra beaucoup de la (CLAUDE.md §12).
   *
   * L'URL est rendue ABSOLUE et pointe toujours sur le domaine de production,
   * comme la canonique : un reseau social ne resout pas une URL relative, et
   * il met l'image en cache, donc une image servie depuis la preprod y
   * resterait.
   *
   * Tant que le fichier n'est pas renseigne, aucune balise n'est emise :
   * mieux vaut pas d'image qu'une URL inventee, qui afficherait un cadre vide
   * sur chaque partage.
   */
  private poserImageDePartage(): void {
    const commun = seoConfig.commun;
    const chemin = commun.imagePartageParDefaut;

    // Un texte de remplacement « [A FOURNIR PAR LE CLIENT] » ne commence ni
    // par une barre oblique ni par un protocole : c'est ce qui le distingue
    // d'un vrai chemin, sans avoir a reconnaitre sa formulation.
    if (!chemin.startsWith('/') && !chemin.startsWith('http')) {
      return;
    }

    const base = this.urlDeBase();
    const url = chemin.startsWith('http') ? chemin : `${base}${chemin}`;

    this.meta.updateTag({ property: 'og:image', content: url });
    this.meta.updateTag({ property: 'og:image:alt', content: commun.imagePartageTexteAlternatif });
    this.meta.updateTag({ property: 'og:image:width', content: String(commun.imagePartageLargeur) });
    this.meta.updateTag({ property: 'og:image:height', content: String(commun.imagePartageHauteur) });
    this.meta.updateTag({ name: 'twitter:image', content: url });
  }

  /**
   * URL canonique d'une page, toujours sur le domaine de production, y compris
   * depuis la preprod (CLAUDE.md §12.3).
   */
  urlCanonique(clePage: string): string {
    const base = this.urlDeBase();
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
