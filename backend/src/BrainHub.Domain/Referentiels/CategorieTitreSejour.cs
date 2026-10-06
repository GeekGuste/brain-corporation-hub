namespace BrainHub.Domain.Referentiels;

/// <summary>
/// Une famille principale de titre de sejour : les douze familles ETU, SAL, ENT,
/// TAL, VPF, UEE, VIS, PRO, MED, JEF, RES, AUT (CLAUDE.md §6).
///
/// Source : annexe 1 du cahier des charges du client, chargee depuis
/// data/referentiels.json au demarrage.
///
/// Une seule famille est retenue par inscription.
/// </summary>
public sealed class CategorieTitreSejour
{
    /// <summary>Code a trois lettres, qui sert de cle. Exemple : « ETU ».</summary>
    public required string Code { get; set; }

    /// <summary>Libelle affiche a l'ecran. Exemple : « Etudes et formation ».</summary>
    public required string Famille { get; set; }

    /// <summary>
    /// Vrai pour la famille AUT (« autre situation »), qui impose au candidat une
    /// precision en texte libre (CLAUDE.md §6).
    /// </summary>
    public bool PrecisionLibreObligatoire { get; set; }

    /// <summary>
    /// Rang d'affichage, tel qu'il figure dans le fichier de reference. L'ordre
    /// du client est conserve : ce n'est pas un ordre alphabetique.
    /// </summary>
    public int Ordre { get; set; }

    /// <summary>
    /// Faux pour une famille retiree du fichier. Jamais supprimee : une
    /// inscription peut la referencer.
    /// </summary>
    public bool Actif { get; set; } = true;

    public List<SousCategorieTitreSejour> SousCategories { get; set; } = [];
}
