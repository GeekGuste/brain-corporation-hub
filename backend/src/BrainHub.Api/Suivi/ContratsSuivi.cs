namespace BrainHub.Api.Suivi;

public sealed record DemandeConnexion(string? Identifiant, string? MotDePasse);

public sealed record EtatSession(bool Connecte);

/// <summary>
/// Une inscription telle que la page de suivi l'affiche.
///
/// AUCUNE donnee de carte : il n'y en a pas en base, et il n'y en aura jamais
/// (CLAUDE.md §6 et §15).
///
/// Le barreau requis figure ici parce que c'est la raison d'etre de la page :
/// le gestionnaire constitue les groupes a la main a partir de lui. Le systeme
/// ne nomme jamais un avocat, il indique un barreau (CLAUDE.md §6).
/// </summary>
public sealed record InscriptionSuivie(
    Guid Id,
    DateTimeOffset? DateValidation,
    string Nom,
    string Prenom,
    string Email,
    string? Telephone,
    string StatutResidence,
    string CategorieCode,
    string CategorieFamille,
    string? SousCategorie,
    string? PrecisionAutreSituation,
    string Departement,
    string Prefecture,
    string TribunalJudiciaire,
    string BarreauRequis,
    string? PaysResidenceActuelle,
    DateOnly? DateArriveePrevisionnelle,
    string? CommuneOuCodePostalProjete,
    bool? FormationSuivie);

public sealed record DemandePresence(bool? Suivie);
