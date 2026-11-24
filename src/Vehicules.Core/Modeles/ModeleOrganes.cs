namespace Vehicules.Core.Modeles;

/// <summary>Liste d'organes proposée pour un nouveau véhicule ; intervalles indicatifs à ajuster.</summary>
public static class ModeleOrganes
{
    private static readonly (string Cle, string Nom, string Categorie, int? Km, int? Mois)[] Liste =
    [
        ("huile-moteur", "Vidange huile moteur", "Entretien", 15000, 12),
        ("filtre-huile", "Filtre à huile", "Entretien", 15000, 12),
        ("filtre-air", "Filtre à air", "Entretien", 30000, 24),
        ("filtre-habitacle", "Filtre d'habitacle (pollen)", "Entretien", 15000, 12),
        ("filtre-carburant", "Filtre à carburant", "Entretien", 60000, 48),
        ("bougies", "Bougies d'allumage", "Entretien", 60000, 48),
        ("liquide-frein", "Liquide de frein", "Freinage", null, 24),
        ("liquide-refroidissement", "Liquide de refroidissement", "Moteur", null, 48),
        ("distribution", "Distribution (courroie ou chaîne)", "Moteur", 120000, 72),
        ("courroie-accessoires", "Courroie d'accessoires", "Moteur", 120000, 72),
        ("embrayage", "Embrayage", "Transmission", null, null),
        ("batterie", "Batterie", "Électricité", null, 60),
        ("clim", "Climatisation (recharge)", "Climatisation", null, 24),
        ("freins-av", "Freins avant (disques, plaquettes)", "Freinage", null, null),
        ("freins-ar", "Freins arrière", "Freinage", null, null),
        ("pneus-av", "Pneus avant", "Pneus", null, null),
        ("pneus-ar", "Pneus arrière", "Pneus", null, null),
        ("amortisseurs", "Amortisseurs", "Suspension", null, null),
        ("essuie-glace", "Balais d'essuie-glace", "Divers", null, 12),
    ];

    public static List<Organe> Pour(string vehiculeId) =>
        Liste.Select(o => new Organe
        {
            Id = $"{vehiculeId}-{o.Cle}",
            VehiculeId = vehiculeId,
            Nom = o.Nom,
            Categorie = o.Categorie,
            IntervalleKm = o.Km,
            IntervalleMois = o.Mois,
        }).ToList();
}
