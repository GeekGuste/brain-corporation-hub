# Modèles d'emails Mailjet

**Trois modèles à créer**, qui ne s'adressent pas aux mêmes personnes :

| Modèle | Destinataire | Variable de configuration |
|---|---|---|
| [confirmation-inscription.html](confirmation-inscription.html) | le stagiaire qui vient de payer | `Mailjet__ModeleConfirmation` |
| [notification-interne.html](notification-interne.html) | vos gestionnaires et commerciaux | `Mailjet__ModeleNotification` |
| [message-contact.html](message-contact.html) | les mêmes, quand un visiteur écrit | `Mailjet__ModeleContact` |

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

## La preuve de paiement reste le reçu Stripe

Le §5.4 parle de deux emails pour le stagiaire : **preuve de paiement** et
**confirmation d'inscription**.

La preuve de paiement est le **reçu Stripe**, envoyé automatiquement par Stripe
à l'adresse du stagiaire. Elle est posée à la création du paiement via
`receipt_email`, et l'application ne produit pas de facture numérotée
(CLAUDE.md §4). Il n'y a donc **qu'un seul modèle Mailjet destiné au stagiaire**. Le second
modèle, la notification interne, est un ajout hors contrat initial accepté en
V1 : il prévient vos équipes à chaque paiement.

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

---

## Le modèle de notification interne

Même procédure que le premier, avec [notification-interne.html](notification-interne.html)
et [notification-interne.txt](notification-interne.txt).

**Objet du message**, à renseigner dans les propriétés du modèle :

```
Nouvelle inscription confirmee : {{var:barreau:""}}
```

Le barreau dans l'objet n'est pas décoratif : il permet de trier la boîte de
réception et de filtrer par ressort sans ouvrir les messages.

Puis l'identifiant du modèle dans la configuration du serveur :

```
Mailjet__ModeleNotification=1234567
```

### Variables envoyées

| Variable | Contenu |
|---|---|
| `prenom` | Prénom du stagiaire |
| `nom` | Nom du stagiaire |
| `barreau` | Barreau requis, dérivé de la préfecture |
| `reference` | Identifiant de l'inscription |

**Ce qui n'est pas envoyé, et c'est volontaire** : ni email, ni téléphone, ni
catégorie de titre de séjour, ni préfecture. Le détail est dans le back-office,
derrière mot de passe, et n'a pas à circuler par email (CLAUDE.md §15). Si une
équipe en demande davantage, il faut en peser la nécessité avant de l'ajouter.

### Qui reçoit ces messages

Les adresses saisies dans le back-office, écran **Notifications**. Elles
s'ajoutent et se retirent de là, sans intervention technique.

**Une liste vide n'est pas un état neutre** : personne ne sera prévenu. L'écran
le dit explicitement plutôt que d'afficher un tableau vide.

### Un message par destinataire

L'application envoie un message séparé à chaque adresse, et non un seul message
à plusieurs destinataires. Deux raisons : personne n'a besoin de voir la liste
de diffusion, et Mailjet rend compte de chaque envoi séparément, ce qui permet
de voir laquelle rebondit.

### Ce qui se passe si l'envoi échoue

Rien, pour l'inscription. Le paiement reste confirmé, l'horodatage est posé, et
le stagiaire reçoit son email. Une notification interne manquée est signalée
dans les journaux, et la ligne est de toute façon visible dans le suivi.

---

## Le modèle du formulaire de contact

Même procédure, avec [message-contact.html](message-contact.html) et
[message-contact.txt](message-contact.txt).

**Objet du message**, à renseigner dans les propriétés du modèle :

```
Question du site : {{var:prenom:""}} {{var:nom:""}}
```

Puis l'identifiant du modèle dans la configuration du serveur :

```
Mailjet__ModeleContact=1234567
```

### Celui-ci n'est pas facultatif

Les deux premiers modèles s'ignorent en silence tant que leur identifiant vaut
zéro : le paiement aboutit quand même. **Pas celui-ci.** Tant qu'il n'est pas
renseigné, le formulaire de contact répond une erreur au visiteur, qui est
invité à écrire directement à l'adresse de contact.

C'est volontaire. Un formulaire qui affiche « message envoyé » sans rien
envoyer est pire qu'un formulaire en panne : le visiteur attendrait une réponse
qui ne viendrait jamais.

### Variables envoyées

| Variable | Contenu |
|---|---|
| `prenom` | Prénom du visiteur |
| `nom` | Nom du visiteur |
| `email` | Son adresse, obligatoire |
| `telephone` | Son numéro, **chaîne vide** s'il ne l'a pas donné |
| `message` | Sa question, telle qu'il l'a écrite |

Le téléphone n'étant pas obligatoire, le modèle teste `{% if var:telephone !=
"" %}` pour faire disparaître la ligne plutôt que d'afficher un libellé sans
valeur.

### Ce message n'existe nulle part ailleurs

**Aucun message de contact n'est enregistré en base**, et il n'apparaît pas non
plus dans les journaux du serveur. C'est de la minimisation (CLAUDE.md §15) :
un visiteur écrira malgré les consignes des détails sur sa situation
administrative, et cette phrase n'a pas à dormir dans une table avec une durée
de conservation à tenir.

La contrepartie est assumée : **si Mailjet refuse l'envoi, le message est
perdu.** Le visiteur l'apprend immédiatement, avec l'adresse où écrire
directement, plutôt que de recevoir une fausse confirmation.

Conséquence pour vos équipes : **l'email reçu est l'original.** Il ne faut pas
le supprimer avant d'avoir répondu. Le modèle le rappelle en bas de message.

### Répondre

L'application pose l'adresse du visiteur en **Reply-To**. Le bouton
« Répondre » de votre messagerie lui écrit directement, sans recopier l'adresse
à la main.

### Si la liste des destinataires est vide

Les messages partent à l'adresse de secours, configurée dans
`appsettings.json` :

```
Mailjet:ContactDestinataireDeSecours = contact@braincorporationhub.com
```

Sans ce filet, un déploiement neuf aurait un formulaire qui répond « envoyé » à
personne. **Il reste préférable de saisir de vraies adresses** dans le
back-office, écran Notifications.

### Ce que le modèle transporte

Contrairement aux deux autres, celui-ci contient du **texte écrit librement par
un inconnu**. Deux précautions :

- ne pas le transférer en dehors des personnes habilitées ;
- le formulaire affiche sous le champ de message l'avertissement du client,
  « n'indiquez pas de données médicales ou de détails confidentiels sur votre
  situation administrative », mais rien n'empêche quelqu'un de l'écrire quand
  même.

### Protection contre les robots

Le formulaire porte un **champ caché** qu'un humain ne remplit jamais et qu'un
robot remplit presque toujours. S'il arrive rempli, le serveur écarte le
message en silence et répond comme si tout allait bien : un robot qui reçoit
une erreur recommence autrement, un robot qui croit avoir réussi passe à autre
chose.

Pas de captcha : il faudrait envoyer l'adresse IP du visiteur à un service
extérieur, et il est infranchissable pour une partie du public (CLAUDE.md §13).

S'y ajoute une limite de **huit envois par dix minutes et par adresse IP**. Ce
compte inclut les envois refusés pour cause de champ mal rempli, le limiteur
s'exécutant avant la validation : huit laisse donc la place aux corrections.
