"""Deuxième passe sur T4Zone : sujets résolus Moteur, Freins, Électricité, Chauffage, Clim, OBD.

Résumés rédigés pour l'application, avec le lien vers chaque discussion.
    python outils/enrichir-diagnostic-2.py src/Vehicules.Web/wwwroot/diagnostic/t4-acv.json
"""
import json, sys

T = "https://t4zone.info/forum/viewtopic.php?t="
def src(t, titre): return {"titre": titre, "url": f"{T}{t}"}

chemin = sys.argv[1]
b = json.load(open(chemin, encoding="utf-8"))
pannes = {p["id"]: p for p in b["pannes"]}

def cause(panne, cid):
    return next(c for c in pannes[panne]["causes"] if c["id"] == cid)

def ajouter_cause(panne, c):
    p = pannes[panne]
    p["causes"] = [x for x in p["causes"] if x["id"] != c["id"]] + [c]

def sources(panne, cid, *liste):
    c = cause(panne, cid)
    deja = {s["url"] for s in c.get("sources", [])}
    c.setdefault("sources", []).extend(s for s in liste if s["url"] not in deja)

def verif(panne, cid, texte):
    c = cause(panne, cid)
    if texte not in c["verifications"]: c["verifications"].append(texte)

# ---- Perte de puissance (2.5 TDI ACV) ----
ajouter_cause("perte-puissance", {
    "id": "n108", "libelle": "Électrovanne de début d'injection N108 coupée", "frequence": 2,
    "verifications": ["Code 17660 ou 00550 persistant", "Mesurer la bobine de l'électrovanne à l'ohmmètre (coupée = infini)", "Après démontage, la pompe se vide : réamorcer (voir la fiche « Ne démarre pas du tout »)"],
    "codes": ["17660", "00550"], "difficulte": "moyen",
    "sources": [src(52969, "ACV sans puissance, code 17660 : N75 grippée, manchon de turbo, N108 coupée")]})
sources("perte-puissance", "n75", src(52969, "N75 grippée et durites à dépression pourries"))
verif("perte-puissance", "durite-turbo", "Manchon entre débitmètre et turbo qui prend du jeu : le turbo aspire de l'air non filtré (un collier suffit)")
verif("perte-puissance", "durite-turbo", "Vis de fixation du turbo desserrées ou perdues")
sources("perte-puissance", "durite-turbo", src(52969, "Manchon débitmètre-turbo avec du jeu"), src(19949, "Perte de puissance : deux vis du turbo perdues"))
sources("perte-puissance", "filtres", src(52969, "Filtres à air et à gazole encrassés"))

# ---- Ne démarre pas ----
verif("ne-demarre-pas", "gazole", "Réamorcer : desserrer les tuyaux d'injecteurs, aspirer par le retour jusqu'à ce que le gazole coule sans bulles, puis lancer au démarreur par séquences de 10 s")
sources("ne-demarre-pas", "gazole", src(52969, "Réamorçage de la pompe après démontage"))
verif("ne-demarre-pas", "batterie", "Une masse sectionnée donne les mêmes symptômes (voyants qui s'allument, préchauffage bref)")
sources("ne-demarre-pas", "batterie", src(12925, "Ne démarre plus : masse sectionnée"))

# ---- Voyant de pression d'huile ----
ajouter_cause("voyant-huile", {
    "id": "sonde-niveau", "libelle": "Sonde de niveau d'huile (voyant orange « burette », pas le rouge)", "frequence": 4,
    "verifications": ["Le voyant orange clignote quelques fois au démarrage", "Sonde sous le carter, devant le bouchon de vidange : nettoyer et resserrer la fiche, sinon la changer", "Le contacteur de capot sert aussi au contrôle de niveau : fiche oxydée ou cassée"],
    "organes": ["huile-moteur"], "difficulte": "facile",
    "sources": [src(27304, "Voyant d'huile orange qui clignote au démarrage : sonde de niveau"), src(8393, "Témoin d'huile allumé : fiche du contacteur de capot oxydée")]})
pannes["voyant-huile"]["questions"].insert(0, {"texte": "Le voyant est-il orange (burette) plutôt que rouge ?", "siOui": {"sonde-niveau": 45, "pression": -20}, "siNon": {"sonde-niveau": -25}})
sources("voyant-huile", "alternateur", src(90404, "Alternateur qui ne charge qu'à chaud et voyant d'huile qui clignote"))

