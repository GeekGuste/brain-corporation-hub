namespace BrainHub.Domain.Inscriptions;

/// <summary>
/// Etats d'une inscription en V1.
///
/// Le cahier des charges du 17 septembre decrit un workflow a six etats, qui est
/// HORS PERIMETRE V1 (CLAUDE.md §8). Seuls les trois etats du parcours de
/// paiement existent ici. Les autres s'ajouteront a cette enumeration sans
/// toucher au reste du schema.
/// </summary>
public enum StatutInscription
{
    /// <summary>
    /// Creee par l'API avant l'appel a Stripe, le temps du paiement
    /// (CLAUDE.md §9.3). Les inscriptions restees dans cet etat sont purgees
    /// periodiquement.
    /// </summary>
    EnAttenteDePaiement = 0,

    /// <summary>
    /// Paiement confirme par le WEBHOOK, jamais par un evenement du navigateur
    /// (CLAUDE.md §9). C'est a ce moment que l'horodatage de validation est
    /// pose et que les emails partent.
    /// </summary>
    Confirmee = 1,

    /// <summary>Paiement refuse ou abandonne, signale par le webhook.</summary>
    PaiementEchoue = 2,
}

/// <summary>
/// Lieu de residence du candidat au moment de l'inscription (CLAUDE.md §6).
///
/// Il commande les champs du formulaire : un resident a l'etranger declare une
/// prefecture de residence PROJETEE, son pays actuel, et facultativement une
/// date d'arrivee et une commune projetee.
/// </summary>
public enum StatutResidence
{
    ResidentEnFrance = 0,
    ResidentALEtranger = 1,
}
