using Vehicules.Core.Modeles;

namespace Vehicules.Core.Calculs;

/// <summary>Kilométrage estimé à une date et rythme annuel, à partir des relevés.</summary>
public static class Kilometrage
{
    /// <summary>Relevés triés par date, un seul par jour (le plus élevé).</summary>
    public static List<ReleveKm> Tries(IEnumerable<ReleveKm> releves) =>
        releves.GroupBy(r => r.Date)
               .Select(g => g.MaxBy(r => r.Km)!)
               .OrderBy(r => r.Date)
               .ToList();

    /// <summary>
    /// Km par an sur les <paramref name="moisFenetre"/> derniers mois couverts par les relevés.
    /// Null s'il n'y a pas deux relevés à des dates différentes.
    /// </summary>
    public static double? KmParAn(IEnumerable<ReleveKm> releves, int moisFenetre = 24)
    {
        var tries = Tries(releves);
        if (tries.Count < 2) return null;
        var dernier = tries[^1];
        var limite = dernier.Date.AddMonths(-moisFenetre);
        // Premier relevé dans la fenêtre ; à défaut, celui qui la précède immédiatement.
        var premier = tries.FirstOrDefault(r => r.Date >= limite && r.Date < dernier.Date)
                      ?? tries.Last(r => r.Date < dernier.Date);
        var jours = dernier.Date.DayNumber - premier.Date.DayNumber;
        return jours <= 0 ? null : (dernier.Km - premier.Km) * 365.25 / jours;
    }

    /// <summary>
    /// Km estimé à une date : interpolation entre deux relevés, ou prolongement du rythme
    /// récent après le dernier. Null avant le premier relevé.
    /// </summary>
    public static int? Estimer(IEnumerable<ReleveKm> releves, DateOnly date)
    {
        var tries = Tries(releves);
        if (tries.Count == 0 || date < tries[0].Date) return null;

        var apres = tries.FirstOrDefault(r => r.Date >= date);
        if (apres is not null && apres.Date == date) return apres.Km;

        var avant = tries.Last(r => r.Date < date);
        if (apres is null)
        {
            var rythme = KmParAn(tries);
            return rythme is null ? avant.Km : avant.Km + (int)Math.Round(rythme.Value * (date.DayNumber - avant.Date.DayNumber) / 365.25);
        }

        var part = (double)(date.DayNumber - avant.Date.DayNumber) / (apres.Date.DayNumber - avant.Date.DayNumber);
        return avant.Km + (int)Math.Round((apres.Km - avant.Km) * part);
    }

    /// <summary>Km parcourus entre deux dates, limités à la période couverte par les relevés et à aujourd'hui.</summary>
    public static int? Parcourus(IEnumerable<ReleveKm> releves, DateOnly debut, DateOnly fin, DateOnly aujourdhui)
    {
        var tries = Tries(releves);
        if (tries.Count < 2) return null;
        var d = debut < tries[0].Date ? tries[0].Date : debut;
        var f = fin > aujourdhui ? aujourdhui : fin;
        if (f <= d) return null;
        var kmDebut = Estimer(tries, d);
        var kmFin = Estimer(tries, f);
        return kmDebut is null || kmFin is null ? null : kmFin - kmDebut;
    }
}
