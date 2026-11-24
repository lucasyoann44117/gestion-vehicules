using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using Vehicules.Core.Modeles;

namespace Vehicules.Core.Stockage;

/// <summary>Format JSON commun : fichier d'historique, sauvegarde et stockage du navigateur.</summary>
public static class Json
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter() },
    };

    public static string Ecrire(Donnees d) => JsonSerializer.Serialize(d, Options);

    public static Donnees Lire(string json) =>
        JsonSerializer.Deserialize<Donnees>(json, Options) ?? new Donnees();
}
