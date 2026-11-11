using System.Threading.RateLimiting;
using BrainHub.Api.Contact;
using BrainHub.Api.Emails;
using BrainHub.Api.Inscriptions;
using BrainHub.Api.Paiement;
using BrainHub.Api.Suivi;
using BrainHub.Infrastructure;
using BrainHub.Infrastructure.Persistence;
using BrainHub.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

// -----------------------------------------------------------------------------
// Production d'un condensat de mot de passe
// -----------------------------------------------------------------------------
// Avant toute mise en route : l'application sait produire le condensat du mot
// de passe administrateur, pour que personne n'ait a installer un outil tiers
// ni a coller un mot de passe dans un service en ligne (CLAUDE.md §15).
//
//   dotnet run -- --hash-mot-de-passe "le mot de passe choisi"
//
// Le resultat se pose dans Administration__HashMotDePasse, cote serveur. Le mot
// de passe en clair n'est jamais stocke nulle part.
if (args is [.., "--hash-mot-de-passe", var motDePasseAHacher])
{
    Console.WriteLine(ServiceAuthentification.Hacher(motDePasseAHacher));
    return;
}

var builder = WebApplication.CreateBuilder(args);

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------
// Les fichiers appsettings ne contiennent aucun secret. Tout ce qui est sensible
// (chaine de connexion, cles Stripe, cles Mailjet, identifiants d'administration)
// arrive par variable d'environnement, depuis le fichier .env du serveur
// (CLAUDE.md §11 et §15).

builder.Services.AjouterPersistance(builder.Configuration);

// -----------------------------------------------------------------------------
// Inscription et paiement
// -----------------------------------------------------------------------------
// TimeProvider plutot que DateTimeOffset.UtcNow : les horodatages de soumission
// et de validation sont des donnees metier (ils determinent l'ordre d'arrivee,
// CLAUDE.md §6), ils doivent donc etre testables sans attendre le calendrier.
builder.Services.AddSingleton(TimeProvider.System);

