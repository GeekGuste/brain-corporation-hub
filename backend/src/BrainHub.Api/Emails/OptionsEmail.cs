using System.ComponentModel.DataAnnotations;

namespace BrainHub.Api.Emails;

/// <summary>
/// Configuration de l'envoi d'emails.
///
/// Les cles viennent des variables d'environnement du serveur, ou du magasin de
/// secrets de .NET en developpement (CLAUDE.md §11 et §15).
///
/// AUCUN texte d'email n'est ici ni ailleurs dans le code : les modeles vivent
/// dans Mailjet, ou le client les personnalise lui-meme. Le back appelle un
/// modele par son identifiant et lui passe des variables (CLAUDE.md §16).
/// </summary>
public sealed class OptionsEmail
{
    public const string Section = "Mailjet";

    [Required(AllowEmptyStrings = false, ErrorMessage = "Mailjet:CleApi est absente.")]
    public string CleApi { get; init; } = string.Empty;

    [Required(AllowEmptyStrings = false, ErrorMessage = "Mailjet:CleSecrete est absente.")]
    public string CleSecrete { get; init; } = string.Empty;

    /// <summary>
    /// Expediteur. Le domaine est deja authentifie chez Mailjet
    /// (CLAUDE.md §16).
    /// </summary>
    [Required(AllowEmptyStrings = false)]
    public string ExpediteurEmail { get; init; } = "noreply@braincorporationhub.com";

    [Required(AllowEmptyStrings = false)]
    public string ExpediteurNom { get; init; } = "Brain Corporation Hub";

    /// <summary>
    /// Identifiant du modele Mailjet de confirmation d'inscription.
    ///
    /// Zero signifie « pas encore cree » : l'envoi est alors ignore, avec une
    /// trace dans le journal. Cela permet de deployer le webhook avant que le
    /// client ait fini ses modeles, sans faire echouer la confirmation d'un
    /// paiement pour autant.
    /// </summary>
    public long ModeleConfirmation { get; init; }

    /// <summary>
    /// Mode bac a sable de Mailjet : la requete est validee de bout en bout
    /// mais aucun email ne part. Utile en preprod et en developpement, pour ne
    /// pas ecrire a de vraies adresses pendant les essais.
    /// </summary>
    public bool BacASable { get; init; }
}
