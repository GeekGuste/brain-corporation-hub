using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using BrainHub.Domain.Inscriptions;
using Microsoft.Extensions.Options;

namespace BrainHub.Api.Emails;

/// <summary>
/// Envoi des emails par l'API Mailjet.
///
/// Appel direct en HTTP plutot qu'un paquet client : l'API « send v3.1 » tient
/// en une requete, et c'est une dependance de moins a suivre pour la duree de
/// vie du projet.
///
/// AUCUN texte n'est ecrit ici. Le modele vit dans Mailjet, ou le client le
/// personnalise, et on lui passe des variables (CLAUDE.md §16).
///
/// Les variables transmises sont le strict necessaire a la redaction du
/// message : la minimisation vaut aussi pour ce qui sort vers un sous-traitant
/// (CLAUDE.md §6).
/// </summary>
public sealed class ServiceEmail(
    HttpClient client,
    IOptions<OptionsEmail> options,
    ILogger<ServiceEmail> journal)
{
    private readonly OptionsEmail _options = options.Value;

    /// <summary>
    /// Confirmation d'inscription.
    ///
    /// La PREUVE DE PAIEMENT, elle, est le recu envoye par Stripe, pose a la
    /// creation du PaymentIntent via « receipt_email » : l'application ne
    /// produit pas de facture numerotee (CLAUDE.md §4).
    ///
    /// Renvoie vrai si l'email est parti. Un echec n'annule JAMAIS la
    /// confirmation du paiement : l'argent est encaisse, l'inscription est
    /// valide, et un email manquant se renvoie a la main. L'inverse, perdre un
    /// paiement confirme parce qu'un email a echoue, serait bien pire.
    /// </summary>
    public async Task<bool> EnvoyerConfirmationAsync(
        Inscription inscription,
        int montantCentimes,
        string devise,
        CancellationToken annulation)
    {
        if (_options.ModeleConfirmation <= 0)
        {
            journal.LogWarning(
                "Aucun modele Mailjet de confirmation configure : l'email de l'inscription "
                + "{Id} n'est pas envoye. Renseignez Mailjet:ModeleConfirmation.",
                inscription.Id);
            return false;
        }

        var montant = (montantCentimes / 100m).ToString("0.00", CultureInfo.InvariantCulture);

        var corps = new
        {
            Messages = new[]
            {
                new
                {
                    From = new { Email = _options.ExpediteurEmail, Name = _options.ExpediteurNom },
                    To = new[]
                    {
                        new
                        {
                            Email = inscription.Email,
                            Name = $"{inscription.Prenom} {inscription.Nom}",
                        },
                    },
                    TemplateID = _options.ModeleConfirmation,
                    TemplateLanguage = true,
                    Variables = new Dictionary<string, object>
                    {
                        // Le strict necessaire a la redaction du message. Ni
                        // categorie de titre, ni prefecture, ni barreau : ces
                        // donnees n'ont rien a faire dans un email, et encore
                        // moins chez un sous-traitant (CLAUDE.md §6).
                        ["prenom"] = inscription.Prenom,
                        ["nom"] = inscription.Nom,
                        ["reference"] = inscription.Id.ToString(),
                        ["montant"] = montant,
                        ["devise"] = devise.ToUpperInvariant(),
                    },
                },
            },

            // Bac a sable : la requete est validee, rien ne part. Indispensable
            // en preprod pour ne pas ecrire a de vraies adresses.
            SandboxMode = _options.BacASable,
        };

        using var requete = new HttpRequestMessage(HttpMethod.Post, "https://api.mailjet.com/v3.1/send")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(corps),
                Encoding.UTF8,
                "application/json"),
        };

        var identifiants = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{_options.CleApi}:{_options.CleSecrete}"));
        requete.Headers.Authorization = new AuthenticationHeaderValue("Basic", identifiants);

        try
        {
            using var reponse = await client.SendAsync(requete, annulation);

            if (!reponse.IsSuccessStatusCode)
            {
                // Le corps de reponse de Mailjet decrit l'erreur et ne contient
                // pas de secret. Il est utile au diagnostic.
                var detail = await reponse.Content.ReadAsStringAsync(annulation);
                journal.LogError(
                    "Mailjet a refuse l'email de l'inscription {Id} : {Code} {Detail}",
                    inscription.Id,
                    (int)reponse.StatusCode,
                    detail);
                return false;
            }

            journal.LogInformation(
                "Email de confirmation envoye pour l'inscription {Id}{BacASable}",
                inscription.Id,
                _options.BacASable ? " (bac a sable, rien n'est parti)" : string.Empty);
            return true;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            journal.LogError(
                exception,
                "Echec de l'appel a Mailjet pour l'inscription {Id}",
                inscription.Id);
            return false;
        }
    }
}
