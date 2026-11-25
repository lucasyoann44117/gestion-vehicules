"""Ajoute à la base de pannes ce qui a été appris sur T4Zone (pannes résolues).

Les textes sont des résumés rédigés pour l'application, avec le lien vers la
discussion d'origine ; rien n'est recopié tel quel du forum.
    python outils/enrichir-diagnostic.py src/Vehicules.Web/wwwroot/diagnostic/t4-acv.json
"""
import json, sys

T = "https://t4zone.info/forum/viewtopic.php?t="
def src(t, titre): return {"titre": titre, "url": f"{T}{t}"}

chemin = sys.argv[1]
b = json.load(open(chemin, encoding="utf-8"))
pannes = {p["id"]: p for p in b["pannes"]}

def ajouter_cause(panne, cause):
    p = pannes[panne]
    p["causes"] = [c for c in p["causes"] if c["id"] != cause["id"]] + [cause]

def sources(panne, cause, *liste):
    c = next(c for c in pannes[panne]["causes"] if c["id"] == cause)
    deja = {s["url"] for s in c.get("sources", [])}
    c.setdefault("sources", []).extend(s for s in liste if s["url"] not in deja)

# ---- Ne démarre pas ----
ajouter_cause("ne-demarre-pas", {
    "id": "contacteur", "libelle": "Contacteur électrique de démarrage usé (derrière le Neiman)", "frequence": 3,
    "verifications": ["Démarrage aléatoire, ou le moteur démarre puis coupe aussitôt", "Le contacteur électrique se change seul, sans toucher aux serrures ni à la clé"],
    "difficulte": "moyen", "cout": "20 à 50 €",
    "sources": [src(99199, "Démarrage aléatoire : réglé par le changement du contacteur"), src(85604, "Démarrage aléatoire après réparation de l'antidémarrage")]})
ajouter_cause("ne-demarre-pas", {
    "id": "alarme", "libelle": "Alarme antivol (même ancienne et inutilisée) passée en sécurité", "frequence": 2,
    "verifications": ["Aucune réaction du tout à la clé, batterie bonne", "Vérifier le module d'alarme et ses relais"],
    "difficulte": "moyen",
    "sources": [src(101611, "Zéro réaction au démarrage : c'était la vieille alarme")]})
ajouter_cause("ne-demarre-pas", {
    "id": "fusible-s102", "libelle": "Fusible du calculateur moteur (S102) en faux contact dans son support", "frequence": 2,
    "verifications": ["Pas de voyant de préchauffage, redémarrage impossible juste après l'arrêt", "Le fusible paraît bon au test : nettoyer et resserrer son support (fusibles cachés au-dessus de la boîte)"],
    "difficulte": "facile",
    "sources": [src(102891, "2.5 TDI ACV qui refuse de démarrer : fusible S102 en faux contact")]})
ajouter_cause("ne-demarre-pas", {
    "id": "galet-pompe", "libelle": "Galet tendeur de la courroie de pompe d'injection cassé", "frequence": 2,
    "verifications": ["Le démarreur tourne normalement mais le moteur « tousse » sans se lancer", "Regarder la courroie de pompe d'injection et son galet (côté distribution)"],
    "organes": ["distribution"], "difficulte": "garage",
    "sources": [src(91604, "Ça tousse mais ça ne part pas : galet de courroie de pompe cassé")]})
sources("ne-demarre-pas", "gazole", src(84424, "Ne repart plus : désamorcé garé en pente avec peu de gazole"), src(92446, "Démarrage impossible : réamorçage du circuit gazole"))
sources("ne-demarre-pas", "demarreur", src(85604, "Démarrage aléatoire : démarreur remplacé"))
for q in pannes["ne-demarre-pas"]["questions"]:
    if q["texte"].startswith("Le démarreur fait-il tourner"):
        q["siOui"].update({"galet-pompe": 15, "contacteur": 5}); q["siNon"].update({"alarme": 15, "galet-pompe": -15})
pannes["ne-demarre-pas"]["questions"].append({
    "texte": "Es-tu garé en pente avec peu de gazole (même avant la réserve) ?", "siOui": {"gazole": 40}, "siNon": {}})

# ---- Démarre mal à froid ----
sources("demarrage-froid", "bougies", src(49323, "2.5 TDI ACV qui peine à démarrer : une bougie morte au milieu"))
for c in pannes["demarrage-froid"]["causes"]:
    if c["id"] == "bougies":
        c["verifications"].append("Une seule bougie HS suffit à rendre le démarrage pénible : les tester une par une au connecteur")
