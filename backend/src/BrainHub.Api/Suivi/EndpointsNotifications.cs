using System.Globalization;
using BrainHub.Domain.Inscriptions;
using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Api.Suivi;

public sealed record DestinataireExpose(Guid Id, string Email, string? Libelle, DateTimeOffset DateAjout);

public sealed record DemandeDestinataire(string? Email, string? Libelle);

/// <summary>
/// Gestion des adresses prevenues d'un paiement confirme.
///
/// Ajout hors contrat initial, demande explicitement et accepte en V1. Ces
/// adresses sont INTERNES, celles des gestionnaires et des commerciaux : ce ne
/// sont pas des donnees de stagiaires.
///
/// Deux actions d'ecriture seulement, ajouter et retirer. Pas de modification :
/// corriger une adresse revient a retirer puis ajouter, et une liste de six
/// lignes ne justifie pas un formulaire d'edition.
/// </summary>
public static class EndpointsNotifications
{
    public static void MapperNotifications(this IEndpointRouteBuilder routes)
    {
        var groupe = routes
            .MapGroup("/suivi/notifications")
            .WithTags("Suivi")
            .RequireAuthorization();

        groupe.MapGet("/", async (BrainHubDbContext contexte, CancellationToken annulation) =>
        {
            var destinataires = await contexte.DestinatairesNotification
                .AsNoTracking()
                .OrderBy(destinataire => destinataire.Email)
                .Select(destinataire => new DestinataireExpose(
                    destinataire.Id,
                    destinataire.Email,
                    destinataire.Libelle,
                    destinataire.DateAjout))
                .ToListAsync(annulation);

            return Results.Ok(destinataires);
        });

        groupe.MapPost("/", async (
            DemandeDestinataire demande,
            BrainHubDbContext contexte,
            TimeProvider horloge,
            ILogger<EndpointsSuivi.Journal> journal,
            CancellationToken annulation) =>
        {
            var email = demande.Email?.Trim().ToLower(CultureInfo.InvariantCulture);

            if (string.IsNullOrWhiteSpace(email) || !EmailPlausible(email))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["email"] = ["Cette adresse email ne semble pas valide."],
                });
            }

            // L'unicite est portee par la base, mais on repond proprement
            // plutot que de laisser remonter une violation de contrainte.
            if (await contexte.DestinatairesNotification
                    .AnyAsync(destinataire => destinataire.Email == email, annulation))
            {
                return Results.Conflict(new { code = "deja-present" });
            }

            var libelle = demande.Libelle?.Trim();

            var destinataire = new DestinataireNotification
            {
                Id = Guid.CreateVersion7(),
                Email = email,
                Libelle = string.IsNullOrWhiteSpace(libelle) ? null : libelle,
                DateAjout = horloge.GetUtcNow(),
            };

            contexte.DestinatairesNotification.Add(destinataire);
            await contexte.SaveChangesAsync(annulation);

            journal.LogInformation("Destinataire de notification {Id} ajoute", destinataire.Id);

            return Results.Created(
                $"/suivi/notifications/{destinataire.Id}",
                new DestinataireExpose(
                    destinataire.Id,
                    destinataire.Email,
                    destinataire.Libelle,
                    destinataire.DateAjout));
        });

        groupe.MapDelete("/{id:guid}", async (
            Guid id,
            BrainHubDbContext contexte,
            ILogger<EndpointsSuivi.Journal> journal,
            CancellationToken annulation) =>
        {
            var supprimes = await contexte.DestinatairesNotification
                .Where(destinataire => destinataire.Id == id)
                .ExecuteDeleteAsync(annulation);

            if (supprimes == 0)
            {
                return Results.NotFound();
            }

            journal.LogInformation("Destinataire de notification {Id} retire", id);
            return Results.NoContent();
        });
    }

    /// <summary>
    /// Controle de forme, identique a celui des inscriptions : deliberement
    /// permissif, la seule preuve qu'une adresse existe est l'email qui y
    /// arrive.
    /// </summary>
    private static bool EmailPlausible(string email)
    {
        if (email.Length > 254)
        {
            return false;
        }

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
