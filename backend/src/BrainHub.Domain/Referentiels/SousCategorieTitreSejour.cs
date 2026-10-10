namespace BrainHub.Domain.Referentiels;

/// <summary>
/// Une sous-categorie, affichee apres le choix de la famille principale
/// (CLAUDE.md §6). Exemple, pour ETU : « Etudiant », « Stagiaire », « Jeune au
/// pair ».
///
/// Elle est FACULTATIVE a l'inscription : seules la famille et la prefecture
/// bloquent la validation.
/// </summary>
public sealed class SousCategorieTitreSejour
{
    /// <summary>
    /// Identifiant technique. Le fichier de reference ne donne que des libelles,
    /// sans code : l'unicite metier est donc portee par le couple
    /// (CategorieCode, Libelle), sur lequel le chargement se cale pour rester
    /// idempotent.
    /// </summary>
    public int Id { get; set; }

    public required string CategorieCode { get; set; }

    public required string Libelle { get; set; }

    /// <summary>Rang d'affichage dans sa famille, tel que donne par le fichier.</summary>
    public int Ordre { get; set; }

    /// <summary>
    /// Faux pour une sous-categorie retiree du fichier. Jamais supprimee : une
    /// inscription peut la referencer.
    /// </summary>
    public bool Actif { get; set; } = true;

    public CategorieTitreSejour? Categorie { get; set; }
}
