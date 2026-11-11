using BrainHub.Api.Emails;
using BrainHub.Domain.Inscriptions;
using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;

namespace BrainHub.Api.Paiement;

public static class EndpointsWebhook
{
    public static void MapperWebhookStripe(this IEndpointRouteBuilder routes)
    {
        // ---------------------------------------------------------------------
        // Webhook Stripe
        // ---------------------------------------------------------------------
        // C'est LUI qui fait foi, et lui seul. Aucune inscription n'est
        // confirmee ni aucun email envoye sur la foi d'un evenement du
        // navigateur : un visiteur qui ferme son onglet juste apres avoir paye
        // doit quand meme recevoir son email (CLAUDE.md §9).
        //
        // Pas de limitation de debit ici : la brider reviendrait a refuser des
        // evenements de Stripe. C'est la signature qui protege l'endpoint, pas
        // un quota.
        routes.MapPost("/webhooks/stripe", async (
            HttpRequest requete,
            BrainHubDbContext contexte,
            ServiceEmail emails,
            IOptions<OptionsPaiement> optionsPaiement,
            IOptions<OptionsFormation> optionsFormation,
            TimeProvider horloge,
            ILogger<Journal> journal,
            CancellationToken annulation) =>
        {
            var secret = optionsPaiement.Value.SecretWebhook;
            if (string.IsNullOrWhiteSpace(secret))
            {
                // Mieux vaut refuser bruyamment que d'accepter sans verifier :
                // un webhook non signe accepterait n'importe quelle requete
                // pretendant qu'un paiement a eu lieu (CLAUDE.md §15).
                journal.LogError(
                    "Stripe:SecretWebhook est absent : le webhook refuse tout. "
                    + "Il y en a TROIS distincts, un par environnement.");
                return Results.StatusCode(StatusCodes.Status500InternalServerError);
            }

            // Le corps BRUT, tel quel : la signature porte sur les octets
            // recus. Le moindre re-encodage la casserait.
            using var lecteur = new StreamReader(requete.Body);
            var charge = await lecteur.ReadToEndAsync(annulation);

            Event evenement;
            try
            {
                // Verification SYSTEMATIQUE de la signature (CLAUDE.md §15).
                //
                // throwOnApiVersionMismatch a FAUX, et c'est un choix delibere.
                //
                // Par defaut, Stripe.net rejette tout evenement dont la version
                // d'API differe de celle qu'il attend. Le compte du client a sa
                // propre version, figee a sa creation, et nos montees de
                // version de Stripe.net sont independantes. Avec le defaut, le
                // moindre ecart ferait repondre 400 a TOUS les evenements : les
                // paiements seraient encaisses, aucune inscription ne serait
                // confirmee, aucun email ne partirait, et Stripe finirait par
                // desactiver l'endpoint. Une panne silencieuse et totale.
                //
                // Le risque annonce par Stripe est qu'un objet soit mal
                // deserialise. Nous ne lisons que trois choses : l'identifiant
                // de l'evenement, son type, et « metadata.inscription_id » que
                // nous avons nous-memes ecrit. Ces trois champs sont stables
                // d'une version a l'autre. L'ecart est donc journalise, pas
                // fatal.
                evenement = EventUtility.ConstructEvent(
                    charge,
                    requete.Headers["Stripe-Signature"],
                    secret,
                    throwOnApiVersionMismatch: false);

                if (evenement.ApiVersion != StripeConfiguration.ApiVersion)
                {
                    journal.LogWarning(
                        "Evenement {Id} en version d'API {Recue}, Stripe.net attend {Attendue}. "
                        + "Traite quand meme : seuls l'identifiant, le type et la metadonnee "
                        + "d'inscription sont lus.",
                        evenement.Id,
                        evenement.ApiVersion,
                        StripeConfiguration.ApiVersion);
                }
            }
            catch (StripeException exception)
            {
                // 400 et non 500 : la requete est invalide, Stripe ne doit pas
                // la rejouer. Une signature fausse est soit une erreur de
                // configuration, soit une tentative.
                journal.LogWarning("Signature de webhook invalide : {Message}", exception.Message);
                return Results.BadRequest();
            }

            // --- Idempotence --------------------------------------------------
            // Stripe rejoue ses evenements. L'identifiant est insere dans LA
            // MEME transaction que la confirmation : si l'evenement revient,
            // l'insertion viole la cle primaire et rien n'est modifie. On ne
            // teste pas d'abord pour ecrire ensuite, ce qui laisserait une
            // fenetre entre les deux (CLAUDE.md §9).
            if (await contexte.EvenementsStripeTraites
                    .AsNoTracking()
                    .AnyAsync(trace => trace.Id == evenement.Id, annulation))
            {
                journal.LogInformation("Evenement {Id} deja traite, ignore", evenement.Id);
                return Results.Ok();
            }

            if (evenement.Data.Object is not PaymentIntent intention)
            {
                // Un evenement qui ne nous concerne pas. On repond 200 pour que
                // Stripe cesse de le rejouer.
                return Results.Ok();
            }

            if (!intention.Metadata.TryGetValue(
                    ServicePaiement.CleMetadonneeInscription,
                    out var identifiantBrut)
                || !Guid.TryParse(identifiantBrut, out var identifiant))
            {
                journal.LogWarning(
                    "PaymentIntent {Intent} sans metadonnee d'inscription exploitable",
                    intention.Id);
                return Results.Ok();
            }

            var inscription = await contexte.Inscriptions
                .FirstOrDefaultAsync(ligne => ligne.Id == identifiant, annulation);

            if (inscription is null)
            {
                // L'inscription a pu etre purgee. On accepte l'evenement pour
                // que Stripe ne le rejoue pas indefiniment, en le signalant.
                journal.LogWarning(
                    "Inscription {Id} introuvable pour le PaymentIntent {Intent}",
                    identifiant,
                    intention.Id);
                return Results.Ok();
            }

            var confirme = evenement.Type == EventTypes.PaymentIntentSucceeded;
            string effet;

            if (confirme)
            {
                // L'horodatage de validation est pose UNE SEULE FOIS, par le
                // serveur, et n'est jamais modifiable : il determine l'ordre
                // d'arrivee en phase 2 (CLAUDE.md §6). Le garder s'il existe
                // deja protege contre un evenement tardif.
                inscription.Statut = StatutInscription.Confirmee;
                inscription.DateValidation ??= horloge.GetUtcNow();
                effet = "confirmee";
            }
            else if (evenement.Type is EventTypes.PaymentIntentPaymentFailed
                or EventTypes.PaymentIntentCanceled)
            {
                // Un echec n'ecrase jamais une confirmation deja acquise : un
                // evenement d'echec peut arriver apres coup, par exemple quand
                // une premiere tentative de carte a echoue avant une seconde
                // reussie.
                if (inscription.Statut == StatutInscription.Confirmee)
                {
                    effet = "echec ignore, l'inscription est deja confirmee";
                }
                else
                {
                    inscription.Statut = StatutInscription.PaiementEchoue;
                    effet = "passee en echec de paiement";
                }
            }
            else
            {
                return Results.Ok();
            }

            contexte.EvenementsStripeTraites.Add(new EvenementStripeTraite
            {
                Id = evenement.Id,
                Type = evenement.Type,
                DateTraitement = horloge.GetUtcNow(),
            });

            try
            {
                await contexte.SaveChangesAsync(annulation);
            }
            catch (DbUpdateException exception)
                when (exception.InnerException?.Message.Contains("evenement_stripe_traite") == true)
            {
                // Deux livraisons du meme evenement arrivees en parallele. La
                // base a tranche, et c'est tres bien.
                journal.LogInformation(
                    "Evenement {Id} traite en parallele, rien a faire",
                    evenement.Id);
                return Results.Ok();
            }

            journal.LogInformation(
                "Inscription {Id} : {Effet} (evenement {Evenement})",
                inscription.Id,
                effet,
                evenement.Id);

            // --- Emails ---------------------------------------------------------
            // APRES l'enregistrement, et sans pouvoir l'annuler. Si Mailjet
            // echoue, le paiement reste confirme : l'argent est encaisse,
            // l'inscription est valide, et un email manquant se renvoie a la
            // main. L'inverse serait bien pire.
            if (confirme)
            {
                await emails.EnvoyerConfirmationAsync(
                    inscription,
                    optionsFormation.Value.MontantCentimes,
                    optionsFormation.Value.Devise,
                    annulation);

                // Puis les gestionnaires et commerciaux, prevenus du paiement.
                // Meme principe : un echec ici ne remet rien en cause.
                var destinataires = await contexte.DestinatairesNotification
                    .AsNoTracking()
                    .Select(destinataire => destinataire.Email)
                    .ToListAsync(annulation);

                await emails.EnvoyerNotificationInterneAsync(
                    inscription,
                    destinataires,
                    annulation);
            }

            return Results.Ok();
        })
        .ExcludeFromDescription();
    }

    /// <summary>Categorie de journalisation du webhook.</summary>
    public sealed class Journal;
}
