namespace Vehicules.Core.Diagnostic;

/// <summary>Base de connaissances de pannes pour un véhicule (ici le T4 2.5 TDI ACV).</summary>
public sealed class BasePannes
{
    public string Vehicule { get; set; } = "";
    public string Moteur { get; set; } = "";
    public List<Panne> Pannes { get; set; } = [];
    public List<CodeDefaut> Codes { get; set; } = [];
    /// <summary>Mots ou expressions équivalents, ramenés au premier de chaque liste.</summary>
    public List<List<string>> Synonymes { get; set; } = [];
}

/// <summary>Un symptôme et ses causes possibles.</summary>
public sealed class Panne
{
    public string Id { get; set; } = "";
    public string Titre { get; set; } = "";
    public string Systeme { get; set; } = "";
    /// <summary>Façons courantes de décrire le symptôme, à l'oral comme à l'écrit.</summary>
    public List<string> Descriptions { get; set; } = [];
    public List<string> MotsCles { get; set; } = [];
    public string? Urgence { get; set; }
    public List<Cause> Causes { get; set; } = [];
    /// <summary>Questions de recoupage : chaque réponse renforce ou écarte des causes.</summary>
    public List<Question> Questions { get; set; } = [];
    /// <summary>Recherches conseillées sur les forums (texte de la recherche).</summary>
    public List<string> Recherches { get; set; } = [];
}

public sealed class Cause
{
    public string Id { get; set; } = "";
    public string Libelle { get; set; } = "";
    /// <summary>Fréquence de cette cause pour ce symptôme, de 1 (rare) à 5 (la plus courante).</summary>
    public int Frequence { get; set; } = 3;
    public List<string> Verifications { get; set; } = [];
    /// <summary>Pièces suivies concernées : sert à recouper avec l'historique.</summary>
    public List<string> Organes { get; set; } = [];
    public List<string> Codes { get; set; } = [];
    /// <summary>facile, moyen ou garage.</summary>
    public string? Difficulte { get; set; }
    public string? Cout { get; set; }
    /// <summary>Recherche d'images ou de tutos (texte de la recherche).</summary>
    public string? Image { get; set; }
    /// <summary>Discussions de forum où cette cause a été trouvée et résolue.</summary>
    public List<Source> Sources { get; set; } = [];
}

/// <summary>« À quoi ça sert » : rôle, emplacement, usure et prix indicatif d'une pièce.</summary>
public sealed class FichePiece
{
    public string Role { get; set; } = "";
    public string? Emplacement { get; set; }
    public string? Usure { get; set; }
    public string? DureeVie { get; set; }
    public string? PrixPiece { get; set; }
    public string? PrixPose { get; set; }
    /// <summary>Zone du compartiment moteur (Moteur, Admission, Alimentation…).</summary>
    public string? Zone { get; set; }
}

public sealed class BaseFichesPieces
{
    public string Avertissement { get; set; } = "";
    /// <summary>Fiches par identifiant de pièce suivie.</summary>
    public Dictionary<string, FichePiece> Pieces { get; set; } = [];
}

/// <summary>Une discussion de forum ou une page de tuto, résumée dans la base.</summary>
public sealed class Source
{
    public string Titre { get; set; } = "";
    public string Url { get; set; } = "";
}

public sealed class Question
{
    public string Texte { get; set; } = "";
    /// <summary>Ajustement du score des causes (par identifiant) si la réponse est oui.</summary>
    public Dictionary<string, int> SiOui { get; set; } = [];
    public Dictionary<string, int> SiNon { get; set; } = [];
}

public sealed class CodeDefaut
{
    public string Code { get; set; } = "";
    public string Libelle { get; set; } = "";
    public string? Composant { get; set; }
    public List<string> Pistes { get; set; } = [];
    /// <summary>Pannes de la base liées à ce code.</summary>
    public List<string> Pannes { get; set; } = [];
}
