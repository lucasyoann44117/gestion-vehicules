namespace Vehicules.Core.Diagnostic;

/// <summary>Planches éclatées du moteur, à la manière du catalogue ETKA (wwwroot/diagnostic/planches-moteur.json).</summary>
public sealed class BasePlanches
{
    public string Avertissement { get; set; } = "";
    public List<Planche> Planches { get; set; } = [];
}

/// <summary>Un groupe de pièces dessiné en 3D (ex. 109 Distribution).</summary>
public sealed class Planche
{
    /// <summary>Numéro de sous-groupe façon ETKA, qui sert aussi de clé pour le dessin 3D.</summary>
    public string Code { get; set; } = "";
    public string Titre { get; set; } = "";
    public string Groupe { get; set; } = "";
    public string? Description { get; set; }
    /// <summary>Planche du moteur : elle entre dans la vue « Moteur complet ».</summary>
    public bool Moteur { get; set; }
    public List<PositionPlanche> Positions { get; set; } = [];
}

/// <summary>Une ligne de la planche : un numéro de repère et la pièce qu'il désigne.</summary>
public sealed class PositionPlanche
{
    public int Pos { get; set; }
    /// <summary>Clé de la pièce dans le dessin 3D.</summary>
    public string Cle { get; set; } = "";
    public string Nom { get; set; } = "";
    /// <summary>Pièce suivie dans l'historique, si elle l'est.</summary>
    public string? Organe { get; set; }
    public string? Qte { get; set; }
    public string? Remarque { get; set; }
}
