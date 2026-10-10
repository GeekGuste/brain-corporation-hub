#!/usr/bin/env bash
# =============================================================================
# Installation initiale du VPS
# -----------------------------------------------------------------------------
# A lancer UNE SEULE FOIS, en root, avant le premier deploiement.
# Apres cela, tout passe par la CI et plus personne ne touche au serveur.
#
#   sudo ./install-serveur.sh
#
# Ce script ne fait que preparer le terrain : arborescence, reseaux Docker a
# sous-reseau fixe, modeles de fichiers .env, verification des ports.
# Il n'installe pas PostgreSQL : c'est install-postgresql.sh, a lancer ENSUITE,
# parce qu'il a besoin des passerelles creees ici.
# =============================================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "A lancer en root." >&2
  exit 1
fi

journal() { echo "[$(date '+%H:%M:%S')] $*"; }

RACINE="/opt/brainhub"
UTILISATEUR_DEPLOIEMENT="deploy"

# Compte GitHub qui heberge les images. Il est ecrit dans les fichiers .env, et
# nulle part dans le depot : le jour ou le depot est transfere au client, seuls
# ces deux fichiers changent, sur le serveur.
#
#   PROPRIETAIRE_GITHUB=compte-du-client ./install-serveur.sh
#
# Docker exige des minuscules, la conversion est faite ici.
PROPRIETAIRE_GITHUB="${PROPRIETAIRE_GITHUB:-geekguste}"
REGISTRE_IMAGES="ghcr.io/$(printf '%s' "$PROPRIETAIRE_GITHUB" | tr '[:upper:]' '[:lower:]')"

# -----------------------------------------------------------------------------
# 1. Prerequis
# -----------------------------------------------------------------------------
for commande in docker curl ss; do
  if ! command -v "$commande" >/dev/null 2>&1; then
    echo "Commande absente : $commande" >&2
    if [[ "$commande" == "docker" ]]; then
      echo "Lancez d'abord ./install-docker.sh" >&2
    fi
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "Le plugin Docker Compose est absent." >&2
  echo "Lancez d'abord ./install-docker.sh" >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# 2. Ports libres
# -----------------------------------------------------------------------------
# Verification faite maintenant plutot que decouverte au premier deploiement.
# Sur un poste de developpement, 8080 est frequemment deja pris par Docker
# Desktop ; sur un serveur Plesk, 8443 et 8880 le sont toujours.
journal "Verification des ports"
PORTS_OCCUPES=""
for port in 8080 8082 3000 3001; do
  if ss -lnt "sport = :$port" 2>/dev/null | grep -q LISTEN; then
    PORTS_OCCUPES="$PORTS_OCCUPES $port"
  fi
done

if [[ -n "$PORTS_OCCUPES" ]]; then
  echo "Ports deja occupes :$PORTS_OCCUPES" >&2
  echo "Liberez-les ou ajustez PORT_API_HOTE / PORT_SSR_HOTE dans les .env." >&2
  exit 1
fi
journal "Les quatre ports sont libres"

# -----------------------------------------------------------------------------
# 3. Utilisateur de deploiement
# -----------------------------------------------------------------------------
if ! id "$UTILISATEUR_DEPLOIEMENT" >/dev/null 2>&1; then
  journal "Creation de l'utilisateur $UTILISATEUR_DEPLOIEMENT"
  adduser --disabled-password --gecos "Deploiement Brain Corporation Hub" \
    "$UTILISATEUR_DEPLOIEMENT"
fi

# Il doit pouvoir piloter Docker sans mot de passe, sinon la CI ne peut rien
# faire. C'est un acces privilegie : cet utilisateur ne sert qu'a cela, et
# uniquement par cle SSH.
usermod --append --groups docker "$UTILISATEUR_DEPLOIEMENT"

install -d -m 700 -o "$UTILISATEUR_DEPLOIEMENT" -g "$UTILISATEUR_DEPLOIEMENT" \
  "/home/$UTILISATEUR_DEPLOIEMENT/.ssh"
touch "/home/$UTILISATEUR_DEPLOIEMENT/.ssh/authorized_keys"
chmod 600 "/home/$UTILISATEUR_DEPLOIEMENT/.ssh/authorized_keys"
chown "$UTILISATEUR_DEPLOIEMENT:$UTILISATEUR_DEPLOIEMENT" \
  "/home/$UTILISATEUR_DEPLOIEMENT/.ssh/authorized_keys"

