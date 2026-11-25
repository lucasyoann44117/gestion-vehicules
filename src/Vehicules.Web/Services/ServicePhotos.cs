using System.Text.Json;
using Microsoft.AspNetCore.Components.Forms;
using Vehicules.Core.Modeles;

namespace Vehicules.Web.Services;

/// <summary>
/// Photos des véhicules, rangées dans le stockage privé Supabase « vehicules-photos ».
/// Les images sont réduites dans le navigateur avant l'envoi, et affichées par des
/// liens signés valables une heure (le stockage n'est pas public).
/// </summary>
public sealed class ServicePhotos(ClientSupabase supabase, OptionsSupabase options)
{
    private const string Seau = "vehicules-photos";
    private const int Largeur = 1600;
    private readonly Dictionary<string, (string Url, DateTime Expire)> liens = [];

    /// <summary>
    /// Désactivé : les photos ne servent qu'à la modélisation 3D, aucun stockage n'est créé.
    /// Pour l'activer : exécuter supabase/photos.sql puis passer cette valeur à vrai.
    /// </summary>
    public const bool StockageActive = false;

    public bool Disponible => StockageActive && options.Configure;

    /// <summary>Réduit la photo choisie et l'envoie ; renvoie la fiche à ajouter au véhicule.</summary>
    public async Task<PhotoVehicule> AjouterAsync(string vehiculeId, IBrowserFile fichier, DateOnly aujourdhui)
    {
        var reduite = await fichier.RequestImageFileAsync("image/jpeg", Largeur, Largeur);
        await using var flux = reduite.OpenReadStream(12_000_000);
        using var memoire = new MemoryStream();
        await flux.CopyToAsync(memoire);
        var chemin = $"{vehiculeId}/{DateTime.UtcNow:yyyyMMddHHmmss}-{Guid.NewGuid():N}"[..(vehiculeId.Length + 24)] + ".jpg";
        await supabase.EnvoyerFichierAsync($"storage/v1/object/{Seau}/{chemin}", memoire.ToArray(), "image/jpeg");
        return new PhotoVehicule { Chemin = chemin, Ajoutee = aujourdhui };
    }

    public async Task SupprimerAsync(PhotoVehicule photo)
    {
        await supabase.EnvoyerAsync(HttpMethod.Delete, $"storage/v1/object/{Seau}", new { prefixes = new[] { photo.Chemin } });
        liens.Remove(photo.Chemin);
    }

    /// <summary>Lien temporaire pour afficher la photo (mis en cache tant qu'il est valable).</summary>
    public async Task<string?> LienAsync(PhotoVehicule? photo)
    {
        if (photo is null || !Disponible) return null;
        if (liens.TryGetValue(photo.Chemin, out var l) && l.Expire > DateTime.UtcNow.AddMinutes(5)) return l.Url;
        try
        {
            var reponse = await supabase.EnvoyerAsync(HttpMethod.Post, $"storage/v1/object/sign/{Seau}/{photo.Chemin}", new { expiresIn = 3600 });
            using var doc = JsonDocument.Parse(await reponse.Content.ReadAsStringAsync());
            var relatif = doc.RootElement.GetProperty("signedURL").GetString()!;
            var url = supabase.Absolue("storage/v1/" + relatif.TrimStart('/'));
            liens[photo.Chemin] = (url, DateTime.UtcNow.AddHours(1));
            return url;
        }
        catch (Exception e) when (e is ErreurSupabase or HttpRequestException or KeyNotFoundException)
        {
            return null;
        }
    }
}
