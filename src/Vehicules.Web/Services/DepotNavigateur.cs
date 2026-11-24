using Microsoft.JSInterop;
using Vehicules.Core.Modeles;
using Vehicules.Core.Stockage;

namespace Vehicules.Web.Services;

/// <summary>
/// Données gardées dans le stockage local du navigateur, construites à partir de
/// wwwroot/donnees/historique.json. Utilisé quand Supabase n'est pas configuré.
/// Quand le fichier change (nouvelles factures intégrées), les données sont mises
/// à jour en gardant les saisies faites ici.
/// </summary>
public sealed class DepotNavigateur(IJSRuntime js, HttpClient http) : IDepot
{
    private const string Cle = "vehicules-donnees";
    private const string CleEmpreinte = "vehicules-historique";

    public bool Local => true;
    public bool HorsLigne => false;

    public async Task<Donnees> ChargerAsync()
    {
        var (historique, empreinte) = await HistoriqueFichier.LireAsync(http);
        var local = await LireLocalAsync();

        if (local is null) return await RepartirDeAsync(historique, empreinte);
        if (historique is null || empreinte == await js.InvokeAsync<string?>("localStorage.getItem", CleEmpreinte))
            return local;

        // L'historique a été enrichi depuis la dernière visite.
        var fusion = Fusion.Appliquer(historique, local);
        await EnregistrerAsync(fusion);
        await js.InvokeVoidAsync("localStorage.setItem", CleEmpreinte, empreinte);
        return fusion;
    }

    public async Task<Donnees> EnregistrerAsync(Donnees donnees)
    {
        await js.InvokeVoidAsync("localStorage.setItem", Cle, Json.Ecrire(donnees));
        return donnees;
    }

    public async Task<Donnees> ReinitialiserAsync()
    {
        var (historique, empreinte) = await HistoriqueFichier.LireAsync(http);
        return await RepartirDeAsync(historique, empreinte);
    }

    private async Task<Donnees> RepartirDeAsync(Donnees? historique, string? empreinte)
    {
        var donnees = historique ?? new Donnees();
        await EnregistrerAsync(donnees);
        if (empreinte is not null) await js.InvokeVoidAsync("localStorage.setItem", CleEmpreinte, empreinte);
        return donnees;
    }

    private async Task<Donnees?> LireLocalAsync()
    {
        var json = await js.InvokeAsync<string?>("localStorage.getItem", Cle);
        if (string.IsNullOrEmpty(json)) return null;
        try { return Json.Lire(json); }
        catch (System.Text.Json.JsonException) { return null; }   // stockage abîmé : on repart de l'historique
    }
}
