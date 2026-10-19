import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

import type {
  CategorieTitre,
  DemandeInscription,
  Prefecture,
  ReponseInscription,
  ResultatEnvoi,
} from './modele-inscription';

/**
 * Appels a l'API d'inscription.
 *
 * Les URL sont RELATIVES et prefixees par /api. Le navigateur ne connait jamais
 * l'adresse de l'API : en preprod et en production c'est Apache qui achemine
 * /api vers le conteneur, et en local le proxy de ng serve (CLAUDE.md §11).
 */
@Injectable({ providedIn: 'root' })
export class ServiceInscription {
  private readonly http = inject(HttpClient);

  private static readonly BASE = '/api';

  categories(): Observable<readonly CategorieTitre[]> {
    return this.http.get<CategorieTitre[]>(`${ServiceInscription.BASE}/referentiels/categories`);
  }

  prefectures(): Observable<readonly Prefecture[]> {
    return this.http.get<Prefecture[]>(`${ServiceInscription.BASE}/referentiels/prefectures`);
  }

  /**
   * Demande si cet email porte deja une inscription confirmee.
   *
   * L'API ne renvoie qu'un booleen, jamais un nom ni une date (CLAUDE.md §15),
   * et elle est limitee en debit. En cas d'echec on renvoie « faux » : ce
   * controle est un confort, il ne doit jamais empecher une inscription, et le
   * serveur refera de toute facon la verification a la creation.
   */
  emailDejaInscrit(email: string): Observable<boolean> {
    return this.http
      .post<{ dejaInscrit: boolean }>(`${ServiceInscription.BASE}/inscriptions/verifier-email`, {
        email,
      })
      .pipe(
        map((reponse) => reponse.dejaInscrit),
        catchError(() => of(false)),
      );
  }

  /**
   * Cree l'inscription au statut « en attente de paiement ».
   *
   * Les erreurs sont traduites en resultats explicites plutot que propagees :
   * le composant doit afficher un message utile pour chaque cas, pas gerer des
   * exceptions (CLAUDE.md §13).
   */
  creer(demande: DemandeInscription): Observable<ResultatEnvoi> {
    return this.http
      .post<ReponseInscription>(`${ServiceInscription.BASE}/inscriptions`, demande)
      .pipe(
        map((inscription): ResultatEnvoi => ({ type: 'creee', inscription })),
        catchError((erreur: unknown): Observable<ResultatEnvoi> => {
          if (!(erreur instanceof HttpErrorResponse)) {
            return of({ type: 'echec', cle: 'serveur' });
          }

          // 409 : l'email porte deja une inscription confirmee et le visiteur
          // n'a pas encore confirme (CLAUDE.md §6).
          if (erreur.status === 409) {
            return of({ type: 'doublon' });
          }

          // 400 : ValidationProblem d'ASP.NET Core, un message par champ.
          if (erreur.status === 400 && erreur.error?.errors) {
            return of({ type: 'invalide', erreurs: erreur.error.errors });
          }

          // 503 : l'inscription est enregistree, c'est Stripe qui n'a pas
          // repondu. Le visiteur doit pouvoir reessayer sans resaisir.
          if (erreur.status === 503) {
            return of({ type: 'echec', cle: 'paiementIndisponible' });
          }

          // 0 : requete jamais partie, donc connexion absente ou coupee. Le
          // public est parfois en connexion lente (CLAUDE.md §13), ce cas
          // merite son propre message.
          return of({ type: 'echec', cle: erreur.status === 0 ? 'reseau' : 'serveur' });
        }),
      );
  }

  /**
   * Etat d'une inscription.
   *
   * Interroge pendant quelques secondes apres le retour de Stripe, le temps que
   * le webhook fasse foi (CLAUDE.md §9.6). Une erreur reseau renvoie null
   * plutot que de propager : l'attente doit continuer, pas s'interrompre sur un
   * paquet perdu.
   */
  statut(id: string): Observable<string | null> {
    return this.http
      .get<{ statut: string }>(`${ServiceInscription.BASE}/inscriptions/${id}/statut`)
      .pipe(
        map((reponse) => reponse.statut),
        catchError(() => of(null)),
      );
  }
}
