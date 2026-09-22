# Brain Corporation Hub / Lignes Rouges

Site de vente de la formation Lignes Rouges : pages publiques, formulaire
d'inscription qualifie, paiement Stripe integre a la page, emails automatiques,
page de suivi des inscriptions.

Le perimetre contractuel, les regles de redaction et les decisions arretees sont
dans [CLAUDE.md](CLAUDE.md). Les documents du client sont dans [docs/](docs/).

## Arborescence

```
frontend/                 Angular 21 avec rendu serveur
  src/content/fr/         textes du site, fournis par le client
  src/seo/                URL centralisees, titres et meta par page
  src/styles/_theme.scss  LE fichier de variables de theme
backend/
  src/BrainHub.Domain     entites et regles metier
  src/BrainHub.Infrastructure  persistance PostgreSQL, migrations
  src/BrainHub.Api        API REST
  database/               PostgreSQL de developpement
  data/                   referentiels.json, charge en base au demarrage
docs/                     cahier des charges et contenus du client
.env.example              inventaire des variables d'environnement
```

## Demarrer en local

Prerequis : Node 22.12 ou plus, .NET 10, Docker.

```bash
# 1. PostgreSQL de developpement (port 5433)
docker compose -f backend/database/docker-compose.yml up -d

# 2. API (port 5080)
cd backend/src/BrainHub.Api
dotnet run

# 3. Front (port 4200, /api est achemine vers l'API)
cd frontend
npm install
npm start
```

Verifier que l'API voit bien la base :

```bash
curl http://localhost:5080/sante/pret     # Healthy si PostgreSQL repond
curl http://localhost:5080/sante/vivant   # Healthy des que le processus tourne
```

## Verifier que le rendu serveur est reel

Le HTML doit etre complet au premier chargement, JavaScript desactive
(CLAUDE.md §12).

```bash
cd frontend
npm run build
PORT=3000 SITE_ALLOWED_HOSTS=localhost,127.0.0.1 \
  SITE_CANONICAL_BASE_URL=https://braincorporationhub.com \
  SITE_INDEXABLE=false \
  node dist/frontend/server/server.mjs

curl -s http://localhost:3000/lignes-rouges | grep -E '<h1|<title'
```

## Ports

| Service | Local | Preprod | Production |
| --- | --- | --- | --- |
| PostgreSQL | 5433 (conteneur) | 5432 sur l'hote | 5432 sur l'hote |
| API .NET | 5080 | `127.0.0.1:8082` | `127.0.0.1:8080` |
| Serveur SSR | 4200 (`ng serve`) | `127.0.0.1:3001` | `127.0.0.1:3000` |

En local, l'API n'ecoute pas sur 8080 : ce port est souvent deja pris, notamment
par Docker Desktop.

## Secrets

Aucun secret dans le depot ni dans les images. Voir [.env.example](.env.example)
pour l'inventaire des variables, et CLAUDE.md §11 pour leur emplacement sur le
serveur.
