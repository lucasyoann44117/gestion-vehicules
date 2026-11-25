using Vehicules.Core.Calculs;

namespace Vehicules.Tests;

public class DecodeurVinTests
{
    [Fact]
    public void Decode_le_VIN_du_T4()
    {
        var s = DecodeurVin.Decoder("WV2ZZZ70Z3H015712");
        Assert.Equal(7, s.Count);
        Assert.Contains("bus", s[0].Signification);
        Assert.Contains("T4", s[2].Signification);
        Assert.Equal("Année-modèle 2003", s[4].Signification);
        Assert.Contains("Hanovre", s[5].Signification);
        Assert.Equal("015712", s[6].Valeur);
    }

    [Theory]
    [InlineData('3', 2003)]
    [InlineData('Y', 2000)]
    [InlineData('A', 2010)]
    [InlineData('S', 2025)]
    public void Millesime(char c, int annee) => Assert.Equal(annee, DecodeurVin.Millesime(c));

    [Theory]
    [InlineData("WV2ZZZ70Z3H01571")]
    [InlineData("WV2ZZZ70Z3H01571O")]
    [InlineData(null)]
    public void Refuse_un_VIN_invalide(string? vin) => Assert.False(DecodeurVin.EstValide(vin));
}
