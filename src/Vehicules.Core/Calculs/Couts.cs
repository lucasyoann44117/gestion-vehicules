using Vehicules.Core.Modeles;

namespace Vehicules.Core.Calculs;

public sealed record CoutAnnuel(
    int Annee,
    decimal TotalTtc,
    IReadOnlyDictionary<TypeIntervention, decimal> ParType,
    decimal PiecesHt,
    decimal MainOeuvreHt,
    int NombreInterventions,
    int? KmParcourus)
{
    /// <summary>Coût TTC par km parcouru dans l'année (hors carburant et assurance s'ils ne sont pas saisis).</summary>
    public decimal? CoutParKm => KmParcourus is > 0 ? Math.Round(TotalTtc / KmParcourus.Value, 3) : null;
}

/// <summary>Dépenses par année, par type et sur une période glissante.</summary>
public static class Couts
{
    public static List<CoutAnnuel> ParAnnee(
        IEnumerable<Intervention> interventions, IEnumerable<ReleveKm> releves, DateOnly aujourdhui)
    {
        var liste = interventions.ToList();
        var relevesListe = releves.ToList();
        if (liste.Count == 0) return [];

        var premiere = liste.Min(i => i.Date.Year);
        var derniere = Math.Max(liste.Max(i => i.Date.Year), aujourdhui.Year);

        return Enumerable.Range(premiere, derniere - premiere + 1).Select(annee =>
        {
            var de = liste.Where(i => i.Date.Year == annee).ToList();
            var parType = de.GroupBy(i => i.Type).ToDictionary(g => g.Key, g => g.Sum(i => i.TotalTtc));
            var km = Kilometrage.Parcourus(relevesListe, new DateOnly(annee, 1, 1), new DateOnly(annee, 12, 31), aujourdhui);
            return new CoutAnnuel(
                annee,
                de.Sum(i => i.TotalTtc),
                parType,
                de.Sum(i => i.TotalPiecesHt),
                de.Sum(i => i.TotalMainOeuvreHt),
                de.Count,
                km);
        }).ToList();
    }

    /// <summary>Total TTC des 12 derniers mois (jour compris).</summary>
    public static decimal SurDouzeMois(IEnumerable<Intervention> interventions, DateOnly aujourdhui)
    {
        var debut = aujourdhui.AddYears(-1);
        return interventions.Where(i => i.Date > debut && i.Date <= aujourdhui).Sum(i => i.TotalTtc);
    }

    /// <summary>Total TTC par organe sur tout l'historique (lignes HT rattachées, TVA appliquée au prorata de la facture).</summary>
    public static Dictionary<string, decimal> ParOrgane(IEnumerable<Intervention> interventions)
    {
        var resultat = new Dictionary<string, decimal>();
        foreach (var i in interventions)
        {
            var ht = i.Lignes.Where(l => !l.Exclue).Sum(l => l.MontantHt);
            var coef = ht > 0 ? i.TotalTtc / ht : 1m;
            foreach (var l in i.Lignes.Where(l => !l.Exclue && l.OrganeId is not null))
            {
                resultat[l.OrganeId!] = resultat.GetValueOrDefault(l.OrganeId!) + Math.Round(l.MontantHt * coef, 2);
            }
        }
        return resultat;
    }
}
