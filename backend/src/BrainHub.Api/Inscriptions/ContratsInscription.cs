namespace BrainHub.Api.Inscriptions;

/// <summary>
/// Ce que le formulaire envoie.
///
/// Tous les champs sont nullables ici, meme ceux qui sont obligatoires : une
/// requete incomplete doit produire un message d'erreur par champ, pas un rejet
/// de desserialisation illisible (CLAUDE.md §13). L'obligation est verifiee par
/// <see cref="ServiceInscription"/>, cote serveur, et jamais seulement dans le
/// formulaire (CLAUDE.md §15).
/// </summary>
public sealed record DemandeInscription
{
    public string? Nom { get; init; }

    public string? Prenom { get; init; }

    public string? Email { get; init; }

    /// <summary>Facultatif (CLAUDE.md §16).</summary>
    public string? Telephone { get; init; }

    /// <summary>« ResidentEnFrance » ou « ResidentALEtranger ».</summary>
    public string? StatutResidence { get; init; }

    public string? CategorieCode { get; init; }

    /// <summary>Facultative : elle ne bloque pas la validation (CLAUDE.md §6).</summary>
    public int? SousCategorieId { get; init; }

    /// <summary>Obligatoire pour la seule famille AUT.</summary>
    public string? PrecisionAutreSituation { get; init; }

    /// <summary>
    /// Numero de departement de la prefecture : de residence actuelle, ou
    /// PROJETEE pour un resident a l'etranger.
    /// </summary>
    public string? DepartementPrefecture { get; init; }

    /// <summary>Obligatoire pour un resident a l'etranger.</summary>
    public string? PaysResidenceActuelle { get; init; }

    /// <summary>Facultative, « si connue ».</summary>
    public DateOnly? DateArriveePrevisionnelle { get; init; }

    /// <summary>Facultatif, « si connu ».</summary>
    public string? CommuneOuCodePostalProjete { get; init; }

    /// <summary>
    /// Vrai quand le visiteur a explicitement confirme vouloir une inscription
    /// supplementaire sur un email deja inscrit (CLAUDE.md §6). Sans cette
    /// confirmation, l'API refuse et renvoie le code « doublon-email ».
    /// </summary>
    public bool DoublonEmailConfirme { get; init; }
}

/// <summary>
/// Ce que l'API renvoie apres creation. L'inscription est au statut
/// « en attente de paiement » : rien n'est confirme, aucun email n'est parti.
///
/// Le « client_secret » permet au navigateur d'afficher le Payment Element et
/// de parler DIRECTEMENT a Stripe. Les numeros de carte ne touchent jamais
/// notre serveur (CLAUDE.md §6 et §15).
///
/// La cle publiable accompagne la reponse plutot que d'etre figee dans le
/// paquet du front : la preprod tourne en cles de test et la production en cles
/// live, et c'est la meme image qui sert les deux (CLAUDE.md §11 et §16).
/// </summary>
public sealed record ReponseInscription(
    Guid Id,
    string Statut,
    string PrefectureLibelle,
    string TribunalJudiciaireReference,
    string BarreauRequis,
    int MontantCentimes,
    string Devise,
    string ClientSecret,
    string ClePubliable);

/// <summary>
/// Etat d'une inscription, interroge par la page apres le retour de Stripe
/// (CLAUDE.md §9.6).
///
/// Ne renvoie QUE le statut : ni nom, ni email, ni categorie. L'identifiant est
/// un GUID non devinable, mais cela ne justifie pas d'y exposer des donnees
/// personnelles.
/// </summary>
public sealed record ReponseStatutInscription(string Statut);

/// <summary>
/// Reponse du controle de doublon.
///
/// Un BOOLEEN, et rien d'autre : jamais un nom, une date ni une categorie.
/// Sinon cet endpoint deviendrait un moyen de tester si telle personne est
/// inscrite a une formation sur le droit au sejour (CLAUDE.md §15).
/// </summary>
public sealed record ReponseVerificationEmail(bool DejaInscrit);

public sealed record DemandeVerificationEmail(string? Email);

// =============================================================================
// Referentiels exposes au formulaire
// =============================================================================

public sealed record SousCategorieExposee(int Id, string Libelle);

public sealed record CategorieExposee(
    string Code,
    string Famille,
    bool PrecisionLibreObligatoire,
    IReadOnlyList<SousCategorieExposee> SousCategories);

/// <summary>
/// Une prefecture proposee dans la liste du formulaire.
///
/// Le tribunal judiciaire et le barreau sont renvoyes avec, pour que le
/// formulaire puisse afficher le rattachement des le choix de la prefecture,
/// sans second aller-retour. Ils sont de toute facon publics : la page du
/// referentiel (etape 8) montre la grille entiere en lecture seule.
///
/// Aucun nom d'avocat n'est renvoye, et il n'y en a aucun en base : le systeme
/// nomme un barreau, jamais une personne (CLAUDE.md §6).
/// </summary>
public sealed record PrefectureExposee(
    string Departement,
    string NomDepartement,
    string Prefecture,
    string TribunalJudiciaire,
    string BarreauRequis,
    string? Note,
    DateOnly? DateDerniereVerification);

// Note et DateDerniereVerification servent a la PAGE PUBLIQUE du referentiel
// (etape 8, CLAUDE.md §5.8). Le formulaire les ignore.
//
// La date est nulle tant que le client n a pas confronte la ligne aux
// annuaires officiels : la validation juridique de cette grille lui appartient,
// nous l integrons sans la certifier (CLAUDE.md §7). Une date inventee
// donnerait une fausse assurance, l absence de date doit donc se voir.
