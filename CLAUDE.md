# CLAUDE.md : Brain Corporation Hub / Lignes Rouges

## 1. Le projet en une phrase
Site de vente en ligne d'une formation professionnelle : pages publiques,
paiement par carte intégré, formulaire d'inscription qualifié, emails
automatiques, page de suivi des inscriptions protégée. Livraison mi-octobre.
Forfait ferme, périmètre figé.

## 2. Deux marques
- **Brain Corporation Hub** : la plateforme de formation et de coaching, appelée
  à intervenir dans des domaines variés. Porte le domaine
  (braincorporationhub.com, préprod sur dev.braincorporationhub.com) et la page
  d'accueil.
- **Lignes Rouges** : le programme phare, consacré à la prévention des risques
  liés au droit au séjour. C'est la marque connue du public et la page qui
  encaisse.

L'architecture doit permettre d'ajouter un second programme (page + prix, même
canal de paiement) sans refonte. Mais **on n'implémente pas de catalogue** : un
seul programme existe.

## 3. Contenus
Les textes des pages sont **fournis par le client** dans le document
« Contenus éditoriaux du site web » (version du 15 septembre 2026).

Règles strictes :
- **Intégrer ces textes tels quels.** Ne pas les réécrire, ne pas les
  « optimiser », ne pas en ajouter. Le client est juriste ; la formulation est
  volontairement prudente et engage sa responsabilité.
- Corriger uniquement les coquilles manifestes (« dépresssion », « non
  anticipée non anticipée ») et **signaler la correction**, ne pas la faire en
  silence.
- Les titres, accroches et intertitres du document servent de hiérarchie H1/H2/H3.
- Tout contenu absent est un texte de remplacement marqué
  `[À FOURNIR PAR LE CLIENT]`. **Ne jamais inventer** un chiffre, un témoignage,
  une date de session, un nom d'avocat ou un logo.
- Ne jamais amplifier le registre : pas de peur ajoutée, pas d'urgence
  artificielle, pas de promesse de résultat. Le client affirme lui-même que la
  formation ne prédit pas les décisions administratives et ne remplace pas
  l'avocat, et cette nuance doit rester visible.
