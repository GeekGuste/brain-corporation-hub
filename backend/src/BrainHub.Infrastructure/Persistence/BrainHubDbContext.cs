using BrainHub.Domain.Referentiels;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Infrastructure.Persistence;

/// <summary>
/// Contexte de persistance de l'application.
///
/// Il porte pour l'instant les referentiels, charges depuis le fichier versionne
/// data/referentiels.json au demarrage (CLAUDE.md §7). L'inscription arrive a
/// l'etape 4.
/// </summary>
public sealed class BrainHubDbContext(DbContextOptions<BrainHubDbContext> options)
    : DbContext(options)
{
    public DbSet<LigneReferentielTerritorial> ReferentielTerritorial => Set<LigneReferentielTerritorial>();

    public DbSet<CategorieTitreSejour> CategoriesTitreSejour => Set<CategorieTitreSejour>();

    public DbSet<SousCategorieTitreSejour> SousCategoriesTitreSejour => Set<SousCategorieTitreSejour>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Les configurations d'entites sont decouvertes dans cet assembly au
        // fur et a mesure des etapes, sans avoir a modifier ce fichier.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BrainHubDbContext).Assembly);
    }
}
