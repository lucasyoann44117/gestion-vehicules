using Vehicules.Core.Diagnostic;
using Vehicules.Core.Stockage;

namespace Vehicules.Tests;

public class PlanchesTests
{
    private static readonly BasePlanches Base = System.Text.Json.JsonSerializer.Deserialize<BasePlanches>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "planches-moteur.json")), Json.Options)!;

    [Fact]
    public void Les_reperes_sont_uniques_et_numerotes_dans_l_ordre()
    {
        Assert.True(Base.Planches.Count >= 8);
        Assert.Equal(Base.Planches.Count, Base.Planches.Select(p => p.Code).Distinct().Count());
        foreach (var p in Base.Planches)
        {
            Assert.Equal(Enumerable.Range(1, p.Positions.Count), p.Positions.Select(x => x.Pos));
            Assert.Equal(p.Positions.Count, p.Positions.Select(x => x.Cle).Distinct().Count());
        }
    }

    [Fact]
    public void Chaque_repere_a_son_dessin_3D()
    {
        var js = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "planches-3d.js"));
        foreach (var p in Base.Planches)
        {
            Assert.Contains($"'{p.Code}': {{", js);
            foreach (var x in p.Positions)
                Assert.True(js.Contains($"'{x.Cle}': {{") || js.Contains($"['{x.Cle}'] = {{"), $"{p.Code} : pas de dessin pour {x.Cle}");
        }
    }

    [Fact]
    public void Les_pieces_suivies_ont_une_fiche()
    {
        var fiches = System.Text.Json.JsonSerializer.Deserialize<BaseFichesPieces>(
            File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "pieces-t4.json")), Json.Options)!;
        foreach (var x in Base.Planches.SelectMany(p => p.Positions).Where(x => x.Organe is not null))
            Assert.True(fiches.Pieces.ContainsKey(x.Organe!), $"Pas de fiche pour {x.Organe}");
    }
}
