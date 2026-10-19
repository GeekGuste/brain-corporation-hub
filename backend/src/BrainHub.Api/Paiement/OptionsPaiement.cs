using System.ComponentModel.DataAnnotations;

namespace BrainHub.Api.Paiement;

/// <summary>
/// Configuration du paiement.
///
/// Le montant vient d'appsettings.json, les cles des variables d'environnement
/// du serveur, ou du magasin de secrets de .NET en developpement. Aucune n'est
/// jamais ecrite dans le depot ni dans l'image (CLAUDE.md §11 et §15).
///
/// L'application REFUSE de demarrer si une valeur manque, plutot que de
/// decouvrir l'absence de cle au premier paiement reel. C'est le meme parti pris
/// que pour le chargement du referentiel.
/// </summary>
public sealed class OptionsPaiement
{
    public const string Section = "Stripe";

    /// <summary>
    /// Cle publiable, transmise au navigateur. Elle n'est pas secrete : elle
    /// identifie le compte, elle n'autorise rien.
    /// </summary>
    [Required(AllowEmptyStrings = false, ErrorMessage = "Stripe:ClePubliable est absente.")]
    public string ClePubliable { get; init; } = string.Empty;

    /// <summary>
    /// Cle secrete. Ne sort JAMAIS du serveur, et n'apparait dans aucun journal.
    /// </summary>
    [Required(AllowEmptyStrings = false, ErrorMessage = "Stripe:CleSecrete est absente.")]
    public string CleSecrete { get; init; } = string.Empty;

    /// <summary>
    /// Secret de signature du webhook. Il y en a TROIS distincts, un par
    /// environnement : local via le Stripe CLI, preprod, production
    /// (CLAUDE.md §9).
    ///
    /// Facultatif a l'etape 5 : il n'est lu qu'a l'etape 6, par le webhook.
    /// </summary>
    public string? SecretWebhook { get; init; }
}

/// <summary>
/// Ce qui est vendu. Le montant vit dans la configuration du serveur et n'est
/// JAMAIS recu du navigateur : sinon n'importe qui paierait le prix de son
/// choix (CLAUDE.md §15).
/// </summary>
public sealed class OptionsFormation
{
    public const string Section = "Formation";

    /// <summary>100 € TTC par stagiaire, soit 10 000 centimes (CLAUDE.md §4).</summary>
    [Range(1, 1_000_000, ErrorMessage = "Formation:MontantCentimes doit etre un montant positif.")]
    public int MontantCentimes { get; init; } = 10_000;

    [Required(AllowEmptyStrings = false)]
    public string Devise { get; init; } = "eur";

    /// <summary>
    /// Intitule reporte sur le releve bancaire du stagiaire. Stripe le limite a
    /// 22 caracteres et le met en capitales. Un libelle reconnaissable evite les
    /// contestations de paiement par simple non-reconnaissance.
    /// </summary>
    public string? LibelleReleve { get; init; }
}
