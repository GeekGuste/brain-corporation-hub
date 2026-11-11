import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import libelles from '../../../content/fr/referentiel-territorial.json';
import type { Prefecture } from '../../core/inscription/modele-inscription';
import { ServiceInscription } from '../../core/inscription/service-inscription';

/**
 * La grille territoriale, en LECTURE SEULE.
 *
 * Partagee par la page publique (CLAUDE.md §5.8) et par l'ecran
 * d'administration : c'est la meme grille, il n'y a donc qu'un seul tableau.
 *
 * Aucune action d'ecriture, nulle part, y compris cote administration :
 * l'interface d'administration du referentiel est explicitement hors perimetre
 * V1 (CLAUDE.md §8). La grille se modifie en editant le fichier versionne
 * data/referentiels.json, recharge au demarrage de l'application (§7).
 */
@Component({
  selector: 'app-tableau-referentiel',
  imports: [],
  templateUrl: './tableau-referentiel.html',
  styleUrl: './tableau-referentiel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableauReferentiel {
  private readonly service = inject(ServiceInscription);

  protected readonly t = libelles;

  protected readonly lignes = signal<readonly Prefecture[]>([]);
  protected readonly enEchec = signal(false);
  protected readonly recherche = signal('');

  protected readonly total = computed(() => this.lignes().length);

  protected readonly resultats = computed(() => {
    const terme = this.recherche().trim();
    if (!terme) {
      return this.lignes();
    }

    // Sans accents ni casse : le public tape « val d'oise » aussi bien que
    // « VAL-D'OISE », les deux doivent trouver (CLAUDE.md §13).
    const cherche = TableauReferentiel.normaliser(terme);

    return this.lignes().filter((ligne) =>
      [ligne.departement, ligne.nomDepartement, ligne.prefecture, ligne.barreauRequis].some(
        (champ) => TableauReferentiel.normaliser(champ).includes(cherche),
      ),
    );
  });

  constructor() {
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
  protected verification(valeur: string): string {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(valeur));
  }

  private static normaliser(valeur: string): string {
    return valeur
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
  }
}
