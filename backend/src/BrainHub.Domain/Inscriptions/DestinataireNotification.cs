namespace BrainHub.Domain.Inscriptions;

/// <summary>
/// Une adresse a prevenir quand un paiement est confirme.
///
/// Ce sont des adresses INTERNES, celles des gestionnaires et des commerciaux,
/// saisies par l'administrateur depuis le back-office. Ce ne sont pas des
/// donnees de stagiaires : elles ne relevent pas de la minimisation du §6, qui
/// porte sur les personnes inscrites.
///
/// Ajout hors contrat initial, demande explicitement et accepte en V1.
/// </summary>
public sealed class DestinataireNotification
{
    public Guid Id { get; set; }

    /// <summary>
    /// Adresse de notification. UNIQUE : la meme personne ajoutee deux fois
    /// recevrait deux messages identiques, et l'erreur ne se verrait pas dans
    /// une liste qui s'allonge.
    /// </summary>
    public required string Email { get; set; }

    /// <summary>
    /// Qui c'est, en clair. Facultatif, mais une liste de six adresses sans
    /// nom devient vite illisible quand il faut en retirer une.
    /// </summary>
    public string? Libelle { get; set; }

    public DateTimeOffset DateAjout { get; set; }
}
