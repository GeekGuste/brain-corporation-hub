#!/usr/bin/env bash
# =============================================================================
# Installation de Docker sur le VPS
# -----------------------------------------------------------------------------
# A lancer UNE SEULE FOIS, en root, AVANT install-serveur.sh.
#
#   sudo ./install-docker.sh
#
# Installe Docker CE depuis le depot officiel Docker, et non depuis les paquets
# de la distribution : ces derniers sont souvent en retard de plusieurs
# versions et n'incluent pas le plugin Compose v2, dont les fichiers de
# deploiement ont besoin.
# =============================================================================

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "A lancer en root." >&2
  exit 1
fi

journal() { echo "[$(date '+%H:%M:%S')] $*"; }

# -----------------------------------------------------------------------------
# 0. Garde-fous
# -----------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  journal "Docker et le plugin Compose sont deja installes :"
  docker --version
  docker compose version
  journal "Rien a faire. Passez a install-serveur.sh."
  exit 0
fi

# Plesk propose sa propre extension Docker. Si elle est installee, elle gere
# deja le demon et une installation par-dessus creerait deux gestionnaires pour
# la meme chose.
if [[ -d /usr/local/psa ]] && plesk bin extension --list 2>/dev/null | grep -qi docker; then
  journal "ATTENTION : l'extension Docker de Plesk semble installee."
  journal "Verifiez dans Plesk avant de continuer, puis relancez avec :"
  journal "  FORCER_INSTALLATION=oui $0"
  [[ "${FORCER_INSTALLATION:-}" == "oui" ]] || exit 1
fi

. /etc/os-release
case "${ID:-}" in
  debian | ubuntu) ;;
  *)
    echo "Distribution non geree par ce script : ${ID:-inconnue}" >&2
    echo "Suivez https://docs.docker.com/engine/install/ puis relancez" >&2
    echo "install-serveur.sh." >&2
    exit 1
    ;;
esac

journal "Distribution detectee : $ID ${VERSION_CODENAME:-}"

# -----------------------------------------------------------------------------
# 1. Depot officiel Docker
# -----------------------------------------------------------------------------
journal "Ajout du depot Docker"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg

install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://download.docker.com/linux/$ID/gpg" \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) \
signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/$ID ${VERSION_CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list

# -----------------------------------------------------------------------------
# 2. Installation
# -----------------------------------------------------------------------------
journal "Installation de Docker CE et du plugin Compose"
apt-get update -qq
apt-get install -y -qq \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable --now docker

# -----------------------------------------------------------------------------
# 3. Verification
# -----------------------------------------------------------------------------
journal ""
docker --version
docker compose version
journal ""

# Le sous-reseau par defaut de Docker (172.17.0.0/16) ne doit pas entrer en
# conflit avec ceux que install-serveur.sh va creer (172.28 et 172.29).
journal "Sous-reseaux Docker existants :"
docker network ls --format '{{.Name}}' | while read -r reseau; do
  sous_reseau="$(docker network inspect "$reseau" \
    --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null)"
  [[ -n "$sous_reseau" ]] && printf '  %-20s %s\n' "$reseau" "$sous_reseau"
done

journal ""
journal "Termine. Etape suivante : ./install-serveur.sh"
