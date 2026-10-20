using BrainHub.Domain.Inscriptions;
using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Api.Inscriptions;

/// <summary>
/// Purge periodique des inscriptions restees « en attente de paiement »
/// (CLAUDE.md §9).
///
/// Ces lignes sont des paniers abandonnes : un visiteur a rempli le formulaire
/// puis n'a pas paye. Elles portent des donnees personnelles sensibles par
/// nature, et la minimisation RGPD ne se limite pas a ce qu'on collecte, elle
/// porte aussi sur ce qu'on garde (CLAUDE.md §6 et §15).
///
/// Seules les inscriptions NON confirmees sont concernees. Une inscription
/// confirmee n'est jamais touchee ici : sa suppression est une action manuelle
/// de la page de suivi (§5.7).
///
/// Le delai est large a dessein. Un paiement par carte qui demande une
/// authentification peut prendre plusieurs minutes, et un evenement Stripe
/// tardif doit encore trouver sa ligne : purger trop tot ferait perdre des
/// paiements reellement aboutis.
/// </summary>
public sealed class ServicePurge(
    IServiceProvider fournisseur,
    IConfiguration configuration,
    TimeProvider horloge,
    ILogger<ServicePurge> journal) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken annulation)
    {
        var heuresDeRetention = configuration.GetValue<int?>("Purge:HeuresAvantSuppression") ?? 48;
        var heuresEntreDeuxPassages = configuration.GetValue<int?>("Purge:HeuresEntreDeuxPassages") ?? 6;

        if (heuresDeRetention <= 0)
        {
            journal.LogInformation("Purge desactivee par la configuration.");
            return;
        }

        // Un premier passage au demarrage serait fait pendant que l'application
        // applique ses migrations et charge ses referentiels. On laisse passer
        // la mise en route.
        try
        {
            await Task.Delay(TimeSpan.FromMinutes(5), horloge, annulation);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!annulation.IsCancellationRequested)
        {
            try
            {
                await PurgerAsync(heuresDeRetention, annulation);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // Une purge qui echoue ne doit jamais arreter l'application ni
                // empecher le passage suivant.
                journal.LogError(exception, "La purge des inscriptions a echoue.");
            }

            try
            {
                await Task.Delay(TimeSpan.FromHours(heuresEntreDeuxPassages), horloge, annulation);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private async Task PurgerAsync(int heuresDeRetention, CancellationToken annulation)
    {
        using var portee = fournisseur.CreateScope();
        var contexte = portee.ServiceProvider.GetRequiredService<BrainHubDbContext>();

        var limite = horloge.GetUtcNow().AddHours(-heuresDeRetention);

        var supprimees = await contexte.Inscriptions
            .Where(inscription =>
                inscription.Statut != StatutInscription.Confirmee
                && inscription.DateSoumission < limite)
            .ExecuteDeleteAsync(annulation);

        // Les traces d'evenements Stripe ne servent qu'a l'idempotence. Stripe
        // cesse de rejouer bien avant un mois : au-dela, les garder n'apporte
        // rien et fait grossir la table indefiniment.
        var tracesSupprimees = await contexte.EvenementsStripeTraites
            .Where(trace => trace.DateTraitement < horloge.GetUtcNow().AddDays(-30))
            .ExecuteDeleteAsync(annulation);

        if (supprimees > 0 || tracesSupprimees > 0)
        {
            journal.LogInformation(
                "Purge : {Inscriptions} inscription(s) non payee(s) de plus de {Heures} h, "
                + "{Traces} trace(s) d'evenement de plus de 30 jours",
                supprimees,
                heuresDeRetention,
                tracesSupprimees);
        }
    }
}
