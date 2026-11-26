using System.Text.Json;

namespace Vehicules.Web.Services;

/// <summary>
/// Modèle 3D de la caisse du T4, rangé dans le stockage privé Supabase « vehicules-modeles »
/// (supabase/modeles-3d.sql) : le site est hébergé publiquement, le modèle n'y est donc pas.
/// La Vue 3D le reçoit par un lien signé, valable dix minutes, puis le garde sur l'appareil.
/// </summary>
public sealed class ServiceModeles3D(ClientSupabase supabase, OptionsSupabase options)
{
    public const string Seau = "vehicules-modeles";
    public const string Caisse = "t4-caisse.glb";

    /// <summary>Lien temporaire vers la caisse, ou null (hors ligne, démo, pas connecté, fichier absent).</summary>
    public async Task<string?> LienCaisseAsync()
    {
        if (!options.Configure || !supabase.Connecte) return null;
        try
        {
            var reponse = await supabase.EnvoyerAsync(HttpMethod.Post, $"storage/v1/object/sign/{Seau}/{Caisse}", new { expiresIn = 600 });
            using var doc = JsonDocument.Parse(await reponse.Content.ReadAsStringAsync());
            return doc.RootElement.TryGetProperty("signedURL", out var lien)
                ? supabase.Absolue("storage/v1/" + lien.GetString()!.TrimStart('/'))
                : null;
        }
        catch (Exception e) when (e is ErreurSupabase or HttpRequestException or JsonException)
        {
            return null;
        }
    }
}
