import { ApplicationConfig, inject, mergeApplicationConfig, TransferState } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import {
  CLE_CONFIGURATION_EXECUTION,
  CONFIGURATION_EXECUTION,
  CONFIGURATION_EXECUTION_PAR_DEFAUT,
  type ConfigurationExecution,
} from './core/config/runtime-config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    {
      // Cote serveur, la configuration vient des variables d'environnement du
      // conteneur, lues a chaque rendu. Elle est deposee dans l'etat transfere
      // pour que le navigateur la retrouve apres hydratation.
      provide: CONFIGURATION_EXECUTION,
      useFactory: (): ConfigurationExecution => {
        const config: ConfigurationExecution = {
          urlCanoniqueDeBase:
            process.env['SITE_CANONICAL_BASE_URL'] ??
            CONFIGURATION_EXECUTION_PAR_DEFAUT.urlCanoniqueDeBase,
          indexable: process.env['SITE_INDEXABLE'] === 'true',
        };
        inject(TransferState).set(CLE_CONFIGURATION_EXECUTION, config);
        return config;
      },
    },
  ],
};

// Les providers du serveur sont ajoutes apres ceux du navigateur : pour un meme
// jeton, c'est le dernier qui l'emporte. La configuration serveur gagne donc
// pendant le rendu.
export const config = mergeApplicationConfig(appConfig, serverConfig);
