using System.Text.Json;

using BrainHub.Domain.Referentiels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BrainHub.Infrastructure.Persistence.Seed;

/// <summary>
/// Charge les referentiels en base depuis le fichier versionne, a chaque
/// demarrage de l'application, de facon idempotente (CLAUDE.md §7).
///
/// Trois principes :
///   - Le fichier est la seule source. Aucune valeur n'est ecrite en dur.
///   - Relancer l'application n'a aucun effet visible si le fichier n'a pas
///     change. Dix demarrages donnent le meme resultat qu'un seul.
///   - Une ligne retiree du fichier est DESACTIVEE, jamais supprimee. Une
///     inscription peut la referencer, et la grille est appelee a evoluer :
///     supprimer casserait l'historique des inscriptions deja payees.
/// </summary>
public sealed class ChargeurReferentiels(
    BrainHubDbContext contexte,
    ILogger<ChargeurReferentiels> journal)
{
    private static readonly JsonSerializerOptions OptionsJson = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public async Task ChargerAsync(string cheminFichier, CancellationToken annulation = default)
    {
        if (!File.Exists(cheminFichier))
        {
            throw new FileNotFoundException(
                $"Le fichier de referentiels est introuvable : {cheminFichier}. " +
                "L'application ne peut pas demarrer sans lui : le formulaire " +
                "d'inscription a besoin de la liste des prefectures et des " +
                "categories de titre de sejour.",
                cheminFichier);
        }

        await using var flux = File.OpenRead(cheminFichier);
        var fichier = await JsonSerializer.DeserializeAsync<FichierReferentiels>(
            flux, OptionsJson, annulation)
            ?? throw new InvalidOperationException(
                $"Le fichier {cheminFichier} n'a pas pu etre lu.");

        ValiderFichier(fichier, cheminFichier);

        journal.LogInformation(
            "Chargement des referentiels, version {Version} : {NombreCategories} familles de titre, {NombreLignes} lignes territoriales",
            fichier.Version ?? "non datee",
            fichier.CategoriesTitreSejour.Count,
            fichier.ReferentielTerritorial.Count);

        // Une seule transaction : si quoi que ce soit echoue, la base reste dans
        // l'etat ou elle etait. Un referentiel a moitie charge serait pire que
        // pas de referentiel du tout.
        //
        // Le tout passe par la strategie d'execution du contexte, qui gere les
        // reprises sur echec reseau (EnableRetryOnFailure). Ouvrir une
        // transaction a la main sans elle est refuse par EF : en cas de coupure,
        // il ne saurait pas quoi rejouer.
        var categoriesTouchees = 0;
        var lignesTouchees = 0;

        var strategie = contexte.Database.CreateExecutionStrategy();
        await strategie.ExecuteAsync(async () =>
        {
            // Une nouvelle tentative doit repartir d'une ardoise propre : sans
            // cela, les entites suivies par la tentative precedente seraient
            // reappliquees et compteraient deux fois.
            contexte.ChangeTracker.Clear();
            categoriesTouchees = 0;
            lignesTouchees = 0;

            await using var transaction = await contexte.Database.BeginTransactionAsync(annulation);

            categoriesTouchees = await ChargerCategoriesAsync(fichier, annulation);
            lignesTouchees = await ChargerTerritoireAsync(fichier, annulation);

            await contexte.SaveChangesAsync(annulation);
            await transaction.CommitAsync(annulation);
        });

        if (categoriesTouchees + lignesTouchees == 0)
        {
            journal.LogInformation("Referentiels deja a jour, rien a ecrire");
        }
        else
        {
            journal.LogInformation(
                "Referentiels charges : {Categories} modification(s) sur les categories, {Lignes} sur le territoire",
                categoriesTouchees,
                lignesTouchees);
        }
    }

    /// <summary>
    /// Refus de charger un fichier manifestement incomplet. Mieux vaut un
    /// demarrage qui echoue avec un message clair qu'un formulaire en ligne dont
    /// la liste des prefectures est tronquee.
    /// </summary>
    private static void ValiderFichier(FichierReferentiels fichier, string chemin)
    {
        if (fichier.CategoriesTitreSejour.Count == 0)
        {
            throw new InvalidOperationException(
                $"{chemin} ne contient aucune categorie de titre de sejour.");
        }

        if (fichier.ReferentielTerritorial.Count == 0)
        {
            throw new InvalidOperationException(
                $"{chemin} ne contient aucune ligne territoriale.");
        }

        var codesEnDouble = fichier.CategoriesTitreSejour
            .GroupBy(categorie => categorie.Code, StringComparer.OrdinalIgnoreCase)
            .Where(groupe => groupe.Count() > 1)
            .Select(groupe => groupe.Key)
            .ToList();

        if (codesEnDouble.Count > 0)
        {
            throw new InvalidOperationException(
                $"{chemin} contient des codes de categorie en double : {string.Join(", ", codesEnDouble)}");
        }

        var departementsEnDouble = fichier.ReferentielTerritorial
            .GroupBy(ligne => ligne.Departement, StringComparer.OrdinalIgnoreCase)
            .Where(groupe => groupe.Count() > 1)
            .Select(groupe => groupe.Key)
            .ToList();

        if (departementsEnDouble.Count > 0)
        {
            throw new InvalidOperationException(
                $"{chemin} contient des departements en double : {string.Join(", ", departementsEnDouble)}");
        }
    }

    private async Task<int> ChargerCategoriesAsync(
        FichierReferentiels fichier,
        CancellationToken annulation)
    {
        var modifications = 0;

        var existantes = await contexte.CategoriesTitreSejour
            .Include(categorie => categorie.SousCategories)
            .ToDictionaryAsync(categorie => categorie.Code, annulation);

        var ordre = 0;
        foreach (var duFichier in fichier.CategoriesTitreSejour)
        {
            ordre++;

            if (!existantes.TryGetValue(duFichier.Code, out var categorie))
            {
                categorie = new CategorieTitreSejour
                {
                    Code = duFichier.Code,
                    Famille = duFichier.Famille,
                    PrecisionLibreObligatoire = duFichier.PrecisionLibreObligatoire,
                    Ordre = ordre,
                };
                contexte.CategoriesTitreSejour.Add(categorie);
                existantes[duFichier.Code] = categorie;
                modifications++;
            }
            else if (
                categorie.Famille != duFichier.Famille
                || categorie.PrecisionLibreObligatoire != duFichier.PrecisionLibreObligatoire
                || categorie.Ordre != ordre
                || !categorie.Actif)
            {
                categorie.Famille = duFichier.Famille;
                categorie.PrecisionLibreObligatoire = duFichier.PrecisionLibreObligatoire;
                categorie.Ordre = ordre;
                categorie.Actif = true;
                modifications++;
            }

            modifications += ChargerSousCategories(categorie, duFichier);
        }

        // Familles presentes en base mais absentes du fichier : desactivees.
        var codesDuFichier = fichier.CategoriesTitreSejour
            .Select(categorie => categorie.Code)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var orpheline in existantes.Values.Where(
            categorie => categorie.Actif && !codesDuFichier.Contains(categorie.Code)))
        {
            orpheline.Actif = false;
            foreach (var sousCategorie in orpheline.SousCategories.Where(s => s.Actif))
            {
                sousCategorie.Actif = false;
            }

            journal.LogWarning(
                "Famille {Code} absente du fichier : desactivee, pas supprimee",
                orpheline.Code);
            modifications++;
        }

        return modifications;
    }

    /// <summary>
    /// Les sous-categories n'ont pas de code dans le fichier, seulement un
    /// libelle. L'appariement se fait donc sur (famille, libelle), ce que la
    /// contrainte d'unicite de la table garantit.
    /// </summary>
    private int ChargerSousCategories(
        CategorieTitreSejour categorie,
        CategorieDuFichier duFichier)
    {
        var modifications = 0;
        var ordre = 0;

        foreach (var libelle in duFichier.SousCategories)
        {
            ordre++;
            var existante = categorie.SousCategories
                .FirstOrDefault(s => s.Libelle == libelle);

            if (existante is null)
            {
                categorie.SousCategories.Add(new SousCategorieTitreSejour
                {
                    CategorieCode = categorie.Code,
                    Libelle = libelle,
                    Ordre = ordre,
                });
                modifications++;
            }
            else if (existante.Ordre != ordre || !existante.Actif)
            {
                existante.Ordre = ordre;
                existante.Actif = true;
                modifications++;
            }
        }

        var libellesDuFichier = duFichier.SousCategories.ToHashSet(StringComparer.Ordinal);
        foreach (var orpheline in categorie.SousCategories.Where(
            s => s.Actif && !libellesDuFichier.Contains(s.Libelle)))
        {
            orpheline.Actif = false;
            modifications++;
        }

        return modifications;
    }

    private async Task<int> ChargerTerritoireAsync(
        FichierReferentiels fichier,
        CancellationToken annulation)
    {
        var modifications = 0;

        var existantes = await contexte.ReferentielTerritorial
            .ToDictionaryAsync(ligne => ligne.Departement, annulation);

        foreach (var duFichier in fichier.ReferentielTerritorial)
        {
            if (!existantes.TryGetValue(duFichier.Departement, out var ligne))
            {
                contexte.ReferentielTerritorial.Add(new LigneReferentielTerritorial
                {
                    Departement = duFichier.Departement,
                    NomDepartement = duFichier.NomDepartement,
                    Prefecture = duFichier.Prefecture,
                    TribunalJudiciaire = duFichier.TribunalJudiciaire,
                    BarreauRequis = duFichier.BarreauRequis,
                    Note = duFichier.Note,
                    DateDerniereVerification = fichier.DateDerniereVerification,
                });
                modifications++;
                continue;
            }

            if (ligne.NomDepartement != duFichier.NomDepartement
                || ligne.Prefecture != duFichier.Prefecture
                || ligne.TribunalJudiciaire != duFichier.TribunalJudiciaire
                || ligne.BarreauRequis != duFichier.BarreauRequis
                || ligne.Note != duFichier.Note
                || ligne.DateDerniereVerification != fichier.DateDerniereVerification
                || !ligne.Actif)
            {
                ligne.NomDepartement = duFichier.NomDepartement;
                ligne.Prefecture = duFichier.Prefecture;
                ligne.TribunalJudiciaire = duFichier.TribunalJudiciaire;
                ligne.BarreauRequis = duFichier.BarreauRequis;
                ligne.Note = duFichier.Note;
                ligne.DateDerniereVerification = fichier.DateDerniereVerification;
                ligne.Actif = true;
                modifications++;
            }
        }

        var departementsDuFichier = fichier.ReferentielTerritorial
            .Select(ligne => ligne.Departement)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var orpheline in existantes.Values.Where(
            ligne => ligne.Actif && !departementsDuFichier.Contains(ligne.Departement)))
        {
            orpheline.Actif = false;
            journal.LogWarning(
                "Departement {Departement} absent du fichier : desactive, pas supprime",
                orpheline.Departement);
            modifications++;
        }

        return modifications;
    }
}
