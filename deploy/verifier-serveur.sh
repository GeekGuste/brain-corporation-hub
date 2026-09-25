#!/usr/bin/env bash
# =============================================================================
# Verification de l'installation du VPS
# -----------------------------------------------------------------------------
# A lancer en root apres les trois scripts d'installation, AVANT le premier
# deploiement.
#
#   sudo ./verifier-serveur.sh
#
# Il ne modifie rien. Il constate, et il dit ce qui manque.
# Mieux vaut trouver un probleme ici que dans un journal de CI.
# =============================================================================

set -uo pipefail

VERTS=0
ROUGES=0

ok()     { echo "  [ OK ]   $*"; VERTS=$((VERTS + 1)); }
echec()  { echo "  [ KO ]   $*"; ROUGES=$((ROUGES + 1)); }
info()   { echo "           $*"; }
titre()  { echo; echo "=== $* ==="; }

# -----------------------------------------------------------------------------
titre "Docker"
# -----------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  ok "Docker present : $(docker --version)"
else
  echec "Docker absent. Lancez install-docker.sh"
fi

if docker compose version >/dev/null 2>&1; then
  ok "Plugin Compose present : $(docker compose version --short 2>/dev/null)"
else
  echec "Plugin Compose absent"
fi

if systemctl is-enabled --quiet docker 2>/dev/null; then
  ok "Docker demarre automatiquement au boot"
else
  echec "Docker n'est pas active au boot : systemctl enable docker"
fi

# -----------------------------------------------------------------------------
titre "Reseaux Docker"
# -----------------------------------------------------------------------------
verifier_reseau() {
  local nom="$1" sous_reseau_attendu="$2" passerelle="$3"

  if ! docker network inspect "$nom" >/dev/null 2>&1; then
    echec "Reseau $nom absent. Lancez install-serveur.sh"
    return
  fi

  local sous_reseau
  sous_reseau="$(docker network inspect "$nom" \
    --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}')"

  if [[ "$sous_reseau" == "$sous_reseau_attendu" ]]; then
    ok "Reseau $nom sur $sous_reseau"
  else
    echec "Reseau $nom sur $sous_reseau, attendu $sous_reseau_attendu"
  fi

  # La passerelle doit exister sur l'hote : c'est l'adresse sur laquelle
  # PostgreSQL ecoute pour cet environnement.
  if ip -4 addr show | grep -q "$passerelle"; then
    ok "Passerelle $passerelle presente sur l'hote"
  else
    echec "Passerelle $passerelle absente de l'hote"
  fi
}

verifier_reseau brainhub-preprod-net 172.28.0.0/24 172.28.0.1
verifier_reseau brainhub-prod-net 172.29.0.0/24 172.29.0.1

# -----------------------------------------------------------------------------
titre "PostgreSQL"
# -----------------------------------------------------------------------------
if systemctl is-active --quiet postgresql; then
  ok "Service actif"
else
  echec "Service inactif"
fi

ECOUTES="$(ss -lnt 2>/dev/null | awk '$4 ~ /:5432$/ {print $4}')"
if [[ -z "$ECOUTES" ]]; then
  echec "PostgreSQL n'ecoute sur aucune adresse"
else
  info "Adresses d'ecoute :"
  while read -r adresse; do
    info "  $adresse"
  done <<< "$ECOUTES"

  # Le point critique : PostgreSQL ne doit jamais etre joignable depuis
  # l'exterieur (CLAUDE.md §10).
  if grep -qE '^(0\.0\.0\.0|\*):5432$' <<< "$ECOUTES"; then
    echec "PostgreSQL ecoute sur TOUTES les interfaces. A corriger d'urgence."
  else
    ok "PostgreSQL n'ecoute pas sur 0.0.0.0"
  fi

  for passerelle in 172.28.0.1 172.29.0.1; do
    if grep -q "^$passerelle:5432$" <<< "$ECOUTES"; then
      ok "Ecoute sur $passerelle"
    else
      echec "N'ecoute pas sur $passerelle : les conteneurs ne pourront pas se connecter"
    fi
  done
fi

# L'ordre de demarrage compte : PostgreSQL ecoute sur des adresses qui
# appartiennent a Docker. Au reboot, sans cette dependance, il demarre avant
# Docker et echoue.
if [[ -f /etc/systemd/system/postgresql@.service.d/apres-docker.conf ]]; then
  ok "Ordre de demarrage PostgreSQL apres Docker configure"
else
  echec "Dependance systemd absente : au redemarrage du serveur, PostgreSQL"
  info "         risque de demarrer avant Docker et de refuser de s'ouvrir."
fi

for base in brainhub_preprod brainhub_prod; do
  if sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$base'" 2>/dev/null | grep -q 1; then
    ok "Base $base presente"
  else
    echec "Base $base absente"
  fi

  if sudo -u postgres psql -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname = '$base'" 2>/dev/null | grep -q 1; then
    ok "Role $base present"
  else
    echec "Role $base absent"
  fi
done

# -----------------------------------------------------------------------------
titre "Cloisonnement des deux environnements"
# -----------------------------------------------------------------------------
# On verifie que pg_hba refuse bien ce qu'il doit refuser : l'utilisateur de
# preprod ne doit pas pouvoir atteindre la base de production, meme avec le bon
# mot de passe.
FICHIER_HBA="$(sudo -u postgres psql -tAc 'SHOW hba_file' 2>/dev/null)"
if [[ -n "$FICHIER_HBA" && -f "$FICHIER_HBA" ]]; then
  if grep -qE '^host\s+brainhub_preprod\s+brainhub_preprod\s+172\.28\.0\.0/24' "$FICHIER_HBA" \
    && grep -qE '^host\s+brainhub_prod\s+brainhub_prod\s+172\.29\.0\.0/24' "$FICHIER_HBA"; then
    ok "pg_hba.conf cloisonne les deux environnements par sous-reseau"
  else
    echec "pg_hba.conf ne contient pas les deux regles attendues"
    info "         Fichier : $FICHIER_HBA"
  fi
