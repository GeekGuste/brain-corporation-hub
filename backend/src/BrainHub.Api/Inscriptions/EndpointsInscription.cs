using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Api.Inscriptions;

public static class EndpointsInscription
{
    /// <summary>
    /// Nom de la politique de limitation de debit du controle de doublon.
    /// Declaree dans Program.cs, appliquee ici.
    /// </summary>
    public const string LimiteVerificationEmail = "verification-email";

    public static void MapperReferentiels(this IEndpointRouteBuilder routes)
    {
        var groupe = routes.MapGroup("/referentiels").WithTags("Referentiels");

        // ---------------------------------------------------------------------
        // Les douze familles de titre de sejour, avec leurs sous-categories
        // ---------------------------------------------------------------------
        // Les sous-categories sont renvoyees avec les familles, en une seule
        // requete : la liste entiere pese quelques kilo-octets, et le public est
        // parfois en connexion lente (CLAUDE.md §13). Un second aller-retour a
        // chaque changement de famille couterait plus que de tout envoyer.
        groupe.MapGet("/categories", async (
            BrainHubDbContext contexte,
            CancellationToken annulation) =>
        {
            var categories = await contexte.CategoriesTitreSejour
                .AsNoTracking()
                .Where(categorie => categorie.Actif)
                .OrderBy(categorie => categorie.Ordre)
                .Select(categorie => new CategorieExposee(
                    categorie.Code,
                    categorie.Famille,
                    categorie.PrecisionLibreObligatoire,
                    categorie.SousCategories
                        .Where(sousCategorie => sousCategorie.Actif)
                        .OrderBy(sousCategorie => sousCategorie.Ordre)
                        .Select(sousCategorie => new SousCategorieExposee(
                            sousCategorie.Id,
                            sousCategorie.Libelle))
                        .ToList()))
                .ToListAsync(annulation);

            return Results.Ok(categories);
        })
        .WithSummary("Les douze familles de titre de sejour et leurs sous-categories");

        // ---------------------------------------------------------------------
        // Les prefectures, avec leur rattachement
        // ---------------------------------------------------------------------
        groupe.MapGet("/prefectures", async (
            BrainHubDbContext contexte,
            CancellationToken annulation) =>
        {
            var prefectures = await contexte.ReferentielTerritorial
                .AsNoTracking()
                .Where(ligne => ligne.Actif)
                .OrderBy(ligne => ligne.Departement)
                .Select(ligne => new PrefectureExposee(
                    ligne.Departement,
                    ligne.NomDepartement,
                    ligne.Prefecture,
                    ligne.TribunalJudiciaire,
                    ligne.BarreauRequis))
                .ToListAsync(annulation);

            return Results.Ok(prefectures);
        })
        .WithSummary("Les prefectures normalisees, avec tribunal judiciaire et barreau requis");
    }

    public static void MapperInscriptions(this IEndpointRouteBuilder routes)
    {
        var groupe = routes.MapGroup("/inscriptions").WithTags("Inscriptions");

        // ---------------------------------------------------------------------
        // Controle de doublon d'email
        // ---------------------------------------------------------------------
        // Renvoie UN BOOLEEN, jamais un nom, une date ni une categorie. Sinon
        // cet endpoint deviendrait un moyen de tester si telle personne est
        // inscrite a une formation sur le droit au sejour (CLAUDE.md §15).
        //
        // Limite en debit pour empecher l'enumeration d'adresses : c'est la
        // seconde moitie de la meme exigence, et elle compte autant que la
        // premiere.
        groupe.MapPost("/verifier-email", async (
            DemandeVerificationEmail demande,
            ServiceInscription service,
            CancellationToken annulation) =>
        {
            var dejaInscrit = await service.EmailDejaInscritAsync(demande.Email, annulation);
            return Results.Ok(new ReponseVerificationEmail(dejaInscrit));
        })
        .RequireRateLimiting(LimiteVerificationEmail)
        .WithSummary("Indique seulement si cet email porte deja une inscription confirmee");

        // ---------------------------------------------------------------------
        // Creation d'une inscription
        // ---------------------------------------------------------------------
        // Statut « en attente de paiement ». Rien n'est confirme, aucun email ne
        // part : la confirmation vient du webhook (CLAUDE.md §9).
        //
        // L'etape 5 ajoutera ici la creation du PaymentIntent Stripe et le
        // renvoi du « client_secret ».
        groupe.MapPost("/", async (
            DemandeInscription demande,
            ServiceInscription service,
            CancellationToken annulation) =>
        {
            var resultat = await service.CreerAsync(demande, annulation);

            return resultat switch
            {
                ResultatInscription.Creee creee =>
                    Results.Created($"/inscriptions/{creee.Reponse.Id}", creee.Reponse),

                ResultatInscription.Invalide invalide =>
                    Results.ValidationProblem(invalide.Erreurs),

                // 409 et un code stable, pour que le formulaire sache qu'il doit
                // demander une confirmation plutot qu'afficher une erreur.
                ResultatInscription.DoublonAConfirmer =>
                    Results.Conflict(new { code = "doublon-email" }),

                // 503 : l'inscription est enregistree, c'est Stripe qui n'a pas
                // repondu. Le visiteur doit pouvoir reessayer, pas recommencer
                // sa saisie.
                ResultatInscription.PaiementIndisponible =>
                    Results.Json(
                        new { code = "paiement-indisponible" },
                        statusCode: StatusCodes.Status503ServiceUnavailable),

                _ => Results.Problem("Resultat inattendu."),
            };
        })
        .WithSummary("Cree une inscription, derive le barreau requis et ouvre le paiement");

        // ---------------------------------------------------------------------
        // Etat d'une inscription
        // ---------------------------------------------------------------------
        // Interroge par la page pendant quelques secondes apres le retour de
        // Stripe, le temps que le webhook fasse foi (CLAUDE.md §9.6).
        //
        // Renvoie UNIQUEMENT le statut. L'identifiant est un GUID non devinable,
        // mais ce n'est pas une raison d'y exposer un nom ou un email.
        groupe.MapGet("/{id:guid}/statut", async (
            Guid id,
            ServiceInscription service,
            CancellationToken annulation) =>
        {
            var statut = await service.StatutAsync(id, annulation);
            return statut is null
                ? Results.NotFound()
                : Results.Ok(new ReponseStatutInscription(statut));
        })
        .WithSummary("Etat d'une inscription, pour l'attente de confirmation du webhook");
    }
}
