namespace Vehicules.Core.Modeles;

public enum TypeIntervention
{
    Entretien,
    Reparation,
    ControleTechnique,
    Pneus,
    Carrosserie,
    Administratif,
    Autre,
}

public enum NatureLigne
{
    Piece,
    MainOeuvre,
    Divers,
}

/// <summary>Un passage au garage, un achat de pièce ou un frais (une facture ou un ticket).</summary>
public sealed class Intervention
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string VehiculeId { get; set; } = "";
    public DateOnly Date { get; set; }
    public int? Km { get; set; }
    public string? Garage { get; set; }
    public TypeIntervention Type { get; set; }
    public string Titre { get; set; } = "";
    public string? NumeroFacture { get; set; }
    public decimal? TotalHt { get; set; }
    public decimal TotalTtc { get; set; }
    public bool Paye { get; set; } = true;
    public string? Notes { get; set; }
    public List<LigneIntervention> Lignes { get; set; } = [];
    /// <summary>Noms des fichiers sources (factures, PV), relatifs au dossier du véhicule.</summary>
    public List<string> Documents { get; set; } = [];

    public decimal TotalPiecesHt => Somme(NatureLigne.Piece);
    public decimal TotalMainOeuvreHt => Somme(NatureLigne.MainOeuvre);
    public decimal TotalDiversHt => Somme(NatureLigne.Divers);

    private decimal Somme(NatureLigne nature) =>
        Lignes.Where(l => l.Nature == nature && !l.Exclue).Sum(l => l.MontantHt);
}

/// <summary>Une ligne de facture : une pièce, de la main-d'œuvre ou un frais divers.</summary>
public sealed class LigneIntervention
{
    public string Designation { get; set; } = "";
    public string? Reference { get; set; }
    public decimal Quantite { get; set; } = 1;
    public decimal? PrixUnitaireHt { get; set; }
    /// <summary>Montant HT de la ligne ; calculé à partir de la quantité et du prix unitaire s'il manque.</summary>
    public decimal MontantHt { get; set; }
    public NatureLigne Nature { get; set; }
    /// <summary>Organe concerné (distribution, batterie…), pour retrouver quand une pièce a été changée.</summary>
    public string? OrganeId { get; set; }
    /// <summary>Ligne sans rapport avec le véhicule (courses sur un ticket de caisse, par exemple).</summary>
    public bool Exclue { get; set; }
}
