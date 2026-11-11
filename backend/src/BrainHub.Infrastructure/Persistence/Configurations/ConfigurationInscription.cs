using BrainHub.Domain.Inscriptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BrainHub.Infrastructure.Persistence.Configurations;

public sealed class ConfigurationInscription : IEntityTypeConfiguration<Inscription>
{
    public void Configure(EntityTypeBuilder<Inscription> builder)
    {
        builder.ToTable("inscription");

        builder.HasKey(inscription => inscription.Id);

        // --- Identite et coordonnees -----------------------------------------
        builder.Property(inscription => inscription.Nom).HasMaxLength(100);
        builder.Property(inscription => inscription.Prenom).HasMaxLength(100);
        builder.Property(inscription => inscription.Email).HasMaxLength(254);
        builder.Property(inscription => inscription.Telephone).HasMaxLength(30);

        // PAS d'index unique sur l'email : plusieurs inscriptions peuvent le
        // partager, une personne pouvant inscrire un proche (CLAUDE.md §6).
        // L'index sert au controle de doublon et a la page de suivi.
        builder.HasIndex(inscription => inscription.Email);

        // --- Situation administrative ----------------------------------------
        // Les enumerations sont stockees en texte et non en entier : une base
        // relue a la main, un export CSV ou une requete de depannage restent
        // lisibles, et l'ajout d'un etat ne decale jamais les valeurs
        // existantes.
        builder.Property(inscription => inscription.StatutResidence)
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(inscription => inscription.CategorieCode).HasMaxLength(3);
        builder.Property(inscription => inscription.PrecisionAutreSituation).HasMaxLength(500);

        builder
            .HasOne(inscription => inscription.Categorie)
            .WithMany()
            .HasForeignKey(inscription => inscription.CategorieCode)
            // Une famille retiree du referentiel est desactivee, jamais
            // supprimee : la restriction documente l'intention au niveau de la
            // base, en plus du code de chargement.
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(inscription => inscription.SousCategorie)
            .WithMany()
            .HasForeignKey(inscription => inscription.SousCategorieId)
            .OnDelete(DeleteBehavior.Restrict);

        // --- Rattachement territorial ----------------------------------------
        builder.Property(inscription => inscription.DepartementPrefecture).HasMaxLength(3);
        builder.Property(inscription => inscription.PrefectureLibelle).HasMaxLength(100);
        builder.Property(inscription => inscription.TribunalJudiciaireReference).HasMaxLength(150);
        builder.Property(inscription => inscription.BarreauRequis).HasMaxLength(150);

        builder
            .HasOne(inscription => inscription.LignePrefecture)
            .WithMany()
            .HasForeignKey(inscription => inscription.DepartementPrefecture)
            .OnDelete(DeleteBehavior.Restrict);

        // La page de suivi affiche et exporte par barreau : c'est le tri du
        // gestionnaire pour constituer les groupes a la main.
        builder.HasIndex(inscription => inscription.BarreauRequis);

        // --- Residents a l'etranger ------------------------------------------
        builder.Property(inscription => inscription.PaysResidenceActuelle).HasMaxLength(100);
        builder.Property(inscription => inscription.CommuneOuCodePostalProjete).HasMaxLength(100);

        // --- Cycle de vie ------------------------------------------------------
        builder.Property(inscription => inscription.Statut)
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(inscription => inscription.IdentifiantPaymentIntent).HasMaxLength(255);

        // Le webhook retrouve l'inscription par cet identifiant, et doit rester
        // idempotent (CLAUDE.md §9) : l'unicite l'y aide, et le filtre partiel
        // laisse coexister toutes les inscriptions pas encore passees au
        // paiement, dont la colonne est nulle.
        // Le nom est entre guillemets : les tables du projet sont en
        // minuscules, mais les colonnes gardent la casse de la propriete, et
        // PostgreSQL replie tout identifiant non protege en minuscules.
        builder
            .HasIndex(inscription => inscription.IdentifiantPaymentIntent)
            .IsUnique()
            .HasFilter("\"IdentifiantPaymentIntent\" IS NOT NULL");

        // La purge des inscriptions restees en attente balaye sur ce couple
        // (CLAUDE.md §9), et la page de suivi trie par date de validation.
        builder.HasIndex(inscription => new { inscription.Statut, inscription.DateSoumission });
        builder.HasIndex(inscription => inscription.DateValidation);

        // --- Hors perimetre V1 -------------------------------------------------
        builder
            .HasOne(inscription => inscription.Cohorte)
            .WithMany(cohorte => cohorte.Inscriptions)
            .HasForeignKey(inscription => inscription.CohorteId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

/// <summary>
/// Cohorte et creneau sont declares dans le schema mais inexploites en V1
/// (CLAUDE.md §8). Les deux configurations tiennent dans ce fichier : il n'y a
/// rien a y lire tant que l'avenant n'est pas signe.
/// </summary>
public sealed class ConfigurationCohorte : IEntityTypeConfiguration<Cohorte>
{
    public void Configure(EntityTypeBuilder<Cohorte> builder)
    {
        builder.ToTable("cohorte");
        builder.HasKey(cohorte => cohorte.Id);
        builder.Property(cohorte => cohorte.BarreauRequis).HasMaxLength(150);
        builder.Property(cohorte => cohorte.CategorieCode).HasMaxLength(3);

        builder
            .HasOne(cohorte => cohorte.Creneau)
            .WithMany(creneau => creneau.Cohortes)
            .HasForeignKey(cohorte => cohorte.CreneauId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class ConfigurationCreneau : IEntityTypeConfiguration<Creneau>
{
    public void Configure(EntityTypeBuilder<Creneau> builder)
    {
        builder.ToTable("creneau");
        builder.HasKey(creneau => creneau.Id);
    }
}

/// <summary>
/// Trace des evenements Stripe deja traites, qui porte l'idempotence du
/// webhook (CLAUDE.md §9).
/// </summary>
public sealed class ConfigurationEvenementStripeTraite
    : IEntityTypeConfiguration<EvenementStripeTraite>
{
    public void Configure(EntityTypeBuilder<EvenementStripeTraite> builder)
    {
        builder.ToTable("evenement_stripe_traite");

        // L'identifiant Stripe EST la cle primaire : c'est la base qui refuse
        // le doublon, pas un test prealable qui laisserait une fenetre entre
        // la lecture et l'ecriture.
        builder.HasKey(evenement => evenement.Id);
        builder.Property(evenement => evenement.Id).HasMaxLength(255);
        builder.Property(evenement => evenement.Type).HasMaxLength(100);

        // La purge des traces anciennes balaye sur la date.
        builder.HasIndex(evenement => evenement.DateTraitement);
    }
}

/// <summary>
/// Adresses internes a prevenir d'un paiement confirme.
/// </summary>
public sealed class ConfigurationDestinataireNotification
    : IEntityTypeConfiguration<DestinataireNotification>
{
    public void Configure(EntityTypeBuilder<DestinataireNotification> builder)
    {
        builder.ToTable("destinataire_notification");

        builder.HasKey(destinataire => destinataire.Id);
        builder.Property(destinataire => destinataire.Email).HasMaxLength(254);
        builder.Property(destinataire => destinataire.Libelle).HasMaxLength(100);

        // Unicite portee par la base : un doublon ajoute par inadvertance
        // enverrait deux fois le meme message, et ne se verrait pas.
        builder.HasIndex(destinataire => destinataire.Email).IsUnique();
    }
}
