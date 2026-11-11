using System.Globalization;
using System.Text;
using BrainHub.Domain.Inscriptions;
using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Api.Suivi;

public static class EndpointsSuivi
{
    /// <summary>Politique de limitation de debit de la connexion.</summary>
    public const string LimiteConnexion = "connexion-suivi";

    public static void MapperSuivi(this IEndpointRouteBuilder routes)
    {
        var groupe = routes.MapGroup("/suivi").WithTags("Suivi");

        // ---------------------------------------------------------------------
        // Connexion
        // ---------------------------------------------------------------------
        // Limitee en debit : c'est la seule porte d'entree vers des donnees
        // sensibles par nature, des situations administratives d'etrangers
        // (CLAUDE.md §15). Sans limite, un mot de passe faible tomberait en
        // quelques heures.
        groupe.MapPost("/connexion", async (
            DemandeConnexion demande,
            ServiceAuthentification authentification,
            HttpContext contexte) =>
        {
            var reussi = await authentification.ConnecterAsync(
                contexte,
                demande.Identifiant,
                demande.MotDePasse);

            // Un seul message pour les deux causes possibles : dire « cet
            // identifiant n'existe pas » revelerait lequel est le bon.
            return reussi ? Results.Ok(new EtatSession(true)) : Results.Unauthorized();
        })
        .RequireRateLimiting(LimiteConnexion)
        .AllowAnonymous();

        groupe.MapPost("/deconnexion", async (HttpContext contexte) =>
        {
            await ServiceAuthentification.DeconnecterAsync(contexte);
            return Results.Ok(new EtatSession(false));
        })
        .AllowAnonymous();

        // Permet a la page de savoir si la session tient encore, sans tenter un
        // appel qui echouerait.
        groupe.MapGet("/session", (HttpContext contexte) =>
            Results.Ok(new EtatSession(contexte.User.Identity?.IsAuthenticated == true)))
        .AllowAnonymous();

        // ---------------------------------------------------------------------
        // Consultation
        // ---------------------------------------------------------------------
        // Seules les inscriptions CONFIRMEES sont listees. Les autres sont des
        // paniers abandonnes, qui seront purges : les afficher donnerait au
        // gestionnaire une liste trompeuse, ou figureraient des gens qui n'ont
        // jamais paye.
        groupe.MapGet("/inscriptions", async (
            BrainHubDbContext contexte,
            CancellationToken annulation) =>
        {
            var inscriptions = await Requete(contexte).ToListAsync(annulation);
            return Results.Ok(inscriptions);
        })
        .RequireAuthorization();

        // ---------------------------------------------------------------------
        // Export CSV (CLAUDE.md §5.7)
        // ---------------------------------------------------------------------
        groupe.MapGet("/inscriptions/export", async (
            BrainHubDbContext contexte,
            TimeProvider horloge,
            CancellationToken annulation) =>
        {
            var inscriptions = await Requete(contexte).ToListAsync(annulation);
            var horodatage = horloge.GetUtcNow().ToString("yyyyMMdd-HHmm", CultureInfo.InvariantCulture);

            return Results.File(
                ConstruireCsv(inscriptions),
                "text/csv; charset=utf-8",
                $"inscriptions-{horodatage}.csv");
        })
        .RequireAuthorization();

        // ---------------------------------------------------------------------
        // PREMIERE des deux seules actions d'ecriture : la presence
        // ---------------------------------------------------------------------
        groupe.MapPut("/inscriptions/{id:guid}/presence", async (
            Guid id,
            DemandePresence demande,
            BrainHubDbContext contexte,
            ILogger<Journal> journal,
            CancellationToken annulation) =>
        {
            var inscription = await contexte.Inscriptions
                .FirstOrDefaultAsync(ligne => ligne.Id == id, annulation);

            if (inscription is null)
            {
                return Results.NotFound();
            }

            if (inscription.Statut != StatutInscription.Confirmee)
            {
                return Results.Conflict(new { code = "inscription-non-confirmee" });
            }

            inscription.FormationSuivie = demande.Suivie;
            await contexte.SaveChangesAsync(annulation);

            journal.LogInformation(
                "Presence de l'inscription {Id} posee a {Valeur}",
                id,
                demande.Suivie?.ToString() ?? "non renseignee");

            return Results.NoContent();
        })
        .RequireAuthorization();

        // ---------------------------------------------------------------------
        // SECONDE action d'ecriture : la suppression
        // ---------------------------------------------------------------------
        // Autorisee UNIQUEMENT une fois la formation marquee comme suivie
        // (CLAUDE.md §5.7). Le gabarit cache le bouton, mais c'est ici que la
        // regle est tenue : le navigateur n'est jamais la source de verite
        // (CLAUDE.md §15).
        //
        // La suppression efface l'inscription de NOTRE base. La trace du
        // paiement reste chez Stripe pour la comptabilite (CLAUDE.md §5.7).
        groupe.MapDelete("/inscriptions/{id:guid}", async (
            Guid id,
            BrainHubDbContext contexte,
            ILogger<Journal> journal,
            CancellationToken annulation) =>
        {
            var inscription = await contexte.Inscriptions
                .FirstOrDefaultAsync(ligne => ligne.Id == id, annulation);

            if (inscription is null)
            {
                return Results.NotFound();
            }

            if (inscription.FormationSuivie != true)
            {
                return Results.Conflict(new { code = "formation-non-suivie" });
            }

            contexte.Inscriptions.Remove(inscription);
            await contexte.SaveChangesAsync(annulation);

            // L'identifiant seul, aucune donnee personnelle : c'est une trace
            // d'action de gestion, pas une copie de ce qui vient d'etre efface.
            journal.LogInformation("Inscription {Id} supprimee depuis la page de suivi", id);

            return Results.NoContent();
        })
        .RequireAuthorization();
    }

