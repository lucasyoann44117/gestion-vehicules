using System.Net.Http.Json;
using Vehicules.Core.Diagnostic;
using Vehicules.Core.Stockage;

namespace Vehicules.Web.Services;

/// <summary>Charge une fois la base de pannes (wwwroot/diagnostic/t4-acv.json).</summary>
public sealed class ServiceDiagnostic(HttpClient http)
{
    private BasePannes? basePannes;

    private BaseFichesPieces? fiches;

    public async Task<BasePannes> BaseAsync() =>
        basePannes ??= await http.GetFromJsonAsync<BasePannes>("diagnostic/t4-acv.json", Json.Options) ?? new BasePannes();

    /// <summary>Fiches « à quoi ça sert » des pièces (wwwroot/diagnostic/pieces-t4.json).</summary>
    public async Task<BaseFichesPieces> FichesAsync() =>
        fiches ??= await http.GetFromJsonAsync<BaseFichesPieces>("diagnostic/pieces-t4.json", Json.Options) ?? new BaseFichesPieces();

    /// <summary>Recherche directe dans le forum T4Zone (il faut y être connecté pour certains sous-forums).</summary>
    public static string LienForum(string recherche) =>
        "https://t4zone.info/forum/search.php?terms=all&sr=topics&keywords=" + Uri.EscapeDataString(
            string.Join(' ', recherche.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                // Le forum ignore les mots de moins de 4 lettres.
                .Where(m => m.Length >= 4 && !m.Equals("2.5", StringComparison.OrdinalIgnoreCase))
                .Take(4)));

    public static string LienImages(string recherche) =>
        "https://www.google.com/search?tbm=isch&q=" + Uri.EscapeDataString(recherche);

    public static string LienTutos(string recherche) =>
        "https://www.youtube.com/results?search_query=" + Uri.EscapeDataString(recherche);
}
