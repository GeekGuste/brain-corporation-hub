namespace BrainHub.Domain.Inscriptions;

/// <summary>
/// Un groupe de stagiaires.
///
/// HORS PERIMETRE V1. Le moteur de constitution des cohortes (groupes de dix,
/// compatibilite categorie et barreau, tri chronologique) fait l'objet d'un
/// avenant et ne doit pas etre developpe (CLAUDE.md §8).
///
/// L'entite existe quand meme dans le schema, parce que le §8 demande
/// explicitement de pouvoir accueillir ces objets « sans migration
/// douloureuse ». Aucun code de V1 ne la lit ni ne l'ecrit : la table reste
/// vide, et la cle etrangere de l'inscription reste nulle.
/// </summary>
public sealed class Cohorte
{
    public Guid Id { get; set; }

    /// <summary>Barreau commun aux stagiaires du groupe.</summary>
    public string? BarreauRequis { get; set; }

    /// <summary>Famille de titre de sejour commune au groupe.</summary>
    public string? CategorieCode { get; set; }

    public DateTimeOffset DateCreation { get; set; }

    /// <summary>Creneau retenu pour la session. Hors perimetre V1.</summary>
    public Guid? CreneauId { get; set; }

    public Creneau? Creneau { get; set; }

    public List<Inscription> Inscriptions { get; set; } = [];
}

/// <summary>
/// Un creneau de session.
///
/// HORS PERIMETRE V1, comme la cohorte : le module de planification
/// (lundi-vendredi, 8h30-18h00, capacite, effectif, etats) releve de l'avenant
/// (CLAUDE.md §8). Presente ici pour la meme raison, et inexploitee.
///
/// Aucune date de session n'est affichee nulle part sur le site ni dans les
/// emails tant que la regle de constitution des cohortes n'est pas tranchee
/// (CLAUDE.md §16).
/// </summary>
public sealed class Creneau
{
    public Guid Id { get; set; }

    public DateTimeOffset Debut { get; set; }

    public DateTimeOffset Fin { get; set; }

    /// <summary>Nombre de places. Hors perimetre V1.</summary>
    public int Capacite { get; set; }

    public List<Cohorte> Cohortes { get; set; } = [];
}
