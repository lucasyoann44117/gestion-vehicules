using Vehicules.Core.Modeles;

namespace Vehicules.Core.Calculs;

public sealed record EtatPneu(
    PositionPneu Position,
    decimal DerniereMm,
    DateOnly DerniereDate,
    int DernierKm,
    double? MmPar1000Km,
    int? KmAvantConseille,
    int? KmAvantLegal);

/// <summary>Usure des pneus à partir des mesures de profondeur, par position.</summary>
public static class UsurePneus
{
    public const decimal SeuilLegalMm = 1.6m;
    public const decimal SeuilConseilleMm = 3.0m;

    public static List<EtatPneu> Etats(IEnumerable<MesurePneu> mesures) =>
        mesures.GroupBy(m => m.Position)
               .OrderBy(g => g.Key)
               .Select(g => Etat(g.Key, g.OrderBy(m => m.Km).ThenBy(m => m.Date).ToList()))
               .ToList();

    private static EtatPneu Etat(PositionPneu position, List<MesurePneu> mesures)
    {
        // Une profondeur qui remonte signale un pneu neuf : on ne garde que le pneu actuel.
        var debut = 0;
        for (var i = 1; i < mesures.Count; i++)
            if (mesures[i].ProfondeurMm > mesures[i - 1].ProfondeurMm + 0.5m) debut = i;
        var actuel = mesures.Skip(debut).ToList();
        var dernier = actuel[^1];

        double? pente = Pente(actuel);  // mm perdus par km (positif)
        double? par1000 = pente is > 0 ? pente * 1000 : null;
        int? Avant(decimal seuil) => pente is > 0
            ? Math.Max(0, (int)Math.Round((double)(dernier.ProfondeurMm - seuil) / pente.Value))
            : null;

        return new EtatPneu(position, dernier.ProfondeurMm, dernier.Date, dernier.Km, par1000, Avant(SeuilConseilleMm), Avant(SeuilLegalMm));
    }

    /// <summary>Droite des moindres carrés profondeur = f(km), renvoyée en usure positive.</summary>
    private static double? Pente(List<MesurePneu> m)
    {
        if (m.Count < 2 || m[^1].Km == m[0].Km) return null;
        var mx = m.Average(x => (double)x.Km);
        var my = m.Average(x => (double)x.ProfondeurMm);
        var num = m.Sum(x => (x.Km - mx) * ((double)x.ProfondeurMm - my));
        var den = m.Sum(x => (x.Km - mx) * (x.Km - mx));
        return den == 0 ? null : -num / den;
    }
}
