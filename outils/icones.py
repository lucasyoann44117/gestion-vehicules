"""Dessine les icônes PNG de l'application (même motif que icone.svg)."""
import sys
from PIL import Image, ImageDraw

def icone(taille, marge=0.0):
    s = 4  # suréchantillonnage pour des bords lisses
    T = taille * s
    img = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    # Dégradé ambre en diagonale.
    grad = Image.new("RGBA", (T, T))
    px = grad.load()
    a, b = (74, 139, 240), (23, 73, 179)
    for y in range(T):
        for x in range(T):
            t = (x + y) / (2 * T)
            px[x, y] = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
    masque = Image.new("L", (T, T), 0)
    d = ImageDraw.Draw(masque)
    if marge:  # icône « maskable » : fond plein, motif réduit au centre
        d.rectangle([0, 0, T, T], fill=255)
    else:
        d.rounded_rectangle([0, 0, T - 1, T - 1], radius=int(T * 11 / 40), fill=255)
    img.paste(grad, (0, 0), masque)

    d = ImageDraw.Draw(img)
    k = T / 40 * (1 - 2 * marge)
    o = T * marge
    P = lambda x, y: (o + x * k, o + y * k)
    noir = (255, 255, 255, 255)
    ambre = (255, 200, 61, 255)
    r = 10.5 * k
    cx, cy = P(20, 20)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=noir, width=int(3 * k))
    r2 = 2.6 * k
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=ambre)
    d.line([P(20, 20), P(26.5, 13.5)], fill=ambre, width=int(3 * k))
    x2, y2 = P(26.5, 13.5)
    d.ellipse([x2 - 1.5 * k, y2 - 1.5 * k, x2 + 1.5 * k, y2 + 1.5 * k], fill=ambre)
    d.line([P(11, 25.5), P(29, 25.5)], fill=(255, 255, 255, 100), width=int(2 * k))
    return img.resize((taille, taille), Image.LANCZOS)

dossier = sys.argv[1]
icone(180).save(f"{dossier}/icone-180.png")
icone(192).save(f"{dossier}/icone-192.png")
icone(512).save(f"{dossier}/icone-512.png")
icone(512, marge=0.12).save(f"{dossier}/icone-512-maskable.png")
print("ok")
