"""Ajoute un lot d'import à historique.json (remplace les éléments de même id)."""
import json, sys

historique, lot = sys.argv[1], sys.argv[2]
with open(historique, encoding="utf-8") as f:
    d = json.load(f)
with open(lot, encoding="utf-8") as f:
    a = json.load(f)

def fusion(cle, ident):
    existants = {ident(x): i for i, x in enumerate(d[cle])}
    for x in a.get(cle, []):
        k = ident(x)
        if k in existants:
            d[cle][existants[k]] = x
        else:
            d[cle].append(x)

for cle in ("organes", "interventions", "controles", "travaux"):
    fusion(cle, lambda x: x["id"])
fusion("releves", lambda x: (x["vehiculeId"], x["date"]))
fusion("mesuresPneus", lambda x: (x["vehiculeId"], x["date"], x["position"]))

d["interventions"].sort(key=lambda x: x["date"])
d["controles"].sort(key=lambda x: x["date"])
d["releves"].sort(key=lambda x: x["date"])

with open(historique, "w", encoding="utf-8") as f:
    json.dump(d, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"{len(d['interventions'])} interventions, {len(d['controles'])} contrôles, "
      f"{len(d['releves'])} relevés, {len(d['organes'])} pièces suivies")
