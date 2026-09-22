using Microsoft.EntityFrameworkCore;

namespace BrainHub.Infrastructure.Persistence;

/// <summary>
/// Contexte de persistance de l'application.
///
/// A l'etape 1, il ne porte aucune entite : il sert a etablir et a verifier la
/// connexion a PostgreSQL. Les referentiels (grille territoriale, categories de
/// titre de sejour) arrivent a l'etape 2, l'inscription a l'etape 4.
/// </summary>
public sealed class BrainHubDbContext(DbContextOptions<BrainHubDbContext> options)
    : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Les configurations d'entites sont decouvertes dans cet assembly au
        // fur et a mesure des etapes, sans avoir a modifier ce fichier.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BrainHubDbContext).Assembly);
    }
}