# -----------------------------------------------------------------------------
# 4. Reseaux Docker a sous-reseau fixe
# -----------------------------------------------------------------------------
# Crees ici, et pas par Compose, pour deux raisons :
#   - PostgreSQL tourne sur l'hote et ecoute sur ces passerelles. Elles doivent
#     exister avant que PostgreSQL demarre, et survivre a un
#     « docker compose down ».
#   - Les sous-reseaux doivent etre previsibles pour que pg_hba.conf puisse
#     autoriser la preprod et la production separement.
creer_reseau() {
  local nom="$1" sous_reseau="$2"
  if docker network inspect "$nom" >/dev/null 2>&1; then
    journal "Reseau $nom deja present"
  else
    journal "Creation du reseau $nom ($sous_reseau)"
    docker network create --subnet "$sous_reseau" "$nom"
  fi
}

creer_reseau brainhub-preprod-net 172.28.0.0/24
creer_reseau brainhub-prod-net 172.29.0.0/24

# -----------------------------------------------------------------------------
# 5. Arborescence et modeles de .env
# -----------------------------------------------------------------------------
ecrire_modele_env() {
  local environnement="$1" port_api="$2" port_ssr="$3" hotes="$4" indexable="$5" \
    passerelle="$6" base="$7"
  local repertoire="$RACINE/$environnement"
  local fichier="$repertoire/.env"

  install -d -m 750 -o "$UTILISATEUR_DEPLOIEMENT" -g "$UTILISATEUR_DEPLOIEMENT" \
    "$repertoire" "$repertoire/sauvegardes"

  if [[ -f "$fichier" ]]; then
    journal "$fichier existe deja, laisse tel quel"
    return
  fi

  journal "Ecriture du modele $fichier"
  cat > "$fichier" <<EOF
# Environnement : $environnement
# Ecrit a la main, jamais versionne, jamais copie dans une image.
# Les valeurs vides sont a completer avant le premier deploiement.

# --- Images -------------------------------------------------------------------
# Prefixe des images a tirer. Seule ligne a changer si le depot est transfere
# vers un autre compte GitHub : le depot lui-meme n'a alors rien a modifier.
REGISTRE_IMAGES=$REGISTRE_IMAGES

# --- Ports publies sur 127.0.0.1 ---------------------------------------------
PORT_API_HOTE=$port_api
PORT_SSR_HOTE=$port_ssr

# --- Serveur de rendu ---------------------------------------------------------
# Toujours le domaine de production, meme en preprod : la canonique de la
# preprod doit pointer vers la production.
SITE_CANONICAL_BASE_URL=https://braincorporationhub.com
SITE_INDEXABLE=$indexable
SITE_ALLOWED_HOSTS=$hotes

# --- Base de donnees ----------------------------------------------------------
# L'hote est la passerelle du reseau Docker de cet environnement : PostgreSQL
# tourne sur la machine, pas dans un conteneur.
# Le mot de passe est genere par install-postgresql.sh.
ConnectionStrings__BrainHub=Host=$passerelle;Port=5432;Database=$base;Username=$base;Password=

# --- A completer aux etapes suivantes -----------------------------------------
# Stripe__ClePubliable=
# Stripe__CleSecrete=
# Stripe__SecretWebhook=
# Mailjet__CleApi=
# Mailjet__CleSecrete=
# Administration__Identifiant=
# Administration__HachageMotDePasse=
EOF

  chmod 600 "$fichier"
  chown "$UTILISATEUR_DEPLOIEMENT:$UTILISATEUR_DEPLOIEMENT" "$fichier"
}

# La production part NON indexable et protegee par mot de passe Plesk : tant
# que les contenus du client ne sont pas integres, rien ne doit etre visible ni
# indexable. La bascule se fera en changeant cette seule variable, sans
# redeploiement.
ecrire_modele_env preprod 8082 3001 dev.braincorporationhub.com false \
  172.28.0.1 brainhub_preprod
ecrire_modele_env prod 8080 3000 \
  braincorporationhub.com,www.braincorporationhub.com false \
  172.29.0.1 brainhub_prod

# -----------------------------------------------------------------------------
# 6. Acces au registre d'images
# -----------------------------------------------------------------------------
journal ""
journal "Installation terminee. Il reste trois choses a faire a la main :"
journal ""
journal "  1. Coller la cle publique SSH de la CI dans :"
journal "     /home/$UTILISATEUR_DEPLOIEMENT/.ssh/authorized_keys"
journal ""
journal "  2. Autoriser le serveur a tirer les images, avec un jeton GitHub"
journal "     ayant la portee read:packages :"
journal "     sudo -u $UTILISATEUR_DEPLOIEMENT docker login ghcr.io -u <compte>"
journal ""
journal "  3. Lancer ./install-postgresql.sh, qui completera les mots de passe"
journal "     dans les deux fichiers .env."
