using BrainHub.Domain.Inscriptions;
using Microsoft.Extensions.Options;
using Stripe;

namespace BrainHub.Api.Paiement;

/// <summary>Ce que l'API renvoie au navigateur pour afficher le paiement.</summary>
public sealed record IntentionDePaiement(string ClientSecret, string ClePubliable);

/// <summary>
/// Creation de l'intention de paiement Stripe.
///
/// Sequencement (CLAUDE.md §9.3) : l'inscription est creee AVANT, au statut
/// « en attente de paiement », et son identifiant est pose dans les metadonnees
/// du PaymentIntent. C'est par la que le webhook retrouvera l'inscription a
/// l'etape 6, sans dependre d'un evenement du navigateur.
///
/// Aucune donnee de carte ne transite par ce service, ni par l'API en general :
/// le navigateur parle directement a Stripe avec le « client_secret », et les
/// numeros de carte ne touchent jamais notre serveur (CLAUDE.md §6 et §15).
/// </summary>
public sealed class ServicePaiement(
    IOptions<OptionsPaiement> optionsPaiement,
    IOptions<OptionsFormation> optionsFormation,
    ILogger<ServicePaiement> journal)
{
    private readonly OptionsPaiement _paiement = optionsPaiement.Value;
    private readonly OptionsFormation _formation = optionsFormation.Value;

    /// <summary>Clef de metadonnee ou l'identifiant d'inscription est range.</summary>
    public const string CleMetadonneeInscription = "inscription_id";

    public async Task<IntentionDePaiement> CreerAsync(
        Inscription inscription,
        CancellationToken annulation)
    {
        var service = new PaymentIntentService(new StripeClient(_paiement.CleSecrete));

        var options = new PaymentIntentCreateOptions
        {
            // Le montant vient de la configuration du serveur, jamais du
            // navigateur (CLAUDE.md §15).
            Amount = _formation.MontantCentimes,
            Currency = _formation.Devise,

            // Les moyens de paiement sont choisis par Stripe selon le compte,
            // MAIS les redirections sont interdites : le paiement doit se faire
            // dans la page, sans quitter le site (CLAUDE.md §9.4). Cela ecarte
            // d'office les moyens qui imposent un detour par un site tiers.
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions
            {
                Enabled = true,
                AllowRedirects = "never",
            },

            // C'est le fil qui relie le paiement a l'inscription. Le webhook
            // s'en sert pour retrouver la ligne a confirmer.
            Metadata = new Dictionary<string, string>
            {
                [CleMetadonneeInscription] = inscription.Id.ToString(),
            },

            // Le recu Stripe part a cette adresse. C'est le justificatif du
            // stagiaire : l'application ne produit pas de facture numerotee
            // (CLAUDE.md §4).
            ReceiptEmail = inscription.Email,

            Description = $"Formation Lignes Rouges, inscription {inscription.Id}",
        };

        if (!string.IsNullOrWhiteSpace(_formation.LibelleReleve))
        {
            // SUFFIXE et non descripteur complet : Stripe refuse
            // « statement_descriptor » des que la carte fait partie des moyens
            // de paiement, et demande un suffixe, qu'il accole au libelle du
            // compte. L'ensemble reste limite a 22 caracteres.
            options.StatementDescriptorSuffix = _formation.LibelleReleve;
        }

        // Idempotence : si le visiteur renvoie le formulaire ou si le reseau
        // coupe au mauvais moment, Stripe renvoie le MEME PaymentIntent au lieu
        // d'en creer un second. La cle est l'identifiant de l'inscription, qui
        // est unique et stable.
        var requete = new RequestOptions { IdempotencyKey = $"inscription-{inscription.Id}" };

        var intention = await service.CreateAsync(options, requete, annulation);

        // Journal volontairement pauvre : deux identifiants opaques, aucune
        // donnee personnelle, aucune donnee de carte (CLAUDE.md §15).
        journal.LogInformation(
            "PaymentIntent {Intent} cree pour l'inscription {Inscription}",
            intention.Id,
            inscription.Id);

        return new IntentionDePaiement(intention.ClientSecret, _paiement.ClePubliable);
    }
}
