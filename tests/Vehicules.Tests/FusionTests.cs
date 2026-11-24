using Vehicules.Core.Modeles;
using Vehicules.Core.Stockage;

namespace Vehicules.Tests;

public class FusionTests
{
    [Fact]
    public void Garde_les_saisies_locales_et_prend_le_nouvel_historique()
    {
        var historique = new Donnees
        {
            Vehicules = [new Vehicule { Id = "v", Nom = "T4" }],
            Organes = [new Organe { Id = "vidange", VehiculeId = "v", IntervalleKm = 15000 }],
            Interventions = [new Intervention { Id = "a" }, new Intervention { Id = "b" }],
            Travaux = [new TravailAPrevoir { Id = "t", Statut = StatutSuivi.APrevoir }],
        };
        var local = new Donnees
        {
            Vehicules = [new Vehicule { Id = "v", Nom = "T4", ValeurEstimee = 3000 }],
            Organes = [new Organe { Id = "vidange", VehiculeId = "v", IntervalleKm = 10000 }],
            Interventions = [new Intervention { Id = "a" }, new Intervention { Id = "saisie" }],
            Releves = [new ReleveKm { VehiculeId = "v", Date = new DateOnly(2026, 11, 1), Km = 480000 }],
            Travaux = [new TravailAPrevoir { Id = "t", Statut = StatutSuivi.Fait }],
        };

        var r = Fusion.Appliquer(historique, local);

        Assert.Equal(["a", "b", "saisie"], r.Interventions.Select(i => i.Id).Order());
        Assert.Single(r.Releves);
        Assert.Equal(3000m, r.Vehicules[0].ValeurEstimee);
        Assert.Equal(10000, r.Organes[0].IntervalleKm);
        Assert.Equal(StatutSuivi.Fait, r.Travaux[0].Statut);
    }
}
