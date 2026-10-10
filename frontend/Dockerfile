# =============================================================================
# Image du serveur de rendu Angular
# -----------------------------------------------------------------------------
# Une seule image pour les deux environnements. Rien de propre a un
# environnement n'est compile dedans : l'URL canonique, l'indexabilite et les
# hotes autorises sont lus dans process.env au lancement, puis transmis au
# navigateur par l'etat transfere (voir src/app/core/config/runtime-config.ts).
#
# C'est ce qui permet de promouvoir en production le tag exact valide en
# preprod, sans reconstruction (CLAUDE.md §11).
#
# Contexte de build attendu : le repertoire frontend/
# =============================================================================

# -----------------------------------------------------------------------------
# Etape 1 : dependances et compilation
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /source

# Les manifestes d'abord, pour garder l'installation en cache tant que les
# dependances ne bougent pas.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# -----------------------------------------------------------------------------
# Etape 2 : execution
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS final
WORKDIR /app

ENV NODE_ENV=production

# Seul le resultat du build est embarque : ni sources, ni node_modules de
# developpement. Le serveur rendu par Angular embarque ses dependances.
COPY --from=build /source/dist/frontend ./

# Utilisateur non privilegie fourni par l'image Node.
USER node

# Port d'ecoute dans le conteneur. Le port publie sur l'hote est decide par le
# fichier compose : 3000 en production, 3001 en preprod, sur 127.0.0.1
# uniquement.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/server.mjs"]
