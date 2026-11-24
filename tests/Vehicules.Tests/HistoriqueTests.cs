using Vehicules.Core.Stockage;

namespace Vehicules.Tests;

/// <summary>
/// Contrôles de cohérence sur l'historique réel (s'il est présent) : chaque facture
/// doit retomber sur son total, et chaque pièce suivie doit exister.
/// </summary>
public class HistoriqueTests
{
    private static readonly string Chemin = Path.Combine(AppContext.BaseDirectory, "historique.json");

    [Fact]
    public void Les_lignes_retombent_sur_le_total_HT()
    {
        if (!File.Exists(Chemin)) return;
        var d = Json.Lire(File.ReadAllText(Chemin));
        foreach (var i in d.Interventions.Where(i => i.TotalHt is not null))
        {
            var somme = i.Lignes.Where(l => !l.Exclue).Sum(l => l.MontantHt);
            Assert.True(Math.Abs(somme - i.TotalHt!.Value) < 0.02m, $"{i.Id} : lignes {somme} ≠ total HT {i.TotalHt}");
        }
    }

    [Fact]
    public void Les_lignes_ont_un_montant_coherent()
    {
        if (!File.Exists(Chemin)) return;
        var d = Json.Lire(File.ReadAllText(Chemin));
        foreach (var (i, l) in d.Interventions.SelectMany(i => i.Lignes.Select(l => (i, l))).Where(x => x.l.PrixUnitaireHt is not null))
        {
            Assert.True(Math.Abs(l.Quantite * l.PrixUnitaireHt!.Value - l.MontantHt) < 0.02m, $"{i.Id} / {l.Designation}");
        }
    }

    [Fact]
    public void Les_pieces_suivies_existent()
    {
        if (!File.Exists(Chemin)) return;
        var d = Json.Lire(File.ReadAllText(Chemin));
        var organes = d.Organes.Select(o => o.Id).ToHashSet();
        var references = d.Interventions.SelectMany(i => i.Lignes).Select(l => l.OrganeId)
            .Concat(d.Controles.SelectMany(c => c.Defaillances).Select(x => x.OrganeId))
            .Concat(d.Travaux.Select(t => t.OrganeId))
            .Where(id => id is not null);
        foreach (var id in references) Assert.Contains(id!, organes);
    }
}
