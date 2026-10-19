using System.Globalization;
using BrainHub.Api.Paiement;
using BrainHub.Domain.Inscriptions;
using BrainHub.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Stripe;

namespace BrainHub.Api.Inscriptions;

/// <summary>Resultat d'une tentative de creation.</summary>
public abstract record ResultatInscription
{
    public sealed record Creee(ReponseInscription Reponse) : ResultatInscription;

    /// <summary>Champs en erreur, un message par champ (CLAUDE.md §13).</summary>
    public sealed record Invalide(Dictionary<string, string[]> Erreurs) : ResultatInscription;

    /// <summary>
    /// L'email porte deja une inscription confirmee et le visiteur n'a pas
    /// confirme vouloir en creer une autre (CLAUDE.md §6).
    /// </summary>
    public sealed record DoublonAConfirmer : ResultatInscription;

    /// <summary>
    /// L'inscription est enregistree mais Stripe n'a pas pu ouvrir le paiement.
    /// La ligne reste « en attente de paiement » et sera purgee : on ne laisse
    /// pas le visiteur devant un formulaire muet.
    /// </summary>
    public sealed record PaiementIndisponible : ResultatInscription;
}

/// <summary>
/// Validation et creation d'une inscription.
///
/// Tout est revalide ici, independamment du formulaire : le navigateur n'est
/// jamais la source de verite (CLAUDE.md §15). Les codes de categorie, de
/// sous-categorie et de departement sont confrontes au referentiel en base, et
/// le barreau requis est DERIVE, jamais recu du client.
/// </summary>
public sealed class ServiceInscription(
    BrainHubDbContext contexte,
    IOptions<OptionsFormation> formation,
    ServicePaiement paiement,
    TimeProvider horloge,
    ILogger<ServiceInscription> journal)
{
    private const int LongueurMaxCourte = 100;

    public async Task<bool> EmailDejaInscritAsync(string? email, CancellationToken annulation)
    {
        var normalise = NormaliserEmail(email);
        if (normalise is null)
        {
            return false;
        }

        // Seules les inscriptions CONFIRMEES comptent. Une inscription restee en
        // attente de paiement est le plus souvent la meme personne qui reessaie
        // apres un echec : l'avertir d'un doublon la bloquerait sans raison,
        // alors que le but de ce controle est d'eviter un second paiement
        // involontaire (CLAUDE.md §6).
        return await contexte.Inscriptions
            .AsNoTracking()
            .AnyAsync(
                inscription => inscription.Email == normalise
                    && inscription.Statut == StatutInscription.Confirmee,
                annulation);
    }

    public async Task<ResultatInscription> CreerAsync(
        DemandeInscription demande,
        CancellationToken annulation)
    {
        var erreurs = new Dictionary<string, string[]>();

        // --- Identite et coordonnees -----------------------------------------
        var nom = Nettoyer(demande.Nom);
        var prenom = Nettoyer(demande.Prenom);
        var email = NormaliserEmail(demande.Email);
        var telephone = Nettoyer(demande.Telephone);

        if (nom is null)
        {
            Ajouter(erreurs, "nom", "Indiquez votre nom.");
        }
        else if (nom.Length > LongueurMaxCourte)
        {
            Ajouter(erreurs, "nom", "Ce nom est trop long.");
        }

        if (prenom is null)
        {
            Ajouter(erreurs, "prenom", "Indiquez votre prénom.");
        }
        else if (prenom.Length > LongueurMaxCourte)
        {
            Ajouter(erreurs, "prenom", "Ce prénom est trop long.");
        }

        if (email is null)
        {
            Ajouter(erreurs, "email", "Indiquez votre adresse email.");
        }
        else if (!EmailPlausible(email))
        {
            Ajouter(erreurs, "email", "Cette adresse email ne semble pas valide.");
        }

        if (telephone is not null && telephone.Length > 30)
        {
            Ajouter(erreurs, "telephone", "Ce numéro est trop long.");
        }

        // --- Statut de residence ---------------------------------------------
        if (!Enum.TryParse<StatutResidence>(demande.StatutResidence, out var statutResidence))
        {
            Ajouter(erreurs, "statutResidence", "Indiquez où vous résidez actuellement.");
        }

        // --- Categorie de titre de sejour ------------------------------------
        var codeCategorie = Nettoyer(demande.CategorieCode)?.ToUpperInvariant();
        var categorie = codeCategorie is null
            ? null
            : await contexte.CategoriesTitreSejour
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    c => c.Code == codeCategorie && c.Actif,
                    annulation);

        if (codeCategorie is null)
        {
            Ajouter(erreurs, "categorieCode", "Choisissez la catégorie de votre titre de séjour.");
        }
        else if (categorie is null)
        {
            Ajouter(erreurs, "categorieCode", "Cette catégorie n'existe pas. Choisissez-en une dans la liste.");
        }

        // La sous-categorie est FACULTATIVE (CLAUDE.md §6). Mais si elle est
        // fournie, elle doit exister, etre active, et appartenir a la famille
        // choisie : autrement l'inscription dirait une chose incoherente.
        if (demande.SousCategorieId is { } sousCategorieId)
        {
            var appartient = await contexte.SousCategoriesTitreSejour
                .AsNoTracking()
                .AnyAsync(
                    sc => sc.Id == sousCategorieId
                        && sc.Actif
                        && sc.CategorieCode == codeCategorie,
                    annulation);

            if (!appartient)
            {
                Ajouter(
                    erreurs,
                    "sousCategorieId",
                    "Cette précision ne correspond pas à la catégorie choisie.");
            }
        }

        var precisionAutre = Nettoyer(demande.PrecisionAutreSituation);
        if (categorie?.PrecisionLibreObligatoire == true)
        {
            if (precisionAutre is null)
            {
                Ajouter(erreurs, "precisionAutreSituation", "Précisez votre situation.");
            }
            else if (precisionAutre.Length > 500)
            {
                Ajouter(erreurs, "precisionAutreSituation", "Cette précision est trop longue.");
            }
        }
        else
        {
            // Hors de la famille AUT, ce champ n'a pas de sens : on ne le
            // conserve pas, par minimisation (CLAUDE.md §6).
            precisionAutre = null;
        }

        // --- Prefecture, et derivation du barreau requis ----------------------
        var departement = Nettoyer(demande.DepartementPrefecture)?.ToUpperInvariant();
        var ligne = departement is null
            ? null
            : await contexte.ReferentielTerritorial
                .AsNoTracking()
                .FirstOrDefaultAsync(
                    l => l.Departement == departement && l.Actif,
                    annulation);

        if (departement is null)
        {
            Ajouter(erreurs, "departementPrefecture", "Choisissez votre préfecture.");
        }
        else if (ligne is null)
        {
            Ajouter(erreurs, "departementPrefecture", "Cette préfecture n'existe pas. Choisissez-en une dans la liste.");
        }

        // --- Champs propres aux residents a l'etranger ------------------------
        var pays = Nettoyer(demande.PaysResidenceActuelle);
        var communeProjetee = Nettoyer(demande.CommuneOuCodePostalProjete);
        var dateArrivee = demande.DateArriveePrevisionnelle;

        if (statutResidence == StatutResidence.ResidentALEtranger)
        {
            if (pays is null)
            {
                Ajouter(erreurs, "paysResidenceActuelle", "Indiquez votre pays de résidence actuelle.");
            }
            else if (pays.Length > LongueurMaxCourte)
            {
                Ajouter(erreurs, "paysResidenceActuelle", "Ce nom de pays est trop long.");
            }

            if (communeProjetee is not null && communeProjetee.Length > LongueurMaxCourte)
            {
                Ajouter(erreurs, "communeOuCodePostalProjete", "Cette valeur est trop longue.");
            }

            // Une date d'arrivee deja passee n'est pas une previsionnelle. Le
            // champ reste facultatif : c'est seulement sa valeur qui est
            // controlee quand elle est fournie.
            if (dateArrivee is { } date
                && date < DateOnly.FromDateTime(horloge.GetUtcNow().UtcDateTime))
            {
                Ajouter(
                    erreurs,
                    "dateArriveePrevisionnelle",
                    "Cette date est déjà passée. Laissez le champ vide si vous ne la connaissez pas encore.");
            }
        }
        else
        {
            // Resident en France : ces trois champs ne s'appliquent pas. On les
            // ecarte au lieu de refuser la requete, pour ne pas bloquer une
            // inscription a cause d'un residu de saisie apres changement de
            // reponse.
            pays = null;
            communeProjetee = null;
            dateArrivee = null;
        }

        if (erreurs.Count > 0)
        {
            return new ResultatInscription.Invalide(erreurs);
        }

        // --- Doublon d'email --------------------------------------------------
        if (!demande.DoublonEmailConfirme && await EmailDejaInscritAsync(email, annulation))
        {
            return new ResultatInscription.DoublonAConfirmer();
        }

        // --- Creation ---------------------------------------------------------
        var inscription = new Inscription
        {
            Id = Guid.CreateVersion7(),
            Nom = nom!,
            Prenom = prenom!,
            Email = email!,
            Telephone = telephone,
            StatutResidence = statutResidence,
            CategorieCode = categorie!.Code,
            SousCategorieId = demande.SousCategorieId,
            PrecisionAutreSituation = precisionAutre,
            DepartementPrefecture = ligne!.Departement,

            // Le barreau requis est DERIVE du referentiel, jamais recu du
            // client. Les trois libelles sont figes a cet instant : la grille
            // peut evoluer, l'inscription doit garder le rattachement qui
            // s'appliquait le jour ou elle a ete prise (CLAUDE.md §7).
            PrefectureLibelle = ligne.Prefecture,
            TribunalJudiciaireReference = ligne.TribunalJudiciaire,
            BarreauRequis = ligne.BarreauRequis,

            PaysResidenceActuelle = pays,
            DateArriveePrevisionnelle = dateArrivee,
            CommuneOuCodePostalProjete = communeProjetee,

            // En attente de paiement. La validation, donc l'horodatage qui
            // determine l'ordre d'arrivee, viendra du WEBHOOK et de lui seul
            // (CLAUDE.md §6 et §9).
            Statut = StatutInscription.EnAttenteDePaiement,
            DateSoumission = horloge.GetUtcNow(),
            DateValidation = null,
        };

        contexte.Inscriptions.Add(inscription);
        await contexte.SaveChangesAsync(annulation);

        // Journalisation volontairement pauvre : un identifiant et un barreau,
        // aucune donnee personnelle, aucune donnee de carte (CLAUDE.md §15).
        journal.LogInformation(
            "Inscription {Id} creee en attente de paiement, barreau requis {Barreau}",
            inscription.Id,
            inscription.BarreauRequis);

        // --- Ouverture du paiement --------------------------------------------
        //
        // APRES l'enregistrement, jamais avant : le PaymentIntent porte
        // l'identifiant de l'inscription dans ses metadonnees, il faut donc que
        // la ligne existe (CLAUDE.md §9.3).
        IntentionDePaiement intention;
        try
        {
            intention = await paiement.CreerAsync(inscription, annulation);
        }
        catch (StripeException exception)
        {
            // L'inscription reste « en attente de paiement » et sera purgee.
            // On ne journalise que le message de Stripe, qui ne contient aucune
            // donnee de carte.
            journal.LogError(
                exception,
                "Stripe a refuse d'ouvrir le paiement pour l'inscription {Id}",
                inscription.Id);
            return new ResultatInscription.PaiementIndisponible();
        }

        inscription.IdentifiantPaymentIntent = ExtraireIdentifiantIntent(intention.ClientSecret);
        await contexte.SaveChangesAsync(annulation);

        return new ResultatInscription.Creee(new ReponseInscription(
            inscription.Id,
            inscription.Statut.ToString(),
            inscription.PrefectureLibelle,
            inscription.TribunalJudiciaireReference,
            inscription.BarreauRequis,
            formation.Value.MontantCentimes,
            formation.Value.Devise,
            intention.ClientSecret,
            intention.ClePubliable));
    }

    /// <summary>
    /// Etat d'une inscription, pour l'interrogation qui suit le retour de
    /// Stripe (CLAUDE.md §9.6). Renvoie null si l'identifiant est inconnu.
    /// </summary>
    public async Task<string?> StatutAsync(Guid id, CancellationToken annulation)
    {
        var statut = await contexte.Inscriptions
            .AsNoTracking()
            .Where(inscription => inscription.Id == id)
            .Select(inscription => (StatutInscription?)inscription.Statut)
            .FirstOrDefaultAsync(annulation);

        return statut?.ToString();
    }

    /// <summary>
    /// Le « client_secret » a la forme « pi_XXX_secret_YYY ». On n'en conserve
    /// que la partie identifiante, « pi_XXX » : c'est elle que le webhook
    /// reverra, et la seconde moitie est un secret qui n'a rien a faire en base.
    /// </summary>
    private static string ExtraireIdentifiantIntent(string clientSecret)
    {
        var separateur = clientSecret.IndexOf("_secret_", StringComparison.Ordinal);
        return separateur > 0 ? clientSecret[..separateur] : clientSecret;
    }

    // -------------------------------------------------------------------------
    // Outils
    // -------------------------------------------------------------------------

    private static void Ajouter(Dictionary<string, string[]> erreurs, string champ, string message) =>
        erreurs[champ] = [message];

    /// <summary>Vide ou blanc devient nul : « absent » n'a qu'une seule forme.</summary>
    private static string? Nettoyer(string? valeur) =>
        string.IsNullOrWhiteSpace(valeur) ? null : valeur.Trim();

    private static string? NormaliserEmail(string? valeur)
    {
        var nettoye = Nettoyer(valeur);
        return nettoye?.ToLower(CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Controle de forme, deliberement permissif : une adresse valide et exotique
    /// ne doit pas etre refusee a un public international. La seule preuve
    /// qu'une adresse existe est l'email qui y arrive.
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
