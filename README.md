# Mes véhicules

Suivi de l'entretien, des pièces changées et des coûts des véhicules du foyer
(le T4, bientôt la Fiat 500). Application web installable (PWA) écrite en C#
avec Blazor WebAssembly : elle tourne sur Android, iPhone et PC.

Cadrage : [docs/CADRAGE.md](docs/CADRAGE.md).

## Organisation

| Dossier | Rôle |
|---|---|
| `src/Vehicules.Core` | Le modèle (véhicule, intervention, pièce, CT…) et les calculs : km estimé, coûts par année, durée de vie des pièces, échéances, usure des pneus. Du C# pur, sans interface. |
| `src/Vehicules.Web` | L'application Blazor : `Pages/` (un fichier `.razor` par écran), `Composants/`, `Services/` (chargement et enregistrement des données), `wwwroot/css/app.css` (le style). |
| `src/Vehicules.Web/wwwroot/donnees/` | `historique.json` : l'historique saisi depuis les factures. **Hors du dépôt** (données personnelles). |
| `tests/Vehicules.Tests` | Tests xUnit des calculs, et contrôles de cohérence de l'historique (chaque facture retombe sur son total). |
| `outils/Vehicules.Scan` | Repère les documents du dossier `E:\Documents\véhicules` qui ne sont pas encore dans l'historique. |

## Commandes

Lancer l'application sur le PC (http://localhost:5227) :

```powershell
dotnet run --project src/Vehicules.Web
```

Lancer les tests :

```powershell
dotnet test
```

Chercher les nouveaux documents scannés :

```powershell
dotnet run --project outils/Vehicules.Scan -- "E:\Documents\véhicules"
```

## Ajouter des documents

1. Déposer le scan dans le sous-dossier du véhicule (`E:\Documents\véhicules\T4\…`),
   de préférence nommé `AAAAMMJJ objet.pdf`.
2. Lancer l'outil de scan : il liste ce qui n'est pas encore intégré et signale les fichiers en double.
3. Claude lit les nouveaux documents et complète `historique.json` (interventions, lignes,
   pièces, kilométrages, contrôles techniques). Un document à ne pas intégrer se note dans
   `documents-ignores.txt`.
4. Dans l'application, **Réglages > Revenir à l'historique d'origine** recharge le fichier.

## Données

Pour l'instant, les données sont gardées dans le navigateur de chaque appareil
(stockage local), chargées depuis `historique.json`. L'étape suivante est Supabase,
comme pour l'application chantier : une base partagée entre les téléphones, avec
connexion des deux comptes du foyer. Le code passe par l'interface `IDepot` : il
suffira d'en écrire une version Supabase.

## Pour mettre les mains dedans

- Un nouvel écran : un fichier dans `Pages/` qui commence par `@page "/adresse"` et
  `@inherits PageBase` (il se redessine quand les données changent).
- Un nouveau calcul : une classe statique dans `Vehicules.Core/Calculs`, avec son test
  dans `tests/Vehicules.Tests`.
- Le style : variables de couleur en tête de `app.css` (thème clair et sombre).
