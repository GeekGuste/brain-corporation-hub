import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  TransferState,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import {
  CLE_CONFIGURATION_EXECUTION,
  CONFIGURATION_EXECUTION,
  CONFIGURATION_EXECUTION_PAR_DEFAUT,
} from './core/config/runtime-config';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      // Retour en haut de page a chaque navigation, et respect des ancres.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
    ),
    provideClientHydration(withEventReplay()),
    {
      // Cote navigateur, la configuration est relue dans l'etat transfere par
      // le serveur. Aucune requete supplementaire, aucune valeur figee au build.
      provide: CONFIGURATION_EXECUTION,
      useFactory: () =>
        inject(TransferState).get(
          CLE_CONFIGURATION_EXECUTION,
          CONFIGURATION_EXECUTION_PAR_DEFAUT,
        ),
    },
  ],
};
