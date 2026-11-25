using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.JSInterop;

namespace Vehicules.Web.Services;

/// <summary>Adresse et clé publique du projet Supabase (wwwroot/appsettings.json).</summary>
public sealed record OptionsSupabase(string? Url, string? AnonKey)
{
    public bool Configure => !string.IsNullOrWhiteSpace(Url) && !string.IsNullOrWhiteSpace(AnonKey);
}

/// <summary>
/// Petit client Supabase écrit à la main (connexion et accès aux tables par l'API REST),
/// pour rester lisible : pas de bibliothèque tierce.
/// </summary>
public sealed class ClientSupabase(OptionsSupabase options, IJSRuntime js)
{
    private const string CleSession = "vehicules-session";
    private static readonly JsonSerializerOptions Snake = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower };

    private readonly HttpClient http = new();
    private Session? session;

    public string? Email => session?.Email;
    public bool Connecte => session is not null;

    private sealed record Session(string AccessToken, string RefreshToken, long ExpiresAt, string? Email);

    private sealed record ReponseJeton(string AccessToken, string RefreshToken, long ExpiresIn, Utilisateur? User);
    private sealed record Utilisateur(string? Email);

    /// <summary>Reprend la session gardée sur l'appareil, en la renouvelant si besoin.</summary>
    public async Task<bool> RestaurerSessionAsync()
    {
        var json = await js.InvokeAsync<string?>("localStorage.getItem", CleSession);
        if (string.IsNullOrEmpty(json)) return false;
        try { session = JsonSerializer.Deserialize<Session>(json); }
        catch (JsonException) { session = null; }
        if (session is null) return false;
        try
        {
            await JetonAsync();
        }
        catch (ErreurSupabase)
        {
            await OublierAsync();   // session révoquée ou trop ancienne
        }
        catch (HttpRequestException)
        {
            // Hors ligne : on garde la session, les données viendront du cache.
        }
        return session is not null;
    }

    public async Task ConnexionAsync(string email, string motDePasse)
    {
        var reponse = await http.SendAsync(Requete(HttpMethod.Post, "auth/v1/token?grant_type=password",
            new { email, password = motDePasse }, jeton: null));
        if (reponse.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized)
            throw new ErreurSupabase("Identifiant ou mot de passe incorrect.");
        await RetenirAsync(reponse);
    }

    public async Task DeconnexionAsync()
    {
        try
        {
            if (session is not null)
                await http.SendAsync(Requete(HttpMethod.Post, "auth/v1/logout", null, session.AccessToken));
        }
        catch (HttpRequestException) { /* hors ligne : on oublie quand même la session */ }
        await OublierAsync();
    }

    /// <summary>Appel authentifié à l'API (chemin relatif, par exemple « rest/v1/table?id=eq.x »).</summary>
    public async Task<HttpResponseMessage> EnvoyerAsync(HttpMethod methode, string chemin, object? corps = null, string? prefer = null)
    {
        var requete = Requete(methode, chemin, corps, await JetonAsync());
        if (prefer is not null) requete.Headers.Add("Prefer", prefer);
        var reponse = await http.SendAsync(requete);
        if (reponse.StatusCode == HttpStatusCode.Unauthorized)
        {
            await OublierAsync();
            throw new ErreurSupabase("Session expirée : reconnecte-toi.");
        }
        if (reponse.StatusCode == HttpStatusCode.NotFound && chemin.StartsWith("rest/"))
            throw new ErreurSupabase("Les tables des véhicules n'existent pas encore dans Supabase : exécuter supabase/schema.sql dans le SQL Editor.");
        if (reponse.StatusCode == HttpStatusCode.Forbidden)
            throw new ErreurSupabase($"Le compte {Email} n'est pas autorisé : son adresse doit figurer dans la table « foyer » de Supabase.");
        if (!reponse.IsSuccessStatusCode && reponse.StatusCode != HttpStatusCode.Conflict)
            throw new ErreurSupabase($"Supabase a répondu {(int)reponse.StatusCode} : {await reponse.Content.ReadAsStringAsync()}");
        return reponse;
    }

    /// <summary>Envoi d'un fichier (stockage), avec remplacement s'il existe déjà.</summary>
    public async Task EnvoyerFichierAsync(string chemin, byte[] contenu, string type)
    {
        var requete = Requete(HttpMethod.Post, chemin, null, await JetonAsync());
        requete.Content = new ByteArrayContent(contenu);
        requete.Content.Headers.ContentType = new(type);
        requete.Headers.Add("x-upsert", "true");
        var reponse = await http.SendAsync(requete);
        if (reponse.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.NotFound or HttpStatusCode.BadRequest)
            throw new ErreurSupabase("Envoi refusé par Supabase : le stockage des photos n'est peut-être pas encore créé (supabase/photos.sql).");
        if (!reponse.IsSuccessStatusCode)
            throw new ErreurSupabase($"Envoi de la photo impossible ({(int)reponse.StatusCode}).");
    }

    /// <summary>Adresse absolue construite à partir d'un chemin relatif renvoyé par l'API.</summary>
    public string Absolue(string chemin) => $"{options.Url!.TrimEnd('/')}/{chemin.TrimStart('/')}";

    private async Task<string> JetonAsync()
    {
        if (session is null) throw new ErreurSupabase("Non connecté.");
        // Renouvelé une minute avant expiration.
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() < session.ExpiresAt - 60) return session.AccessToken;
        var reponse = await http.SendAsync(Requete(HttpMethod.Post, "auth/v1/token?grant_type=refresh_token",
            new { refresh_token = session.RefreshToken }, jeton: null));
        if (!reponse.IsSuccessStatusCode) throw new ErreurSupabase("Session expirée : reconnecte-toi.");
        await RetenirAsync(reponse);
        return session!.AccessToken;
    }

    private async Task RetenirAsync(HttpResponseMessage reponse)
    {
        if (!reponse.IsSuccessStatusCode)
            throw new ErreurSupabase($"Connexion impossible ({(int)reponse.StatusCode}).");
        var j = await reponse.Content.ReadFromJsonAsync<ReponseJeton>(Snake)
                ?? throw new ErreurSupabase("Réponse de connexion vide.");
        session = new Session(j.AccessToken, j.RefreshToken,
            DateTimeOffset.UtcNow.ToUnixTimeSeconds() + j.ExpiresIn, j.User?.Email ?? session?.Email);
        await js.InvokeVoidAsync("localStorage.setItem", CleSession, JsonSerializer.Serialize(session));
    }

    private async Task OublierAsync()
    {
        session = null;
        await js.InvokeVoidAsync("localStorage.removeItem", CleSession);
    }

    private HttpRequestMessage Requete(HttpMethod methode, string chemin, object? corps, string? jeton)
    {
        var requete = new HttpRequestMessage(methode, $"{options.Url!.TrimEnd('/')}/{chemin}");
        requete.Headers.Add("apikey", options.AnonKey);
        if (jeton is not null) requete.Headers.Authorization = new("Bearer", jeton);
        if (corps is not null)
        {
            var texte = corps as string ?? JsonSerializer.Serialize(corps);
            requete.Content = new StringContent(texte, Encoding.UTF8, "application/json");
        }
        return requete;
    }
}

public sealed class ErreurSupabase(string message) : Exception(message);
