using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using Vehicules.Core.Calculs;
using Vehicules.Core.Modeles;

namespace Vehicules.Core.Diagnostic;

public sealed record PanneTrouvee(Panne Panne, double Score, IReadOnlyList<string> MotsReconnus);

/// <summary>Une cause classée, avec ce que dit l'historique du véhicule sur les pièces concernées.</summary>
public sealed record CauseClassee(Cause Cause, int Score, IReadOnlyList<string> Historique, bool Ecartee);

/// <summary>
/// Recherche de pannes à partir d'une description libre (tapée ou dictée), recoupage
/// par questions, et croisement avec l'historique des pièces du véhicule.
/// </summary>
public static partial class MoteurDiagnostic
{
    private static readonly HashSet<string> MotsVides =
    [
        "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou", "a", "au", "aux", "en", "il", "elle",
        "y", "j", "je", "ai", "on", "mon", "ma", "mes", "ce", "c", "est", "qui", "que", "quand", "avec", "sur", "dans",
        "par", "pour", "plus", "tres", "trop", "un", "peu", "bien", "fait", "fais", "camion", "t4", "vehicule", "voiture",
        "van", "moteur", "me", "se", "s", "ca", "cela", "quelque", "chose", "parfois", "depuis", "jours", "hier",
    ];

    /// <summary>Minuscules, sans accents ni ponctuation.</summary>
    public static string Normaliser(string texte)
    {
        var d = texte.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(d.Length);
        foreach (var c in d)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(char.IsLetterOrDigit(c) ? c : ' ');
        }
        return Espaces().Replace(sb.ToString(), " ").Trim();
    }

    /// <summary>Racine grossière : retire les terminaisons courantes (pluriels, verbes).</summary>
    public static string Racine(string mot)
    {
        if (mot.Length <= 4) return mot;
        foreach (var fin in new[] { "ements", "ement", "ations", "ation", "euses", "euse", "eurs", "eur", "ees", "ee", "es", "er", "ez", "e", "s", "x" })
            if (mot.EndsWith(fin) && mot.Length - fin.Length >= 4) return mot[..^fin.Length];
        return mot;
    }

    public static List<string> Mots(string texte, BasePannes b)
    {
        var t = " " + Normaliser(texte) + " ";
        // Expressions synonymes ramenées à leur forme de référence (« demarre pas » → « demarrage »).
        foreach (var groupe in b.Synonymes)
        {
            var reference = Normaliser(groupe[0]);
            foreach (var s in groupe.Skip(1).Select(Normaliser).OrderByDescending(s => s.Length))
                t = t.Replace(" " + s + " ", " " + reference + " ");
        }
        return t.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(m => !MotsVides.Contains(m))
                .Select(Racine)
                .Distinct()
                .ToList();
    }

    /// <summary>Pannes qui correspondent le mieux à la description, de la plus probable à la moins probable.</summary>
    public static List<PanneTrouvee> Chercher(string description, BasePannes b, int max = 6)
    {
        var mots = Mots(description, b);
        if (mots.Count == 0) return [];
        var resultats = new List<PanneTrouvee>();
        foreach (var p in b.Pannes)
        {
            var clesPanne = p.MotsCles.SelectMany(k => Mots(k, b)).ToHashSet();
            var texte = p.Descriptions.Append(p.Titre).SelectMany(d => Mots(d, b)).ToHashSet();
            double score = 0;
            var reconnus = new List<string>();
            foreach (var m in mots)
            {
                if (clesPanne.Contains(m)) { score += 3; reconnus.Add(m); }
                else if (texte.Contains(m)) { score += 1.5; reconnus.Add(m); }
                else if (m.Length >= 5 && clesPanne.Any(k => k.StartsWith(m) || m.StartsWith(k))) { score += 1; reconnus.Add(m); }
            }
            if (score > 0) resultats.Add(new PanneTrouvee(p, score / Math.Sqrt(mots.Count), reconnus));
        }
        return resultats.OrderByDescending(r => r.Score).Take(max).ToList();
    }

    /// <summary>
    /// Classe les causes d'une panne : fréquence, réponses aux questions, et historique
    /// (une pièce changée récemment est moins suspecte, une pièce en retard l'est plus).
    /// </summary>
    public static List<CauseClassee> Classer(
        Panne panne, IReadOnlyDictionary<int, bool> reponses, IReadOnlyList<EtatOrgane> etats, IEnumerable<string>? codesLus = null)
    {
        var scores = panne.Causes.ToDictionary(c => c.Id, c => c.Frequence * 10);
        foreach (var (index, oui) in reponses)
        {
            if (index < 0 || index >= panne.Questions.Count) continue;
            var q = panne.Questions[index];
            foreach (var (cause, delta) in oui ? q.SiOui : q.SiNon)
                if (scores.ContainsKey(cause)) scores[cause] += delta;
        }

        var codes = codesLus?.Select(c => c.Trim().ToUpperInvariant()).ToHashSet() ?? [];
        var resultat = new List<CauseClassee>();
        foreach (var c in panne.Causes)
        {
            var notes = new List<string>();
            var s = scores[c.Id];
            foreach (var e in etats.Where(e => c.Organes.Contains(e.Organe.Id)))
            {
                if (e.Dernier is { } d)
                {
                    var depuis = e.KmDepuis is { } k ? $"{k:N0} km" : $"{e.MoisDepuis} mois";
                    notes.Add($"{e.Organe.Nom} : changé le {d.Date:dd/MM/yyyy}, il y a {depuis}.");
                    if (e.KmDepuis is < 15000 || e.MoisDepuis is < 12) s -= 8;
                    if (e.Urgence == Urgence.Depasse) s += 8;
                }
                else notes.Add($"{e.Organe.Nom} : aucun changement dans l'historique.");
            }
            if (c.Codes.Any(codes.Contains)) { s += 40; notes.Insert(0, "Un code défaut lu correspond à cette cause."); }
            resultat.Add(new CauseClassee(c, s, notes, s <= 0));
        }
        return resultat.OrderByDescending(r => r.Score).ToList();
    }

    /// <summary>Codes défaut trouvés dans un texte (rapport VCDS collé, saisie) : 5 chiffres VAG ou P0123.</summary>
    public static List<string> ExtraireCodes(string texte) =>
        CodeVag().Matches(texte).Select(m => m.Value.ToUpperInvariant()).Distinct().ToList();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Espaces();

    [GeneratedRegex(@"\b(?:[PpBbCcUu][0-3][0-9A-Fa-f]{3}|\d{5})\b")]
    private static partial Regex CodeVag();
}
