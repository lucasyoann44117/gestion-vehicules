using Vehicules.Core.Diagnostic;
using Vehicules.Core.Stockage;

namespace Vehicules.Tests;

public class DiagnosticTests
{
    private static readonly BasePannes Base = System.Text.Json.JsonSerializer.Deserialize<BasePannes>(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "t4-acv.json")), Json.Options)!;

    [Theory]
    [InlineData("il démarre mal le matin, faut insister", "demarrage-froid")]
    [InlineData("ça claque quand je braque à fond", "claquement-virage")]
    [InlineData("l'aiguille de température monte dans les bouchons", "surchauffe")]
    [InlineData("il ne pousse plus en côte, plus de turbo", "perte-puissance")]
    [InlineData("le voyant batterie reste allumé", "voyant-batterie")]
    [InlineData("la clim souffle tiède", "clim")]
    [InlineData("il y a une goutte de gasoil sous l'injecteur", "fuite-gazole")]
    [InlineData("le voyant d'huile rouge clignote et ça bipe", "voyant-huile")]
    public void Trouve_la_bonne_panne(string description, string attendue) =>
        Assert.Equal(attendue, MoteurDiagnostic.Chercher(description, Base)[0].Panne.Id);

    [Fact]
    public void Une_reponse_change_le_classement()
    {
        var panne = Base.Pannes.Single(p => p.Id == "demarrage-froid");
        var sans = MoteurDiagnostic.Classer(panne, new Dictionary<int, bool>(), []);
        var avec = MoteurDiagnostic.Classer(panne, new Dictionary<int, bool> { [0] = false }, []);
        Assert.Equal("bougies", sans[0].Cause.Id);
        Assert.Equal("relais", avec[0].Cause.Id);
    }

    [Fact]
    public void Extrait_les_codes_d_un_rapport_VCDS()
    {
        var codes = MoteurDiagnostic.ExtraireCodes("""
            Address 01: Engine
            2 Faults Found:
            00553 - Mass Air Flow Sensor (G70): Signal too Low
            01247 - Solenoid Valve for Charge Pressure Control (N75) / P0100
            """);
        Assert.Equal(["00553", "01247", "P0100"], codes);
    }

    [Fact]
    public void La_base_est_coherente()
    {
        foreach (var p in Base.Pannes)
        {
            var causes = p.Causes.Select(c => c.Id).ToHashSet();
            Assert.Equal(p.Causes.Count, causes.Count);
            foreach (var q in p.Questions)
                foreach (var id in q.SiOui.Keys.Concat(q.SiNon.Keys))
                    Assert.True(causes.Contains(id), $"{p.Id} : la question « {q.Texte} » vise une cause inconnue ({id})");
        }
        var pannes = Base.Pannes.Select(p => p.Id).ToHashSet();
        foreach (var c in Base.Codes)
            foreach (var p in c.Pannes) Assert.Contains(p, pannes);
    }

    [Fact]
    public void Les_pieces_citees_existent_dans_l_historique()
    {
        var chemin = Path.Combine(AppContext.BaseDirectory, "historique.json");
        if (!File.Exists(chemin)) return;
        var organes = Json.Lire(File.ReadAllText(chemin)).Organes.Select(o => o.Id).ToHashSet();
        foreach (var c in Base.Pannes.SelectMany(p => p.Causes))
            foreach (var o in c.Organes) Assert.True(organes.Contains(o), $"Pièce inconnue : {o}");
    }
}
