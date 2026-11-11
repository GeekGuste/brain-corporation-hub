using System.Globalization;
using BrainHub.Api.Emails;
using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Api.Contact;

/// <summary>
/// Message envoye depuis le formulaire de contact.
///
/// « Piege » n'est pas un champ du formulaire visible : voir la note sur les
/// robots dans <see cref="EndpointsContact"/>.
/// </summary>
public sealed record DemandeContact(
    string? Prenom,
    string? Nom,
    string? Email,
    string? Telephone,
    string? Message,
    string? Piege);

/// <summary>
/// Formulaire de contact public.
///
/// HORS DU PERIMETRE du §5 de CLAUDE.md, demande explicitement et accepte en
/// V1 : les visiteurs ont des questions avant de s'inscrire, et la foire aux
/// questions n'y repond pas toujours.
///
/// AUCUN MESSAGE N'EST ENREGISTRE EN BASE. Le message part par email aux
/// adresses internes et rien n'en reste chez nous. C'est de la minimisation
/// (CLAUDE.md §15) : un visiteur ecrira malgre les consignes « je suis sous OQTF
/// depuis mars », et cette phrase n'a pas a dormir dans une table avec une
/// duree de conservation a tenir. La contrepartie est assumee : si Mailjet
/// refuse l'envoi, le message est perdu, et on le dit franchement au visiteur
/// en lui donnant l'adresse ou ecrire directement.
/// </summary>
public static class EndpointsContact
{
    /// <summary>
    /// Nom de la politique de limitation de debit. Declaree dans Program.cs,
    /// appliquee ici.
    /// </summary>
    public const string LimiteEnvoi = "contact";

    /// <summary>Longueurs maximales. Un formulaire public est une porte ouverte.</summary>
    private const int LongueurMaxNom = 100;
    private const int LongueurMaxEmail = 254;
    private const int LongueurMaxTelephone = 30;
    private const int LongueurMaxMessage = 4000;

    /// <summary>Marqueur de journal, pour ne pas exposer un type interne.</summary>
    public sealed class Journal;

    public static void MapperContact(this IEndpointRouteBuilder routes)
    {
        var groupe = routes.MapGroup("/contact").WithTags("Contact");

        groupe.MapPost("/", async (
            DemandeContact demande,
            BrainHubDbContext contexte,
            ServiceEmail emails,
            ILogger<Journal> journal,
            CancellationToken annulation) =>
        {
            // -----------------------------------------------------------------
            // Robots
            // -----------------------------------------------------------------
            // Le formulaire porte un champ cache qu'un humain ne remplit jamais
            // et qu'un robot remplit presque toujours. S'il est rempli, on
            // repond 202 comme si tout allait bien : un robot qui recoit une
            // erreur recommence autrement, un robot qui croit avoir reussi
            // passe a autre chose.
            //
            // Pas de captcha : il faudrait appeler un service exterieur, donc
            // envoyer l'adresse IP du visiteur a un tiers, et il est
            // infranchissable pour une partie du public (CLAUDE.md §13).
            if (!string.IsNullOrWhiteSpace(demande.Piege))
            {
                journal.LogInformation("Message de contact ecarte : champ piege rempli");
                return Results.Accepted();
            }

            // -----------------------------------------------------------------
            // Validation, cote serveur et pas seulement dans le formulaire
            // -----------------------------------------------------------------
            // Les messages sont en francais simple et disent QUOI corriger
            // (CLAUDE.md §13 et §15).
            var erreurs = new Dictionary<string, string[]>();

            var prenom = demande.Prenom?.Trim() ?? string.Empty;
            var nom = demande.Nom?.Trim() ?? string.Empty;
            var email = demande.Email?.Trim() ?? string.Empty;
            var telephone = demande.Telephone?.Trim() ?? string.Empty;
            var message = demande.Message?.Trim() ?? string.Empty;

            if (prenom.Length == 0)
            {
                erreurs["prenom"] = ["Indiquez votre prénom."];
            }
            else if (prenom.Length > LongueurMaxNom)
            {
                erreurs["prenom"] = ["Ce prénom est trop long."];
            }

            if (nom.Length == 0)
            {
                erreurs["nom"] = ["Indiquez votre nom."];
            }
            else if (nom.Length > LongueurMaxNom)
            {
                erreurs["nom"] = ["Ce nom est trop long."];
            }

            if (email.Length == 0)
            {
                erreurs["email"] = ["Indiquez votre adresse email."];
            }
            else if (email.Length > LongueurMaxEmail || !EmailPlausible(email))
            {
                erreurs["email"] =
                    ["Cette adresse email ne semble pas valide. Vérifiez qu’elle contient un arobase et un point."];
            }

            if (telephone.Length > LongueurMaxTelephone)
            {
                erreurs["telephone"] = ["Ce numéro est trop long."];
            }

            if (message.Length == 0)
            {
                erreurs["message"] = ["Écrivez votre question."];
            }
            else if (message.Length > LongueurMaxMessage)
            {
                erreurs["message"] =
                    ["Votre message est trop long. Résumez-le en quelques phrases, nous vous rappellerons."];
            }

            if (erreurs.Count > 0)
            {
                return Results.ValidationProblem(erreurs);
            }

            // -----------------------------------------------------------------
            // Destinataires
            // -----------------------------------------------------------------
            // Les memes adresses que les notifications de paiement, saisies
            // depuis la page de suivi. Une seule liste a tenir.
            var destinataires = await contexte.DestinatairesNotification
                .AsNoTracking()
                .OrderBy(destinataire => destinataire.Email)
                .Select(destinataire => destinataire.Email)
                .ToListAsync(annulation);

            var parti = await emails.EnvoyerMessageContactAsync(
                prenom,
                nom,
                email.ToLower(CultureInfo.InvariantCulture),
                telephone,
                message,
                destinataires,
                annulation);

            if (!parti)
            {
                // On ne ment pas au visiteur. Rien n'est enregistre : si l'envoi
                // echoue, son message n'existe nulle part, et il doit le savoir
                // pour pouvoir ecrire autrement.
                journal.LogError("Un message de contact n'a pas pu etre transmis");
                return Results.Problem(
                    statusCode: StatusCodes.Status502BadGateway,
                    type: "envoi-impossible");
            }

            journal.LogInformation(
                "Message de contact transmis a {Nombre} destinataire(s)",
                destinataires.Count);

            // 202 et non 201 : rien n'a ete cree, un message a ete accepte.
            // Aucune donnee en reponse, il n'y a rien a renvoyer.
            return Results.Accepted();
        })
        .RequireRateLimiting(LimiteEnvoi)
        .WithSummary("Transmet un message du formulaire de contact aux adresses internes");
    }

    /// <summary>
    /// Controle de forme, identique a celui des inscriptions : deliberement
    /// permissif, la seule preuve qu'une adresse existe est l'email qui y
    /// arrive.
    /// </summary>
    private static bool EmailPlausible(string email)
    {
        var arobase = email.IndexOf('@', StringComparison.Ordinal);
        if (arobase <= 0 || arobase != email.LastIndexOf('@'))
        {
            return false;
        }

        var domaine = email[(arobase + 1)..];
        return domaine.Length >= 3
            && domaine.Contains('.', StringComparison.Ordinal)
            && !domaine.StartsWith('.')
            && !domaine.EndsWith('.')
            && !email.Contains(' ', StringComparison.Ordinal);
    }
}