# ---- Batterie, charge ----
sources("voyant-batterie", "courroie", src(30666, "Voyant batterie et moteur qui chauffe : courroie détendue"))
verif("voyant-batterie", "courroie", "Voyant batterie et moteur qui chauffe en même temps : la courroie entraîne aussi la pompe à eau")
sources("voyant-batterie", "masse", src(26596, "Câble d'alternateur qui chauffe : cosse défectueuse"))
verif("voyant-batterie", "masse", "Cosse du câble de charge qui chauffe : la ressouder")
verif("voyant-batterie", "consommateur", "Relais de préchauffage défaillant qui reste alimenté")
verif("voyant-batterie", "consommateur", "Ventilateurs qui tournent moteur coupé : relais 98 (ressort cassé) ou thermocontacteur")
sources("voyant-batterie", "consommateur", src(94156, "Batterie qui se vide : relais de préchauffage"), src(13981, "Ventilateurs qui ne s'arrêtent pas : relais 98"), src(94240, "Batteries à plat à répétition : thermocontacteur du ventilateur"))
ajouter_cause("voyant-batterie", {
    "id": "combine", "libelle": "Soudure du combiné d'instruments (l'alternateur ne s'excite qu'à chaud)", "frequence": 1,
    "verifications": ["La charge ne fonctionne qu'une fois le moteur chaud", "Composant à ressouder sous le compte-tours"], "difficulte": "moyen",
    "sources": [src(90404, "L'alternateur ne charge qu'à chaud : soudure du tableau de bord")]})

# ---- Surchauffe, refroidissement ----
ajouter_cause("surchauffe", {
    "id": "radiateur-ar", "libelle": "Radiateur de chauffage arrière qui fuit (sous la banquette du Multivan)", "frequence": 2,
    "verifications": ["Le niveau baisse sans trace au moteur", "Ouvrir la trappe sous la banquette arrière : traces de liquide autour du chauffage arrière"],
    "organes": ["liquide-refroidissement"], "difficulte": "moyen",
    "sources": [src(21040, "Fuite de liquide à l'arrière : radiateur de chauffage arrière")]})
verif("surchauffe", "ventilateur", "Relais 98 de temporisation des ventilateurs, fusibles 50 A au-dessus du phare gauche")
sources("surchauffe", "ventilateur", src(13981, "Coupure des ventilateurs : relais 98"), src(14578, "Relais et fusibles des ventilateurs de refroidissement"))

# ---- Chauffage ----
verif("chauffage", "air", "Après une vidange : laisser le vase se mettre en pression puis ouvrir la valve de purge sur la durite de chauffage")
sources("chauffage", "air", src(73431, "Plus de chauffage après vidange du liquide : purge"))
sources("chauffage", "eber-bougie", src(67708, "Chauffage stationnaire réparé : fusible du boîtier, bougie, ventilateur nettoyé"))
verif("chauffage", "eber-bougie", "Fusible du boîtier de la chaudière grillé, ventilateur de combustion bloqué par la suie")
ajouter_cause("chauffage", {
    "id": "pulseur-ar", "libelle": "Pulseur de chauffage arrière : fusible 30 A", "frequence": 2,
    "verifications": ["Code 01027 (ventilateur d'air chaud arrière V47) dans le Climatronic", "Fusible 30 A de la rangée du bas (n°13 sur certains modèles)"],
    "codes": ["01027"], "difficulte": "facile",
    "sources": [src(27309, "Pulseur de chauffage arrière : fusible 30 A grillé")]})

# ---- Clim ----
c = cause("clim", "fusible")
c["libelle"] = "Fusible (n°30) ou relais de clim (relais 140)"
verif("clim", "fusible", "Le fusible 30 alimente le relais 140 qui commande l'embrayage du compresseur : le tester sous charge, un voltmètre peut tromper")
verif("clim", "fusible", "Retirer et remettre le relais 140 (faux contact)")
sources("clim", "fusible", src(83410, "Clim HS : fusible 30 du relais 140"), src(95230, "Clim qui ne s'enclenche plus : panne en amont du compresseur"), src(102656, "Clim relancée : pressostat changé, relais reposé"))
sources("clim", "pressostat", src(102656, "Pressostat changé, pas de fuite"))

# ---- Freinage ----
verif("freinage", "assistance", "Pédale dure surtout au démarrage : tuyau entre pompe à vide et master vac fendu")
sources("freinage", "assistance", src(93536, "2.5 TDI ACV : pédale dure, tuyau de dépression du master vac"))
verif("freinage", "disques", "Pistons d'étriers qui reviennent mal : vibrations dans la direction et la pédale vers 70-80 km/h")
sources("freinage", "disques", src(88701, "Vibrations inexpliquées : pistons d'étriers grippés"))

# ---- Vitesses, embrayage ----
ajouter_cause("vitesses", {
    "id": "hydraulique", "libelle": "Commande hydraulique d'embrayage (émetteur, flexible, purge)", "frequence": 3,
    "verifications": ["La pédale reste enfoncée ou le niveau de liquide baisse", "Flexible dont l'agrafe a sauté", "Purge impossible : émetteur bouché"],
    "difficulte": "moyen",
    "sources": [src(93433, "Pédale d'embrayage enfoncée : flexible débranché"), src(82464, "Purge d'embrayage impossible : émetteur")]})
