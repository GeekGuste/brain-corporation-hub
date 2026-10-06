using BrainHub.Domain.Referentiels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrainHub.Infrastructure.Persistence.Configurations;

public sealed class ConfigurationReferentielTerritorial
    : IEntityTypeConfiguration<LigneReferentielTerritorial>
{
    public void Configure(EntityTypeBuilder<LigneReferentielTerritorial> builder)
    {
        builder.ToTable("referentiel_territorial");

        // Le numero de departement est la cle naturelle : deux caracteres, pour
        // couvrir « 2A » et « 2B ». Un entier perdrait le zero initial et la
        // Corse.
        builder.HasKey(ligne => ligne.Departement);
        builder.Property(ligne => ligne.Departement).HasMaxLength(3);

        builder.Property(ligne => ligne.NomDepartement).HasMaxLength(100);
        builder.Property(ligne => ligne.Prefecture).HasMaxLength(100);
        builder.Property(ligne => ligne.TribunalJudiciaire).HasMaxLength(150);
        builder.Property(ligne => ligne.BarreauRequis).HasMaxLength(150);
        builder.Property(ligne => ligne.Note).HasMaxLength(500);

        // La page publique du referentiel (etape 8) et la liste des prefectures
        // du formulaire (etape 4) trient par departement et ne montrent que les
        // lignes actives.
        builder.HasIndex(ligne => ligne.Actif);
        builder.HasIndex(ligne => ligne.Prefecture);
    }
}
