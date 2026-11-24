using System.Globalization;
using Vehicules.Core.Calculs;
using Vehicules.Core.Modeles;

namespace Vehicules.Web.Services;

/// <summary>Mise en forme française des montants, dates et libellés.</summary>
public static class Format
{
    public static readonly CultureInfo Fr = CultureInfo.GetCultureInfo("fr-FR");

    public static string Euros(decimal? v, int decimales = 2) =>
        v is null ? "–" : v.Value.ToString(decimales == 0 ? "#,##0 €" : "#,##0." + new string('0', decimales) + " €", Fr);

    public static string Km(int? v) => v is null ? "–" : v.Value.ToString("#,##0", Fr) + " km";

    public static string Nombre(double? v, int decimales = 0) =>
        v is null ? "–" : v.Value.ToString("N" + decimales, Fr);

    public static string Date(DateOnly? d) => d is null ? "–" : d.Value.ToString("dd/MM/yyyy", Fr);

    public static string DateCourte(DateOnly d) => d.ToString("d MMM yyyy", Fr);

    public static string Mois(int? mois)
    {
        if (mois is null) return "–";
        var a = mois.Value / 12;
        var m = mois.Value % 12;
        return (a, m) switch
        {
            (0, _) => $"{m} mois",
            (_, 0) => a == 1 ? "1 an" : $"{a} ans",
            _ => (a == 1 ? "1 an" : $"{a} ans") + $" {m} mois",
        };
    }

    public static string Libelle(TypeIntervention t) => t switch
    {
        TypeIntervention.Entretien => "Entretien",
        TypeIntervention.Reparation => "Réparation",
        TypeIntervention.ControleTechnique => "Contrôle technique",
        TypeIntervention.Pneus => "Pneus",
        TypeIntervention.Carrosserie => "Carrosserie",
        TypeIntervention.Administratif => "Administratif",
        _ => "Autre",
    };

    public static string Libelle(NatureLigne n) => n switch
    {
        NatureLigne.Piece => "Pièce",
        NatureLigne.MainOeuvre => "Main-d'œuvre",
        _ => "Divers",
    };

    public static string Libelle(PositionPneu p) => p switch
    {
        PositionPneu.AvantGauche => "Avant gauche",
        PositionPneu.AvantDroit => "Avant droit",
        PositionPneu.ArriereGauche => "Arrière gauche",
        _ => "Arrière droit",
    };

    public static string Libelle(StatutSuivi s) => s switch
    {
        StatutSuivi.ASurveiller => "À surveiller",
        StatutSuivi.APrevoir => "À prévoir",
        StatutSuivi.Fait => "Fait",
        _ => "Abandonné",
    };

    public static string Libelle(Urgence u) => u switch
    {
        Urgence.Depasse => "Dépassé",
        Urgence.Bientot => "Bientôt",
        Urgence.Ok => "OK",
        _ => "Sans échéance",
    };

    /// <summary>Classe CSS d'état : ok, att (attention), mal.</summary>
    public static string Classe(Urgence u) => u switch
    {
        Urgence.Depasse => "mal",
        Urgence.Bientot => "att",
        Urgence.Ok => "ok",
        _ => "neutre",
    };
}
