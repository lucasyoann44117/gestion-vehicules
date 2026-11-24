using Vehicules.Core.Modeles;

namespace Vehicules.Core.Calculs;

public enum Urgence
{
    /// <summary>Pas d'intervalle connu ou jamais changé.</summary>
    Inconnue,
    Ok,
    Bientot,
    Depasse,
}

/// <summary>Un changement d'organe : une intervention qui le touche.</summary>
public sealed record Changement(DateOnly Date, int? Km, string InterventionId, string Titre, string? Garage, decimal MontantHt, IReadOnlyList<LigneIntervention> Lignes);

/// <summary>Temps et distance entre deux changements successifs.</summary>
public sealed record DureeVie(DateOnly Du, DateOnly Au, int? Km, int Mois);

public sealed record EtatOrgane(
    Organe Organe,
    IReadOnlyList<Changement> Changements,
    IReadOnlyList<DureeVie> Durees,
    int? KmDepuis,
    int? MoisDepuis,
    int? ProchainKm,
    DateOnly? ProchaineDate,
    Urgence Urgence)
{
    public Changement? Dernier => Changements.Count > 0 ? Changements[^1] : null;

    /// <summary>Part de l'intervalle déjà consommée (0 = neuf, 1 = échéance atteinte), au plus défavorable du km et du temps.</summary>
    public double? Avancement { get; init; }
}

/// <summary>« Qu'a-t-on changé, quand, et quand faudra-t-il le refaire ? »</summary>
public static class SuiviOrganes
{
    /// <summary>Marge avant échéance à partir de laquelle on prévient.</summary>
    public const int MargeKm = 2000;
    public const int MargeJours = 60;

    public static List<EtatOrgane> Etats(
        IEnumerable<Organe> organes, IEnumerable<Intervention> interventions, IEnumerable<ReleveKm> releves, DateOnly aujourdhui)
    {
        var inter = interventions.OrderBy(i => i.Date).ToList();
        var rel = Kilometrage.Tries(releves);
        var kmActuel = Kilometrage.Estimer(rel, aujourdhui);
        return organes.Select(o => Etat(o, inter, rel, kmActuel, aujourdhui)).ToList();
    }

    public static EtatOrgane Etat(Organe organe, IReadOnlyList<Intervention> interventions, IReadOnlyList<ReleveKm> releves, int? kmActuel, DateOnly aujourdhui)
    {
        var changements = interventions
            .Select(i => (i, lignes: i.Lignes.Where(l => l.OrganeId == organe.Id && !l.Exclue).ToList()))
            .Where(x => x.lignes.Count > 0)
            .Select(x => new Changement(
                x.i.Date,
                x.i.Km ?? Kilometrage.Estimer(releves, x.i.Date),
                x.i.Id, x.i.Titre, x.i.Garage,
                x.lignes.Sum(l => l.MontantHt),
                x.lignes))
            .ToList();

        var durees = changements.Zip(changements.Skip(1), (a, b) =>
            new DureeVie(a.Date, b.Date, a.Km is { } ka && b.Km is { } kb ? kb - ka : null, Mois(a.Date, b.Date))).ToList();

        var dernier = changements.LastOrDefault();
        int? kmDepuis = dernier?.Km is { } k && kmActuel is { } ka2 ? ka2 - k : null;
        int? moisDepuis = dernier is null ? null : Mois(dernier.Date, aujourdhui);
        int? prochainKm = dernier?.Km is { } k2 && organe.IntervalleKm is { } ik ? k2 + ik : null;
        DateOnly? prochaineDate = dernier is not null && organe.IntervalleMois is { } im ? dernier.Date.AddMonths(im) : null;

        var urgence = Urgence.Inconnue;
        if (dernier is not null && (prochainKm is not null || prochaineDate is not null))
        {
            var depasse = (prochainKm is { } pk && kmActuel >= pk) || (prochaineDate is { } pd && aujourdhui >= pd);
            var bientot = (prochainKm is { } pk2 && kmActuel >= pk2 - MargeKm) || (prochaineDate is { } pd2 && aujourdhui.AddDays(MargeJours) >= pd2);
            urgence = depasse ? Urgence.Depasse : bientot ? Urgence.Bientot : Urgence.Ok;
        }

        double? avancement = null;
        if (dernier is not null)
        {
            if (kmDepuis is { } kd && organe.IntervalleKm is > 0)
                avancement = (double)kd / organe.IntervalleKm.Value;
            if (prochaineDate is { } pd3 && pd3 > dernier.Date)
            {
                var parTemps = (double)(aujourdhui.DayNumber - dernier.Date.DayNumber) / (pd3.DayNumber - dernier.Date.DayNumber);
                avancement = Math.Max(avancement ?? 0, parTemps);
            }
        }

        return new EtatOrgane(organe, changements, durees, kmDepuis, moisDepuis, prochainKm, prochaineDate, urgence)
        {
            Avancement = avancement,
        };
    }

    /// <summary>Mois révolus entre deux dates.</summary>
    public static int Mois(DateOnly du, DateOnly au)
    {
        var m = (au.Year - du.Year) * 12 + au.Month - du.Month;
        if (au.Day < du.Day) m--;
        return Math.Max(m, 0);
    }
}