// ValidateOnStart : l'application REFUSE de demarrer si une cle Stripe ou le
// montant manquent. Un conteneur qui ne demarre pas est rattrape par le
// controle de sante du script de deploiement, qui revient au tag precedent
// (CLAUDE.md §11). Decouvrir une cle absente au premier paiement reel coute
// infiniment plus cher qu'une indisponibilite visible.
builder.Services
    .AddOptions<OptionsPaiement>()
    .Bind(builder.Configuration.GetSection(OptionsPaiement.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services
    .AddOptions<OptionsFormation>()
    .Bind(builder.Configuration.GetSection(OptionsFormation.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Les modeles d'email vivent dans Mailjet, ou le client les personnalise. Le
// back appelle un modele par son identifiant et lui passe des variables : aucun
// texte d'email n'est ecrit dans le code (CLAUDE.md §16).
builder.Services
    .AddOptions<OptionsEmail>()
    .Bind(builder.Configuration.GetSection(OptionsEmail.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddScoped<ServicePaiement>();
builder.Services.AddScoped<ServiceInscription>();

// Delai court : le webhook doit repondre vite a Stripe, et un envoi d'email qui
// traine ne doit pas faire expirer la livraison de l'evenement.
builder.Services
    .AddHttpClient<ServiceEmail>(client => client.Timeout = TimeSpan.FromSeconds(10));

// Purge des inscriptions restees en attente de paiement (CLAUDE.md §9).
builder.Services.AddHostedService<ServicePurge>();

// -----------------------------------------------------------------------------
// Page de suivi : compte administrateur unique
// -----------------------------------------------------------------------------
// Un seul compte, pas de roles, pas d'inscription : la gestion de comptes
// utilisateurs est hors perimetre V1 (CLAUDE.md §5.7 et §8).
builder.Services
    .AddOptions<OptionsAdministration>()
    .Bind(builder.Configuration.GetSection(OptionsAdministration.Section))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddScoped<ServiceAuthentification>();

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "brainhub.suivi";
        // Inaccessible au JavaScript : meme en cas de faille d'injection sur
        // le site, le cookie de session ne peut pas etre lu.
        options.Cookie.HttpOnly = true;
        // Jamais transmis en clair en ligne. En developpement local, le site
        // tourne en HTTP : exiger HTTPS y rendrait la connexion impossible.
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        // Le cookie ne part pas avec une requete venue d'un autre site : c'est
        // ce qui ferme la falsification de requete intersite sur les deux
        // actions d'ecriture.
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.SlidingExpiration = true;

        // Une API ne redirige pas vers une page de connexion : elle repond 401
        // et 403, et c'est le front qui decide quoi afficher.
        options.Events.OnRedirectToLogin = contexte =>
        {
            contexte.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = contexte =>
        {
            contexte.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

builder.Services.AddAuthorization();

// -----------------------------------------------------------------------------
// Limitation de debit
// -----------------------------------------------------------------------------
// Pour le seul controle de doublon d'email. Il ne renvoie qu'un booleen, mais
// sans limite il permettrait d'enumerer des adresses pour savoir qui est inscrit
// a une formation sur le droit au sejour (CLAUDE.md §15).
//
// Le partitionnement se fait sur l'adresse du client, lue APRES le middleware de
// forwarded headers : derriere Apache, sans cela, tout le trafic partagerait la
// seule adresse du proxy et la limite tomberait sur tout le monde a la fois.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    // Connexion a la page de suivi : cinq essais par minute et par adresse.
    // C est la seule porte vers des donnees sensibles par nature, et sans
    // limite un mot de passe faible tomberait en quelques heures
    // (CLAUDE.md §15).
    options.AddPolicy(EndpointsSuivi.LimiteConnexion, contexte =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: contexte.Connection.RemoteIpAddress?.ToString() ?? "inconnu",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    options.AddPolicy(EndpointsInscription.LimiteVerificationEmail, contexte =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: contexte.Connection.RemoteIpAddress?.ToString() ?? "inconnu",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                // Dix essais par minute : largement au-dessus d'une saisie
                // humaine, qui corrige une adresse deux ou trois fois, et bien
                // en dessous de ce qu'exige un balayage de liste.
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    // Formulaire de contact : huit envois par dix minutes et par adresse.
    //
    // Le compte inclut les envois REFUSES, parce que le limiteur s execute
    // avant la validation : une personne qui corrige son adresse email deux
    // fois a deja consomme trois jetons. Huit laisse donc la place aux
    // corrections, et laisse aussi passer deux adresses derriere un meme
    // routeur, sans pour autant permettre d inonder les boites internes. Le
    // champ piege arrete de son cote la plupart des robots.
    options.AddPolicy(EndpointsContact.LimiteEnvoi, contexte =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: contexte.Connection.RemoteIpAddress?.ToString() ?? "inconnu",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 8,
                Window = TimeSpan.FromMinutes(10),
                QueueLimit = 0,
            }));
});

// -----------------------------------------------------------------------------
// Derriere le proxy
// -----------------------------------------------------------------------------
// Apache termine le HTTPS et transmet la requete a Kestrel en clair sur le
// reseau local du conteneur. Sans ce middleware, l'application se croit en HTTP :
// les URL generees sont fausses et la verification de la signature du webhook
// Stripe casse (CLAUDE.md §11).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor
        | ForwardedHeaders.XForwardedProto
        | ForwardedHeaders.XForwardedHost;

    // Le proxy est sur la machine, sur le reseau bridge Docker. On ne connait
    // pas son adresse à l'avance, mais on sait qu'il n'y en a qu'un seul devant
    // nous, et que le port n'est publié que sur la boucle locale.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// -----------------------------------------------------------------------------
// CORS
// -----------------------------------------------------------------------------
// En production, le navigateur appelle /api sur le meme domaine que le site :
// il n'y a pas de requete d'origine croisee. CORS ne sert qu'au developpement
// local, ou le serveur Angular et l'API n'ont pas le meme port. La liste vient
// de la configuration, jamais du code.
const string PolitiqueCors = "origines-autorisees";
var originesAutorisees = builder.Configuration
    .GetSection("Cors:OriginesAutorisees")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
    options.AddPolicy(PolitiqueCors, politique =>
    {
        if (originesAutorisees.Length == 0)
        {
            return;
        }

        politique
            .WithOrigins(originesAutorisees)
            .AllowAnyHeader()
            .AllowAnyMethod();
    }));

// -----------------------------------------------------------------------------
// Etat de sante
// -----------------------------------------------------------------------------
// /sante/vivant repond des que le processus tourne : c'est ce que regarde Docker.
// /sante/pret ouvre en plus une connexion a PostgreSQL : c'est ce que regarde le
// script de deploiement avant de considerer la mise en ligne reussie.
builder.Services
    .AddHealthChecks()
    .AddDbContextCheck<BrainHubDbContext>("postgresql", tags: ["pret"]);

builder.Services.AddOpenApi();

var app = builder.Build();

// -----------------------------------------------------------------------------
// Migrations
// -----------------------------------------------------------------------------
// Appliquees au demarrage du conteneur, sur le serveur, jamais depuis la CI
// (CLAUDE.md §11). Le script de deploiement prend une sauvegarde de la base
// juste avant de lancer le conteneur : si une migration se passe mal, le
// controle de sante echoue, le script revient au tag precedent, et la
// sauvegarde est la.
//
// Le drapeau est pose par le compose du serveur uniquement. En local, on
// applique les migrations a la main.
using (var portee = app.Services.CreateScope())
{
    var fournisseur = portee.ServiceProvider;

    if (app.Configuration.GetValue<bool>("AppliquerMigrationsAuDemarrage"))
    {
        var contexte = fournisseur.GetRequiredService<BrainHubDbContext>();
        await contexte.Database.MigrateAsync();
    }

    // -------------------------------------------------------------------------
    // Referentiels
    // -------------------------------------------------------------------------
    // Charges a CHAQUE demarrage, de facon idempotente (CLAUDE.md §7). Ce n'est
    // pas conditionne par le drapeau des migrations : le referentiel doit etre
    // present et a jour en local comme sur le serveur.
    //
    // Si le chargement echoue, l'application ne demarre pas. C'est voulu : un
    // formulaire d'inscription dont la liste des prefectures est vide ou
    // tronquee ferait plus de degats qu'une indisponibilite visible.
    var cheminReferentiels = Path.Combine(
        app.Environment.ContentRootPath,
        app.Configuration.GetValue<string>("Referentiels:CheminFichier")
            ?? "data/referentiels.json");

    var chargeur = fournisseur.GetRequiredService<ChargeurReferentiels>();
    await chargeur.ChargerAsync(cheminReferentiels);
}

app.UseForwardedHeaders();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(PolitiqueCors);

// Apres UseForwardedHeaders, pour que la limite porte sur l'adresse du visiteur
// et non sur celle du proxy.
app.UseRateLimiter();

// Avant les endpoints, et apres CORS : l identite doit etre etablie avant que
// l autorisation ne la verifie.
app.UseAuthentication();
app.UseAuthorization();

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------
// A la RACINE, sans prefixe /api : c'est Apache qui retire ce prefixe en
// preprod et en production (ProxyPass /api/ vers la racine du conteneur), et le
// proxy de ng serve fait de meme en local. Le navigateur, lui, appelle toujours
// /api/... (CLAUDE.md §11).
app.MapperWebhookStripe();
app.MapperSuivi();
app.MapperNotifications();
app.MapperReferentiels();
app.MapperInscriptions();
app.MapperContact();

app.MapHealthChecks("/sante/vivant", new()
{
    Predicate = _ => false,
});

app.MapHealthChecks("/sante/pret", new()
{
    Predicate = verification => verification.Tags.Contains("pret"),
});

app.Run();
