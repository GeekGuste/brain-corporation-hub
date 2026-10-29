import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import libelles from '../../../content/fr/contact.json';
import { cheminDePage } from '../../core/config/site-routes';
import { ServiceContact } from '../../core/contact/service-contact';
import { Seo } from '../../core/seo/seo';
import { TexteAvecLiens } from '../../shared/texte-avec-liens/texte-avec-liens';

/** Les deux ecrans de la page : le formulaire, puis l'accuse de reception. */
type Etape = 'formulaire' | 'envoye';

/**
 * Page de contact.
 *
 * HORS DU PERIMETRE du §5 de CLAUDE.md, demandee explicitement et acceptee en
 * V1 : les visiteurs ont des questions avant de s'inscrire, et la foire aux
 * questions n'y repond pas toujours.
 *
 * Cinq champs, quatre obligatoires. Le telephone ne porte AUCUNE mention
 * « facultatif », a la demande expresse du client : les quatre autres champs
 * portent l'attribut « required », donc les lecteurs d'ecran les annoncent
 * comme obligatoires, et l'absence de marque sur celui-ci suffit a dire qu'il
 * ne l'est pas, sans l'ecrire.
 *
 * AUCUN MESSAGE N'EST ENREGISTRE, ni ici ni cote serveur : il part par email
 * aux adresses internes et rien n'en reste. Si l'envoi echoue, on le dit
 * franchement plutot que d'afficher une confirmation mensongere.
 */
@Component({
  selector: 'app-contact',
  imports: [ReactiveFormsModule, RouterLink, TexteAvecLiens],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Contact {
  private readonly service = inject(ServiceContact);
  private readonly fb = inject(FormBuilder);

  /** Libelles, lus dans content/fr/contact.json (CLAUDE.md §13). */
  protected readonly t = libelles;

  /** La phrase « Politique de confidentialite » devient un lien. */
  protected readonly lienPolitique = {
    phrase: 'Politique de confidentialité',
    chemin: cheminDePage('politique-confidentialite'),
  };

  /** Chemin du produit phare, jamais ecrit en dur (CLAUDE.md §12). */
  protected readonly versLignesRouges = cheminDePage('lignes-rouges');

  protected readonly etape = signal<Etape>('formulaire');
  protected readonly envoiEnCours = signal(false);

  /** Messages du serveur, par nom de champ. */
  protected readonly erreursServeur = signal<Record<string, readonly string[]>>({});

  /** Message global, quand l'echec n'est imputable a aucun champ. */
  protected readonly erreurGlobale = signal<string | null>(null);

  protected readonly formulaire = this.fb.nonNullable.group({
    prenom: ['', [Validators.required, Validators.maxLength(100)]],
    nom: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    telephone: ['', [Validators.maxLength(30)]],
    message: ['', [Validators.required, Validators.maxLength(4000)]],

    // Champ piege : voir le gabarit. Jamais rempli par un humain.
    piege: [''],
  });

  /** Nombre de caracteres restants, affiche au-dela de la moitie du quota. */
  private readonly longueurMessage = signal(0);

  protected readonly caracteresRestants = computed(() => 4000 - this.longueurMessage());

  constructor() {
    inject(Seo).appliquer('contact');
  }

  protected surSaisieMessage(): void {
    this.longueurMessage.set(this.formulaire.controls.message.value.length);
  }

  // ---------------------------------------------------------------------------
  // Erreurs
  // ---------------------------------------------------------------------------

  protected messageErreur(champ: string): string | null {
    const duServeur = this.erreursServeur()[champ]?.[0];
    if (duServeur) return duServeur;

    const controle = this.formulaire.get(champ);
    if (!controle || !controle.touched || controle.valid) return null;

    // Le message dit QUOI corriger, et il est propre au champ : « Ce champ est
    // obligatoire » quatre fois de suite n'aide personne (CLAUDE.md §13).
    const parChamp = this.t.erreurs.champs as Record<string, string | undefined>;
    if (controle.hasError('email')) return this.t.erreurs.emailInvalide;
    return parChamp[champ] ?? this.t.erreurs.requis;
  }

  protected enErreur(champ: string): boolean {
    return this.messageErreur(champ) !== null;
  }

  // ---------------------------------------------------------------------------
  // Envoi
  // ---------------------------------------------------------------------------

  protected envoyer(): void {
    this.erreurGlobale.set(null);
    this.erreursServeur.set({});

    if (this.formulaire.invalid) {
      // « touched » partout, sinon les messages des champs jamais visites ne
      // s'affichent pas et le visiteur ne voit pas ce qui manque.
      this.formulaire.markAllAsTouched();
      return;
    }

    this.envoiEnCours.set(true);
    const valeurs = this.formulaire.getRawValue();

    this.service
      .envoyer({
        prenom: valeurs.prenom.trim(),
        nom: valeurs.nom.trim(),
        email: valeurs.email.trim(),
        telephone: valeurs.telephone.trim(),
        message: valeurs.message.trim(),
        piege: valeurs.piege,
      })
      .subscribe((resultat) => {
        this.envoiEnCours.set(false);

        switch (resultat.type) {
          case 'envoye':
            this.etape.set('envoye');
            break;

          case 'invalide':
            this.erreursServeur.set(normaliser(resultat.erreurs));
            break;

          case 'echec':
            this.erreurGlobale.set(this.t.erreurs[resultat.cle]);
            break;
        }
      });
  }
}

/**
 * ASP.NET Core renvoie les cles de « ValidationProblem » telles qu'elles sont
 * ecrites cote serveur. On les ramene a la casse des champs du formulaire.
 */
function normaliser(
  erreurs: Record<string, readonly string[]>,
): Record<string, readonly string[]> {
  const normalisees: Record<string, readonly string[]> = {};
  for (const [cle, messages] of Object.entries(erreurs)) {
    normalisees[cle.charAt(0).toLowerCase() + cle.slice(1)] = messages;
  }
  return normalisees;
}
