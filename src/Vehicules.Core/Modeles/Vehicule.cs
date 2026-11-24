namespace Vehicules.Core.Modeles;

/// <summary>Un véhicule du foyer (le T4, la Fiat 500…).</summary>
public sealed class Vehicule
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Nom { get; set; } = "";
    public string Marque { get; set; } = "";
    public string Modele { get; set; } = "";
    public string? Motorisation { get; set; }
    public string? Energie { get; set; }
    public string? Vin { get; set; }
    public DateOnly? MiseEnCirculation { get; set; }
    public DateOnly? DateAchat { get; set; }
    public int? KmAchat { get; set; }
    /// <summary>Couleur d'accent dans l'interface (#rrggbb).</summary>
    public string Couleur { get; set; } = "#f2b705";
    /// <summary>Silhouette dessinée sur la carte : « van » ou « citadine ».</summary>
    public string Silhouette { get; set; } = "citadine";
    public string? Notes { get; set; }
    /// <summary>Valeur de revente estimée (cote), pour juger s'il vaut la peine de réparer.</summary>
    public decimal? ValeurEstimee { get; set; }

    /// <summary>Immatriculations successives, de la plus ancienne à la plus récente.</summary>
    public List<Immatriculation> Immatriculations { get; set; } = [];

    public string? ImmatriculationActuelle =>
        Immatriculations.OrderBy(i => i.Depuis ?? DateOnly.MinValue).LastOrDefault()?.Numero;

    /// <summary>Âge en années révolues à une date donnée.</summary>
    public int? Age(DateOnly aujourdhui)
    {
        if (MiseEnCirculation is not { } mec) return null;
        var age = aujourdhui.Year - mec.Year;
        if (aujourdhui < mec.AddYears(age)) age--;
        return age;
    }
}

public sealed record Immatriculation(string Numero, DateOnly? Depuis);
