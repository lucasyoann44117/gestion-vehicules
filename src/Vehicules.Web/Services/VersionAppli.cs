using System.Reflection;

namespace Vehicules.Web.Services;

/// <summary>Numéro de la version publiée (début du commit Git), pour vérifier que le téléphone est à jour.</summary>
public static class VersionAppli
{
    public static string Courte { get; } = Lire();

    private static string Lire()
    {
        var v = typeof(VersionAppli).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "";
        var plus = v.IndexOf('+');
        if (plus < 0) return "locale";
        var commit = v[(plus + 1)..];
        return commit.Length > 7 ? commit[..7] : commit;
    }
}
