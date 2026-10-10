# Déploiement

Préprod et production tournent sur le **même VPS**, à partir de la **même image
Docker**, distinguées uniquement par leur fichier `.env`. Le tag validé en
préprod est promu en production sans reconstruction.

| | Préprod | Production |
| --- | --- | --- |
| Domaine | dev.braincorporationhub.com | braincorporationhub.com |
| Projet Compose | `brainhub-preprod` | `brainhub-prod` |
| Réseau Docker | `brainhub-preprod-net` | `brainhub-prod-net` |
| Sous-réseau | 172.28.0.0/24 | 172.29.0.0/24 |
| API | `127.0.0.1:8082` | `127.0.0.1:8080` |
| Serveur de rendu | `127.0.0.1:3001` | `127.0.0.1:3000` |
| Base | `brainhub_preprod` | `brainhub_prod` |
| Déclencheur | `develop`, automatique | `main`, après approbation |

## Installation initiale, une seule fois

L'ordre compte : PostgreSQL écoute sur les passerelles des réseaux Docker, qui
doivent donc exister avant lui.

```bash
# Depuis votre poste
scp -r deploy root@<vps>:/root/brainhub-install

# Sur le VPS, en root
cd /root/brainhub-install
chmod +x *.sh

./install-docker.sh         # Docker CE et le plugin Compose
./install-serveur.sh        # arborescence, réseaux, modèles de .env, ports
./install-postgresql.sh     # PostgreSQL 18, bases, utilisateurs, mots de passe
```

Si `install-serveur.sh` répond « Commande absente : docker », c'est que
`install-docker.sh` n'a pas encore tourné.

Puis, à la main :

1. **Clé SSH de la CI** dans `/home/deploy/.ssh/authorized_keys`.

2. **Accès au registre d'images.** Les images sont déposées par la CI sur
   ghcr.io, le registre de GitHub, et elles sont privées. Le VPS doit donc
   s'authentifier pour les télécharger.

   Sur github.com : Settings, Developer settings, Personal access tokens,
   **Tokens (classic)**, Generate new token (classic). Cochez **uniquement**
   `read:packages`. Prenez bien « classic » : les jetons fine-grained ont un
   support partiel de ghcr.io.

   ```bash
   sudo -iu deploy
   docker login ghcr.io -u GeekGuste
   # mot de passe demandé = le jeton, pas le mot de passe GitHub
   exit
   ```

   Se connecter **en tant que `deploy`** n'est pas décoratif. Docker enregistre
   les identifiants par utilisateur, dans `~/.docker/config.json`. La CI exécute
   le déploiement sous l'utilisateur `deploy` : une connexion faite en root
   donnerait un `docker pull` qui marche quand vous le testez à la main, et un
   déploiement qui échoue sur `denied`.

   Le `-i` de `sudo` ouvre un shell de connexion. Sans lui, `sudo` conserve le
   `HOME` de l'appelant et Docker écrirait dans `/root/.docker/`, ce qui produit
   le même symptôme.

   Le jeton est stocké encodé, pas chiffré, dans
   `/home/deploy/.docker/config.json`. C'est pour cela qu'il ne doit porter
   aucun autre droit que la lecture des images. Il est révocable depuis GitHub
   sans toucher au serveur.

3. **Plesk** : les deux domaines, Let's Encrypt sur chacun, les directives de
   [apache/directives-plesk.conf](apache/directives-plesk.conf), et la
   protection par mot de passe **sur les deux domaines** tant que les contenus
   du client ne sont pas intégrés.
4. **GitHub** : les secrets `VPS_HOTE`, `VPS_UTILISATEUR`, `VPS_CLE_SSH`, et un
   environnement `production` exigeant votre approbation.

## Ensuite, plus rien à faire

Un merge sur `develop` déploie la préprod. Un merge sur `main` construit
l'image puis attend votre validation dans l'onglet Actions.

Le script [deploy.sh](deploy.sh) fait, dans cet ordre : sauvegarde de la base,
bascule sur le nouveau tag, migrations au démarrage du conteneur, contrôle de
santé réel qui ouvre une connexion à PostgreSQL, et retour arrière automatique
sur le tag précédent si la santé ne répond pas en soixante secondes.

## Mise en ligne réelle

Quand les contenus seront intégrés et le site prêt, deux gestes suffisent, sans
redéploiement ni reconstruction :

```bash
# Sur le VPS
sed -i 's/^SITE_INDEXABLE=false/SITE_INDEXABLE=true/' /opt/brainhub/prod/.env
cd /opt/brainhub/prod && TAG_IMAGE=$(cat .tag-actuel) \
  docker compose -f docker-compose.prod.yml up -d
```

Et le retrait de la protection par mot de passe du domaine de production dans
Plesk.

## Vérifications après déploiement

```bash
# La production ne doit pas être indexable tant que le contenu n'est pas là
curl -I https://braincorporationhub.com/ | grep -i x-robots-tag

# Notre robots.txt, pas celui de Plesk (à partir de l'étape 10)
curl https://braincorporationhub.com/robots.txt

# Le site ne doit répondre ni sur l'IP du serveur ni sur le nom d'hôte IONOS
curl -I http://<ip-du-vps>/

# PostgreSQL ne doit écouter que sur localhost et les deux passerelles
ss -lnt | grep 5432
```

## Transférer le dépôt vers le compte du client

Le nom du compte GitHub n'est écrit nulle part dans le dépôt. Le workflow le
déduit du dépôt qui l'exécute et le met en minuscules, et les fichiers Compose
lisent le préfixe des images dans la variable `REGISTRE_IMAGES` du `.env`.

Un transfert ne demande donc aucune modification de code.

**Sur GitHub, côté client**

1. Transférer le dépôt (Settings, Danger Zone, Transfer ownership), ou le
   pousser vers un nouveau dépôt lui appartenant.
2. Recréer les secrets : `VPS_HOTE`, `VPS_UTILISATEUR`, `VPS_CLE_SSH`, et
   `VPS_PORT_SSH` si nécessaire.
3. Recréer les environnements `preprod` et `production`, avec l'approbation
   obligatoire sur `production`.

**Sur le VPS**

4. Changer une ligne dans chacun des deux `.env` :

   ```bash
   sed -i 's|^REGISTRE_IMAGES=.*|REGISTRE_IMAGES=ghcr.io/compte-du-client|' \
     /opt/brainhub/preprod/.env /opt/brainhub/prod/.env
   ```

   En minuscules : Docker refuse les majuscules dans un nom de dépôt d'images,
   et `deploy.sh` vérifie ce point avant de tirer quoi que ce soit.

5. Reconnecter `deploy` au registre, avec un jeton du compte du client :

   ```bash
   sudo -iu deploy
   docker logout ghcr.io
   docker login ghcr.io -u compte-du-client
   exit
   ```

6. Relancer `./verifier-serveur.sh`, puis pousser un commit pour reconstruire
   les images sous le nouveau compte.

**Ensuite**

Les anciennes images restées sur votre compte peuvent être supprimées, ce qui
libère l'espace de stockage. Gardez-les le temps de confirmer qu'un déploiement
complet passe sous le nouveau compte : jusque-là, elles sont votre seul retour
arrière.

## Retour arrière manuel

```bash
cd /opt/brainhub/prod
TAG_IMAGE=<sha-precedent> docker compose -f docker-compose.prod.yml up -d
```

Les sauvegardes prises avant chaque migration sont dans
`/opt/brainhub/<env>/sauvegardes/`, les dix dernières conservées.
