using System.Text.Json.Serialization;

namespace BrainHub.Infrastructure.Persistence.Seed;

/// <summary>
/// Reflet exact du fichier data/referentiels.json.
///
/// Ces types ne servent qu'a le lire. Ils sont volontairement distincts des
/// entites du domaine : le fichier est une donnee d'entree fournie par le
/// client, son format peut evoluer independamment du schema de la base.
/// </summary>
public sealed class FichierReferentiels
{
    /// <summary>Version de la grille, telle que datee par le client. Journalisee au chargement.</summary>
    [JsonPropertyName("version")]
    public string? Version { get; set; }

    /// <summary>
    /// Date a laquelle le client a confronte la grille aux annuaires officiels.
    /// Nulle aujourd'hui : cette validation lui appartient et n'est pas faite.
    /// </summary>
    [JsonPropertyName("dateDerniereVerification")]
    public DateOnly? DateDerniereVerification { get; set; }

    [JsonPropertyName("categoriesTitreSejour")]
    public List<CategorieDuFichier> CategoriesTitreSejour { get; set; } = [];

    [JsonPropertyName("referentielTerritorial")]
    public List<LigneDuFichier> ReferentielTerritorial { get; set; } = [];
}

public sealed class CategorieDuFichier
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("famille")]
    public string Famille { get; set; } = string.Empty;

    [JsonPropertyName("sousCategories")]
    public List<string> SousCategories { get; set; } = [];

    [JsonPropertyName("precisionLibreObligatoire")]
    public bool PrecisionLibreObligatoire { get; set; }
}

public sealed class LigneDuFichier
{
    [JsonPropertyName("departement")]
    public string Departement { get; set; } = string.Empty;

    [JsonPropertyName("nomDepartement")]
    public string NomDepartement { get; set; } = string.Empty;

    [JsonPropertyName("prefecture")]
    public string Prefecture { get; set; } = string.Empty;

    [JsonPropertyName("tribunalJudiciaire")]
    public string TribunalJudiciaire { get; set; } = string.Empty;

    [JsonPropertyName("barreauRequis")]
    public string BarreauRequis { get; set; } = string.Empty;

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}
