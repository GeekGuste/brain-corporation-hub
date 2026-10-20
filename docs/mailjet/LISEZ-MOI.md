# Modèles d'emails Mailjet

Les modèles vivent **dans Mailjet**, où le client les personnalise lui-même.
L'application les appelle par leur identifiant et leur passe des variables :
aucun texte d'email n'est écrit dans le code (CLAUDE.md §16).

Les fichiers de ce dossier sont la **version de départ**, versionnée pour la
reprise du projet. Ils ne sont lus par aucun programme.

## Poser le modèle dans Mailjet

1. Mailjet > **Campagnes > Modèles > Créer un modèle**.
2. Choisir **« Coder le vôtre »** (éditeur HTML), pas le glisser-déposer.
3. Coller le contenu de [confirmation-inscription.html](confirmation-inscription.html).
4. Onglet **Texte brut** : coller [confirmation-inscription.txt](confirmation-inscription.txt).
   Certains clients de messagerie et certains filtres antispam ne lisent que
   celle-là.
5. Dans les **propriétés du modèle**, renseigner l'objet :

   ```
   Votre inscription à la formation Lignes Rouges est confirmée
   ```

6. Enregistrer, puis relever l'**identifiant numérique du modèle**, visible
   dans l'URL ou dans la liste des modèles.
7. Le poser dans la configuration du serveur :

   ```
   Mailjet__ModeleConfirmation=1234567
   ```

   En développement local : `appsettings.Development.json`, clé
   `Mailjet:ModeleConfirmation`.

Tant que l'identifiant vaut zéro, l'envoi est ignoré avec une trace dans le
journal, et la confirmation du paiement aboutit quand même.

## Variables envoyées par l'application

| Variable | Contenu | Exemple |
|---|---|---|
| `prenom` | Prénom du stagiaire | Marie |
| `nom` | Nom du stagiaire | Dupont |
| `reference` | Identifiant de l'inscription | 01a14f8b-9894-795d-… |
| `montant` | Montant payé | 100.00 |
| `devise` | Devise | EUR |

Syntaxe Mailjet : `{{var:prenom:"valeur par défaut"}}`. La valeur par défaut
évite qu'un email parte avec un trou si une variable manque.

**Ces cinq variables sont les seules envoyées, et c'est volontaire.** Ni
catégorie de titre de séjour, ni préfecture, ni barreau : ces données n'ont
rien à faire dans un email, et encore moins chez un sous-traitant
(CLAUDE.md §6). Si le client en demande d'autres, il faut en peser la nécessité
avant de les ajouter.

## À compléter avant la mise en ligne

Trois endroits portent `[À FOURNIR PAR LE CLIENT]` :

1. **Ce qui se passe ensuite.** C'est la question §17 du cahier des charges,
   restée sans réponse : la cohorte se constitue à dix stagiaires, et nous ne
   savons pas ce qui doit être annoncé sur le délai. Le paragraphe est encadré
   en rouge dans le modèle pour qu'il ne parte pas en production par oubli.
   Retirer l'encadré en même temps que le texte.
2. **L'adresse de contact.** `noreply@braincorporationhub.com` est l'expéditeur,
   ce n'est pas une adresse de réponse.
3. **Le lien vers la politique de confidentialité**, qui sera posée à l'étape 9.

**Aucune date de session ne doit apparaître**, ici ni ailleurs, tant que la
règle de constitution des cohortes n'est pas tranchée (CLAUDE.md §16).

## Le logo ne s'affichera pas tout de suite

Le modèle pointe vers :

```
https://braincorporationhub.com/visuels/logo-lignes-rouges.png
```

Tant que le domaine de production est protégé par mot de passe, les clients de
messagerie ne pourront pas charger cette image et afficheront le texte
alternatif. Deux options :

- héberger le logo ailleurs, par exemple dans la bibliothèque de médias de
  Mailjet, qui donne une adresse publique ;
- attendre la levée de la protection.

La seconde est la plus simple si la mise en ligne est proche.

## Le second email

Le §5.4 parle de deux emails : **preuve de paiement** et **confirmation
d'inscription**.

La preuve de paiement est le **reçu Stripe**, envoyé automatiquement par Stripe
à l'adresse du stagiaire. Elle est posée à la création du paiement via
`receipt_email`, et l'application ne produit pas de facture numérotée
(CLAUDE.md §4). Il n'y a donc **qu'un seul modèle Mailjet à créer**.

À vérifier côté Stripe avant la mise en ligne : la mention « TVA non
applicable, article 293 B du CGI » doit figurer sur ce reçu. Stripe ne l'ajoute
pas tout seul, elle se paramètre dans les réglages du compte (CLAUDE.md §4).

## Essais sans envoyer de vrais emails

Le mode bac à sable valide la requête de bout en bout sans rien envoyer :

```
Mailjet__BacASable=true
```

À laisser à `true` en préprod et en développement, à passer à `false` en
production.
