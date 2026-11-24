using Vehicules.Core.Calculs;
using Vehicules.Core.Modeles;

namespace Vehicules.Tests;

public class KilometrageTests
{
    private static ReleveKm R(int a, int m, int j, int km) => new() { VehiculeId = "v", Date = new DateOnly(a, m, j), Km = km };

    [Fact]
    public void Estimer_interpole_entre_deux_releves()
    {
        var releves = new[] { R(2024, 1, 1, 100_000), R(2024, 12, 31, 136_500) };   // 365 jours, 100 km/jour
        Assert.Equal(118_200, Kilometrage.Estimer(releves, new DateOnly(2024, 7, 1)));  // 182 jours
    }

    [Fact]
    public void Estimer_renvoie_le_releve_exact()
    {
        var releves = new[] { R(2024, 1, 1, 100_000), R(2024, 6, 1, 110_000) };
        Assert.Equal(110_000, Kilometrage.Estimer(releves, new DateOnly(2024, 6, 1)));
    }

    [Fact]
    public void Estimer_avant_le_premier_releve_est_inconnu()
    {
        var releves = new[] { R(2024, 1, 1, 100_000) };
        Assert.Null(Kilometrage.Estimer(releves, new DateOnly(2023, 12, 31)));
    }

    [Fact]
    public void Estimer_apres_le_dernier_prolonge_le_rythme()
    {
        var releves = new[] { R(2023, 1, 1, 100_000), R(2024, 1, 1, 120_000) };      // 20 000 km sur 365 jours
        var estime = Kilometrage.Estimer(releves, new DateOnly(2024, 7, 2));            // 183 jours plus tard
        Assert.InRange(estime!.Value, 129_900, 130_100);
    }

    [Fact]
    public void Plusieurs_releves_le_meme_jour_gardent_le_plus_haut()
    {
        var releves = new[] { R(2024, 1, 1, 100_000), R(2024, 1, 1, 100_500) };
        Assert.Single(Kilometrage.Tries(releves));
        Assert.Equal(100_500, Kilometrage.Tries(releves)[0].Km);
    }

    [Fact]
    public void KmParAn_utilise_la_fenetre_recente()
    {
        // Peu roulé autrefois, beaucoup ces deux dernières années.
        var releves = new[] { R(2018, 1, 1, 50_000), R(2022, 1, 1, 60_000), R(2024, 1, 1, 100_000) };
        Assert.InRange(Kilometrage.KmParAn(releves)!.Value, 19_900, 20_100);
    }

    [Fact]
    public void Parcourus_est_borne_au_premier_releve()
    {
        var releves = new[] { R(2024, 7, 1, 100_000), R(2025, 7, 1, 120_000) };
        // 2024 : seulement du 1er juillet au 31 décembre.
        var km = Kilometrage.Parcourus(releves, new DateOnly(2024, 1, 1), new DateOnly(2024, 12, 31), new DateOnly(2026, 1, 1));
        Assert.InRange(km!.Value, 10_000, 10_200);
    }
}
