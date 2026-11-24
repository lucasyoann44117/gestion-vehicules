using System.Security.Cryptography;
using System.Text;
using Vehicules.Core.Modeles;
using Vehicules.Core.Stockage;

namespace Vehicules.Web.Services;

/// <summary>
/// L'historique saisi depuis les factures (wwwroot/donnees/historique.json).
/// Présent quand l'application tourne sur le PC ; absent de la version en ligne
/// (données personnelles, hors du dépôt).
/// </summary>
public static class HistoriqueFichier
{
    /// <returns>Les données et une empreinte courte du fichier, ou (null, null) s'il est absent.</returns>
    public static async Task<(Donnees? Donnees, string? Empreinte)> LireAsync(HttpClient http)
    {
        try
        {
            using var r = await http.GetAsync("donnees/historique.json");
            if (!r.IsSuccessStatusCode) return (null, null);
            var texte = await r.Content.ReadAsStringAsync();
            if (!texte.TrimStart().StartsWith('{')) return (null, null);   // page d'erreur servie à la place
            var empreinte = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(texte)))[..16];
            return (Json.Lire(texte), empreinte);
        }
        catch (Exception e) when (e is HttpRequestException or System.Text.Json.JsonException)
        {
            return (null, null);
        }
    }
}
