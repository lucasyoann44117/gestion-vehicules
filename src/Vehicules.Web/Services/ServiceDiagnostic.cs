using System.Net.Http.Json;
using Vehicules.Core.Diagnostic;
using Vehicules.Core.Stockage;

namespace Vehicules.Web.Services;

/// <summary>Charge une fois la base de pannes (wwwroot/diagnostic/t4-acv.json).</summary>
public sealed class ServiceDiagnostic(HttpClient http)
{
    private BasePannes? basePannes;

    public async Task<BasePannes> BaseAsync() =>
        basePannes ??= await http.GetFromJsonAsync<BasePannes>("diagnostic/t4-acv.json", Json.Options) ?? new BasePannes();

    /// <summary>Recherche sur le forum T4Zone (via un moteur de recherche, le forum demande un compte).</summary>
    public static string LienForum(string recherche) =>
        "https://www.google.com/search?q=" + Uri.EscapeDataString($"site:t4zone.info {recherche}");

    public static string LienImages(string recherche) =>
        "https://www.google.com/search?tbm=isch&q=" + Uri.EscapeDataString(recherche);

    public static string LienTutos(string recherche) =>
        "https://www.youtube.com/results?search_query=" + Uri.EscapeDataString(recherche);
}
