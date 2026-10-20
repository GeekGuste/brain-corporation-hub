namespace BrainHub.Domain.Inscriptions;

/// <summary>
/// Trace d'un evenement Stripe deja traite.
///
/// Stripe REJOUE ses evenements : en cas de reponse lente, d'erreur reseau ou
/// de 5xx de notre part, le meme evenement revient, parfois plusieurs fois, et
/// parfois des heures plus tard. Sans cette table, une inscription pourrait
/// recevoir deux fois son email de confirmation, et son horodatage de
/// validation serait reecrit (CLAUDE.md §9).
///
/// Le principe : l'identifiant d'evenement est la cle primaire, et il est
/// insere DANS LA MEME TRANSACTION que la confirmation de l'inscription. Si
/// l'evenement revient, l'insertion viole la cle primaire et le traitement
/// s'arrete sans rien modifier. L'unicite est donc garantie par la base, pas
/// par un test prealable qui laisserait une fenetre entre la lecture et
/// l'ecriture.
/// </summary>
public sealed class EvenementStripeTraite
{
    /// <summary>Identifiant Stripe de l'evenement, de la forme « evt_... ».</summary>
    public required string Id { get; set; }

    /// <summary>Type de l'evenement, conserve pour le diagnostic.</summary>
    public required string Type { get; set; }

    public DateTimeOffset DateTraitement { get; set; }
}
