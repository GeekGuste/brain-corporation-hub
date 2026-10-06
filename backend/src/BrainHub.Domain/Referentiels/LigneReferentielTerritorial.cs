namespace BrainHub.Domain.Referentiels;

/// <summary>
/// Une ligne de la grille territoriale : prefecture, tribunal judiciaire de
/// reference, barreau requis (CLAUDE.md §7).
///
/// Source : annexe 2 du cahier des charges du client, 96 lignes, France
/// metropolitaine et Corse. Alimentee par le fichier versionne
/// data/referentiels.json, charge en base au demarrage.
///
/// La validation juridique de ces correspondances appartient au client, qui doit
/// les confronter aux annuaires officiels avant la mise en production. Nous
/// integrons la grille fournie ; nous ne la certifions pas.
/// </summary>
public sealed class LigneReferentielTerritorial
{
    /// <summary>
    /// Numero de departement, qui sert de cle : « 01 » a « 95 », plus « 2A » et
    /// « 2B » pour la Corse. Deux caracteres, jamais un entier.
    /// </summary>
    public required string Departement { get; set; }

    public required string NomDepartement { get; set; }

    /// <summary>
    /// Ville-prefecture. La correspondance porte sur elle, et non sur toutes les
    /// communes du departement (CLAUDE.md §7).
    /// </summary>
    public required string Prefecture { get; set; }

    /// <summary>
    /// Tribunal judiciaire territorialement competent pour la ville-prefecture.
    /// Il n'est pas toujours situe dans la prefecture : Val-d'Oise a Cergy pour
    /// prefecture mais Pontoise pour tribunal, la Manche a Saint-Lo mais
    /// Coutances.
    /// </summary>
    public required string TribunalJudiciaire { get; set; }

    /// <summary>
    /// Barreau auquel devra appartenir l'avocat-formateur, choisi ensuite
    /// MANUELLEMENT par le gestionnaire. Certains barreaux portent un nom plus
    /// large que leur siege : Alpes-de-Haute-Provence, La Rochelle-Rochefort,
    /// Coutances-Avranches.
    ///
    /// Le systeme ne selectionne, ne propose, ne nomme et n'affecte jamais un
    /// avocat (CLAUDE.md §6).
    /// </summary>
    public required string BarreauRequis { get; set; }

    /// <summary>
    /// Precision du client sur une correspondance qui pourrait surprendre.
    /// Affichee telle quelle sur la page publique du referentiel (etape 8).
    /// </summary>
    public string? Note { get; set; }

    /// <summary>
    /// Date a laquelle la ligne a ete confrontee aux annuaires officiels.
    /// Nulle tant que le client ne l'a pas fait : c'est sa responsabilite, et
    /// une date inventee donnerait une fausse assurance.
    /// </summary>
    public DateOnly? DateDerniereVerification { get; set; }

    /// <summary>
    /// Faux pour une ligne retiree du fichier de reference.
    ///
    /// Le chargement ne supprime jamais une ligne : une inscription peut la
    /// referencer, et la grille est appelee a evoluer (regroupements de
    /// barreaux, modifications de ressort). Desactiver plutot que supprimer
    /// preserve l'historique des inscriptions deja payees.
    /// </summary>
    public bool Actif { get; set; } = true;
}
