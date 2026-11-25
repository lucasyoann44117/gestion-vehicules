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

    /// <summary>Carte d'identité : type, motorisation, dimensions, équipements.</summary>
    public Identite? Identite { get; set; }

    /// <summary>Photos du véhicule (fichiers dans le stockage Supabase « vehicules-photos »).</summary>
    public List<PhotoVehicule> Photos { get; set; } = [];

    /// <summary>Photo affichée en couverture : celle choisie, sinon la plus récente.</summary>
    public PhotoVehicule? PhotoCouverture =>
        Photos.FirstOrDefault(p => p.Couverture) ?? Photos.OrderByDescending(p => p.Ajoutee).FirstOrDefault();

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

public sealed class PhotoVehicule
{
    /// <summary>Chemin du fichier dans le stockage (par exemple « t4/1a2b3c.jpg »).</summary>
    public string Chemin { get; set; } = "";
    public string? Legende { get; set; }
    public DateOnly Ajoutee { get; set; }
    public bool Couverture { get; set; }
    /// <summary>Position verticale du cadrage en couverture, de 0 (haut) à 100 (bas).</summary>
    public int CadrageY { get; set; } = 60;
}
