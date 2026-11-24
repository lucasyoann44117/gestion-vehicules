using Vehicules.Core.Modeles;

namespace Vehicules.Web.Services;

/// <summary>
/// Lecture et enregistrement des données : dans le navigateur (<see cref="DepotNavigateur"/>)
/// ou partagées entre les appareils du foyer (<see cref="DepotSupabase"/>).
/// </summary>
public interface IDepot
{
    /// <summary>Vrai si les données ne quittent pas cet appareil.</summary>
    bool Local { get; }

    /// <summary>Vrai si la dernière lecture a dû se contenter de la copie gardée sur l'appareil.</summary>
    bool HorsLigne { get; }

    Task<Donnees> ChargerAsync();

    /// <summary>
    /// Enregistre et renvoie les données à jour : elles peuvent différer de celles passées
    /// si un autre appareil a enregistré entre-temps (les deux saisies sont alors fusionnées).
    /// </summary>
    Task<Donnees> EnregistrerAsync(Donnees donnees);

    /// <summary>Réintègre l'historique des factures (historique.json) fourni avec l'application.</summary>
    Task<Donnees> ReinitialiserAsync();
}
