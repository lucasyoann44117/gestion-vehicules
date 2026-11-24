using Vehicules.Core.Calculs;
using Vehicules.Core.Modeles;

namespace Vehicules.Web.Services;

/// <summary>
/// État partagé par les écrans : les données chargées, le véhicule choisi,
/// la connexion et la date du jour. Prévient les écrans quand quelque chose change.
/// </summary>
public sealed class Etat(IDepot depot, ClientSupabase supabase, OptionsSupabase options)
{
    public Donnees Donnees { get; private set; } = new();
    public bool Charge { get; private set; }
    public bool Local => depot.Local;
    public bool HorsLigne => depot.HorsLigne;

    /// <summary>Supabase est configuré mais personne n'est connecté sur cet appareil.</summary>
    public bool ConnexionRequise { get; private set; }
    public string? Utilisateur => supabase.Email;

    /// <summary>Dernière erreur d'enregistrement, affichée en bandeau.</summary>
    public string? Erreur { get; private set; }

    /// <summary>Véhicule affiché ; null = tous.</summary>
    public string? VehiculeId { get; private set; }

    public DateOnly Aujourdhui => DateOnly.FromDateTime(DateTime.Now);

    public event Action? Change;

    public async Task DemarrerAsync()
    {
        if (Charge) return;
        if (options.Configure && !await supabase.RestaurerSessionAsync())
        {
            ConnexionRequise = true;
            Change?.Invoke();
            return;
        }
        await ChargerAsync();
    }

    public async Task ConnexionAsync(string email, string motDePasse)
    {
        await supabase.ConnexionAsync(email, motDePasse);
        ConnexionRequise = false;
        await ChargerAsync();
    }

    public async Task DeconnexionAsync()
    {
        await supabase.DeconnexionAsync();
        Donnees = new();
        Charge = false;
        ConnexionRequise = true;
        Change?.Invoke();
    }

    private async Task ChargerAsync()
    {
        try
        {
            Donnees = await depot.ChargerAsync();
        }
        catch (ErreurSupabase e)
        {
            if (!supabase.Connecte && options.Configure) { ConnexionRequise = true; Change?.Invoke(); return; }
            Erreur = e.Message;
        }
        if (VehiculeId is null && Donnees.Vehicules.Count == 1) VehiculeId = Donnees.Vehicules[0].Id;
        Charge = true;
        Change?.Invoke();
    }

    public void ChoisirVehicule(string? id)
    {
        VehiculeId = id;
        Change?.Invoke();
    }

    /// <summary>Enregistre après une modification de <see cref="Donnees"/>.</summary>
    public async Task EnregistrerAsync()
    {
        try
        {
            Donnees = await depot.EnregistrerAsync(Donnees);
            Erreur = null;
        }
        catch (Exception e) when (e is ErreurSupabase or HttpRequestException)
        {
            Erreur = e is HttpRequestException
                ? "Pas de réseau : la modification n'est pas enregistrée. Réessaie une fois connecté."
                : e.Message;
            if (!supabase.Connecte && options.Configure) ConnexionRequise = true;
        }
        Change?.Invoke();
    }

    public async Task RemplacerAsync(Donnees nouvelles)
    {
        Donnees = nouvelles;
        if (VehiculeId is not null && Donnees.Vehicules.All(v => v.Id != VehiculeId)) VehiculeId = null;
        await EnregistrerAsync();
    }

    public async Task ReinitialiserAsync()
    {
        try
        {
            Donnees = await depot.ReinitialiserAsync();
            Erreur = null;
        }
        catch (Exception e) when (e is ErreurSupabase or HttpRequestException)
        {
            Erreur = e.Message;
        }
        VehiculeId = Donnees.Vehicules.Count == 1 ? Donnees.Vehicules[0].Id : null;
        Change?.Invoke();
    }

    public void EffacerErreur()
    {
        Erreur = null;
        Change?.Invoke();
    }

    // ---- Raccourcis filtrés sur le véhicule choisi ----

    public IEnumerable<Vehicule> Vehicules =>
        Donnees.Vehicules.Where(v => VehiculeId is null || v.Id == VehiculeId);

    public IEnumerable<Intervention> Interventions =>
        Donnees.Interventions.Where(i => VehiculeId is null || i.VehiculeId == VehiculeId);

    public IEnumerable<ControleTechnique> Controles =>
        Donnees.Controles.Where(c => VehiculeId is null || c.VehiculeId == VehiculeId);

    public Vehicule? Vehicule(string id) => Donnees.Vehicules.FirstOrDefault(v => v.Id == id);

    public Organe? Organe(string? id) => id is null ? null : Donnees.Organes.FirstOrDefault(o => o.Id == id);

    public List<ReleveKm> Releves(string vehiculeId) =>
        Donnees.Releves.Where(r => r.VehiculeId == vehiculeId).ToList();

    public int? KmEstime(string vehiculeId) => Kilometrage.Estimer(Releves(vehiculeId), Aujourdhui);
}
