using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace BrainHub.Api.Suivi;

/// <summary>
/// Connexion du compte administrateur unique de la page de suivi.
/// </summary>
public sealed class ServiceAuthentification(
    IOptions<OptionsAdministration> options,
    ILogger<ServiceAuthentification> journal)
{
    private readonly OptionsAdministration _options = options.Value;
    private static readonly PasswordHasher<object> Hasheur = new();
    private static readonly object Porteur = new();

    /// <summary>Produit le condensat d'un mot de passe, pour la configuration.</summary>
    public static string Hacher(string motDePasse) => Hasheur.HashPassword(Porteur, motDePasse);

    /// <summary>
    /// Verifie les identifiants et ouvre la session.
    ///
    /// Le condensat est TOUJOURS verifie, meme quand l'identifiant est faux :
    /// sinon le temps de reponse revelerait si un identifiant existe. Et la
    /// comparaison de l'identifiant est a temps constant, pour la meme raison.
    /// </summary>
    public async Task<bool> ConnecterAsync(
        HttpContext contexte,
        string? identifiant,
        string? motDePasse)
    {
        var identifiantValide = ComparerATempsConstant(identifiant, _options.Identifiant);

        var resultat = Hasheur.VerifyHashedPassword(
            Porteur,
            _options.HashMotDePasse,
            motDePasse ?? string.Empty);

        var motDePasseValide = resultat is PasswordVerificationResult.Success
            or PasswordVerificationResult.SuccessRehashNeeded;

        if (!identifiantValide || !motDePasseValide)
        {
            // Jamais l'identifiant essaye dans le journal : il finirait dans
            // les fichiers de log, et un mot de passe saisi dans le mauvais
            // champ avec lui.
            journal.LogWarning(
                "Echec de connexion a la page de suivi depuis {Adresse}",
                contexte.Connection.RemoteIpAddress);
            return false;
        }

        var identite = new ClaimsIdentity(
            [new Claim(ClaimTypes.Name, _options.Identifiant)],
            CookieAuthenticationDefaults.AuthenticationScheme);

        await contexte.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identite),
            new AuthenticationProperties
            {
                // Pas de « se souvenir de moi » : la session meurt avec le
                // navigateur ou a l'expiration, celle qui arrive en premier.
                IsPersistent = false,
                ExpiresUtc = DateTimeOffset.UtcNow.AddMinutes(_options.MinutesDeSession),
            });

        journal.LogInformation("Connexion a la page de suivi reussie");
        return true;
    }

    public static Task DeconnecterAsync(HttpContext contexte) =>
        contexte.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

    /// <summary>
    /// Comparaison a temps constant : une comparaison ordinaire s'arrete au
    /// premier caractere different, et la duree trahirait la longueur du
    /// prefixe correct.
    /// </summary>
    private static bool ComparerATempsConstant(string? gauche, string droite)
    {
        var octetsGauche = Encoding.UTF8.GetBytes(gauche ?? string.Empty);
        var octetsDroite = Encoding.UTF8.GetBytes(droite);
        return CryptographicOperations.FixedTimeEquals(
            SHA256.HashData(octetsGauche),
            SHA256.HashData(octetsDroite));
    }
}
