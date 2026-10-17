using BrainHub.Domain.Referentiels;

namespace BrainHub.Domain.Inscriptions;

/// <summary>
/// Une inscription a la formation Lignes Rouges.
///
/// La seule entite exploitee en V1 (CLAUDE.md §8). Elle porte exactement les
/// donnees listees au §6, et rien de plus : la minimisation RGPD n'est pas une
/// intention, c'est la liste des colonnes de cette classe.
///
/// AUCUNE donnee de carte bancaire, jamais, ni ici ni dans les journaux : elles
/// restent chez Stripe (CLAUDE.md §6 et §15).
/// </summary>
public sealed class Inscription
{
    public Guid Id { get; set; }

    // -------------------------------------------------------------------------
    // Identite et coordonnees
    // -------------------------------------------------------------------------

    public required string Nom { get; set; }

    public required string Prenom { get; set; }

    /// <summary>
    /// Email du stagiaire. NON unique : une personne peut inscrire un proche,
    /// donc plusieurs inscriptions peuvent partager un email. La deuxieme et les
    /// suivantes exigent une confirmation explicite du visiteur avant creation
    /// (CLAUDE.md §6).
    /// </summary>
    public required string Email { get; set; }

    /// <summary>Facultatif (CLAUDE.md §16).</summary>
    public string? Telephone { get; set; }

    // -------------------------------------------------------------------------
    // Situation administrative
    // -------------------------------------------------------------------------

    public StatutResidence StatutResidence { get; set; }

    /// <summary>
    /// Famille principale de titre de sejour, une seule par inscription
    /// (CLAUDE.md §6). Obligatoire : sans elle, la validation est impossible.
    /// </summary>
    public required string CategorieCode { get; set; }

    public CategorieTitreSejour? Categorie { get; set; }

    /// <summary>
    /// Sous-categorie, FACULTATIVE : elle ne bloque pas la validation
    /// (CLAUDE.md §6).
    /// </summary>
    public int? SousCategorieId { get; set; }

    public SousCategorieTitreSejour? SousCategorie { get; set; }

    /// <summary>
    /// Precision en texte libre, obligatoire pour la seule famille AUT
    /// (« autre situation »).
    /// </summary>
    public string? PrecisionAutreSituation { get; set; }

    // -------------------------------------------------------------------------
    // Rattachement territorial
    // -------------------------------------------------------------------------

    /// <summary>
    /// Departement de la prefecture declaree : de residence actuelle pour un
    /// resident en France, de residence PROJETEE pour un resident a l'etranger
    /// (CLAUDE.md §6). Obligatoire dans les deux cas.
    /// </summary>
    public required string DepartementPrefecture { get; set; }

    public LigneReferentielTerritorial? LignePrefecture { get; set; }

    // --- Copies figees au moment de l'inscription ---------------------------
    //
    // La grille territoriale est appelee a evoluer : regroupements de barreaux,
    // modifications de ressort (CLAUDE.md §7). Une inscription deja payee doit
    // conserver le rattachement qui s'appliquait LE JOUR de son inscription,
    // sinon l'historique se reecrit tout seul a chaque mise a jour du
    // referentiel. D'ou ces trois copies, a cote de la cle etrangere.

    public required string PrefectureLibelle { get; set; }

    public required string TribunalJudiciaireReference { get; set; }

    /// <summary>
    /// Barreau auquel devra appartenir l'avocat-formateur, derive
    /// automatiquement de la prefecture.
    ///
    /// Le systeme ne selectionne, ne propose, ne nomme et n'affecte JAMAIS un
    /// avocat : ce choix est humain et manuel (CLAUDE.md §6). Cette colonne
    /// nomme un barreau, jamais une personne.
    /// </summary>
    public required string BarreauRequis { get; set; }

    // -------------------------------------------------------------------------
    // Residents a l'etranger seulement
    // -------------------------------------------------------------------------

    /// <summary>Obligatoire si et seulement si le candidat reside a l'etranger.</summary>
    public string? PaysResidenceActuelle { get; set; }

    /// <summary>Facultatif : « si connue » (CLAUDE.md §6).</summary>
    public DateOnly? DateArriveePrevisionnelle { get; set; }

    /// <summary>Facultatif : « si connu » (CLAUDE.md §6).</summary>
    public string? CommuneOuCodePostalProjete { get; set; }

    // -------------------------------------------------------------------------
    // Cycle de vie
    // -------------------------------------------------------------------------

    public StatutInscription Statut { get; set; } = StatutInscription.EnAttenteDePaiement;

    /// <summary>
    /// Horodatage de la SOUMISSION du formulaire, pose par le serveur.
    ///
    /// Conserve separement de la validation : il ne sert qu'a purger les
    /// inscriptions restees en attente de paiement (CLAUDE.md §6 et §9).
    /// </summary>
    public DateTimeOffset DateSoumission { get; set; }

    /// <summary>
    /// Horodatage de la VALIDATION, c'est-a-dire de la confirmation du paiement
    /// par le webhook, jamais de la soumission du formulaire.
    ///
    /// Pose une seule fois, par le serveur, et JAMAIS modifiable : il determine
    /// l'ordre d'arrivee en phase 2 (CLAUDE.md §6). Nul tant que le paiement
    /// n'est pas confirme.
    /// </summary>
    public DateTimeOffset? DateValidation { get; set; }

    /// <summary>
    /// Identifiant du PaymentIntent Stripe, pose avant le paiement et utilise
    /// par le webhook pour retrouver l'inscription (CLAUDE.md §9.3). Renseigne a
    /// l'etape 5. Ce n'est pas une donnee de carte : c'est une reference opaque.
    /// </summary>
    public string? IdentifiantPaymentIntent { get; set; }

    /// <summary>
    /// Nul tant que le gestionnaire ne s'est pas prononce, puis vrai ou faux.
    ///
    /// C'est l'une des deux seules actions d'ecriture de la page de suivi
    /// (CLAUDE.md §5.7), construite a l'etape 7. La colonne est posee des
    /// maintenant pour eviter une migration a ce moment-la.
    /// </summary>
    public bool? FormationSuivie { get; set; }

    /// <summary>
    /// Rattachement a une cohorte. HORS PERIMETRE V1 : le moteur de
    /// constitution des cohortes fait l'objet d'un avenant (CLAUDE.md §8).
    /// La cle est prevue dans le schema, elle reste nulle en V1.
    /// </summary>
    public Guid? CohorteId { get; set; }

    public Cohorte? Cohorte { get; set; }
}
