import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  TransferState,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
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
    // withFetch : requis pour que les appels passent aussi cote serveur sous
    // SSR. Le formulaire n'appelle l'API que dans le navigateur, mais la
    // configuration doit etre juste des maintenant pour ne pas pieger l'etape 5.
    provideHttpClient(withFetch()),
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
