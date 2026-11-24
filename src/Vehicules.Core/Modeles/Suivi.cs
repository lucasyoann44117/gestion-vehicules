namespace Vehicules.Core.Modeles;

/// <summary>
/// Un organe ou une pièce suivie sur un véhicule (distribution, batterie, rotule AV G…).
/// Les intervalles sont indicatifs et se règlent dans l'application.
/// </summary>
public sealed class Organe
{
    public string Id { get; set; } = "";
    public string VehiculeId { get; set; } = "";
    public string Nom { get; set; } = "";
    public string Categorie { get; set; } = "";
    public int? IntervalleKm { get; set; }
    public int? IntervalleMois { get; set; }
    public string? Notes { get; set; }
}

public enum SourceReleve
{
    Facture,
    ControleTechnique,
    Saisie,
    Autre,
}

public sealed class ReleveKm
{
    public string VehiculeId { get; set; } = "";
    public DateOnly Date { get; set; }
    public int Km { get; set; }
    public SourceReleve Source { get; set; }
    public string? Note { get; set; }
}

public enum ResultatCt
{
    Favorable,
    Defavorable,
    DefavorableCritique,
}

public enum Gravite
{
    Mineure,
    Majeure,
    Critique,
}

public enum StatutSuivi
{
    ASurveiller,
    APrevoir,
    Fait,
    Abandonne,
}

public sealed class ControleTechnique
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string VehiculeId { get; set; } = "";
    public DateOnly Date { get; set; }
    public int? Km { get; set; }
    public bool ContreVisite { get; set; }
    public ResultatCt Resultat { get; set; }
    /// <summary>Limite de validité : date du prochain contrôle.</summary>
    public DateOnly? Echeance { get; set; }
    public string? Centre { get; set; }
    public string? NumeroPv { get; set; }
    public List<Defaillance> Defaillances { get; set; } = [];
    public List<string> Mesures { get; set; } = [];
    public List<string> Documents { get; set; } = [];
}

public sealed class Defaillance
{
    public string Code { get; set; } = "";
    public string Libelle { get; set; } = "";
    public Gravite Gravite { get; set; }
    public StatutSuivi Statut { get; set; } = StatutSuivi.ASurveiller;
    public string? OrganeId { get; set; }
    /// <summary>Intervention qui a réglé le défaut.</summary>
    public string? InterventionId { get; set; }
}

/// <summary>Travail signalé par le garage, un CT ou noté soi-même.</summary>
public sealed class TravailAPrevoir
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string VehiculeId { get; set; } = "";
    public DateOnly DateSignalement { get; set; }
    public string Source { get; set; } = "";
    public string Libelle { get; set; } = "";
    public string? OrganeId { get; set; }
    public StatutSuivi Statut { get; set; } = StatutSuivi.APrevoir;
    public string? InterventionId { get; set; }
}

public enum PositionPneu
{
    AvantGauche,
    AvantDroit,
    ArriereGauche,
    ArriereDroit,
}

public sealed class MesurePneu
{
    public string VehiculeId { get; set; } = "";
    public DateOnly Date { get; set; }
    public int Km { get; set; }
    public PositionPneu Position { get; set; }
    public decimal ProfondeurMm { get; set; }
}

/// <summary>Toutes les données du foyer, telles qu'enregistrées.</summary>
public sealed class Donnees
{
    public int Version { get; set; } = 1;
    public List<Vehicule> Vehicules { get; set; } = [];
    public List<Organe> Organes { get; set; } = [];
    public List<Intervention> Interventions { get; set; } = [];
    public List<ReleveKm> Releves { get; set; } = [];
    public List<ControleTechnique> Controles { get; set; } = [];
    public List<TravailAPrevoir> Travaux { get; set; } = [];
    public List<MesurePneu> MesuresPneus { get; set; } = [];
}
