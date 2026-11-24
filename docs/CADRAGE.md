# Projet : application de suivi des véhicules

## Contexte
Suivi personnel des véhicules du foyer : le VW T4 Multivan (2.5 TDI, 1re mise en
circulation 11/06/2002, plus de 470 000 km), puis la Fiat 500 à venir.
Objectifs : voir l'évolution des coûts par année, savoir quelle pièce a été
changée, quand et à quel kilométrage, suivre l'usure (pneus, freins…) et
anticiper les échéances. Consultable sur Android, iPhone et PC, gratuitement.

## Stack technique (C#)
- **Blazor WebAssembly en PWA (.NET 10)** : l'application est écrite en C#,
  compilée pour le navigateur et installable sur l'écran d'accueil
  (Android, iPhone, PC), comme l'application chantier.
- **Supabase** (offre gratuite) : base PostgreSQL, connexion des deux comptes
  du foyer, règles d'accès (RLS) et stockage des factures (PDF et photos).
  Client C# : paquet NuGet `Supabase`.
- **GitHub Pages** pour héberger les pages (gratuit, aucun serveur à faire tourner).
- **Interface reprise de l'application chantier** : menu latéral sur PC, barre
  de navigation en bas sur téléphone, tableaux qui deviennent des fiches sur
  petit écran, thème clair et sombre.
- Écarté : .NET MAUI (application native). Il faudrait un compte développeur
  Apple payant (99 € par an) pour l'iPhone, et une publication sur les stores.
- Écarté : LubeLogger, une application libre en C# qui fait déjà une partie
  du travail. Elle demande un serveur Docker allumé en permanence et se règle
  mal sur nos besoins (pièces, usure, coût par an).

## Modèle de données
- **Véhicules** : nom, immatriculations successives (370-BAK-35 puis HL-472-CA
  pour le T4), VIN, type, motorisation, date de mise en circulation, date et
  kilométrage d'achat, photo.
- **Relevés kilométriques** : date et km, avec leur source (facture, contrôle
  technique, saisie). Ils servent à estimer le kilométrage du jour et le nombre
  de km parcourus par an.
- **Interventions** : date, km, garage, type (entretien, réparation, contrôle
  technique, pneus, carrosserie, administratif), total HT, TVA et TTC, statut
  de paiement, documents joints.
- **Lignes d'intervention** : désignation, référence, quantité, prix unitaire,
  pièce ou main-d'œuvre, rattachement à un **organe**. Une ligne peut être
  exclue, par exemple les courses sur le ticket de caisse de la batterie.
- **Organes** (catalogue par véhicule) : distribution, courroie d'accessoires,
  huile moteur, filtres, batterie, alternateur, clim, freins AV et AR, pneus,
  rotules et triangles, embrayage, boîte… Chacun a un intervalle conseillé en
  km et/ou en mois.
- **Pneus** : train monté (marque, dimension, date et km de montage, position),
  mesures de profondeur au fil du temps, permutations.
- **Contrôles techniques** : date, km, résultat, échéance, défaillances (code
  et libellé), chacune avec un suivi « à surveiller → réparé ».
- **Travaux à prévoir** : ce que le garage signale (« rotule inférieure AV GH »
  le 22/05/2025, réparée le 02/07/2025) et ce que l'on note soi-même.
- **Autres frais** (facultatif) : assurance, carte grise, carburant, péage.

## Écrans
1. **Bilan** : carte par véhicule avec km estimé, prochaines échéances (CT,
   vidange, distribution), alertes et dépenses de l'année.
2. **Historique** : frise des interventions, filtrable par organe, année ou
   garage, avec recherche (« batterie », « rotule »…).
3. **Pièces / organes** : pour chaque organe, dernier changement (date et km),
   ancienneté, durée de vie observée entre deux changements, prochaine
   échéance conseillée. C'est l'écran « qu'a-t-on changé et quand ».
