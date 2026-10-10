using BrainHub.Domain.Referentiels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrainHub.Infrastructure.Persistence.Configurations;

public sealed class ConfigurationCategorieTitreSejour
    : IEntityTypeConfiguration<CategorieTitreSejour>
{
    public void Configure(EntityTypeBuilder<CategorieTitreSejour> builder)
    {
        builder.ToTable("categorie_titre_sejour");

        // Le code du client est la cle : il est stable, lisible dans un export
        // CSV, et c'est lui que l'inscription referencera.
        builder.HasKey(categorie => categorie.Code);
        builder.Property(categorie => categorie.Code).HasMaxLength(3);

        builder.Property(categorie => categorie.Famille).HasMaxLength(150);

        builder
            .HasMany(categorie => categorie.SousCategories)
            .WithOne(sousCategorie => sousCategorie.Categorie)
            .HasForeignKey(sousCategorie => sousCategorie.CategorieCode)
            // Une famille ne se supprime pas : le chargement la desactive. Ce
            // garde-fou empeche une suppression en cascade d'emporter des
            // sous-categories auxquelles des inscriptions se rattachent.
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(categorie => categorie.Actif);
    }
}

public sealed class ConfigurationSousCategorieTitreSejour
    : IEntityTypeConfiguration<SousCategorieTitreSejour>
{
    public void Configure(EntityTypeBuilder<SousCategorieTitreSejour> builder)
    {
        builder.ToTable("sous_categorie_titre_sejour");

        builder.HasKey(sousCategorie => sousCategorie.Id);

        builder.Property(sousCategorie => sousCategorie.CategorieCode).HasMaxLength(3);
        builder.Property(sousCategorie => sousCategorie.Libelle).HasMaxLength(200);

        // Le fichier de reference ne donne aucun code de sous-categorie, juste
        // des libelles. Cette contrainte porte l'unicite metier et c'est sur elle
        // que le chargement se cale : relancer l'application ne cree jamais de
        // doublon.
        builder
            .HasIndex(sousCategorie => new { sousCategorie.CategorieCode, sousCategorie.Libelle })
            .IsUnique();
    }
}
