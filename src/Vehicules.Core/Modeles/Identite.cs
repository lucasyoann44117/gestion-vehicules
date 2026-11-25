namespace Vehicules.Core.Modeles;

/// <summary>Carte d'identité d'un véhicule : ce que disent la carte grise, les PV de CT et la plaque constructeur.</summary>
public sealed class Identite
{
    public string? Finition { get; set; }
    /// <summary>Type mines / CNIT (repère D.2 de la carte grise).</summary>
    public string? TypeMines { get; set; }
    public string? Genre { get; set; }
    public string? Categorie { get; set; }
    public string? CodeMoteur { get; set; }
    public string? Cylindree { get; set; }
    public int? PuissanceKw { get; set; }
    public int? PuissanceCh { get; set; }
    public int? PuissanceFiscale { get; set; }
    public string? Boite { get; set; }
    public string? Transmission { get; set; }
    public string? Couleur { get; set; }
    public string? CodeCouleur { get; set; }
    public string? Jantes { get; set; }
    public string? Pneus { get; set; }
    public string? Places { get; set; }
    public decimal? LongueurM { get; set; }
    public decimal? LargeurM { get; set; }
    public decimal? HauteurM { get; set; }
    public decimal? EmpattementM { get; set; }
    public DateOnly? PremiereImmatriculationFrance { get; set; }
    public string? Usine { get; set; }
    public int? Millesime { get; set; }
    /// <summary>Équipements et options repérés (d'origine ou ajoutés).</summary>
    public List<Equipement> Equipements { get; set; } = [];
    /// <summary>Codes PR de la plaque de données (« autocollant d'options »), s'ils sont connus.</summary>
    public List<string> CodesPr { get; set; } = [];
}

public sealed class Equipement
{
    public string Nom { get; set; } = "";
    public string? Detail { get; set; }
    /// <summary>Confort, Chauffage, Électricité, Aménagement, Extérieur, Moteur…</summary>
    public string Categorie { get; set; } = "";
    /// <summary>d'origine, ajouté, remplacé.</summary>
    public string Provenance { get; set; } = "d'origine";
    /// <summary>D'où vient l'information (facture, PV de CT, forum…).</summary>
    public string? Source { get; set; }
    /// <summary>Illustration à afficher (même familles que les pièces, plus siège, rideau, table…).</summary>
    public string? Icone { get; set; }
}
