#!/usr/bin/env bash
# =============================================================================
# Installation et configuration de PostgreSQL sur l'hote
# -----------------------------------------------------------------------------
# A lancer UNE SEULE FOIS, en root, APRES install-serveur.sh : ce script a
# besoin des passerelles des reseaux Docker, qui doivent deja exister.
#
#   sudo ./install-postgresql.sh
#
# Ce qu'il met en place (CLAUDE.md §10) :
#   - PostgreSQL 18, installe sur l'hote et non en conteneur
#   - ecoute sur localhost et sur les deux passerelles Docker, rien d'autre
#   - deux bases et deux utilisateurs distincts, chacun sans droit sur l'autre
#   - separation renforcee par pg_hba : chaque utilisateur n'est accepte que
#     depuis le sous-reseau de son propre environnement
# =============================================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "A lancer en root." >&2
  exit 1
fi

journal() { echo "[$(date '+%H:%M:%S')] $*"; }

VERSION_PG=18
PASSERELLE_PREPROD=172.28.0.1
PASSERELLE_PROD=172.29.0.1
SOUS_RESEAU_PREPROD=172.28.0.0/24
SOUS_RESEAU_PROD=172.29.0.0/24

# -----------------------------------------------------------------------------
# 0. Garde-fous
# -----------------------------------------------------------------------------
# Plesk sait gerer ses propres instances de bases de donnees. Si une
# installation PostgreSQL existe deja, on s'arrete : ecraser la configuration
# d'un serveur en production se repare mal.
if command -v psql >/dev/null 2>&1 && systemctl is-active --quiet postgresql; then
  journal "PostgreSQL est deja installe et actif."
  journal "Ce script ne modifie pas une installation existante."
  journal "Reprenez les sections 3 a 5 a la main, ou desinstallez d'abord."
  exit 1
fi

for passerelle in "$PASSERELLE_PREPROD" "$PASSERELLE_PROD"; do
  if ! ip -4 addr show | grep -q "$passerelle"; then
    echo "La passerelle $passerelle n'existe pas." >&2
    echo "Lancez d'abord install-serveur.sh, qui cree les reseaux Docker." >&2
    exit 1
  fi
done

# -----------------------------------------------------------------------------
# 1. Installation
# -----------------------------------------------------------------------------
journal "Installation de PostgreSQL $VERSION_PG depuis le depot officiel PGDG"
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release

install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc

echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list

apt-get update -qq
apt-get install -y -qq "postgresql-$VERSION_PG" "postgresql-client-$VERSION_PG"

REPERTOIRE_CONF="/etc/postgresql/$VERSION_PG/main"

# -----------------------------------------------------------------------------
# 2. Ecoute reseau
# -----------------------------------------------------------------------------
# Localhost et les deux passerelles Docker, rien de plus. Le serveur n'est
# jamais joignable depuis l'exterieur, meme si le pare-feu tombait.
journal "Configuration de l'ecoute"
cat > "$REPERTOIRE_CONF/conf.d/brainhub.conf" <<EOF
# Pose par install-postgresql.sh. Ne pas editer a la main sans raison.
listen_addresses = 'localhost,$PASSERELLE_PREPROD,$PASSERELLE_PROD'
password_encryption = 'scram-sha-256'
EOF

# -----------------------------------------------------------------------------
# 3. Authentification
# -----------------------------------------------------------------------------
# Chaque utilisateur n'est accepte que depuis le sous-reseau de son propre
# environnement, et seulement vers sa propre base. Meme avec le bon mot de
# passe, un conteneur de preprod est refuse par la base de production.
journal "Configuration de pg_hba.conf"
FICHIER_HBA="$REPERTOIRE_CONF/pg_hba.conf"
cp "$FICHIER_HBA" "$FICHIER_HBA.origine"

cat > "$FICHIER_HBA" <<EOF
# Pose par install-postgresql.sh. L'original est dans pg_hba.conf.origine

# Administration locale
local   all             postgres                                peer
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256

# Preprod : uniquement depuis le reseau Docker de preprod, vers sa seule base
host    brainhub_preprod    brainhub_preprod    $SOUS_RESEAU_PREPROD    scram-sha-256

# Production : uniquement depuis le reseau Docker de production
host    brainhub_prod       brainhub_prod       $SOUS_RESEAU_PROD       scram-sha-256
EOF

systemctl restart postgresql
journal "PostgreSQL redemarre"

# -----------------------------------------------------------------------------
# 4. Demarrage apres Docker
# -----------------------------------------------------------------------------
# PostgreSQL ecoute sur des adresses qui appartiennent a Docker. Au redemarrage
# du serveur, si PostgreSQL demarre avant le demon Docker, ces adresses
# n'existent pas encore et le service refuse de se lancer. Ce reglage impose
# l'ordre.
journal "Ordre de demarrage : PostgreSQL apres Docker"
install -d /etc/systemd/system/postgresql@.service.d
cat > /etc/systemd/system/postgresql@.service.d/apres-docker.conf <<'EOF'
# Pose par install-postgresql.sh.
# PostgreSQL ecoute sur les passerelles des reseaux Docker : elles doivent
# exister avant qu'il demarre.
[Unit]
After=docker.service
Wants=docker.service
EOF
systemctl daemon-reload

# -----------------------------------------------------------------------------
# 5. Bases et utilisateurs
# -----------------------------------------------------------------------------
creer_environnement() {
  local nom="$1"
  local mot_de_passe
  mot_de_passe="$(openssl rand -base64 30 | tr -d '/+=' | head -c 32)"

  journal "Creation du role et de la base $nom"

  sudo -u postgres psql --quiet --no-psqlrc <<EOF
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$nom') THEN
    CREATE ROLE $nom LOGIN PASSWORD '$mot_de_passe';
  ELSE
    ALTER ROLE $nom PASSWORD '$mot_de_passe';
  END IF;
END
\$\$;
EOF

  if ! sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$nom'" | grep -q 1; then
    sudo -u postgres createdb --owner="$nom" "$nom"
  fi

  # Aucun autre role ne doit pouvoir se connecter a cette base, ni creer quoi
  # que ce soit dans son schema public.
  sudo -u postgres psql --quiet --no-psqlrc --dbname="$nom" <<EOF
REVOKE ALL ON DATABASE $nom FROM PUBLIC;
GRANT CONNECT ON DATABASE $nom TO $nom;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO $nom;
EOF

  # Le mot de passe est ecrit directement dans le .env de l'environnement, pour
  # qu'il ne transite ni par un copier-coller ni par l'historique du shell.
  local fichier_env="/opt/brainhub/${nom#brainhub_}/.env"
  if [[ -f "$fichier_env" ]]; then
    sed -i "s|^ConnectionStrings__BrainHub=\(.*\)Password=.*$|ConnectionStrings__BrainHub=\1Password=$mot_de_passe|" \
      "$fichier_env"
    journal "Mot de passe ecrit dans $fichier_env"
  else
    journal "ATTENTION : $fichier_env introuvable."
    journal "Mot de passe de $nom : $mot_de_passe"
  fi
}

creer_environnement brainhub_preprod
creer_environnement brainhub_prod

# -----------------------------------------------------------------------------
# 6. Verification
# -----------------------------------------------------------------------------
journal ""
journal "Adresses d'ecoute effectives :"
ss -lnt | grep -E ':5432' || true
journal ""
journal "Termine. Verifiez qu'aucune ligne ne montre 0.0.0.0:5432."
