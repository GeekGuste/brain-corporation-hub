import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import libelles from '../../../content/fr/referentiel-territorial.json';
import type { Prefecture } from '../../core/inscription/modele-inscription';
import { ServiceInscription } from '../../core/inscription/service-inscription';
import { Seo } from '../../core/seo/seo';

/**
 * Page publique du referentiel territorial (CLAUDE.md §5.8).
 *
 * LECTURE SEULE. Aucun ajout, aucun retrait, aucune modification : l'interface
 * d'administration du referentiel est explicitement hors perimetre V1
 * (CLAUDE.md §8). Il n'y a donc ici aucun formulaire, et c'est voulu.
 *
 * La grille indique prefecture, tribunal judiciaire de reference et barreau
 * REQUIS. Elle ne designe jamais un avocat : ce choix est humain et manuel
 * (CLAUDE.md §6), et la page le dit a l'ecran plutot que de le laisser deviner.
 *
 * La validation juridique de cette grille appartient au client, qui doit la
 * confronter aux annuaires officiels. Nous integrons la grille fournie, nous ne
 * la certifions pas (CLAUDE.md §7) : d'ou la colonne de date de derniere
 * verification, et la mention explicite quand elle manque.
 */
@Component({
  selector: 'app-referentiel-territorial',
  imports: [],
  templateUrl: './referentiel-territorial.html',
  styleUrl: './referentiel-territorial.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferentielTerritorial {
  private readonly service = inject(ServiceInscription);

  protected readonly t = libelles;

  protected readonly lignes = signal<readonly Prefecture[]>([]);
  protected readonly enEchec = signal(false);
  protected readonly recherche = signal('');

  protected readonly resultats = computed(() => {
    const terme = this.recherche().trim().toLowerCase();
    if (!terme) {
      return this.lignes();
    }

    // Recherche sur les quatre colonnes utiles. Sans accents ni casse : le
    // public tape « val d'oise » ou « VAL-D'OISE », les deux doivent marcher.
    const normalise = (valeur: string) =>
      valeur
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');

    const cherche = normalise(terme);

    return this.lignes().filter((ligne) =>
      [ligne.departement, ligne.nomDepartement, ligne.prefecture, ligne.barreauRequis]
        .some((champ) => normalise(champ).includes(cherche)),
    );
  });

  protected readonly total = computed(() => this.lignes().length);

  constructor() {
    inject(Seo).appliquer('referentiel-territorial');

    this.service.prefectures().subscribe({
      next: (lignes) => this.lignes.set(lignes),
      error: () => this.enEchec.set(true),
    });
  }

  protected surRecherche(evenement: Event): void {
    this.recherche.set((evenement.target as HTMLInputElement).value);
  }

  protected effacer(): void {
    this.recherche.set('');
  }

  /** Date de verification, ou la mention explicite de son absence. */
  protected verification(valeur: string | null | undefined): string {
    if (!valeur) {
      return this.t.verification.jamais;
    }
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(valeur));
  }
}
