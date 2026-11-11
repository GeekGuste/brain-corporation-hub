import { ChangeDetectionStrategy, Component } from '@angular/core';

import libelles from '../../../../content/fr/suivi.json';
import { TableauReferentiel } from '../../../shared/tableau-referentiel/tableau-referentiel';

/**
 * Le referentiel territorial dans le back-office.
 *
 * Exactement le meme tableau que la page publique, et en LECTURE SEULE comme
 * elle. L'interface d'administration du referentiel est hors perimetre V1
 * (CLAUDE.md §8) : il n'y a ici ni ajout, ni retrait, ni modification.
 *
 * La grille se modifie en editant le fichier versionne
 * backend/data/referentiels.json, recharge au demarrage de l'application
 * (CLAUDE.md §7).
 */
@Component({
  selector: 'app-suivi-referentiel',
  imports: [TableauReferentiel],
  templateUrl: './suivi-referentiel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuiviReferentiel {
  protected readonly t = libelles;
}
