using Vehicules.Core.Modeles;

namespace Vehicules.Core.Stockage;

/// <summary>
/// Quand l'historique (issu des factures) est enrichi, on repart de sa nouvelle version
/// en gardant ce qui a été saisi sur l'appareil et qui n'y figure pas encore :
/// interventions, relevés, mesures, véhicules et pièces ajoutés à la main, réglages
/// des véhicules et des intervalles, suivi des défauts et des travaux.
/// </summary>
public static class Fusion
{
    public static Donnees Appliquer(Donnees historique, Donnees local)
    {
        var r = Json.Lire(Json.Ecrire(historique));   // copie

        Ajouter(r.Vehicules, local.Vehicules, v => v.Id);
        Ajouter(r.Organes, local.Organes, o => o.Id);
        Ajouter(r.Interventions, local.Interventions, i => i.Id);
        Ajouter(r.Controles, local.Controles, c => c.Id);
        Ajouter(r.Travaux, local.Travaux, t => t.Id);
        Ajouter(r.Releves, local.Releves, x => (x.VehiculeId, x.Date));
        Ajouter(r.MesuresPneus, local.MesuresPneus, x => (x.VehiculeId, x.Date, x.Position));

        // Réglages faits dans l'application.
        foreach (var v in r.Vehicules)
        {
            if (local.Vehicules.FirstOrDefault(x => x.Id == v.Id) is not { } l) continue;
            v.ValeurEstimee ??= l.ValeurEstimee;
            v.Couleur = l.Couleur;
            if (l.Immatriculations.Count > v.Immatriculations.Count) v.Immatriculations = l.Immatriculations;
        }
        foreach (var o in r.Organes)
        {
            if (local.Organes.FirstOrDefault(x => x.Id == o.Id) is not { } l) continue;
            o.IntervalleKm = l.IntervalleKm;
            o.IntervalleMois = l.IntervalleMois;
        }

        // Suivi des défauts et des travaux : un statut changé à la main l'emporte.
        foreach (var t in r.Travaux)
            if (local.Travaux.FirstOrDefault(x => x.Id == t.Id) is { } l && l.Statut != StatutSuivi.APrevoir) t.Statut = l.Statut;
        foreach (var c in r.Controles)
        {
            if (local.Controles.FirstOrDefault(x => x.Id == c.Id) is not { } l) continue;
            foreach (var d in c.Defaillances)
                if (l.Defaillances.FirstOrDefault(x => x.Code == d.Code) is { } ld && ld.Statut != StatutSuivi.ASurveiller) d.Statut = ld.Statut;
        }

        return r;
    }

    private static void Ajouter<T, TCle>(List<T> cible, IEnumerable<T> source, Func<T, TCle> cle)
    {
        var connus = cible.Select(cle).ToHashSet();
        cible.AddRange(source.Where(x => !connus.Contains(cle(x))));
    }
}