    private static IQueryable<InscriptionSuivie> Requete(BrainHubDbContext contexte) =>
        contexte.Inscriptions
            .AsNoTracking()
            .Where(inscription => inscription.Statut == StatutInscription.Confirmee)
            // L'ordre d'arrivee, qui est celui de la validation du paiement par
            // le webhook, et qui determinera les cohortes (CLAUDE.md §6).
            .OrderBy(inscription => inscription.DateValidation)
            .Select(inscription => new InscriptionSuivie(
                inscription.Id,
                inscription.DateValidation,
                inscription.Nom,
                inscription.Prenom,
                inscription.Email,
                inscription.Telephone,
                inscription.StatutResidence.ToString(),
                inscription.CategorieCode,
                inscription.Categorie!.Famille,
                inscription.SousCategorie != null ? inscription.SousCategorie.Libelle : null,
                inscription.PrecisionAutreSituation,
                inscription.DepartementPrefecture,
                inscription.PrefectureLibelle,
                inscription.TribunalJudiciaireReference,
                inscription.BarreauRequis,
                inscription.PaysResidenceActuelle,
                inscription.DateArriveePrevisionnelle,
                inscription.CommuneOuCodePostalProjete,
                inscription.FormationSuivie));

    /// <summary>
    /// Fabrique le CSV.
    ///
    /// Point-virgule comme separateur et marque d'ordre des octets en tete :
    /// c'est ce qu'attend Excel en configuration francaise. Sans la marque, les
    /// accents sortent en charabia ; avec une virgule, tout atterrit dans une
    /// seule colonne.
    /// </summary>
    private static byte[] ConstruireCsv(IReadOnlyCollection<InscriptionSuivie> inscriptions)
    {
        var sortie = new StringBuilder();

        sortie.AppendLine(string.Join(';', new[]
        {
            "Date de validation", "Nom", "Prenom", "Email", "Telephone",
            "Residence", "Code categorie", "Categorie", "Sous-categorie",
            "Precision autre situation", "Departement", "Prefecture",
            "Tribunal judiciaire", "Barreau requis", "Pays de residence",
            "Arrivee previsionnelle", "Commune projetee", "Formation suivie",
            "Reference",
        }));

        foreach (var inscription in inscriptions)
        {
            sortie.AppendLine(string.Join(';', new[]
            {
                Champ(inscription.DateValidation?.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture)),
                Champ(inscription.Nom),
                Champ(inscription.Prenom),
                Champ(inscription.Email),
                Champ(inscription.Telephone),
                Champ(inscription.StatutResidence),
                Champ(inscription.CategorieCode),
                Champ(inscription.CategorieFamille),
                Champ(inscription.SousCategorie),
                Champ(inscription.PrecisionAutreSituation),
                Champ(inscription.Departement),
                Champ(inscription.Prefecture),
                Champ(inscription.TribunalJudiciaire),
                Champ(inscription.BarreauRequis),
                Champ(inscription.PaysResidenceActuelle),
                Champ(inscription.DateArriveePrevisionnelle?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)),
                Champ(inscription.CommuneOuCodePostalProjete),
                Champ(inscription.FormationSuivie switch
                {
                    true => "oui",
                    false => "non",
                    null => string.Empty,
                }),
                Champ(inscription.Id.ToString()),
            }));
        }

        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sortie.ToString())).ToArray();
    }

    /// <summary>
    /// Echappe un champ CSV et le neutralise contre l'injection de formule.
    ///
    /// Un nom ou une precision libre commencant par =, +, - ou @ est interprete
    /// comme une FORMULE par Excel a l'ouverture du fichier. Comme ces champs
    /// sont saisis par les visiteurs, c'est un vecteur d'execution de code sur
    /// le poste du gestionnaire. On prefixe donc d'une apostrophe, qui force
    /// Excel a lire du texte et ne se voit pas dans la cellule.
    /// </summary>
    private static string Champ(string? valeur)
    {
        if (string.IsNullOrEmpty(valeur))
        {
            return string.Empty;
        }

        var sur = valeur.Length > 0 && valeur[0] is '=' or '+' or '-' or '@' or '\t' or '\r'
            ? "'" + valeur
            : valeur;

        // Guillemets doubles a l'interieur d'un champ entre guillemets.
        return $"\"{sur.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }

    /// <summary>Categorie de journalisation de la page de suivi.</summary>
    public sealed class Journal;
}
