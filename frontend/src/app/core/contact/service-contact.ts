import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

/** Message saisi dans le formulaire de contact. */
export interface DemandeContact {
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
  readonly telephone: string;
  readonly message: string;
  /** Champ piege, vide chez un humain. Voir le composant. */
  readonly piege: string;
}

/**
 * Issue d'un envoi.
 *
 * Les erreurs sont traduites en resultats explicites plutot que propagees : le
 * composant doit afficher un message utile pour chaque cas, pas gerer des
 * exceptions (CLAUDE.md §13).
 */
export type ResultatContact =
  | { readonly type: 'envoye' }
  | { readonly type: 'invalide'; readonly erreurs: Record<string, readonly string[]> }
  | {
      readonly type: 'echec';
      readonly cle: 'reseau' | 'serveur' | 'envoiImpossible' | 'tropDeMessages';
    };

/**
 * Appel a l'API de contact.
 *
 * L'URL est RELATIVE et prefixee par /api : le navigateur ne connait jamais
 * l'adresse de l'API. En preprod et en production c'est Apache qui achemine
 * /api vers le conteneur, en local le proxy de ng serve (CLAUDE.md §11).
 */
@Injectable({ providedIn: 'root' })
export class ServiceContact {
  private readonly http = inject(HttpClient);

  envoyer(demande: DemandeContact): Observable<ResultatContact> {
    return this.http.post('/api/contact', demande, { observe: 'response' }).pipe(
      map((): ResultatContact => ({ type: 'envoye' })),
      catchError((erreur: unknown): Observable<ResultatContact> => {
        if (!(erreur instanceof HttpErrorResponse)) {
          return of({ type: 'echec', cle: 'serveur' });
        }

        // 400 : ValidationProblem d'ASP.NET Core, un message par champ.
        if (erreur.status === 400 && erreur.error?.errors) {
          return of({ type: 'invalide', erreurs: erreur.error.errors });
        }

        // 429 : limitation de debit. Trois messages par dix minutes.
        if (erreur.status === 429) {
          return of({ type: 'echec', cle: 'tropDeMessages' });
        }

        // 502 : le serveur n'a pas pu transmettre le message, et RIEN n'est
        // enregistre. Le visiteur doit le savoir pour ecrire autrement : son
        // message n'existe nulle part.
        if (erreur.status === 502) {
          return of({ type: 'echec', cle: 'envoiImpossible' });
        }

        // 0 : requete jamais partie, donc connexion absente ou coupee. Le
        // public est parfois en connexion lente (CLAUDE.md §13), ce cas merite
        // son propre message.
        return of({ type: 'echec', cle: erreur.status === 0 ? 'reseau' : 'serveur' });
      }),
    );
  }
}