ajouter_cause("demarrage-froid", {
    "id": "faisceau-g62", "libelle": "Câble de la sonde G62 en court-circuit (le relais ne préchauffe plus)", "frequence": 2,
    "verifications": ["Pas de voyant ni de tension aux bougies, mais ça démarre en alimentant les bougies directement", "Contrôler le câble entre la sonde G62 et le relais de préchauffage"],
    "codes": ["00522"], "organes": ["sonde-temperature"], "difficulte": "moyen",
    "sources": [src(95785, "Pas de préchauffage : court-circuit sur le câble de la sonde G62")]})
sources("demarrage-froid", "pompe-usee", src(98293, "2.5 TDI qui démarre mal à froid : piste du début d'injection"))

# ---- Ralenti, calage ----
ajouter_cause("ralenti-calage", {
    "id": "compresseur-bloque", "libelle": "Compresseur de clim qui bloque et freine le moteur jusqu'au calage", "frequence": 2,
    "verifications": ["Le moteur coupe en touchant la clim ou la ventilation", "Débrancher l'embrayage du compresseur : si le moteur repart, c'est lui"],
    "organes": ["compresseur-clim"], "difficulte": "garage",
    "sources": [src(89572, "Coupure moteur en roulant : compresseur de clim")]})

# ---- Perte de puissance ----
ajouter_cause("perte-puissance", {
    "id": "calage-pompe", "libelle": "Calage de la pompe d'injection légèrement décalé", "frequence": 2,
    "verifications": ["VCDS : début d'injection (groupe 004) moteur chaud"], "codes": ["00550"], "difficulte": "garage",
    "sources": [src(103450, "Cascade de soucis : calage de pompe et électrovanne de turbo")]})
sources("perte-puissance", "n75", src(103450, "Cascade de soucis : électrovanne de turbo fatiguée"))

# ---- Batterie, alternateur ----
ajouter_cause("voyant-batterie", {
    "id": "pont-diodes", "libelle": "Pont de diodes ou charbons du régulateur de l'alternateur (odeur de chaud électrique)", "frequence": 2,
    "verifications": ["Fumée ou odeur de chaud côté alternateur", "L'alternateur se répare : pont de diodes, charbons, bague collectrice"],
    "organes": ["alternateur"], "difficulte": "moyen",
    "sources": [src(103537, "Odeur de chaud et fumée : pont de diodes de l'alternateur")]})
ajouter_cause("voyant-batterie", {
    "id": "pompe-additionnelle", "libelle": "Pompe d'eau additionnelle qui tourne moteur coupé (sonde défectueuse) et vide la batterie", "frequence": 2,
    "verifications": ["La batterie est à plat seulement après un trajet moteur chaud", "On entend une pompe tourner après l'arrêt"],
    "organes": ["pompe-eau-auxiliaire"], "difficulte": "moyen",
    "sources": [src(103095, "Batterie qui se décharge : sonde neuve défectueuse sur la pompe additionnelle")]})

