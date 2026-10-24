import { ApplicationConfig, inject, mergeApplicationConfig, TransferState } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServerRendering, withRoutes } from '@angular/ssr';

import { appConfig } from './app.config';
import { intercepteurApiServeur } from './core/config/intercepteur-api-serveur';
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

    // Les appels a l'API sont relatifs cote navigateur, Apache les acheminant.
    // Pendant le rendu serveur, Node n'a aucune base pour les resoudre : sans
    // cet intercepteur, toute page qui depend de l'API serait rendue vide, et
    // c'est ce HTML-la que verraient les moteurs de recherche.
    //
    // Le conteneur de rendu joint celui de l'API par le reseau interne de
    // Docker. En developpement local, l'API ecoute sur 5080.
    provideHttpClient(
      withFetch(),
      withInterceptors([
        intercepteurApiServeur(
          process.env['SITE_API_INTERNE'] ?? 'http://localhost:5080',
        ),
      ]),
    ),
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
