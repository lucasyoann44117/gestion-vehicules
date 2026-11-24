using Vehicules.Core.Calculs;
using Vehicules.Core.Modeles;

namespace Vehicules.Tests;

public class SuiviOrganesTests
{
    private static Intervention Changement(string id, DateOnly date, int km, string organe, decimal montant) => new()
    {
        Id = id, VehiculeId = "v", Date = date, Km = km, Titre = id, TotalTtc = montant * 1.2m,
        Lignes = [new LigneIntervention { Designation = organe, MontantHt = montant, Nature = NatureLigne.Piece, OrganeId = organe }],
    };

    private static readonly Organe Vidange = new() { Id = "vidange", VehiculeId = "v", Nom = "Vidange", IntervalleKm = 15_000, IntervalleMois = 12 };

    [Fact]
    public void Durees_de_vie_entre_changements()
    {
        var inter = new[]
        {
            Changement("a", new DateOnly(2024, 1, 10), 100_000, "vidange", 100),
            Changement("b", new DateOnly(2025, 3, 10), 116_000, "vidange", 110),
        };
        var releves = new[] { new ReleveKm { VehiculeId = "v", Date = new DateOnly(2025, 3, 10), Km = 116_000 } };

        var etat = SuiviOrganes.Etats([Vidange], inter, releves, new DateOnly(2025, 4, 1)).Single();

        Assert.Equal(2, etat.Changements.Count);
        var duree = Assert.Single(etat.Durees);
        Assert.Equal(16_000, duree.Km);
        Assert.Equal(14, duree.Mois);
        Assert.Equal(131_000, etat.ProchainKm);
        Assert.Equal(new DateOnly(2026, 3, 10), etat.ProchaineDate);
        Assert.Equal(Urgence.Ok, etat.Urgence);
    }

    [Fact]
    public void Echeance_depassee_a_la_date()
    {
        var inter = new[] { Changement("a", new DateOnly(2024, 1, 10), 100_000, "vidange", 100) };
        var etat = SuiviOrganes.Etats([Vidange], inter, [], new DateOnly(2025, 2, 1)).Single();
        Assert.Equal(Urgence.Depasse, etat.Urgence);
    }

    [Fact]
    public void Echeance_proche_au_kilometrage()
    {
        var inter = new[] { Changement("a", new DateOnly(2025, 1, 1), 100_000, "vidange", 100) };
        var releves = new[]
        {
            new ReleveKm { VehiculeId = "v", Date = new DateOnly(2025, 1, 1), Km = 100_000 },
            new ReleveKm { VehiculeId = "v", Date = new DateOnly(2025, 4, 1), Km = 113_500 },
        };
        var etat = SuiviOrganes.Etats([Vidange], inter, releves, new DateOnly(2025, 4, 1)).Single();
        Assert.Equal(Urgence.Bientot, etat.Urgence);
    }

    [Fact]
    public void Les_lignes_exclues_ne_comptent_pas()
    {
        var i = Changement("a", new DateOnly(2025, 1, 1), 100_000, "vidange", 100);
        i.Lignes[0].Exclue = true;
        var etat = SuiviOrganes.Etats([Vidange], [i], [], new DateOnly(2025, 2, 1)).Single();
        Assert.Empty(etat.Changements);
        Assert.Equal(Urgence.Inconnue, etat.Urgence);
    }

    [Theory]
    [InlineData("2024-01-10", "2025-01-09", 11)]
    [InlineData("2024-01-10", "2025-01-10", 12)]
    [InlineData("2024-01-31", "2024-03-01", 1)]
    public void Mois_revolus(string du, string au, int attendu) =>
        Assert.Equal(attendu, SuiviOrganes.Mois(DateOnly.Parse(du), DateOnly.Parse(au)));
}

public class CoutsTests
{
    [Fact]
    public void ParOrgane_repartit_la_TVA()
    {
        var i = new Intervention
        {
            TotalTtc = 120,
            Lignes =
            [
                new() { MontantHt = 60, OrganeId = "a" },
                new() { MontantHt = 40, OrganeId = "b" },
                new() { MontantHt = 50, OrganeId = "c", Exclue = true },
            ],
        };
        var couts = Couts.ParOrgane([i]);
        Assert.Equal(72m, couts["a"]);
        Assert.Equal(48m, couts["b"]);
        Assert.False(couts.ContainsKey("c"));
    }

    [Fact]
    public void SurDouzeMois_exclut_ce_qui_a_plus_d_un_an()
    {
        var inter = new[]
        {
            new Intervention { Date = new DateOnly(2025, 6, 1), TotalTtc = 100 },
            new Intervention { Date = new DateOnly(2025, 6, 2), TotalTtc = 50 },
        };
        Assert.Equal(50m, Couts.SurDouzeMois(inter, new DateOnly(2026, 6, 1)));
    }
}

public class UsurePneusTests
{
    private static MesurePneu M(int km, decimal mm) => new() { Date = new DateOnly(2025, 1, 1).AddDays(km / 100), Km = km, Position = PositionPneu.AvantGauche, ProfondeurMm = mm };

    [Fact]
    public void Usure_et_km_restants()
    {
        var etat = UsurePneus.Etats([M(10_000, 7.0m), M(20_000, 6.0m), M(30_000, 5.0m)]).Single();
        Assert.Equal(0.1, etat.MmPar1000Km!.Value, 3);
        Assert.Equal(20_000, etat.KmAvantConseille);   // 5 mm → 3 mm
        Assert.Equal(34_000, etat.KmAvantLegal);       // 5 mm → 1,6 mm
    }

    [Fact]
    public void Un_pneu_neuf_remet_le_calcul_a_zero()
    {
        var etat = UsurePneus.Etats([M(10_000, 3.0m), M(12_000, 8.0m), M(22_000, 7.5m)]).Single();
        Assert.Equal(0.05, etat.MmPar1000Km!.Value, 3);
    }
}