ajouter_cause("vitesses", {
    "id": "pignons-5", "libelle": "Pignons et synchro de 5e usés (la 5e craque puis saute)", "frequence": 2,
    "verifications": ["Sifflement sur autoroute, la 5e craque puis tourne au point mort", "Accès par le carter du pignon de 5e"],
    "organes": ["huile-boite"], "difficulte": "garage", "cout": "environ 500 €",
    "sources": [src(21549, "Plus de 5e : pignons et synchro remplacés")]})
sources("vitesses", "commande", src(88229, "Levier de vitesses flottant : timonerie"))
pannes["vitesses"]["questions"].append({"texte": "La pédale d'embrayage reste-t-elle enfoncée ou le liquide baisse-t-il ?", "siOui": {"hydraulique": 45}, "siNon": {"hydraulique": -15}})

# ---- Nouvelle fiche : direction ----
b["pannes"] = [p for p in b["pannes"] if p["id"] != "direction"]
b["pannes"].append({
    "id": "direction", "titre": "Direction floue, le camion louvoie ou tire d'un côté", "systeme": "Train avant",
    "descriptions": ["Le camion ne suit pas la trajectoire", "Il tire à droite malgré le parallélisme", "Usure anormale des pneus"],
    "motsCles": ["direction", "flou", "louvoie", "tire", "trajectoire", "parallelisme", "usure", "pneus", "volant"],
    "causes": [
        {"id": "geometrie", "libelle": "Géométrie (parallélisme, carrossage)", "frequence": 4, "verifications": ["Ripage mesuré au contrôle technique", "Usure en biseau des pneus"], "organes": ["parallelisme", "pneus-av"], "difficulte": "garage"},
        {"id": "cremaillere", "libelle": "Crémaillère de direction usée", "frequence": 3, "verifications": ["Jeu au volant, sensation de flou"], "organes": ["direction"], "difficulte": "garage",
         "sources": [src(96248, "Direction floue et camion qui louvoie : crémaillère changée")]},
        {"id": "triangles", "libelle": "Triangles inférieurs ou leur réglage (garde)", "frequence": 3, "verifications": ["Le parallélisme est bon mais le camion tire toujours"], "organes": ["triangle-inf-avd"], "difficulte": "garage",
         "sources": [src(8809, "Tire à droite malgré le parallélisme : triangles et réglage de la garde")]},
        {"id": "rotules", "libelle": "Rotules de suspension ou de direction", "frequence": 3, "organes": ["rotule-inf-avg", "rotule-inf-avd", "rotules-sup-av", "direction"], "difficulte": "moyen"},
        {"id": "frein", "libelle": "Frein qui frotte d'un côté (étrier)", "frequence": 2, "verifications": ["Une jante plus chaude que l'autre après un trajet"], "organes": ["freins-av"], "difficulte": "moyen"},
        {"id": "ressorts", "libelle": "Ressorts ou amortisseurs arrière fatigués (arrière qui s'affaisse)", "frequence": 2, "organes": ["amortisseurs"], "difficulte": "moyen",
         "sources": [src(96248, "Ressorts arrière renforcés en complément")]}
    ],
    "questions": [
        {"texte": "Le camion tire-t-il seulement au freinage ?", "siOui": {"frein": 40, "geometrie": -10}, "siNon": {"frein": -15}},
        {"texte": "Y a-t-il du jeu ou du flou au volant ?", "siOui": {"cremaillere": 30, "rotules": 20}, "siNon": {"geometrie": 15, "triangles": 15}}
    ],
    "recherches": ["direction floue louvoie", "tire droite parallelisme"]})

# ---- Codes ----
nouveaux = [
    {"code": "17660", "libelle": "Relevé sur un 2.5 TDI ACV sans puissance : réglé par l'électrovanne de début d'injection N108", "pistes": ["Mesurer N108 à l'ohmmètre", "Contrôler le début d'injection"], "pannes": ["perte-puissance"]},
    {"code": "17664", "libelle": "Sonde de température du liquide G62 : circuit ouvert ou court-circuit (P1256)", "composant": "G62", "pistes": ["Connecteur et câble de la sonde G62"], "pannes": ["demarrage-froid", "surchauffe"]},
    {"code": "01027", "libelle": "Ventilateur d'air chaud arrière (V47)", "composant": "V47", "pistes": ["Fusible 30 A du pulseur arrière"], "pannes": ["chauffage"]},
]
codes = {c["code"] for c in nouveaux}
b["codes"] = [c for c in b["codes"] if c["code"] not in codes] + nouveaux

json.dump(b, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(len(b["pannes"]), "pannes,", sum(len(p["causes"]) for p in b["pannes"]), "causes,",
      len({s["url"] for p in b["pannes"] for c in p["causes"] for s in c.get("sources", [])}), "discussions citées,", len(b["codes"]), "codes")
