#!/usr/bin/env bash
# =============================================================================
# Deploiement d'un environnement sur le VPS
# -----------------------------------------------------------------------------
# Lance par la CI via SSH, depuis /opt/brainhub/<environnement>/.
#
#   ./deploy.sh preprod a3f9c21e...
#   ./deploy.sh prod    a3f9c21e...
#
# Enchainement :
#   1. sauvegarde de la base, AVANT toute migration
#   2. bascule sur le nouveau tag
#   3. controle de sante reel, qui ouvre une connexion a PostgreSQL
#   4. retour arriere automatique sur le tag precedent en cas d'echec
#
# La CI n'a jamais la chaine de connexion : elle appelle ce script, et c'est ce
# script, sur le serveur, qui parle a PostgreSQL (CLAUDE.md §11).
# =============================================================================

set -euo pipefail

ENVIRONNEMENT="${1:-}"
TAG="${2:-}"

if [[ -z "$ENVIRONNEMENT" || -z "$TAG" ]]; then
  echo "Usage : $0 <preprod|prod> <tag>" >&2
  exit 1
fi

if [[ "$ENVIRONNEMENT" != "preprod" && "$ENVIRONNEMENT" != "prod" ]]; then
  echo "Environnement inconnu : $ENVIRONNEMENT" >&2
  exit 1
fi

REPERTOIRE="/opt/brainhub/$ENVIRONNEMENT"
COMPOSE="$REPERTOIRE/docker-compose.$ENVIRONNEMENT.yml"
FICHIER_ENV="$REPERTOIRE/.env"
FICHIER_TAG="$REPERTOIRE/.tag-actuel"
SAUVEGARDES="$REPERTOIRE/sauvegardes"

cd "$REPERTOIRE"

for fichier in "$COMPOSE" "$FICHIER_ENV"; do
  if [[ ! -f "$fichier" ]]; then
    echo "Fichier manquant : $fichier" >&2
    echo "L'installation initiale n'a pas ete faite. Voir deploy/install-serveur.sh" >&2
    exit 1
  fi
done

journal() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# -----------------------------------------------------------------------------
# Lecture de la configuration
# -----------------------------------------------------------------------------
# On extrait les valeurs du .env sans l'executer : un fichier de configuration
# n'a pas a etre interprete comme du shell.
lire_variable() {
  sed -n "s/^$1=//p" "$FICHIER_ENV" | tail -n 1
}

# La chaine de connexion est la seule source de verite pour la base. On en
# derive les parametres de la sauvegarde plutot que de les redeclarer ailleurs,
# ou ils finiraient par diverger.
CHAINE_CONNEXION="$(lire_variable 'ConnectionStrings__BrainHub')"
extraire_champ() {
  echo "$CHAINE_CONNEXION" | tr ';' '\n' | sed -n "s/^ *$1 *= *//Ip" | tail -n 1
}

BASE_HOTE="$(extraire_champ 'Host')"
BASE_PORT="$(extraire_champ 'Port')"
BASE_NOM="$(extraire_champ 'Database')"
BASE_UTILISATEUR="$(extraire_champ 'Username')"
BASE_MOT_DE_PASSE="$(extraire_champ 'Password')"

PORT_API_HOTE="$(lire_variable 'PORT_API_HOTE')"
PORT_SSR_HOTE="$(lire_variable 'PORT_SSR_HOTE')"
REGISTRE_IMAGES="$(lire_variable 'REGISTRE_IMAGES')"

for variable in BASE_NOM PORT_API_HOTE PORT_SSR_HOTE REGISTRE_IMAGES; do
  if [[ -z "${!variable}" ]]; then
    echo "Configuration incomplete dans $FICHIER_ENV : $variable manquant" >&2
    exit 1
  fi
done

# Docker refuse toute majuscule dans un nom de depot d'images. Autant le dire
# ici, clairement, plutot que de laisser « docker compose pull » echouer sur un
# message obscur.
if [[ "$REGISTRE_IMAGES" != "$(printf '%s' "$REGISTRE_IMAGES" | tr '[:upper:]' '[:lower:]')" ]]; then
  echo "REGISTRE_IMAGES contient des majuscules : $REGISTRE_IMAGES" >&2
  echo "Docker exige un nom entierement en minuscules." >&2
  exit 1
fi

TAG_PRECEDENT=""
[[ -f "$FICHIER_TAG" ]] && TAG_PRECEDENT="$(cat "$FICHIER_TAG")"