# ---- Nouvelles fiches ----
b["pannes"] = [p for p in b["pannes"] if p["id"] not in ("fuite-gazole", "voyant-huile")]
b["pannes"].append({
    "id": "fuite-gazole", "titre": "Fuite ou odeur de gazole", "systeme": "Moteur",
    "descriptions": ["Goutte-à-goutte de gazole sous le moteur", "Odeur de gazole dans l'habitacle", "La pompe d'injection suinte"],
    "motsCles": ["gazole", "gasoil", "fuite", "odeur", "goutte", "injecteur", "pompe", "suinte"],
    "causes": [
        {"id": "bouchon-retour", "libelle": "Bouchon de retour d'injecteur fêlé ou manquant", "frequence": 4,
         "verifications": ["Se garer en pente et inspecter les injecteurs à la lampe frontale", "Le bouchon est minuscule et souvent couvert de gras"],
         "organes": ["injecteurs"], "difficulte": "facile",
         "sources": [{"titre": "Ton T4 : fuite sur l'injecteur n°1 (juin 2026)", "url": "https://t4zone.info/forum/viewtopic.php?f=12&t=20227"}]},
        {"id": "durites-retour", "libelle": "Durites de retour des injecteurs poreuses", "frequence": 4,
         "verifications": ["Durites fendillées ou molles entre les injecteurs"], "organes": ["injecteurs"], "difficulte": "facile", "cout": "10 à 20 €"},
        {"id": "couvercle-pompe", "libelle": "Joint du couvercle de la pompe d'injection fatigué", "frequence": 3,
         "verifications": ["Suintement en haut de la pompe", "Repérer la position avant de déposer le couvercle (l'ergot doit retomber dans son logement)", "Purger le circuit après remontage"],
         "difficulte": "moyen",
         "sources": [src(99959, "Pompe à injection : fuite au couvercle, joint changé")]},
        {"id": "filtre", "libelle": "Filtre à gazole ou ses raccords", "frequence": 2,
         "verifications": ["Joint du filtre, purgeur d'eau mal serré"], "organes": ["filtre-gasoil"], "difficulte": "facile"},
        {"id": "banjo", "libelle": "Raccords banjo d'arrivée et de retour inversés après une intervention", "frequence": 1,
         "verifications": ["Même pas de vis mais orifices différents : vérifier le sens après un remontage de la pompe"],
         "difficulte": "moyen",
         "sources": [src(100367, "Perte de puissance : raccords banjo inversés sur la pompe")]}
    ],
    "questions": [
        {"texte": "La fuite vient-elle du haut du moteur, près des injecteurs ?", "siOui": {"bouchon-retour": 25, "durites-retour": 20}, "siNon": {"couvercle-pompe": 15, "filtre": 15}},
        {"texte": "Le problème est apparu juste après une intervention sur la pompe ?", "siOui": {"banjo": 40, "couvercle-pompe": 15}, "siNon": {}}
    ],
    "recherches": ["fuite gazole injecteur ACV", "fuite couvercle pompe injection"]})
b["pannes"].append({
    "id": "voyant-huile", "titre": "Voyant de pression d'huile qui clignote ou bipe", "systeme": "Moteur",
    "descriptions": ["Le voyant d'huile rouge clignote avec un bip", "Ça bipe vers 1800 tours"],
    "motsCles": ["huile", "pression", "voyant", "clignote", "bip", "bipe", "rouge"],
    "urgence": "Arrêter si la pression est vraiment basse",
    "causes": [
        {"id": "niveau", "libelle": "Niveau d'huile bas", "frequence": 4, "verifications": ["Contrôler la jauge moteur à plat"], "organes": ["huile-moteur"], "difficulte": "facile"},
        {"id": "capteur", "libelle": "Capteur de pression d'huile ou son connecteur", "frequence": 4,
         "verifications": ["Le 2.5 TDI ACV n'a qu'un capteur de pression", "Remplacer le capteur, vérifier le fil"], "difficulte": "facile", "cout": "15 à 40 €",
         "sources": [src(100685, "Pression d'huile qui clignote sur un 2.5 TDI ACV")]},
        {"id": "pression", "libelle": "Pression réellement faible (huile trop fluide, pompe, crépine)", "frequence": 2,
         "verifications": ["Mesurer au manomètre à chaud : environ 2 bar à 2 000 tr/min au minimum"], "difficulte": "garage",
         "sources": [src(100685, "Mesure au manomètre : pression faible au ralenti")]},
        {"id": "alternateur", "libelle": "Signal de l'alternateur (le contrôle d'huile s'en sert pour savoir si le moteur tourne)", "frequence": 2,
         "verifications": ["Le défaut apparaît aussi avec un problème de charge"], "organes": ["alternateur"], "difficulte": "moyen",
         "sources": [src(47588, "Voyant d'huile qui clignote : cause alternateur")]}
    ],
    "questions": [
        {"texte": "Le niveau d'huile est-il correct sur la jauge ?", "siOui": {"niveau": -30, "capteur": 10}, "siNon": {"niveau": 40}},
        {"texte": "Le voyant de batterie ou la charge pose-t-il aussi problème ?", "siOui": {"alternateur": 35}, "siNon": {"alternateur": -10}}
    ],
    "recherches": ["voyant pression huile clignote ACV"]})

# ---- Codes ----
b["codes"] = [c for c in b["codes"] if c["code"] != "01414"]
b["codes"].append({"code": "01414", "libelle": "Chauffage stationnaire D4W : ventilateur d'air de combustion (V6)", "composant": "V6",
                   "pistes": ["Circuit ouvert : connecteur, faisceau ou moteur du ventilateur", "Relevé sur ton T4 le 21/12/2024"], "pannes": ["chauffage"]})

json.dump(b, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(b["pannes"]), "pannes,", sum(len(p["causes"]) for p in b["pannes"]), "causes,",
      sum(len(c.get("sources", [])) for p in b["pannes"] for c in p["causes"]), "sources T4Zone")
