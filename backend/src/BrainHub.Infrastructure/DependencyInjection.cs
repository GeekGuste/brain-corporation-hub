using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BrainHub.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Branche la persistance PostgreSQL.
    ///
    /// La chaine de connexion vient exclusivement de la configuration, donc en
    /// pratique d'une variable d'environnement du conteneur
    /// (ConnectionStrings__BrainHub). Elle n'est jamais dans l'image ni dans le
    /// depot (CLAUDE.md §11 et §15).
    /// </summary>
    public static IServiceCollection AjouterPersistance(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var chaineDeConnexion = configuration.GetConnectionString("BrainHub")
            ?? throw new InvalidOperationException(
                "La chaine de connexion « BrainHub » est absente. " +
                "Posez ConnectionStrings__BrainHub dans l'environnement.");

        services.AddDbContext<BrainHubDbContext>(options =>
            options.UseNpgsql(chaineDeConnexion, npgsql =>
            {
                // Une coupure reseau passagere entre le conteneur et PostgreSQL
                // sur l'hote ne doit pas faire echouer une requete.
                npgsql.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(5),
                    errorCodesToAdd: null);
            }));

        return services;
    }
}
