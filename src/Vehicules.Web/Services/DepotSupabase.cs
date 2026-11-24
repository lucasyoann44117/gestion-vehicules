using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.JSInterop;
using Vehicules.Core.Modeles;
using Vehicules.Core.Stockage;

namespace Vehicules.Web.Services;

/// <summary>
/// Données partagées entre les téléphones et le PC du foyer, dans la table Supabase
/// « vehicules_donnees » (une seule ligne, id = « foyer », voir supabase/schema.sql).
///
/// - Une copie est gardée sur l'appareil : sans réseau, l'application s'ouvre quand même.
/// - Chaque enregistrement vérifie la version : si l'autre téléphone a enregistré entre-temps,
///   les deux saisies sont fusionnées au lieu de s'écraser.
/// - Quand l'application tourne sur le PC avec un historique.json plus récent (nouvelles
///   factures intégrées), il est fusionné dans Supabase à l'ouverture.
/// </summary>
public sealed class DepotSupabase(ClientSupabase supabase, HttpClient http, IJSRuntime js) : IDepot
{
    private const string Table = "rest/v1/vehicules_donnees";
    private const string Ligne = "foyer";
    private const string CleCache = "vehicules-cache";

    private int version;

    public bool Local => false;
    public bool HorsLigne { get; private set; }

    private sealed record LigneDistante(Donnees Donnees, int Version, string? Historique);

    public async Task<Donnees> ChargerAsync()
    {
        try
        {
            var distante = await LireAsync();
            var (historique, empreinte) = await HistoriqueFichier.LireAsync(http);
            HorsLigne = false;

            Donnees donnees;
            if (distante is null)
            {
                // Tout premier lancement : on part de l'historique des factures.
                donnees = historique ?? new Donnees();
                await CreerAsync(donnees, empreinte);
            }
            else if (historique is not null && empreinte != distante.Historique)
            {
                version = distante.Version;
                donnees = await EcrireAsync(Fusion.Appliquer(historique, distante.Donnees), empreinte);
            }
            else
            {
                version = distante.Version;
                donnees = distante.Donnees;
            }
            await GarderCopieAsync(donnees);
            return donnees;
        }
        catch (HttpRequestException)
        {
            HorsLigne = true;
            return await LireCopieAsync() ?? new Donnees();
        }
    }

    public async Task<Donnees> EnregistrerAsync(Donnees donnees)
    {
        if (HorsLigne)
        {
            // Nouvelle tentative de connexion avant d'abandonner.
            var distante = await LireAsync();
            version = distante?.Version ?? 0;
            HorsLigne = false;
            if (distante is not null) donnees = Fusion.Appliquer(distante.Donnees, donnees);
        }
        var resultat = await EcrireAsync(donnees, empreinte: null);
        await GarderCopieAsync(resultat);
        return resultat;
    }

    public async Task<Donnees> ReinitialiserAsync()
    {
        var (historique, empreinte) = await HistoriqueFichier.LireAsync(http);
        if (historique is null)
            throw new ErreurSupabase("L'historique des factures n'est disponible que sur le PC (application lancée avec dotnet run).");
        var distante = await LireAsync();
        version = distante?.Version ?? 0;
        var donnees = distante is null ? historique : Fusion.Appliquer(historique, distante.Donnees);
        var resultat = distante is null ? await CreerAsync(donnees, empreinte) : await EcrireAsync(donnees, empreinte);
        await GarderCopieAsync(resultat);
        return resultat;
    }

    // ---------- Accès à la table ----------

    private async Task<LigneDistante?> LireAsync()
    {
        var reponse = await supabase.EnvoyerAsync(HttpMethod.Get, $"{Table}?id=eq.{Ligne}&select=donnees,version,historique");
        using var doc = JsonDocument.Parse(await reponse.Content.ReadAsStringAsync());
        if (doc.RootElement.GetArrayLength() == 0) return null;
        var l = doc.RootElement[0];
        return new LigneDistante(
            Json.Lire(l.GetProperty("donnees").GetRawText()),
            l.GetProperty("version").GetInt32(),
            l.GetProperty("historique").ValueKind == JsonValueKind.String ? l.GetProperty("historique").GetString() : null);
    }

    private async Task<Donnees> CreerAsync(Donnees donnees, string? empreinte)
    {
        var corps = Corps(donnees, 1, empreinte);
        corps["id"] = Ligne;
        var reponse = await supabase.EnvoyerAsync(HttpMethod.Post, Table, corps.ToJsonString(), "return=minimal");
        if (reponse.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            // L'autre appareil vient de créer la ligne : on fusionne avec elle.
            var distante = (await LireAsync())!;
            version = distante.Version;
            return await EcrireAsync(Fusion.Appliquer(distante.Donnees, donnees), empreinte);
        }
        version = 1;
        return donnees;
    }

    /// <summary>Enregistre si la version n'a pas bougé ; sinon fusionne avec la version distante et recommence.</summary>
    private async Task<Donnees> EcrireAsync(Donnees donnees, string? empreinte)
    {
        for (var essai = 0; essai < 3; essai++)
        {
            var reponse = await supabase.EnvoyerAsync(HttpMethod.Patch,
                $"{Table}?id=eq.{Ligne}&version=eq.{version}",
                Corps(donnees, version + 1, empreinte).ToJsonString(),
                "return=representation");
            using var doc = JsonDocument.Parse(await reponse.Content.ReadAsStringAsync());
            if (doc.RootElement.GetArrayLength() > 0)
            {
                version++;
                return donnees;
            }

            // Conflit : un autre appareil a enregistré entre-temps.
            var distante = await LireAsync() ?? throw new ErreurSupabase("Les données ont disparu de Supabase.");
            version = distante.Version;
            donnees = Fusion.Appliquer(distante.Donnees, donnees);
        }
        throw new ErreurSupabase("Enregistrement impossible : l'autre appareil modifie les données en même temps. Réessaie.");
    }

    private JsonObject Corps(Donnees donnees, int nouvelleVersion, string? empreinte)
    {
        var corps = new JsonObject
        {
            ["donnees"] = JsonNode.Parse(Json.Ecrire(donnees)),
            ["version"] = nouvelleVersion,
            ["modifie_par"] = supabase.Email,
            ["updated_at"] = DateTimeOffset.UtcNow.ToString("O"),
        };
        if (empreinte is not null) corps["historique"] = empreinte;
        return corps;
    }

    // ---------- Copie sur l'appareil ----------

    private async Task GarderCopieAsync(Donnees donnees) =>
        await js.InvokeVoidAsync("localStorage.setItem", CleCache, Json.Ecrire(donnees));

    private async Task<Donnees?> LireCopieAsync()
    {
        var json = await js.InvokeAsync<string?>("localStorage.getItem", CleCache);
        if (string.IsNullOrEmpty(json)) return null;
        try { return Json.Lire(json); }
        catch (JsonException) { return null; }
    }
}
