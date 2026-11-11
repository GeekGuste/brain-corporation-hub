using System.ComponentModel.DataAnnotations;

namespace BrainHub.Api.Suivi;

/// <summary>
/// Le compte administrateur unique de la page de suivi (CLAUDE.md §5.7).
///
/// Un seul compte, pas de gestion de roles, pas d'inscription : la gestion de
/// comptes utilisateurs est explicitement hors perimetre V1 (CLAUDE.md §8).
///
/// Le mot de passe n'est JAMAIS stocke en clair, ni ici, ni en base, ni dans la
/// configuration : seul son condensat y figure (CLAUDE.md §15). Pour le
/// produire, l'application sait le faire elle-meme :
///
///   dotnet run -- --hash-mot-de-passe "le mot de passe choisi"
///
/// Le resultat se pose dans Administration__HashMotDePasse, cote serveur.
/// </summary>
public sealed class OptionsAdministration
{
    public const string Section = "Administration";

    [Required(AllowEmptyStrings = false, ErrorMessage = "Administration:Identifiant est absent.")]
    public string Identifiant { get; init; } = string.Empty;

    /// <summary>
    /// Condensat du mot de passe, produit par PasswordHasher (PBKDF2 avec sel
    /// aleatoire et compteur d'iterations, format versionne par ASP.NET Core).
    /// </summary>
    [Required(AllowEmptyStrings = false, ErrorMessage = "Administration:HashMotDePasse est absent.")]
    public string HashMotDePasse { get; init; } = string.Empty;

    /// <summary>
    /// Duree de la session. Volontairement courte : la page affiche des donnees
    /// sensibles par nature, des situations administratives d'etrangers
    /// (CLAUDE.md §15). Un poste laisse ouvert ne doit pas le rester des jours.
    /// </summary>
    [Range(5, 1440)]
    public int MinutesDeSession { get; init; } = 480;
}