else
  echec "pg_hba.conf introuvable"
fi

# -----------------------------------------------------------------------------
titre "Arborescence et configuration"
# -----------------------------------------------------------------------------
for environnement in preprod prod; do
  repertoire="/opt/brainhub/$environnement"
  fichier_env="$repertoire/.env"

  if [[ ! -d "$repertoire" ]]; then
    echec "$repertoire absent"
    continue
  fi
  ok "$repertoire present"

  if [[ ! -d "$repertoire/sauvegardes" ]]; then
    echec "$repertoire/sauvegardes absent"
  fi

  if [[ ! -f "$fichier_env" ]]; then
    echec "$fichier_env absent"
    continue
  fi

  droits="$(stat -c '%a' "$fichier_env")"
  if [[ "$droits" == "600" ]]; then
    ok "$fichier_env en 600"
  else
    echec "$fichier_env en $droits, attendu 600 : il contient des secrets"
  fi

  # Le mot de passe est ecrit par install-postgresql.sh. S'il manque, l'API ne
  # demarrera pas et le deploiement fera un retour arriere.
  chaine="$(sed -n 's/^ConnectionStrings__BrainHub=//p' "$fichier_env")"
  if [[ "$chaine" =~ Password=[^\;]+ ]]; then
    ok "Mot de passe de base renseigne pour $environnement"
  else
    echec "Mot de passe de base VIDE pour $environnement"
  fi

  for variable in SITE_ALLOWED_HOSTS SITE_INDEXABLE PORT_API_HOTE PORT_SSR_HOTE; do
    valeur="$(sed -n "s/^$variable=//p" "$fichier_env")"
    if [[ -n "$valeur" ]]; then
      ok "$environnement : $variable=$valeur"
    else
      echec "$environnement : $variable non renseignee"
    fi
  done
done

# La production doit rester non indexable tant que les contenus du client ne
# sont pas integres.
if [[ -f /opt/brainhub/prod/.env ]]; then
  if grep -q '^SITE_INDEXABLE=false' /opt/brainhub/prod/.env; then
    ok "Production NON indexable, comme prevu a ce stade"
  else
    echec "Production indexable alors que le contenu n'est pas integre"
  fi
fi

# -----------------------------------------------------------------------------
titre "Utilisateur de deploiement"
# -----------------------------------------------------------------------------
if id deploy >/dev/null 2>&1; then
  ok "Utilisateur deploy present"

  if id -nG deploy | tr ' ' '\n' | grep -qx docker; then
    ok "deploy est dans le groupe docker"
  else
    echec "deploy n'est pas dans le groupe docker"
  fi

  cles="/home/deploy/.ssh/authorized_keys"
  if [[ -s "$cles" ]]; then
    ok "Cle SSH presente ($(grep -c . "$cles") ligne(s))"
  else
    echec "Aucune cle SSH dans $cles : la CI ne pourra pas se connecter"
  fi

  # Les identifiants du registre sont enregistres par utilisateur. Une
  # connexion faite en root ne sert a rien : c'est deploy qui tire les images.
  if [[ -f /home/deploy/.docker/config.json ]] \
    && grep -q 'ghcr.io' /home/deploy/.docker/config.json; then
    ok "deploy est connecte a ghcr.io"
  else
    echec "deploy n'est pas connecte a ghcr.io"
    info "         sudo -iu deploy"
    info "         docker login ghcr.io -u <compte>"
    info "         Le -i ouvre un shell de connexion : sans lui, sudo garde le"
    info "         HOME de l'appelant et docker ecrit ses identifiants au"
    info "         mauvais endroit."
  fi

  for environnement in preprod prod; do
    if sudo -u deploy test -r "/opt/brainhub/$environnement/.env" 2>/dev/null; then
      ok "deploy peut lire /opt/brainhub/$environnement/.env"
    else
      echec "deploy ne peut pas lire /opt/brainhub/$environnement/.env"
    fi
  done
else
  echec "Utilisateur deploy absent"
fi

# -----------------------------------------------------------------------------
titre "Ports"
# -----------------------------------------------------------------------------
for port in 8080 8082 3000 3001; do
  occupant="$(ss -lntp "sport = :$port" 2>/dev/null | awk 'NR>1 {print $NF}')"
  if [[ -z "$occupant" ]]; then
    ok "Port $port libre"
  else
    # Un port occupe par nos propres conteneurs est normal apres un premier
    # deploiement.
    if [[ "$occupant" == *docker* ]]; then
      info "Port $port occupe par Docker (deploiement deja en place)"
    else
      echec "Port $port occupe par : $occupant"
    fi
  fi
done

# -----------------------------------------------------------------------------
titre "Outils attendus par le script de deploiement"
# -----------------------------------------------------------------------------
for commande in pg_dump curl ss; do
  if command -v "$commande" >/dev/null 2>&1; then
    ok "$commande present"
  else
    echec "$commande absent : deploy.sh en a besoin"
  fi
done

# -----------------------------------------------------------------------------
echo
echo "============================================================"
echo "  $VERTS verification(s) reussie(s), $ROUGES en echec"
echo "============================================================"

if [[ $ROUGES -gt 0 ]]; then
  echo
  echo "Corrigez les points en echec avant le premier deploiement."
  exit 1
fi

echo
echo "Le serveur est pret. Il reste a poser les secrets GitHub et les"
echo "directives Apache dans Plesk."
exit 0
