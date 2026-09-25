# =============================================================================
# Image de l'API .NET
# -----------------------------------------------------------------------------
# Construite une seule fois par commit, taguee par SHA, puis lancee telle quelle
# en preprod et en production (CLAUDE.md §11). Elle ne contient AUCUN secret ni
# aucune valeur propre a un environnement : tout arrive par variables au
# lancement du conteneur.
#
# Contexte de build attendu : le repertoire backend/
# =============================================================================

# -----------------------------------------------------------------------------
# Etape 1 : compilation
# -----------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source

# Les fichiers projet d'abord : tant qu'ils ne changent pas, la restauration des
# paquets reste en cache et les builds suivants sont rapides.
COPY BrainHub.slnx ./
COPY src/BrainHub.Domain/BrainHub.Domain.csproj src/BrainHub.Domain/
COPY src/BrainHub.Infrastructure/BrainHub.Infrastructure.csproj src/BrainHub.Infrastructure/
COPY src/BrainHub.Api/BrainHub.Api.csproj src/BrainHub.Api/
RUN dotnet restore BrainHub.slnx

COPY src/ src/
RUN dotnet publish src/BrainHub.Api/BrainHub.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app

# -----------------------------------------------------------------------------
# Etape 2 : execution
# -----------------------------------------------------------------------------
# Image Debian et non Alpine : l'application manipule des libelles francais
# (villes-prefectures, noms de barreaux) et a besoin d'ICU pour les tris et les
# comparaisons. Les variantes Alpine ne l'embarquent pas.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Npgsql sonde la bibliotheque GSSAPI au premier chargement. Sans elle, la
# connexion fonctionne quand meme, mais chaque demarrage journalise une erreur.
# Un journal de production qui crie au loup pour rien finit par masquer les
# vrais problemes.
USER root
RUN apt-get update \
    && apt-get install --yes --no-install-recommends libgssapi-krb5-2 \
    && rm --recursive --force /var/lib/apt/lists/*

# Le referentiel territorial et la grille des categories, charges en base au
# demarrage (CLAUDE.md §7). Fichier versionne, jamais de valeur en dur.
COPY data/ /app/data/

COPY --from=build /app .

# Utilisateur non privilegie fourni par l'image .NET.
USER $APP_UID

# Kestrel ecoute sur ce port dans le conteneur. Le port publie sur l'hote est
# decide par le fichier compose : 8080 en production, 8082 en preprod, sur
# 127.0.0.1 uniquement.
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "BrainHub.Api.dll"]
