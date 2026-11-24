using Vehicules.Core.Modeles;

namespace Vehicules.Core.Calculs;

public enum TypeEcheance
{
    ControleTechnique,
    Organe,
    TravailAPrevoir,
    DefautCt,
}

/// <param name="Avancement">Part du délai déjà écoulée (0 à 1 et plus), pour une jauge.</param>
public sealed record Echeance(
    string VehiculeId, TypeEcheance Type, string Libelle, string? Detail,
    DateOnly? Date, int? Km, Urgence Urgence, double? Avancement = null, string? OrganeId = null);

/// <summary>Ce qui arrive ou ce qui est en retard, tous véhicules confondus.</summary>
public static class Echeances
{
    public const int AlerteCtJours = 90;

    public static List<Echeance> Calculer(Donnees d, DateOnly aujourdhui)
    {
        var liste = new List<Echeance>();
        foreach (var v in d.Vehicules)
        {
            var releves = d.Releves.Where(r => r.VehiculeId == v.Id).ToList();
            var interventions = d.Interventions.Where(i => i.VehiculeId == v.Id).ToList();

            // Contrôle technique : échéance du dernier contrôle.
            var dernierCt = d.Controles.Where(c => c.VehiculeId == v.Id).OrderBy(c => c.Date).LastOrDefault();
            if (dernierCt?.Echeance is { } ech)
            {
                var u = aujourdhui >= ech ? Urgence.Depasse : aujourdhui.AddDays(AlerteCtJours) >= ech ? Urgence.Bientot : Urgence.Ok;
                var duree = ech.DayNumber - dernierCt.Date.DayNumber;
                double? avancement = duree > 0 ? (double)(aujourdhui.DayNumber - dernierCt.Date.DayNumber) / duree : null;
                liste.Add(new Echeance(v.Id, TypeEcheance.ControleTechnique, "Contrôle technique",
                    $"Dernier le {dernierCt.Date:dd/MM/yyyy}", ech, null, u, avancement));

                foreach (var df in dernierCt.Defaillances.Where(x => x.Statut == StatutSuivi.ASurveiller))
                {
                    liste.Add(new Echeance(v.Id, TypeEcheance.DefautCt, df.Libelle, $"CT du {dernierCt.Date:dd/MM/yyyy} · {df.Code}", null, null,
                        df.Gravite == Gravite.Mineure ? Urgence.Ok : Urgence.Bientot, null, df.OrganeId));
                }
            }

            foreach (var e in SuiviOrganes.Etats(d.Organes.Where(o => o.VehiculeId == v.Id), interventions, releves, aujourdhui)
                         .Where(e => e.Urgence != Urgence.Inconnue))
            {
                liste.Add(new Echeance(v.Id, TypeEcheance.Organe, e.Organe.Nom,
                    e.Dernier is { } c ? $"Changé le {c.Date:dd/MM/yyyy}" + (c.Km is { } k ? $" à {k:N0} km" : "") : null,
                    e.ProchaineDate, e.ProchainKm, e.Urgence, e.Avancement, e.Organe.Id));
            }

            foreach (var t in d.Travaux.Where(t => t.VehiculeId == v.Id && t.Statut == StatutSuivi.APrevoir))
            {
                liste.Add(new Echeance(v.Id, TypeEcheance.TravailAPrevoir, t.Libelle, $"{t.Source}, {t.DateSignalement:dd/MM/yyyy}",
                    null, null, Urgence.Bientot, null, t.OrganeId));
            }
        }

        return liste
            .OrderByDescending(e => e.Urgence)
            .ThenByDescending(e => e.Avancement ?? 0)
            .ToList();
    }
}
