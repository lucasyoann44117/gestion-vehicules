namespace Vehicules.Core.Calculs;

/// <summary>Un morceau du numéro de série (VIN) et sa signification.</summary>
public sealed record SegmentVin(int Debut, string Valeur, string Nom, string Signification);

/// <summary>
/// Lecture d'un numéro d'identification (VIN, 17 caractères, norme ISO 3779),
/// avec les correspondances propres à Volkswagen.
/// </summary>
public static class DecodeurVin
{
    private static readonly Dictionary<string, string> Constructeurs = new()
    {
        ["WVW"] = "Volkswagen voitures particulières (Allemagne)",
        ["WV1"] = "Volkswagen Véhicules utilitaires, utilitaires (Allemagne)",
        ["WV2"] = "Volkswagen Véhicules utilitaires, bus et monospaces (Allemagne)",
        ["ZFA"] = "Fiat (Italie)",
        ["ZFF"] = "Ferrari (Italie)",
        ["VF1"] = "Renault (France)",
        ["VF3"] = "Peugeot (France)",
        ["VF7"] = "Citroën (France)",
    };

    private static readonly Dictionary<string, string> ModelesVw = new()
    {
        ["70"] = "Transporter T4 (1990-2003)",
        ["7H"] = "Transporter T5",
        ["7E"] = "Transporter T6",
        ["2K"] = "Caddy",
        ["1J"] = "Golf IV",
    };

    private static readonly Dictionary<char, string> UsinesVw = new()
    {
        ['H'] = "Hanovre (Allemagne)",
        ['W'] = "Wolfsburg (Allemagne)",
        ['X'] = "Poznań (Pologne)",
        ['D'] = "Bratislava (Slovaquie)",
        ['E'] = "Emden (Allemagne)",
        ['G'] = "Graz (Autriche)",
    };

    /// <summary>Année-modèle (millésime) codée par le 10e caractère, pour 1980-2039.</summary>
    public static int? Millesime(char c)
    {
        const string codes = "ABCDEFGHJKLMNPRSTVWXY123456789";
        var i = codes.IndexOf(char.ToUpperInvariant(c));
        if (i < 0) return null;
        var annee = 1980 + i;
        // Le cycle recommence tous les 30 ans : on retient l'année passée la plus récente.
        return annee + 30 <= DateTime.Today.Year + 1 ? annee + 30 : annee;
    }

    public static bool EstValide(string? vin) =>
        vin is { Length: 17 } && vin.All(c => char.IsAsciiLetterOrDigit(c) && c is not ('I' or 'O' or 'Q'));

    public static List<SegmentVin> Decoder(string vin)
    {
        vin = vin.Trim().ToUpperInvariant();
        if (!EstValide(vin)) return [];
        var wmi = vin[..3];
        var vw = wmi.StartsWith("WV");
        var annee = Millesime(vin[9]);
        return
        [
            new(0, wmi, "Constructeur", Constructeurs.GetValueOrDefault(wmi, "Code constructeur mondial (WMI)")),
            new(3, vin[3..6], "Description", vw && vin[3..6] == "ZZZ" ? "Remplissage : VW ne code rien ici pour l'Europe" : "Caractéristiques du véhicule"),
            new(6, vin[6..8], "Modèle", vw ? ModelesVw.GetValueOrDefault(vin[6..8], "Code modèle Volkswagen") : "Modèle"),
            new(8, vin[8..9], "Contrôle", vin[8] == 'Z' ? "Remplissage (pas de chiffre de contrôle en Europe)" : "Chiffre de contrôle"),
            new(9, vin[9..10], "Millésime", annee is { } a ? $"Année-modèle {a}" : "Année-modèle"),
            new(10, vin[10..11], "Usine", vw ? UsinesVw.GetValueOrDefault(vin[10], "Usine d'assemblage") : "Usine d'assemblage"),
            new(11, vin[11..], "Numéro de série", $"{int.Parse(vin[11..].TrimStart('0') is { Length: > 0 } n && n.All(char.IsDigit) ? n : "0"):N0}e véhicule de la série"),
        ];
    }
}