journal "Environnement : $ENVIRONNEMENT"
journal "Tag demande  : $TAG"
journal "Tag en place : ${TAG_PRECEDENT:-aucun}"

# -----------------------------------------------------------------------------
# 1. Sauvegarde de la base, avant toute migration
# -----------------------------------------------------------------------------
mkdir -p "$SAUVEGARDES"
HORODATAGE="$(date '+%Y%m%d-%H%M%S')"
FICHIER_SAUVEGARDE="$SAUVEGARDES/avant-$TAG-$HORODATAGE.dump"

journal "Sauvegarde de $BASE_NOM vers $FICHIER_SAUVEGARDE"
PGPASSWORD="$BASE_MOT_DE_PASSE" pg_dump \
  --host="$BASE_HOTE" \
  --port="${BASE_PORT:-5432}" \
  --username="$BASE_UTILISATEUR" \
  --dbname="$BASE_NOM" \
  --format=custom \
  --file="$FICHIER_SAUVEGARDE"

# On garde les dix dernieres. La sauvegarde quotidienne externalisee couvre le
# long terme ; celle-ci sert au retour arriere immediat.
ls -1t "$SAUVEGARDES"/avant-*.dump 2>/dev/null | tail -n +11 | xargs -r rm --

# -----------------------------------------------------------------------------
# 2. Bascule sur le nouveau tag
# -----------------------------------------------------------------------------
demarrer() {
  local tag="$1"
  journal "Demarrage du tag $tag"
  TAG_IMAGE="$tag" docker compose --file "$COMPOSE" pull --quiet
  TAG_IMAGE="$tag" docker compose --file "$COMPOSE" up --detach --remove-orphans
}

# -----------------------------------------------------------------------------
# 3. Controle de sante
# -----------------------------------------------------------------------------
# /sante/pret ouvre une vraie connexion a PostgreSQL : si une migration a
# echoue, ou si la base est injoignable, ce controle le voit.
attendre_sante() {
  local tentatives=30
  local attente=2

  for ((i = 1; i <= tentatives; i++)); do
    local api_ok=0 ssr_ok=0

    curl --silent --fail --max-time 5 \
      "http://127.0.0.1:$PORT_API_HOTE/sante/pret" >/dev/null 2>&1 && api_ok=1

    curl --silent --fail --max-time 10 \
      --header "Host: $(lire_variable 'SITE_ALLOWED_HOSTS' | cut -d, -f1)" \
      "http://127.0.0.1:$PORT_SSR_HOTE/" >/dev/null 2>&1 && ssr_ok=1

    if [[ $api_ok -eq 1 && $ssr_ok -eq 1 ]]; then
      journal "Sante confirmee apres $((i * attente)) secondes"
      return 0
    fi

    sleep "$attente"
  done

  journal "ECHEC : API=$api_ok SSR=$ssr_ok apres $((tentatives * attente)) secondes"
  return 1
}

demarrer "$TAG"

if attendre_sante; then
  echo "$TAG" > "$FICHIER_TAG"
  journal "Deploiement reussi : $TAG"
  # On ne purge que les images sans conteneur, en gardant les recentes : le tag
  # precedent doit rester disponible pour un retour arriere manuel.
  docker image prune --force --filter 'until=168h' >/dev/null 2>&1 || true
  exit 0
fi

# -----------------------------------------------------------------------------
# 4. Retour arriere
# -----------------------------------------------------------------------------
journal "Le nouveau tag ne repond pas. Journaux des conteneurs :"
TAG_IMAGE="$TAG" docker compose --file "$COMPOSE" logs --tail=50 || true

if [[ -z "$TAG_PRECEDENT" ]]; then
  journal "Aucun tag precedent : rien a restaurer. Premier deploiement en echec."
  exit 1
fi

journal "Retour arriere sur $TAG_PRECEDENT"
demarrer "$TAG_PRECEDENT"

if attendre_sante; then
  journal "Retour arriere reussi. La sauvegarde de la base est dans $FICHIER_SAUVEGARDE"
  journal "ATTENTION : si une migration s'est appliquee, le schema peut etre en avance"
  journal "sur le code restaure. Restaurer la sauvegarde si l'application se comporte mal :"
  journal "  pg_restore --clean --if-exists -d $BASE_NOM $FICHIER_SAUVEGARDE"
else
  journal "Le retour arriere a echoue lui aussi. Intervention manuelle necessaire."
fi

exit 1
