using System.Threading.RateLimiting;
using BrainHub.Api.Inscriptions;
using BrainHub.Infrastructure;
using BrainHub.Infrastructure.Persistence;
using BrainHub.Infrastructure.Persistence.Seed;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

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
// Inscription
// -----------------------------------------------------------------------------
// TimeProvider plutot que DateTimeOffset.UtcNow : les horodatages de soumission
// et de validation sont des donnees metier (ils determinent l'ordre d'arrivee,
// CLAUDE.md §6), ils doivent donc etre testables sans attendre le calendrier.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ServiceInscription>();

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

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------
// A la RACINE, sans prefixe /api : c'est Apache qui retire ce prefixe en
// preprod et en production (ProxyPass /api/ vers la racine du conteneur), et le
// proxy de ng serve fait de meme en local. Le navigateur, lui, appelle toujours
// /api/... (CLAUDE.md §11).
app.MapperReferentiels();
app.MapperInscriptions();

app.MapHealthChecks("/sante/vivant", new()
{
    Predicate = _ => false,
});

app.MapHealthChecks("/sante/pret", new()
{
    Predicate = verification => verification.Tags.Contains("pret"),
});

app.Run();