4. **Coûts** : dépenses par année et par catégorie, coût au km, cumul depuis
   l'achat, part pièces et main-d'œuvre, plus grosses dépenses.
5. **Pneus et freins** : usure en mm par 1 000 km et date estimée de
   remplacement à partir des mesures.
6. **Contrôles techniques** : historique des CT, défaillances récurrentes,
   kilométrages relevés.
7. **Documents** : factures et procès-verbaux rattachés aux interventions.

## Idées en plus
- **Garder ou changer ?** Comparer les dépenses des 12 derniers mois avec la
  valeur estimée du véhicule, et suivre le coût au km année par année. C'est
  utile pour un véhicule ancien.
- **Saisie depuis une photo de facture** : on photographie la facture, les
  lignes sont pré-remplies et on n'a plus qu'à les valider. Au départ, Claude
  Code le fait sur les PDF du dossier ; un bouton dans l'application viendrait
  dans un second temps, et coûterait un peu en API.
- **Rappels** par km ou par date, avec une notification sur le téléphone
  (prochain CT le 23/06/2028, vidange…).
- **Fiche à montrer au garage** : liste des derniers travaux et références de
  pièces, imprimable en PDF. Elle servira aussi à la revente.
- **Défaillances CT récurrentes** : la plaque constructeur est signalée depuis
  2024 ; usure anormale des pneus AR et déséquilibre du frein AR en 2026.
- **Mode hors ligne** : consulter sans réseau, au garage par exemple.

## Données déjà disponibles (dossier T4)
| Date | Km | Garage | Objet | TTC |
|---|---|---|---|---|
| 05/07/2024 | 431 234 | Autosur Aucfer | CT défavorable | – |
| 28/08/2024 | 434 167 | Autosur Aucfer | Contre-visite favorable | – |
| 04/09/2024 | 434 167 | AD MGS Rieux | Triangle inf. AV D, parallélisme, contre-visite | 404,66 € |
| 22/05/2025 | 450 218 | AD MGS Rieux | Vidange + 4 filtres, kit commande boîte | 450,48 € |
| 02/07/2025 | 452 645 | AD MGS Rieux | Rotule inf. AV G, vidange boîte | 249,36 € |
| 17/04/2026 | 467 019 | AD MGS Rieux | Vidange, culasse : arbre à cames, distribution, soupapes, joint | 3 310,76 € |
| 09/06/2026 | – | AD MGS Rieux | Plaques HL-472-CA | 40,13 € |
| 21/06/2026 | – | Super U Cancale | Batterie 95 Ah 800 A (garantie 36 mois) | 124,99 € |
| 24/06/2026 | 472 269 | Autosur Aucfer | CT favorable, 10 défaillances mineures, échéance 23/06/2028 | – |
| 25/06/2026 | 472 269 | AD MGS Rieux | Compresseur clim + recharge, alternateur, pré-contrôle | 1 464,49 € |

Kilométrages plus anciens relevés sur les CT : 359 399 km (28/05/2020),
381 066 km (08/06/2022). Total facturé de 09/2024 à 06/2026 : 6 044,87 € pour
environ 38 100 km, soit environ 0,16 € par km hors carburant et assurance.

À noter sur les fichiers :
- `F20260819.pdf` et `20260417.pdf` sont la même facture.
- Les noms ne suivent pas tous la même date. `20240409` correspond au
  04/09/2024, `20260906 paques` aux plaques du 09/06/2026 et `F20251944` au
  02/07/2025.

## Étapes
1. Créer le projet Blazor WASM PWA, la mise en page responsive et le mode démo
   (données dans le navigateur, comme pour l'application chantier).
2. Créer le schéma Supabase, la connexion des deux comptes et les règles d'accès.
3. Écrire les écrans Bilan, Historique et Pièces / organes, puis charger
   l'historique du T4.
4. Écrire les écrans Coûts, Pneus et freins, CT et Documents.
5. Ajouter les rappels, la fiche garage et la saisie depuis une photo.
