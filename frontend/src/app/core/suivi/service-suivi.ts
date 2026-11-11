import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';

/** Une inscription confirmee, telle que la page de suivi l'affiche. */
export interface InscriptionSuivie {
  readonly id: string;
  readonly dateValidation: string | null;
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
  readonly telephone: string | null;
  readonly statutResidence: string;
  readonly categorieCode: string;
  readonly categorieFamille: string;
  readonly sousCategorie: string | null;
  readonly precisionAutreSituation: string | null;
  readonly departement: string;
  readonly prefecture: string;
  readonly tribunalJudiciaire: string;
  readonly barreauRequis: string;
  readonly paysResidenceActuelle: string | null;
  readonly dateArriveePrevisionnelle: string | null;
  readonly communeOuCodePostalProjete: string | null;
  readonly formationSuivie: boolean | null;
}


/** Une adresse prevenue d un paiement confirme. */
export interface DestinataireNotification {
  readonly id: string;
  readonly email: string;
  readonly libelle: string | null;
  readonly dateAjout: string;
}

/**
 * Appels de la page de suivi (CLAUDE.md §5.7).
 *
 * La session est portee par un cookie pose par le serveur, inaccessible au
 * JavaScript : rien n'est conserve ici, ni jeton ni identifiant. « withCredentials »
 * fait suivre ce cookie, y compris en developpement ou le front et l'API n'ont
 * pas le meme port.
 */
@Injectable({ providedIn: 'root' })
export class ServiceSuivi {
  private readonly http = inject(HttpClient);
  private static readonly BASE = '/api/suivi';
  private static readonly AVEC_SESSION = { withCredentials: true } as const;

  /** Vrai si la connexion a reussi. */
  connexion(identifiant: string, motDePasse: string): Observable<boolean> {
    return this.http
      .post(
        `${ServiceSuivi.BASE}/connexion`,
        { identifiant, motDePasse },
        ServiceSuivi.AVEC_SESSION,
      )
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  deconnexion(): Observable<void> {
    return this.http
      .post(`${ServiceSuivi.BASE}/deconnexion`, {}, ServiceSuivi.AVEC_SESSION)
      .pipe(
        map(() => undefined),
        catchError(() => of(undefined)),
      );
  }

  /** Permet de savoir si la session tient encore, sans tenter un appel qui echoue. */
  session(): Observable<boolean> {
    return this.http
      .get<{ connecte: boolean }>(`${ServiceSuivi.BASE}/session`, ServiceSuivi.AVEC_SESSION)
      .pipe(
        map((reponse) => reponse.connecte),
        catchError(() => of(false)),
      );
  }

  /** Null quand la session a expire : la page redemande alors les identifiants. */
  inscriptions(): Observable<readonly InscriptionSuivie[] | null> {
    return this.http
      .get<InscriptionSuivie[]>(`${ServiceSuivi.BASE}/inscriptions`, ServiceSuivi.AVEC_SESSION)
      .pipe(catchError(() => of(null)));
  }

  /**
   * Premiere des deux seules actions d'ecriture : marquer qu'un stagiaire a
   * suivi ou non la formation (CLAUDE.md §5.7).
   */
  posePresence(id: string, suivie: boolean | null): Observable<boolean> {
    return this.http
      .put(
        `${ServiceSuivi.BASE}/inscriptions/${id}/presence`,
        { suivie },
        ServiceSuivi.AVEC_SESSION,
      )
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  /**
   * Seconde action d'ecriture : supprimer une inscription.
   *
   * Le serveur la refuse tant que la formation n'est pas marquee comme suivie.
   * Le bouton est cache cote page, mais c'est le serveur qui tient la regle
   * (CLAUDE.md §15).
   */
  supprime(id: string): Observable<'ok' | 'non-suivie' | 'echec'> {
    return this.http
      .delete(`${ServiceSuivi.BASE}/inscriptions/${id}`, ServiceSuivi.AVEC_SESSION)
      .pipe(
        map(() => 'ok' as const),
        catchError((erreur: unknown) =>
          of(
            erreur instanceof HttpErrorResponse && erreur.status === 409
              ? ('non-suivie' as const)
              : ('echec' as const),
          ),
        ),
      );
  }

  /**
   * Telechargement de l'export CSV.
   *
   * Il passe par le client HTTP et non par un lien direct : le fichier n'est
   * servi qu'avec la session, et un lien ouvert dans un nouvel onglet ne
   * transmettrait pas toujours le cookie.
   */
  exporte(): Observable<Blob | null> {
    return this.http
      .get(`${ServiceSuivi.BASE}/inscriptions/export`, {
        ...ServiceSuivi.AVEC_SESSION,
        responseType: 'blob',
      })
      .pipe(catchError(() => of(null)));
  }

  // ---------------------------------------------------------------------------
  // Adresses de notification
  // ---------------------------------------------------------------------------

  destinataires(): Observable<readonly DestinataireNotification[] | null> {
    return this.http
      .get<DestinataireNotification[]>(
        `${ServiceSuivi.BASE}/notifications`,
        ServiceSuivi.AVEC_SESSION,
      )
      .pipe(catchError(() => of(null)));
  }

  ajouteDestinataire(
    email: string,
    libelle: string | null,
  ): Observable<DestinataireNotification | 'invalide' | 'deja-present' | 'echec'> {
    return this.http
      .post<DestinataireNotification>(
        `${ServiceSuivi.BASE}/notifications`,
        { email, libelle },
        ServiceSuivi.AVEC_SESSION,
      )
      .pipe(
        catchError((erreur: unknown) => {
          if (erreur instanceof HttpErrorResponse && erreur.status === 400) {
            return of('invalide' as const);
          }
          if (erreur instanceof HttpErrorResponse && erreur.status === 409) {
            return of('deja-present' as const);
          }
          return of('echec' as const);
        }),
      );
  }

  retireDestinataire(id: string): Observable<boolean> {
    return this.http
      .delete(`${ServiceSuivi.BASE}/notifications/${id}`, ServiceSuivi.AVEC_SESSION)
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }
}
