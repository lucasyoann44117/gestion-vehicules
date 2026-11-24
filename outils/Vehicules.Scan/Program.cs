// Repère les documents du dossier des véhicules qui ne sont pas encore dans l'historique.
//
//   dotnet run --project outils/Vehicules.Scan -- "E:\Documents\véhicules"
//
// Chaque sous-dossier porte le nom court d'un véhicule (T4, Fiat 500…). Un document est
// « connu » s'il est cité dans historique.json (interventions ou contrôles techniques) ou
// listé dans documents-ignores.txt. Les fichiers identiques (même contenu) sont signalés.
// Code de sortie : 0 si rien de nouveau, 1 s'il y a des documents à traiter, 2 en cas d'erreur.

using System.Security.Cryptography;
using Vehicules.Core.Stockage;

var dossierDocuments = args.Length > 0 ? args[0] : @"E:\Documents\véhicules";
var racine = TrouverRacine(AppContext.BaseDirectory) ?? Directory.GetCurrentDirectory();
var dossierDonnees = Path.Combine(racine, "src", "Vehicules.Web", "wwwroot", "donnees");
var cheminHistorique = Path.Combine(dossierDonnees, "historique.json");
var cheminIgnores = Path.Combine(dossierDonnees, "documents-ignores.txt");

if (!Directory.Exists(dossierDocuments)) { Console.Error.WriteLine($"Dossier introuvable : {dossierDocuments}"); return 2; }
if (!File.Exists(cheminHistorique)) { Console.Error.WriteLine($"Historique introuvable : {cheminHistorique}"); return 2; }

var donnees = Json.Lire(File.ReadAllText(cheminHistorique));
var nomsVehicules = donnees.Vehicules.ToDictionary(v => v.Id, v => v.Nom);

// Documents déjà connus, sous la forme « Véhicule/fichier ».
var connus = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
void Connu(string vehiculeId, IEnumerable<string> fichiers)
{
    var nom = nomsVehicules.GetValueOrDefault(vehiculeId, vehiculeId);
    foreach (var f in fichiers) connus.Add($"{nom}/{f}");
}
foreach (var i in donnees.Interventions) Connu(i.VehiculeId, i.Documents);
foreach (var c in donnees.Controles) Connu(c.VehiculeId, c.Documents);
if (File.Exists(cheminIgnores))
{
    foreach (var ligne in File.ReadAllLines(cheminIgnores).Select(l => l.Trim()).Where(l => l.Length > 0 && !l.StartsWith('#')))
        connus.Add(ligne.Replace('\\', '/'));
}

string[] extensions = [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".webp"];
var fichiers = Directory.EnumerateFiles(dossierDocuments, "*", SearchOption.AllDirectories)
    .Where(f => extensions.Contains(Path.GetExtension(f).ToLowerInvariant()))
    .Select(f => (Chemin: f, Cle: Path.GetRelativePath(dossierDocuments, f).Replace('\\', '/')))
    .OrderBy(f => f.Cle, StringComparer.OrdinalIgnoreCase)
    .ToList();

var nouveaux = fichiers.Where(f => !connus.Contains(f.Cle)).ToList();
var sansVehicule = nouveaux.Where(f => !f.Cle.Contains('/') || !nomsVehicules.Values.Contains(f.Cle.Split('/')[0], StringComparer.OrdinalIgnoreCase)).ToList();

// Doublons exacts (même contenu sous deux noms).
var doublons = fichiers.GroupBy(f => Empreinte(f.Chemin)).Where(g => g.Count() > 1).ToList();

Console.WriteLine($"{fichiers.Count} document(s) dans {dossierDocuments}, {fichiers.Count - nouveaux.Count} déjà traité(s).");
if (nouveaux.Count == 0) Console.WriteLine("Rien de nouveau.");
else
{
    Console.WriteLine($"{nouveaux.Count} nouveau(x) document(s) à traiter :");
    foreach (var f in nouveaux)
        Console.WriteLine($"  + {f.Cle}  ({new FileInfo(f.Chemin).Length / 1024} Ko, {File.GetLastWriteTime(f.Chemin):dd/MM/yyyy HH:mm})");
}
foreach (var f in sansVehicule)
    Console.WriteLine($"  ! {f.Cle} : le dossier ne correspond à aucun véhicule ({string.Join(", ", nomsVehicules.Values)}).");
foreach (var g in doublons)
    Console.WriteLine($"  = Fichiers identiques : {string.Join(" / ", g.Select(f => f.Cle))}");

return nouveaux.Count > 0 ? 1 : 0;

static string Empreinte(string chemin)
{
    using var flux = File.OpenRead(chemin);
    return Convert.ToHexString(SHA256.HashData(flux));
}

static string? TrouverRacine(string depart)
{
    for (var d = new DirectoryInfo(depart); d is not null; d = d.Parent)
        if (File.Exists(Path.Combine(d.FullName, "GestionVehicules.slnx"))) return d.FullName;
    return null;
}