- **Ponctuation** : dans tout texte que tu produis (interface, emails,
  messages d'erreur, documentation), n'utilise pas de tirets cadratins.
  Préfère les deux-points, les virgules ou les parenthèses. Cette règle ne
  s'applique pas aux textes fournis par le client, qui sont intégrés tels
  quels.

Pages publiques (d'après le document de contenus) :
1. **Accueil** : Brain Corporation Hub, « Mieux comprendre les risques pour
   décider plus tôt », les trois piliers.
2. **Brain Corporation Hub** : la vision, les intervenants, l'exigence
   pédagogique.
3. **Lignes Rouges**, la page de vente : pourquoi la formation existe, ce
   qu'elle propose, les objectifs, le tableau de bord pédagogique, à qui elle
   s'adresse, les formateurs, et le paiement intégré.
4. Pages légales (textes fournis par le client).

## 4. Le produit vendu
- Formation **Lignes Rouges**, 1 h 30, à distance, **100 € TTC** par stagiaire.
- **Auto-entreprise** : la mention « TVA non applicable, article 293 B du CGI »
  doit apparaître sur le justificatif de paiement, dans les CGV et sur la page
  de confirmation. Elle se paramètre côté Stripe pour le reçu ; Stripe ne
  l'ajoute pas tout seul.
- **Justificatif** : le reçu Stripe. Pas de facture numérotée à produire par
  l'application, donc pas de numérotation séquentielle à tenir.
- **Rétractation** : la formation ne se déroule jamais avant l'expiration du
  délai de quatorze jours. Aucune case de renonciation au droit de rétractation
  dans le formulaire.
- Animée par des avocats partenaires. Chaque avocat intervient exclusivement
  auprès des stagiaires dont la préfecture relève du ressort de la cour d'appel
  de son barreau d'inscription.
- Le « tableau de bord de sécurisation du titre de séjour » est un **support
  pédagogique remis pendant la formation. Ce n'est pas une fonctionnalité du
  site. Ne jamais le développer.**
- Périmètre géographique : France métropolitaine, Corse comprise. Pas de
  collectivités ultramarines dans le référentiel territorial.

## 5. Périmètre V1 : ce qui est au contrat
1. Pages publiques (§3)
2. Formulaire d'inscription qualifié (§6)
3. Paiement Stripe intégré à la page, confirmation **fiabilisée côté serveur
   (webhook)**
4. Emails automatiques : preuve de paiement + confirmation d'inscription
5. RGPD : bandeau de consentement, pages légales
6. Socle technique de référencement
7. **Page de suivi des inscriptions** : authentification (compte administrateur
   unique), export CSV, affichage du barreau requis calculé. Deux actions
   d'écriture, et deux seulement :
   - marquer qu'un stagiaire a suivi ou non la formation ;
   - supprimer une inscription, bouton visible **uniquement** une fois la
     formation marquée comme suivie. La suppression efface l'inscription de
     notre base ; la trace du paiement reste chez Stripe pour la comptabilité.
   Toute autre modification (corriger un email, éditer une donnée) est hors V1.
8. **Page publique du référentiel territorial** : affichage en lecture seule de
   la grille département / préfecture / tribunal judiciaire / barreau requis.
   Consultation uniquement, aucun ajout, retrait ni modification (V2).

## 6. Données d'inscription : modèle complet dès la V1
Le formulaire collecte, pour chaque inscription :

- Identité et coordonnées.
- **Date et heure exactes de validation**, horodatées côté serveur et
  **jamais modifiables** : elles déterminent l'ordre d'arrivée en phase 2.
  La validation est la **confirmation du paiement par le webhook**, pas la
  soumission du formulaire. La date de soumission est conservée séparément :
  elle sert à la purge des inscriptions restées en attente.
- **Statut de résidence** : résident en France / résident à l'étranger.
- **Catégorie de titre de séjour** : une seule famille principale par
  inscription, choisie dans le référentiel des catégories (12 familles :
  ETU, SAL, ENT, TAL, VPF, UEE, VIS, PRO, MED, JEF, RES, AUT), avec
  sous-catégories affichées après le choix de la famille. La sous-catégorie est
  **facultative** : elle ne bloque pas la validation. La famille AUT
  (« autre situation ») impose une précision en texte libre.
- **Préfecture** : sélection obligatoire dans une liste normalisée associant
  numéro de département et ville-préfecture.
  - Résident en France : préfecture de résidence actuelle.
  - Résident à l'étranger : **préfecture de résidence projetée**, libellée
    distinctement de l'adresse actuelle, plus pays de résidence actuelle, date
    prévisionnelle d'arrivée si connue, commune ou code postal projeté si connu.
    Le libellé de l'écran doit alors indiquer « titre de séjour envisagé après
    l'arrivée en France ».
- Validation impossible si la catégorie de titre ou la préfecture manque.
- **Doublons d'email** : plusieurs inscriptions avec le même email sont
  autorisées (une personne peut inscrire un proche), mais la deuxième et les
  suivantes exigent une **confirmation explicite du visiteur** avant la
  création de l'inscription et le paiement.

**Barreau requis** : dérivé automatiquement de la préfecture via le référentiel
territorial (§7). Le système indique uniquement préfecture → tribunal judiciaire
de référence → barreau requis. **Il ne sélectionne, ne propose, ne nomme et
n'affecte jamais un avocat** : ce choix est humain et manuel. Cette règle est
explicite dans le cahier des charges et ne souffre aucune interprétation.

Minimisation RGPD : ne collecter que ce qui précède. **Aucune donnée de carte
bancaire** en base ni dans les logs : elles restent chez Stripe.

## 7. Référentiel territorial
Table de référence : département, préfecture, tribunal judiciaire de référence,
barreau requis, **date de dernière vérification**. Source : annexe 2 du cahier
des charges du client (96 lignes, France métropolitaine + Corse).

- Alimentée par un fichier de données versionné (`referentiels.json`), **chargé
  en base au démarrage de l'application** : à chaque lancement, l'application
  vérifie la présence du référentiel et l'insère ou le met à jour depuis le
  fichier, de façon idempotente. Aucune valeur codée en dur dans le code.
- Deux exceptions déjà identifiées par le client : Val-d'Oise → préfecture
  Cergy mais TJ de Pontoise ; Manche → préfecture Saint-Lô mais TJ de
  Coutances. Certains barreaux portent un nom plus large que leur siège
  (Alpes-de-Haute-Provence, La Rochelle-Rochefort, Coutances-Avranches).
- La correspondance porte sur la **ville-préfecture**, pas sur toutes les
  communes du département.
- **La validation juridique de ce référentiel appartient au client**, qui doit
  la confronter aux annuaires officiels avant la mise en production. Nous
  intégrons la grille fournie ; nous ne la certifions pas.
- Le modèle doit prévoir que la grille évolue (regroupements de barreaux,
  modifications de ressort).

## 8. HORS PÉRIMÈTRE V1 : ne pas construire
Le cahier des charges du 17 septembre décrit un back-office de gestion qui
**dépasse le contrat signé**. Ces éléments font l'objet d'un avenant et ne
doivent pas être développés sans instruction explicite :

- Moteur de constitution des cohortes (groupes de 10, compatibilité
  catégorie + barreau, tri chronologique)
- Gestion du reliquat à la clôture de campagne et signalement de dépassement
- Module de planification des créneaux (lundi-vendredi, 8h30-18h00, capacité,
  effectif, états)
- Workflow des six états de suivi
- Les cinq tableaux de gestion éditables et leur colonne « avocat retenu
  manuellement »
- Interface d'administration du référentiel territorial
- Comptes utilisateurs stagiaires, espace participant, gestion de rôles
- Catalogue multi-programmes, blog, CMS
- Le tableau de bord pédagogique (§4)

**Le modèle de données doit néanmoins être conçu pour accueillir ces objets sans
migration douloureuse** : entités Inscription, Cohorte, Créneau, Statut prévues
dans le schéma, mais seule Inscription est exploitée en V1.

En cas de doute sur une fonctionnalité non listée au §5 : ne pas l'implémenter,
le signaler.

## 9. Parcours V1 et séquencement du paiement
1. Le visiteur arrive sur la page Lignes Rouges, le plus souvent sur mobile.
2. Il lit, comprend, décide.
3. Il remplit le formulaire d'inscription qualifié (§6). **Avant le paiement**,
   l'API crée l'inscription au statut « en attente de paiement », calcule le
   barreau requis, crée le PaymentIntent Stripe avec l'identifiant de
   l'inscription dans ses métadonnées, et renvoie le `client_secret`.
4. Le Payment Element affiche le paiement **dans la page** (pas de
   redirection). Le retour de Stripe au navigateur permet d'afficher
   immédiatement l'issue du paiement.
5. En parallèle, Stripe appelle le **webhook** : signature vérifiée,
   inscription retrouvée par les métadonnées, statut passé à « confirmée »,
   horodatage serveur, emails Mailjet déclenchés.
6. La page interroge l'API sur le statut de l'inscription pendant quelques
   secondes après le retour de Stripe, puis affiche la confirmation définitive.
   Si le webhook tarde : « paiement reçu, votre confirmation arrive par email ».
7. Le client consulte les inscriptions sur la page de suivi et constitue les
   cohortes manuellement.

Règles critiques :
- Aucune inscription confirmée ni aucun email envoyé sur la foi d'un événement
  navigateur. Un utilisateur qui ferme son onglet juste après le paiement doit
  recevoir son email.
- Webhook idempotent : l'identifiant d'événement Stripe est stocké, un même
  événement reçu deux fois ne produit rien de nouveau.
- Gérer aussi l'échec de paiement.
- Purge périodique des inscriptions restées « en attente de paiement ».
- **Trois secrets de signature distincts** (local via Stripe CLI, préprod,
  prod), chacun dans son environnement.
- Développement local : `stripe listen --forward-to` vers le port publié du
  conteneur, cartes de test, `stripe trigger` pour rejouer des événements.

## 10. Stack
- **Front** : Angular avec SSR, pensé pour le référencement.
- **CSS** : **Bootstrap**. Pas d'autre framework CSS, pas de bibliothèque de
  composants supplémentaire.
- **Back** : .NET Core (API REST).
- **Base** : PostgreSQL installé sur l'hôte (pas en conteneur), écoute sur
  localhost et sur l'interface bridge Docker uniquement. Deux bases et **deux
  utilisateurs distincts** (préprod / prod), chacun sans droit sur l'autre base.
- **Paiement** : Stripe, intégré dans la page (pas de redirection).
- **Emails** : Mailjet via API, modèles gérés côté client dans Mailjet.
- **Local** : `docker-compose.yml` dans `/backend/database` pour PostgreSQL de
  développement.

## 11. Dépôt et déploiement
```
/frontend            Angular SSR
/backend             API .NET Core
/backend/database    docker-compose.yml (PostgreSQL local) + migrations
/assets              images sources
/.github/workflows   CI/CD
```
- **Déploiement par images Docker** : GitHub Actions construit et pousse les
  images, un script sur le VPS les récupère et relance les services.
  Images taguées par SHA de commit (pas seulement `latest`) pour permettre un
  retour arrière immédiat.
- `develop` → préprod, `main` → production. Les deux environnements tournent en
  permanence (`restart: unless-stopped`), avec projets Compose, ports et
  réseaux distincts.
- **Les deux environnements cohabitent sur le même VPS.** Une seule image par
  service, configurée au lancement : le tag validé en préprod est promu en
  production sans reconstruction. Ports publiés sur `127.0.0.1` uniquement,
  jamais sur `0.0.0.0` : sinon les conteneurs sont joignables par l'IP du
  serveur, ce qui contourne le mot de passe Plesk de la préprod (§12.5).

  | Service | Production | Préprod |
  |---|---|---|
  | API .NET (Kestrel) | `127.0.0.1:8080` | `127.0.0.1:8082` |
  | SSR Node | `127.0.0.1:3000` | `127.0.0.1:3001` |

- **Déploiement automatique au merge** : `develop` et `main` déclenchent le
  build, le push des images et une connexion SSH au VPS qui exécute
  `deploy.sh` (sauvegarde de la base, `pull`, `up -d` sur le tag SHA,
  migrations depuis le conteneur, contrôle de santé, retour arrière sur le tag
  précédent en cas d'échec). Aucune action manuelle sur le serveur après
  l'installation initiale. La CI n'a jamais la chaîne de connexion : elle
  appelle le script, le script parle à PostgreSQL.
- **Préprod automatique, production sous approbation** : un merge sur `develop`
  déploie sans intervention ; un merge sur `main` construit l'image puis attend
  une approbation manuelle dans l'environnement GitHub protégé avant la mise en
  ligne. Le port 22 du VPS est ouvert, authentification par clé.
- **Sauvegarde de la base avant chaque migration**, dans le script de
  déploiement, en plus de la sauvegarde quotidienne externalisée.
- Secrets (clés Stripe, Mailjet, chaînes de connexion) **jamais dans l'image ni
  dans le dépôt** : fichier `.env` sur le serveur, injecté au lancement ;
  secrets GitHub pour la CI, un environnement par cible.
- Migrations exécutées sur le serveur, jamais depuis la CI.
- **Hébergement** : VPS IONOS avec **Plesk**, serveur web **Apache** en reverse
  proxy devant les conteneurs. Kestrel et le processus Node SSR ne sont jamais
  exposés directement. Directives `ProxyPass` / `ProxyPassReverse` posées dans
  les directives Apache additionnelles du domaine.
- **Middleware de forwarded headers obligatoire côté ASP.NET Core** : derrière
  le proxy, sans lui l'application ne voit pas le HTTPS terminé par Apache, ce
  qui casse la vérification du webhook Stripe et les URL générées.
- HTTPS par l'extension Let's Encrypt de Plesk.

## 12. Référencement
- SSR effectif : HTML complet au premier chargement, vérifiable JavaScript
  désactivé.
- Un seul `<h1>` par page, hiérarchie H2/H3 sans saut de niveau.
- `title` et `meta description` **externalisés par page dans des fichiers de
  configuration**, remplaçables sans toucher au code (le plan du référenceur
  arrivera plus tard). Idem pour tous les textes de contenu.
- `sitemap.xml`, `robots.txt`, JSON-LD (`Organization`, `Course`), Open Graph et
  Twitter Card (le trafic viendra beaucoup des réseaux sociaux).
- URL centralisées dans la configuration des routes : le référenceur les
  confirmera.
- Performance : images optimisées et dimensionnées, chargement différé hors du
  premier écran, polices limitées.
- `noindex` sur la page de suivi des inscriptions.
- **Préprod jamais indexable** :
  1. Protection par mot de passe du domaine de préprod dans Plesk, seule
     protection étanche.
  2. En-tête `X-Robots-Tag: noindex, nofollow`, piloté par variable
     d'environnement.
  3. Canonique pointant vers le domaine de production.
  4. **Ne pas combiner `Disallow: /` et `noindex`** : le crawl interdit empêche
     de lire le `noindex` et l'URL peut rester listée.
  5. Vérifier que le site n'est pas servi par l'IP du serveur ni par le nom
     d'hôte de l'hébergeur.
  6. Ne jamais lier la préprod publiquement, ne pas la soumettre à la Search
     Console.

## 13. Public et accessibilité : contrainte forte
Public étranger, souvent non francophone de naissance, parfois peu à l'aise avec
les outils numériques, majoritairement sur mobile, parfois en connexion lente.

- Mobile d'abord, réellement testé sur petit écran.
- Français simple, phrases courtes, pas de jargon non expliqué.
- Le formulaire d'inscription est le point critique : il est plus long que la
  moyenne (catégorie de titre, sous-catégorie, préfecture, champs conditionnels
  pour l'étranger). Le rendre progressif et lisible, avec des libellés
  explicites et des messages d'erreur qui disent quoi corriger. Aucune création
  de compte.
- Contrastes accessibles, focus clavier visible, cibles tactiles généreuses.
- Textes externalisés pour permettre une version anglaise plus tard.
  **Ne pas implémenter l'i18n en V1.**

## 14. Design et thème
La charte graphique (logo, couleurs) n'est pas encore fournie.

- **Bootstrap** comme socle, personnalisé par surcharge.
- **Toutes les couleurs, la typographie et les rayons dans UN SEUL fichier de
  variables** (par exemple `frontend/src/styles/_theme.scss`), via les variables
  CSS de Bootstrap. Aucune couleur codée en dur ailleurs dans le projet, jamais.
  Le remplacement de la charte doit se faire en modifiant ce seul fichier.
- Registre visuel : sérieux, institutionnel, rassurant, proche d'un organisme
  de formation ou d'un cabinet. Pas d'esthétique « page de vente agressive » :
  ni compteur, ni bandeau clignotant, ni popup.
- Emplacements du logo et des visuels prévus avec textes alternatifs
  paramétrables, en attendant les fichiers définitifs.

## 15. Sécurité
- Secrets en variables d'environnement uniquement.
- Signature du webhook Stripe vérifiée systématiquement.
- Page de suivi : compte administrateur unique, mot de passe haché, session
  sécurisée, `noindex`, aucune donnée de carte affichée.
- Le formulaire collecte des données sensibles par nature (situation
  administrative d'étrangers) : minimisation, chiffrement en transit, accès
  restreint, durée de conservation à définir avec le client.
- HTTPS partout, en-têtes de sécurité, CORS restreint.
- Validation des entrées côté serveur, pas seulement côté formulaire.
- **Contrôle des doublons d'email (§6)** : l'endpoint ne renvoie qu'un booléen,
  jamais un nom, une date ni une catégorie. Sinon il devient un moyen de tester
  si telle personne est inscrite à une formation sur le droit au séjour. Il est
  limité en débit pour empêcher l'énumération d'adresses.
- Préprod protégée par mot de passe (§12).

## 16. Décisions arrêtées
- **Trois pages publiques** confirmées (§3), plus les pages légales.
- **URL** : accueil `/` ; Brain Corporation Hub `/brain-corporation-hub` ;
  Lignes Rouges `/lignes-rouges`. À centraliser dans la configuration des
  routes : elles pourront être ajustées après validation du référenceur.
- **Téléphone optionnel** à l'inscription.
- **Emails** : modèles créés dans Mailjet avec un contenu par défaut, que le
  client pourra personnaliser lui-même ensuite. Le back appelle le modèle avec
  ses variables ; le texte n'est jamais écrit en dur dans le code.
- **Conservation des données** : deux ans envisagés, à confirmer. La
  suppression manuelle (§5.7) est le mécanisme prévu en V1.
- **Domaines** : production braincorporationhub.com, préprod
  dev.braincorporationhub.com, les deux sur le même VPS (§11).
- **Stripe** : compte existant sous Brain Corporation Hub, accès développeur
  disponible. Clés de test en préprod, clés live en production.
- **Mailjet** : expéditeur `noreply@braincorporationhub.com`, domaine déjà
  authentifié.
- **PostgreSQL** : installé sur l'hôte par le client, hors de notre périmètre
  d'installation.
- **Aucune date de session** n'est affichée nulle part sur le site, ni dans les
  emails, tant que la règle de constitution des cohortes n'est pas tranchée.
- **Charte graphique** : en attendant les fichiers du client, palette et
  typographie neutres provisoires dans le fichier de thème unique (§14), et
  emplacements de logo avec textes alternatifs paramétrables.
- **Pages légales** : les pages existent dans l'arborescence dès maintenant,
  avec des contenus marqués `[À FOURNIR PAR LE CLIENT]`.

## 17. Points ouverts : demander, ne pas trancher
- Ce que dit l'email de confirmation sur le délai avant la session, puisque la
  cohorte se constitue à 10 stagiaires. **En attente de la réponse du client.**
- Ce qu'il advient d'un stagiaire dont la cohorte n'atteint jamais 10 :
  remboursement, report, ou autre. Même attente.
- Durée de conservation définitive et mention correspondante dans la politique
  de confidentialité.
- Logo, couleurs, visuels, textes légaux : fournis par le client.
