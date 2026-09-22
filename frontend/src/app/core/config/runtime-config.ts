import { InjectionToken, makeStateKey, StateKey } from '@angular/core';

/**
 * Configuration lue au LANCEMENT du conteneur, jamais au build.
 *
 * C'est ce qui permet de n'avoir qu'une seule image Docker pour la preprod et
 * la production (CLAUDE.md §11) : le tag valide en preprod est promu en
 * production sans reconstruction.
 *
 * Le navigateur, lui, ne recoit aucune URL d'API : Apache achemine /api vers
 * le conteneur de l'API et le reste vers le serveur SSR. Les appels du front
 * sont donc relatifs.
 */
export interface ConfigurationExecution {
  /**
   * Domaine servant a construire les URL canoniques. Il vaut TOUJOURS le
   * domaine de production, y compris en preprod : la canonique de la preprod
   * doit pointer vers la production (CLAUDE.md §12.3).
   */
  readonly urlCanoniqueDeBase: string;
  /** Faux en preprod et en local : la page sort alors en noindex, nofollow. */
  readonly indexable: boolean;
}

/** Valeurs de repli, utilisees si aucune variable d'environnement n'est posee. */
export const CONFIGURATION_EXECUTION_PAR_DEFAUT: ConfigurationExecution = {
  urlCanoniqueDeBase: 'https://braincorporationhub.com',
  indexable: false,
};

export const CONFIGURATION_EXECUTION = new InjectionToken<ConfigurationExecution>(
  'ConfigurationExecution',
);

/**
 * Cle de transfert serveur vers navigateur. Le serveur lit les variables
 * d'environnement, depose le resultat dans l'etat transfere, et le navigateur
 * le relit apres hydratation sans requete supplementaire.
 */
export const CLE_CONFIGURATION_EXECUTION: StateKey<ConfigurationExecution> =
  makeStateKey<ConfigurationExecution>('configurationExecution');
