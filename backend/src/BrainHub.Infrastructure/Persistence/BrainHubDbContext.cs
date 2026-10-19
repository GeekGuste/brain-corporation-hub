using BrainHub.Domain.Inscriptions;
using BrainHub.Domain.Referentiels;
using Microsoft.EntityFrameworkCore;

namespace BrainHub.Infrastructure.Persistence;

/// <summary>
/// Contexte de persistance de l'application.
///
/// Il porte les referentiels, charges depuis le fichier versionne
/// data/referentiels.json au demarrage (CLAUDE.md §7), et les inscriptions.
///
/// Cohorte et Creneau sont declares pour que le schema puisse accueillir
/// l'avenant sans migration douloureuse, mais aucun code de V1 ne les lit ni ne
/// les ecrit (CLAUDE.md §8).
/// </summary>
public sealed class BrainHubDbContext(DbContextOptions<BrainHubDbContext> options)
    : DbContext(options)
{
    public DbSet<LigneReferentielTerritorial> ReferentielTerritorial => Set<LigneReferentielTerritorial>();

    public DbSet<CategorieTitreSejour> CategoriesTitreSejour => Set<CategorieTitreSejour>();

    public DbSet<SousCategorieTitreSejour> SousCategoriesTitreSejour => Set<SousCategorieTitreSejour>();

    public DbSet<Inscription> Inscriptions => Set<Inscription>();

    public DbSet<Cohorte> Cohortes => Set<Cohorte>();

    public DbSet<Creneau> Creneaux => Set<Creneau>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Les configurations d'entites sont decouvertes dans cet assembly au
        // fur et a mesure des etapes, sans avoir a modifier ce fichier.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BrainHubDbContext).Assembly);
    }
}
