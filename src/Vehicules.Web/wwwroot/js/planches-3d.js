// Planches éclatées du moteur 2.5 TDI ACV, à la manière du catalogue ETKA :
// pièces dessinées en traits noirs sur fond papier, éclatées le long de leurs axes,
// avec des repères numérotés cliquables.
//
// Toutes les planches partagent le même repère « moteur », ce qui permet de les monter
// ensemble dans la vue « Moteur complet » :
//   X le long du vilebrequin (+X côté distribution), Y vers le haut, Z vers l'avant du moteur.
//   Unités en mètres, origine au milieu du bloc.

import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://esm.sh/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js';

// ---------- Matières « dessin technique » ----------
const TEINTES = { clair: 0xf5f4ef, moyen: 0xdedcd4, fonce: 0xaeaca5, gomme: 0x8d8b86 };
const TEINTES_ETAT = { ok: 0xcdebd5, att: 0xfbe2b4, mal: 0xf6c9c4, neutre: null };
const TRAIT = 0x1b1b1a, TRAIT_CHOISI = 0x1f5fd1;
const REMPLI_CHOISI = 0xbcd3fa, REMPLI_SURVOL = 0xe0ebfd;

// Quand la Vue 3D du camion emprunte ces pièces, elle fournit ses propres matières (métal, caoutchouc…).
let fabrique = null;

function mat(teinte = 'clair') {
  if (fabrique) return fabrique(teinte);
  // Carters et caches : translucides, pour laisser voir ce qu'ils couvrent.
  if (teinte === 'verre') return new THREE.MeshStandardMaterial({ color: TEINTES.clair, roughness: 0.9, transparent: true, opacity: 0.28, depthWrite: false });
  return new THREE.MeshStandardMaterial({
    color: TEINTES[teinte] ?? teinte, roughness: 0.92, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
  });
}

// ---------- Briques de dessin ----------
function orienter(o, axe) {
  if (axe === 'x') o.rotation.z = Math.PI / 2;
  if (axe === 'z') o.rotation.x = Math.PI / 2;
  return o;
}
const a = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const g = (...objets) => { const gr = new THREE.Group(); objets.flat().forEach(o => gr.add(o)); return gr; };

function cyl(r, h, teinte = 'clair', axe = 'y', seg = 36, rHaut = r) {
  return orienter(new THREE.Mesh(new THREE.CylinderGeometry(rHaut, r, h, seg), mat(teinte)), axe);
}
function boite(l, h, p, teinte = 'clair', r = 0.006) {
  return new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 2, Math.min(r, l / 2.2, h / 2.2, p / 2.2)), mat(teinte));
}
/** Pièce de révolution : profil [[rayon, hauteur], …] tourné autour de l'axe. */
function tour(profil, teinte = 'clair', axe = 'y', seg = 40) {
  return orienter(new THREE.Mesh(new THREE.LatheGeometry(profil.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat(teinte)), axe);
}
function tuyau(points, r, teinte = 'clair', seg = 64) {
  const courbe = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(courbe, seg, r, 12), mat(teinte));
}
function tore(R, r, teinte = 'clair', axe = 'y', arc = Math.PI * 2) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 12, 48, arc), mat(teinte));
  if (axe === 'y') m.rotation.x = Math.PI / 2;
  if (axe === 'x') m.rotation.y = Math.PI / 2;
  return m;
}
/** Contour extrudé (dans le plan XY, épaisseur selon Z), recentré. */
function extrude(forme, ep, teinte = 'clair') {
  const geo = new THREE.ExtrudeGeometry(forme, { depth: ep, bevelEnabled: false, curveSegments: 24 });
  geo.translate(0, 0, -ep / 2);
  return new THREE.Mesh(geo, mat(teinte));
}
/** Passe un objet dessiné dans le plan XY dans le plan ZY (épaisseur selon X). */
function versPlanX(o) { const gr = g(o); o.rotation.y = -Math.PI / 2; return gr; }

function engrenage(r, dents, ep, teinte = 'clair', creux = 0.007) {
  const f = new THREE.Shape();
  const n = dents * 4;
  for (let i = 0; i <= n; i++) {
    const ang = (i / n) * Math.PI * 2;
    const rr = (i % 4 < 2) ? r : r - creux;
    if (i === 0) f.moveTo(rr * Math.cos(ang), rr * Math.sin(ang)); else f.lineTo(rr * Math.cos(ang), rr * Math.sin(ang));
  }
  const trou = new THREE.Path(); trou.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
  f.holes.push(trou);
  return extrude(f, ep, teinte);
}
function poulie(r, l, teinte = 'clair', gorges = 0) {
  const p = [[0.004, -l / 2], [r + 0.004, -l / 2], [r + 0.004, -l / 2 + 0.003], [r, -l / 2 + 0.005]];
  for (let i = 0; i < gorges; i++) {
    const y = -l / 2 + 0.005 + (i + 0.5) * ((l - 0.01) / gorges);
    p.push([r, y - 0.002], [r - 0.003, y], [r, y + 0.002]);
  }
  p.push([r, l / 2 - 0.005], [r + 0.004, l / 2 - 0.003], [r + 0.004, l / 2], [0.004, l / 2]);
  return tour(p, teinte, 'x');
}
function galet(r, l) {
  return g(poulie(r, l, 'clair'), cyl(r * 0.45, l * 1.25, 'moyen', 'x', 24), a(boite(l * 0.6, r * 1.6, r * 0.55, 'moyen'), -l * 0.6, -r * 0.6, 0));
}
function vis(r, l, axe = 'y') {
  const v = g(a(cyl(r * 1.7, r * 1.3, 'moyen', 'y', 6), 0, l / 2 + r * 0.65, 0), cyl(r, l, 'clair', 'y', 12));
  return orienter(v, axe);
}
function ressort(r, l, spires = 7, fil = 0.0025, axe = 'y') {
  const pts = [];
  for (let i = 0; i <= spires * 24; i++) {
    const t = i / (spires * 24), ang = t * spires * Math.PI * 2;
    pts.push([r * Math.cos(ang), -l / 2 + t * l, r * Math.sin(ang)]);
  }
  return orienter(tuyau(pts, fil, 'moyen', spires * 24), axe);
}
/** Enveloppe convexe 2D (chaîne monotone). */
function enveloppe(points) {
  const p = [...points].sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const croix = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]);
  const bas = [], haut = [];
  for (const q of p) { while (bas.length >= 2 && croix(bas.at(-2), bas.at(-1), q) <= 0) bas.pop(); bas.push(q); }
  for (const q of p.reverse()) { while (haut.length >= 2 && croix(haut.at(-2), haut.at(-1), q) <= 0) haut.pop(); haut.push(q); }
  return bas.slice(0, -1).concat(haut.slice(0, -1));
}
function contourCercles(cercles, marge) {
  const pts = [];
  for (const [u, v, r] of cercles)
    for (let i = 0; i < 64; i++) { const t = (i / 64) * Math.PI * 2; pts.push([u + (r + marge) * Math.cos(t), v + (r + marge) * Math.sin(t)]); }
  return enveloppe(pts);
}
/**
 * Courroie tendue autour de poulies placées dans le plan perpendiculaire à X.
 * cercles : [[z, y, r], …], x : plan de la courroie.
 */
function courroie(cercles, x, largeur, ep = 0.005, teinte = 'gomme') {
  const ext = contourCercles(cercles, ep), int = contourCercles(cercles, 0);
  const f = new THREE.Shape(ext.map(([u, v]) => new THREE.Vector2(u, v)));
  f.holes.push(new THREE.Path(int.map(([u, v]) => new THREE.Vector2(u, v)).reverse()));
  return a(versPlanX(extrude(f, largeur, teinte)), x, 0, 0);
}
/** Plaque de carter qui épouse les poulies (vue de profil), dans le plan X. */
function carterSur(cercles, x, marge, ep, teinte = 'clair') {
  const ext = contourCercles(cercles, marge);
  return a(versPlanX(extrude(new THREE.Shape(ext.map(([u, v]) => new THREE.Vector2(u, v))), ep, teinte)), x, 0, 0);
}
function plaqueTrouee(l, p, trous, ep, teinte = 'moyen') {
  const f = new THREE.Shape();
  f.moveTo(-l / 2, -p / 2); f.lineTo(l / 2, -p / 2); f.lineTo(l / 2, p / 2); f.lineTo(-l / 2, p / 2); f.closePath();
  for (const [x, z, r] of trous) { const h = new THREE.Path(); h.absarc(x, z, r, 0, Math.PI * 2, true); f.holes.push(h); }
  const m = extrude(f, ep, teinte);
  m.rotation.x = Math.PI / 2;
  return g(m);
}
function cadre(l, p, bord, ep, teinte = 'gomme') {
  const f = new THREE.Shape();
  f.moveTo(-l / 2, -p / 2); f.lineTo(l / 2, -p / 2); f.lineTo(l / 2, p / 2); f.lineTo(-l / 2, p / 2); f.closePath();
  const h = new THREE.Path();
  h.moveTo(-l / 2 + bord, -p / 2 + bord); h.lineTo(-l / 2 + bord, p / 2 - bord); h.lineTo(l / 2 - bord, p / 2 - bord); h.lineTo(l / 2 - bord, -p / 2 + bord); h.closePath();
  f.holes.push(h);
  const m = extrude(f, ep, teinte);
  m.rotation.x = Math.PI / 2;
  return g(m);
}

// ---------- Cotes communes du moteur ----------
const CYL = [-0.24, -0.12, 0, 0.12, 0.24];      // axes des 5 cylindres
const Y_VILO = -0.02, Y_AAC = 0.39;
const X_DISTRI = 0.355, X_ACC = 0.45, X_POMPE = -0.355;
const CERCLES_DISTRI = [[0, Y_VILO, 0.045], [0, Y_AAC, 0.085], [0.11, 0.15, 0.04], [-0.10, 0.17, 0.03], [0.095, 0.07, 0.026]];
const CERCLES_POMPE = [[0, Y_AAC, 0.05], [0.16, 0.14, 0.055], [0.12, 0.33, 0.022]];
const CERCLES_ACC = [[0, Y_VILO, 0.075], [0.17, 0.30, 0.03], [0.20, -0.17, 0.055], [-0.13, 0.28, 0.055], [0.25, 0.08, 0.03]];

// ---------- Les pièces, groupe par groupe ----------
// Chaque pièce : fabrique (dessinée à sa place moteur monté) + vecteur d'éclaté.
const PIECES = {
  // 103 — Bloc, culasse et supports
  '103': {
    'bloc': { eclat: [0, -0.16, 0], faire: () => {
      const b = a(boite(0.62, 0.30, 0.26, 'moyen', 0.01), 0, 0.10, 0);
      const fûts = CYL.map(x => a(cyl(0.041, 0.004, 'clair', 'y', 32), x, 0.252, 0));
      const nervures = [-0.18, -0.06, 0.06, 0.18].map(x => a(boite(0.012, 0.22, 0.27, 'moyen', 0.003), x, 0.07, 0));
      return g(b, fûts, nervures);
    } },
    'joint-culasse': { eclat: [0, -0.02, 0], faire: () => a(plaqueTrouee(0.62, 0.25, CYL.map(x => [x, 0, 0.042]).concat([[-0.29, 0.1, 0.006], [0.29, -0.1, 0.006]]), 0.003, 'fonce'), 0, 0.2535, 0) },
    'culasse': { eclat: [0, 0.10, 0], faire: () => {
      const c = a(boite(0.64, 0.10, 0.24, 'clair', 0.008), 0, 0.30, 0);
      const puits = CYL.map(x => a(cyl(0.016, 0.012, 'moyen', 'y', 20), x, 0.356, 0.06));
      const sortie = a(boite(0.03, 0.05, 0.06, 'clair', 0.006), 0.335, 0.30, 0.06);
      return g(c, puits, sortie);
    } },
    'poussoirs': { eclat: [0, 0.19, 0], faire: () => g(CYL.flatMap(x => [-0.025, 0.025].map(dx => a(cyl(0.015, 0.028, 'clair', 'y', 20), x + dx, 0.366, -0.04)))) },
    'arbre-cames': { eclat: [0, 0.28, 0], faire: () => {
      const arbre = a(cyl(0.013, 0.70, 'clair', 'x', 20), 0, Y_AAC, -0.04);
      const cames = CYL.flatMap((x, i) => [-0.025, 0.025].map((dx, j) => {
        const f = new THREE.Shape();
        for (let k = 0; k <= 48; k++) { const t = (k / 48) * Math.PI * 2, r = 0.019 + 0.011 * Math.max(0, Math.cos(t)) ** 3; if (k === 0) f.moveTo(r * Math.cos(t), r * Math.sin(t)); else f.lineTo(r * Math.cos(t), r * Math.sin(t)); }
        const m = extrude(f, 0.012, 'clair');
        m.rotation.y = Math.PI / 2;
        m.rotation.x = (i * 2 + j) * 1.1;
        return a(g(m), x + dx, Y_AAC, -0.04);
      }));
      return g(arbre, cames);
    } },
    'vis-culasse': { eclat: [0, 0.34, 0.30], faire: () => g([-0.29, -0.18, -0.06, 0.06, 0.18, 0.29].flatMap(x => [-0.085, 0.085].map(z => a(vis(0.006, 0.13), x, 0.40, z)))) },
    'joint-couvre': { eclat: [0, 0.38, 0], faire: () => a(cadre(0.60, 0.20, 0.012, 0.004), 0, 0.402, 0) },
    'couvre-culasse': { eclat: [0, 0.50, 0], faire: () => {
      const c = a(boite(0.60, 0.06, 0.20, 'fonce', 0.02), 0, 0.435, 0);
      const bouchon = a(cyl(0.022, 0.018, 'moyen'), 0.12, 0.474, 0.04);
      const ecrous = [-0.2, 0, 0.2].map(x => a(cyl(0.008, 0.01, 'moyen', 'y', 6), x, 0.468, -0.06));
      return g(c, bouchon, ecrous);
    } },
    'reniflard': { eclat: [0, 0.48, -0.22], faire: () => g(a(cyl(0.025, 0.04, 'fonce'), -0.16, 0.485, -0.08), tuyau([[-0.16, 0.5, -0.08], [-0.2, 0.52, -0.14], [-0.26, 0.46, -0.2]], 0.008, 'gomme')) },
    'pompe-vide': { eclat: [-0.24, 0.06, 0], faire: () => g(a(cyl(0.045, 0.06, 'clair', 'x'), -0.355, 0.33, -0.04), a(cyl(0.008, 0.05, 'moyen', 'z', 12), -0.355, 0.36, -0.09)) },
    'supports-moteur': { eclat: [0, -0.30, 0.10], faire: () => g([-1, 1].map(s => g(
      a(boite(0.08, 0.02, 0.12, 'clair', 0.004), s * 0.36, -0.06, 0.0),
      a(cyl(0.035, 0.04, 'gomme'), s * 0.36, -0.09, 0),
      a(boite(0.06, 0.012, 0.09, 'moyen', 0.003), s * 0.36, -0.118, 0)))) },
  },

  // 115 — Lubrification
  '115': {
    'bouchon-remplissage': { eclat: [0, 0.16, 0], faire: () => a(tour([[0.0, 0], [0.024, 0], [0.024, 0.014], [0.018, 0.022], [0.006, 0.026], [0, 0.026]], 'fonce'), 0.12, 0.48, 0.04) },
    'jauge': { eclat: [0, 0.30, 0.06], faire: () => g(tuyau([[-0.2, 0.0, 0.14], [-0.2, 0.25, 0.15], [-0.19, 0.47, 0.16]], 0.003, 'moyen'), a(tore(0.014, 0.004, 'fonce', 'z'), -0.19, 0.49, 0.16)) },
    'support-filtre': { eclat: [0, 0, 0.12], faire: () => a(g(boite(0.09, 0.06, 0.05, 'clair', 0.006), a(cyl(0.042, 0.02, 'clair'), 0, 0.04, 0.025)), 0.18, 0.02, 0.155) },
    'filtre-huile': { eclat: [0, 0.24, 0.16], faire: () => g(
      a(cyl(0.036, 0.10, 'moyen', 'y', 48), 0.18, 0.12, 0.18),
      a(tour([[0, 0], [0.04, 0], [0.042, 0.02], [0.042, 0.03], [0, 0.03]], 'clair'), 0.18, 0.17, 0.18)) },
    'joint-carter': { eclat: [0, -0.12, 0], faire: () => a(cadre(0.60, 0.25, 0.012, 0.003), 0, -0.052, 0) },
    'carter-huile': { eclat: [0, -0.24, 0], faire: () => {
      const f = new THREE.Shape([[-0.30, 0], [0.30, 0], [0.30, -0.06], [0.10, -0.13], [-0.25, -0.13], [-0.30, -0.06]].map(([u, v]) => new THREE.Vector2(u, v)));
      const m = extrude(f, 0.24, 'moyen');
      return a(g(m), 0, -0.054, 0);
    } },
    'bouchon-vidange': { eclat: [0, -0.44, 0], faire: () => a(vis(0.008, 0.016), -0.1, -0.19, 0) },
    'pompe-huile': { eclat: [0.06, -0.12, -0.24], faire: () => g(a(boite(0.10, 0.07, 0.08, 'clair', 0.006), 0.22, -0.09, -0.02), a(engrenage(0.025, 14, 0.012, 'moyen', 0.004), 0.22, -0.09, 0.025)) },
    'crepine': { eclat: [-0.06, -0.20, -0.24], faire: () => g(tuyau([[0.18, -0.10, -0.02], [0.12, -0.13, -0.02], [0.06, -0.15, 0]], 0.008, 'clair'), a(cyl(0.035, 0.012, 'moyen'), 0.05, -0.16, 0)) },
  },

  // 109 — Distribution et courroie de pompe
  '109': {
    'courroie-distribution': { eclat: [0.46, 0, 0], faire: () => courroie(CERCLES_DISTRI, X_DISTRI + 0.014, 0.028) },
    'galet-tendeur': { eclat: [0.30, 0.08, -0.14], faire: () => a(galet(0.03, 0.03), X_DISTRI, 0.17, -0.10) },
    'galet-enrouleur': { eclat: [0.30, -0.06, 0.14], faire: () => a(galet(0.026, 0.03), X_DISTRI, 0.07, 0.095) },
    'pignon-aac': { eclat: [0.15, 0.05, 0], faire: () => a(versPlanX(engrenage(0.085, 38, 0.03)), X_DISTRI, Y_AAC, 0) },
    'pignon-vilo': { eclat: [0.15, -0.05, 0], faire: () => a(versPlanX(engrenage(0.045, 20, 0.03)), X_DISTRI, Y_VILO, 0) },
    'pompe-eau': { eclat: [0.18, 0, 0.14], faire: () => g(
      a(poulie(0.04, 0.03), X_DISTRI, 0.15, 0.11),
      a(cyl(0.045, 0.05, 'clair', 'x'), 0.315, 0.15, 0.11),
      a(versPlanX(engrenage(0.03, 7, 0.012, 'moyen', 0.012)), 0.285, 0.15, 0.11)) },
    'carter-distribution': { eclat: [0.64, 0, 0], faire: () => g(carterSur(CERCLES_DISTRI, 0.395, 0.02, 0.006, 'verre'), [[0, 0.49], [0.13, 0.28], [-0.14, 0.25], [0.08, -0.08]].map(([z, y]) => a(vis(0.004, 0.012, 'x'), 0.40, y, z))) },
    'poulie-vilo': { eclat: [0.82, -0.04, 0], faire: () => g(a(poulie(0.075, 0.034, 'clair', 5), 0.43, Y_VILO, 0), a(cyl(0.05, 0.012, 'moyen', 'x'), 0.452, Y_VILO, 0), a(vis(0.008, 0.03, 'x'), 0.462, Y_VILO, 0)) },
    'courroie-pompe': { eclat: [-0.30, 0, 0], faire: () => courroie(CERCLES_POMPE, X_POMPE - 0.012, 0.022) },
    'tendeur-pompe': { eclat: [-0.22, 0.05, 0.06], faire: () => a(galet(0.022, 0.024), X_POMPE, 0.33, 0.12) },
    'pignon-pompe': { eclat: [-0.14, -0.02, 0.10], faire: () => a(versPlanX(engrenage(0.055, 26, 0.024)), X_POMPE, 0.14, 0.16) },
  },

  // 121 — Refroidissement
  '121': {
    'radiateur': { eclat: [0, 0, 0.38], faire: () => {
      const noyau = a(boite(0.62, 0.40, 0.035, 'clair', 0.002), 0, 0.18, 0.62);
      const ailettes = Array.from({ length: 16 }, (_, i) => a(boite(0.003, 0.40, 0.036, 'moyen', 0.001), -0.29 + i * 0.039, 0.18, 0.62));
      const boites = [-1, 1].map(s => a(boite(0.05, 0.44, 0.05, 'fonce', 0.01), s * 0.335, 0.18, 0.62));
      return g(noyau, ailettes, boites, a(cyl(0.016, 0.05, 'fonce', 'z'), 0.335, 0.33, 0.585), a(cyl(0.016, 0.05, 'fonce', 'z'), -0.335, 0.03, 0.585));
    } },
    'ventilateurs': { eclat: [0, 0, 0.17], faire: () => g([-0.16, 0.16].map(x => {
      const virole = a(tour([[0.15, -0.02], [0.155, -0.02], [0.155, 0.02], [0.15, 0.02]], 'fonce', 'z', 48), 0, 0, 0);
      const moteur = cyl(0.04, 0.05, 'moyen', 'z');
      const pales = Array.from({ length: 5 }, (_, i) => { const p = boite(0.035, 0.12, 0.006, 'clair', 0.003); p.position.set(Math.cos(i * 1.2566) * 0.08, Math.sin(i * 1.2566) * 0.08, 0); p.rotation.z = i * 1.2566 - Math.PI / 2; p.rotation.y = 0.35; return p; });
      return a(g(virole, moteur, pales), x, 0.18, 0.56);
    })) },
    'vase-expansion': { eclat: [0.12, 0.18, 0.06], faire: () => g(a(boite(0.10, 0.12, 0.16, 'clair', 0.02), 0.25, 0.40, 0.30), a(cyl(0.008, 0.06, 'gomme', 'y', 12), 0.25, 0.32, 0.34)) },
    'bouchon-vase': { eclat: [0.12, 0.32, 0.06], faire: () => a(tour([[0, 0], [0.022, 0], [0.022, 0.016], [0.014, 0.022], [0, 0.022]], 'fonce'), 0.25, 0.46, 0.27) },
    'durites': { eclat: [0, 0.04, 0.18], faire: () => g(
      tuyau([[0.335, 0.33, 0.56], [0.42, 0.36, 0.38], [0.38, 0.32, 0.14], [0.335, 0.30, 0.10]], 0.016, 'gomme'),
      tuyau([[-0.335, 0.03, 0.56], [-0.30, -0.06, 0.38], [-0.10, -0.02, 0.24], [-0.05, 0.02, 0.19]], 0.016, 'gomme')) },
    'boitier-thermostat': { eclat: [0, -0.18, 0.24], faire: () => g(a(tour([[0.0, 0], [0.04, 0], [0.04, 0.008], [0.03, 0.03], [0.018, 0.05], [0, 0.05]], 'clair', 'z'), -0.05, 0.02, 0.16), a(cyl(0.016, 0.04, 'clair', 'z'), -0.05, 0.02, 0.22)) },
    'thermostat': { eclat: [0, -0.18, 0.12], faire: () => g(a(cyl(0.032, 0.003, 'moyen', 'z'), -0.05, 0.02, 0.145), a(ressort(0.012, 0.035, 5, 0.0018, 'z'), -0.05, 0.02, 0.13), a(cyl(0.009, 0.03, 'clair', 'z'), -0.05, 0.02, 0.16)) },
    'sonde-g62': { eclat: [0.16, 0.08, 0], faire: () => g(a(cyl(0.006, 0.04, 'moyen', 'x', 12), 0.37, 0.31, 0.06), a(boite(0.02, 0.018, 0.016, 'fonce', 0.003), 0.395, 0.31, 0.06)) },
    'pompe-eau-auxiliaire': { eclat: [-0.18, 0, 0], faire: () => g(a(cyl(0.028, 0.09, 'clair', 'z'), -0.46, 0.05, -0.15), a(cyl(0.008, 0.04, 'gomme', 'x', 12), -0.43, 0.05, -0.11), a(cyl(0.008, 0.04, 'gomme', 'x', 12), -0.43, 0.05, -0.19)) },
  },

  // 129 — Admission d'air et turbo
  '129': {
    'boite-air': { eclat: [-0.18, 0, 0], faire: () => g(a(boite(0.24, 0.09, 0.30, 'fonce', 0.015), -0.52, 0.385, -0.05), a(cyl(0.035, 0.06, 'fonce', 'z'), -0.52, 0.40, -0.23)) },
    'element-filtrant': { eclat: [-0.18, 0.14, 0], faire: () => g(a(cadre(0.21, 0.27, 0.012, 0.03, 'moyen'), -0.52, 0.44, -0.05), Array.from({ length: 12 }, (_, i) => a(boite(0.004, 0.026, 0.25, 'clair', 0.001), -0.6 + i * 0.015, 0.44, -0.05))) },
    'couvercle-boite': { eclat: [-0.18, 0.28, 0], faire: () => a(boite(0.24, 0.06, 0.30, 'fonce', 0.02), -0.52, 0.475, -0.05) },
    'debitmetre': { eclat: [-0.06, 0.16, -0.16], faire: () => g(a(cyl(0.04, 0.12, 'clair', 'x'), -0.33, 0.40, -0.22), a(boite(0.04, 0.03, 0.03, 'fonce', 0.004), -0.33, 0.44, -0.22)) },
    'durite-admission': { eclat: [0, 0.10, -0.16], faire: () => tuyau([[-0.27, 0.40, -0.22], [-0.14, 0.38, -0.30], [-0.05, 0.25, -0.33], [-0.01, 0.16, -0.30]], 0.034, 'gomme') },
    'turbo': { eclat: [0, -0.02, -0.30], faire: () => g(
      a(tore(0.05, 0.03, 'clair', 'x'), -0.02, 0.12, -0.30),
      a(cyl(0.032, 0.05, 'clair', 'x'), -0.05, 0.12, -0.30),
      a(cyl(0.03, 0.06, 'moyen', 'x'), 0.03, 0.12, -0.30),
      a(tore(0.042, 0.026, 'fonce', 'x'), 0.08, 0.12, -0.30),
      a(cyl(0.025, 0.06, 'fonce', 'y'), 0.08, 0.06, -0.33),
      a(g(cyl(0.02, 0.04, 'moyen', 'z'), a(cyl(0.004, 0.06, 'moyen', 'x', 8), 0.03, 0, 0)), 0.0, 0.18, -0.34)) },
    'pipe-admission': { eclat: [0, 0.10, -0.10], faire: () => g(a(boite(0.60, 0.05, 0.045, 'clair', 0.01), 0, 0.315, -0.17), CYL.map(x => a(boite(0.05, 0.04, 0.03, 'clair', 0.006), x, 0.30, -0.135))) },
    'egr': { eclat: [0, 0.24, -0.16], faire: () => g(a(cyl(0.022, 0.03, 'clair'), 0.12, 0.355, -0.18), a(tour([[0, 0], [0.035, 0], [0.03, 0.02], [0.015, 0.03], [0, 0.032]], 'moyen'), 0.12, 0.37, -0.18), a(cyl(0.004, 0.03, 'gomme', 'z', 8), 0.12, 0.39, -0.2)) },
    'n75': { eclat: [-0.12, 0, -0.22], faire: () => g(a(boite(0.04, 0.05, 0.035, 'fonce', 0.004), -0.26, 0.24, -0.36), [-0.012, 0, 0.012].map(dx => a(cyl(0.003, 0.02, 'moyen', 'y', 8), -0.26 + dx, 0.275, -0.36))) },
  },

  // 130 — Injection et préchauffage
  '130': {
    'pompe-vp37': { eclat: [-0.12, -0.04, 0.18], faire: () => g(
      a(boite(0.15, 0.12, 0.10, 'clair', 0.012), -0.255, 0.14, 0.17),
      a(cyl(0.045, 0.05, 'clair', 'x'), -0.155, 0.15, 0.17),
      a(cyl(0.016, 0.05, 'fonce'), -0.24, 0.22, 0.17),
      a(boite(0.04, 0.03, 0.04, 'fonce', 0.005), -0.29, 0.215, 0.14)) },
    'injecteurs': { eclat: [0, 0.22, 0], faire: () => g(CYL.map(x => g(
      a(cyl(0.011, 0.07, 'clair', 'y', 20), x, 0.385, 0.06),
      a(cyl(0.015, 0.012, 'moyen', 'y', 6), x, 0.41, 0.06),
      a(cyl(0.005, 0.02, 'moyen', 'y', 12), x, 0.342, 0.06),
      a(cyl(0.005, 0.02, 'moyen', 'z', 12), x, 0.40, 0.075)))) },
    'tuyaux-hp': { eclat: [0, 0.10, 0.14], faire: () => g(CYL.map((x, i) => tuyau([[-0.13, 0.13 + i * 0.012, 0.17], [-0.06 + x * 0.3, 0.28, 0.17], [x, 0.43, 0.10], [x, 0.40, 0.085]], 0.003, 'moyen', 40))) },
    'retours': { eclat: [0, 0.34, 0], faire: () => g(tuyau(CYL.map(x => [x, 0.455, 0.06]).concat([[0.32, 0.44, 0.08]]), 0.003, 'gomme', 60), CYL.map(x => a(cyl(0.004, 0.025, 'gomme', 'y', 10), x, 0.44, 0.06))) },
    'bougies': { eclat: [0, 0.12, -0.16], faire: () => g(CYL.map(x => { const b = g(cyl(0.004, 0.06, 'moyen', 'y', 12), a(cyl(0.008, 0.008, 'clair', 'y', 6), 0, 0.03, 0), a(cyl(0.003, 0.012, 'moyen', 'y', 8), 0, 0.04, 0)); b.position.set(x + 0.03, 0.37, -0.075); b.rotation.x = -0.35; return b; })) },
    'bus-bougies': { eclat: [0, 0.24, -0.22], faire: () => g(a(boite(0.56, 0.004, 0.012, 'fonce', 0.001), 0.03, 0.415, -0.095), CYL.map(x => a(boite(0.006, 0.02, 0.012, 'fonce', 0.001), x + 0.03, 0.405, -0.095))) },
    'filtre-gazole': { eclat: [0.10, 0.10, 0.10], faire: () => g(a(cyl(0.045, 0.14, 'clair', 'y', 40), 0.47, 0.42, 0.24), a(tour([[0, 0], [0.05, 0], [0.05, 0.02], [0.03, 0.03], [0, 0.03]], 'moyen'), 0.47, 0.49, 0.24), a(cyl(0.006, 0.04, 'gomme', 'x', 10), 0.44, 0.51, 0.24)) },
    'relais-103': { eclat: [0.12, 0, -0.06], faire: () => g(a(boite(0.03, 0.04, 0.03, 'fonce', 0.004), 0.57, 0.12, -0.24), [-0.008, 0.008].map(dz => a(boite(0.002, 0.012, 0.004, 'moyen', 0.0005), 0.57, 0.095, -0.24 + dz))) },
  },

  // 903 / 911 — Courroie d'accessoires, alternateur, démarreur
  '903': {
    'courroie-accessoires': { eclat: [0.28, 0, 0], faire: () => courroie(CERCLES_ACC, X_ACC + 0.008, 0.022) },
    'galet-accessoires': { eclat: [0.20, 0.02, 0.10], faire: () => a(galet(0.03, 0.024), X_ACC, 0.08, 0.25) },
    'alternateur': { eclat: [0.14, 0.12, 0.10], faire: () => g(
      a(cyl(0.07, 0.13, 'clair', 'x', 40), 0.37, 0.30, 0.17),
      Array.from({ length: 10 }, (_, i) => a(boite(0.12, 0.004, 0.012, 'moyen', 0.001), 0.37, 0.30 + Math.sin(i * 0.628) * 0.071, 0.17 + Math.cos(i * 0.628) * 0.071)),
      a(poulie(0.03, 0.024, 'clair', 4), X_ACC, 0.30, 0.17)) },
    'compresseur-clim': { eclat: [0.14, -0.12, 0.12], faire: () => g(a(cyl(0.065, 0.15, 'moyen', 'x', 40), 0.36, -0.17, 0.20), a(poulie(0.055, 0.026, 'clair', 4), X_ACC, -0.17, 0.20), a(cyl(0.012, 0.04, 'clair', 'y', 12), 0.34, -0.10, 0.20)) },
    'pompe-direction': { eclat: [0.14, 0.10, -0.10], faire: () => g(a(cyl(0.05, 0.10, 'clair', 'x'), 0.38, 0.28, -0.13), a(poulie(0.055, 0.024, 'clair', 4), X_ACC, 0.28, -0.13)) },
    'poulie-vilo': { doublon: true, eclat: [0.20, -0.04, 0], faire: () => PIECES['109']['poulie-vilo'].faire() },
    'demarreur': { eclat: [-0.24, -0.04, -0.06], faire: () => g(a(cyl(0.045, 0.18, 'fonce', 'x'), -0.40, -0.03, -0.12), a(cyl(0.025, 0.10, 'clair', 'x'), -0.40, 0.04, -0.12), a(engrenage(0.018, 10, 0.02, 'moyen', 0.004), -0.50, -0.03, -0.12)) },
  },

  // 253 — Échappement (longueurs raccourcies, comme sur un catalogue)
  '253': {
    'collecteur': { eclat: [0, 0, -0.18], faire: () => g(
      a(cyl(0.028, 0.50, 'clair', 'x'), -0.03, 0.20, -0.20),
      CYL.map(x => tuyau([[x, 0.25, -0.14], [x, 0.23, -0.17], [x * 0.95, 0.20, -0.20]], 0.02, 'clair', 20)),
      CYL.map(x => a(boite(0.06, 0.05, 0.008, 'clair', 0.002), x, 0.25, -0.138))) },
    'joints-collecteur': { eclat: [0, 0, -0.08], faire: () => g(CYL.map(x => a(boite(0.055, 0.045, 0.002, 'fonce', 0.001), x, 0.25, -0.132))) },
    'tube-avant': { eclat: [0, -0.08, -0.20], faire: () => tuyau([[0.08, 0.04, -0.33], [0.06, -0.10, -0.34], [-0.06, -0.22, -0.34], [-0.26, -0.25, -0.34]], 0.026, 'clair') },
    'flexible': { eclat: [0, -0.16, -0.16], faire: () => g(a(cyl(0.03, 0.14, 'moyen', 'x', 24), -0.34, -0.25, -0.34), Array.from({ length: 6 }, (_, i) => a(tore(0.031, 0.004, 'clair', 'x'), -0.395 + i * 0.022, -0.25, -0.34))) },
    'tube-intermediaire': { eclat: [0, -0.22, -0.08], faire: () => a(cyl(0.026, 0.64, 'clair', 'x'), -0.74, -0.25, -0.34) },
    'catalyseur': { eclat: [0, -0.16, 0.06], faire: () => { const c = g(a(cyl(0.085, 0.24, 'clair', 'x', 40), 0, 0, 0), a(cyl(0.026, 0.05, 'clair', 'x', 24, 0.085), 0.145, 0, 0), a(cyl(0.085, 0.05, 'clair', 'x', 24, 0.026), -0.145, 0, 0)); c.scale.z = 0.75; return a(g(c), -1.23, -0.25, -0.34); } },
    'silencieux': { eclat: [0, -0.08, 0.16], faire: () => { const s = a(cyl(0.12, 0.40, 'clair', 'x', 48), 0, 0, 0); s.scale.z = 0.7; return g(a(g(s), -1.62, -0.25, -0.34), a(cyl(0.024, 0.18, 'clair', 'x'), -1.90, -0.27, -0.34)); } },
    'supports-echappement': { eclat: [0, 0.14, 0], faire: () => g([-0.70, -1.45, -1.80].map(x => g(a(tore(0.022, 0.008, 'gomme', 'x'), x, -0.17, -0.34), a(cyl(0.004, 0.05, 'moyen', 'y', 8), x, -0.20, -0.34)))) },
    'colliers': { eclat: [0, -0.05, -0.24], faire: () => g([-0.41, -1.07, -1.40].map(x => g(a(tore(0.03, 0.005, 'moyen', 'x'), x, -0.25, -0.34), a(vis(0.003, 0.02, 'z'), x, -0.215, -0.34)))) },
  },
};

// Pièces dessinées dans un autre groupe : réutilisées sans être dessinées deux fois en vue complète.
PIECES['121']['pompe-eau'] = { doublon: true, eclat: [0.18, 0, 0.10], faire: () => PIECES['109']['pompe-eau'].faire() };

/**
 * Fabrique les pièces du moteur pour une autre scène (la Vue 3D du camion).
 * selection : { code: null (tout le groupe) | [clés] } ; fabriqueMat(teinte) donne la matière.
 * Renvoie [{ code, cle, eclat, objet }] dessinés dans le repère moteur.
 */
export function piecesMoteur(selection, fabriqueMat) {
  fabrique = fabriqueMat;
  try {
    return Object.entries(selection).flatMap(([code, cles]) =>
      Object.entries(PIECES[code] ?? {})
        .filter(([cle, d]) => !d.doublon && (!cles || cles.includes(cle)))
        .map(([cle, d]) => ({ code, cle, eclat: d.eclat, objet: d.faire() })));
  } finally {
    fabrique = null;
  }
}

// Angle de vue et décalage du groupe dans la vue « Moteur complet ».
const MISE_EN_PAGE = {
  '103': { vue: [0.8, 0.55, 0.9], ensemble: [0, 0, 0] },
  '115': { vue: [0.7, 0.35, 0.9], ensemble: [0, -0.22, 0] },
  '109': { vue: [0.4, 0.3, 1], ensemble: [0.40, 0, 0] },
  '121': { vue: [1, 0.45, 0.5], ensemble: [0, 0, 0.42] },
  '129': { vue: [-0.6, 0.5, -1], ensemble: [-0.15, 0.22, -0.40] },
  '130': { vue: [0.45, 0.8, 0.9], ensemble: [0, 0.36, 0.20] },
  '903': { vue: [0.45, 0.3, 1], ensemble: [0.68, 0, 0.12] },
  '253': { vue: [0.35, 0.5, -1], ensemble: [0, -0.30, -0.55] },
  'ensemble': { vue: [0.9, 0.6, 0.85] },
};

// ---------- Scène ----------
let rendu, scene, camera, controles, hote, dotnet, raf, calque, svg;
let actuelle = null;                    // { code, positions }
let elements = [];                      // { cle, pos, groupe, objet, centre, eclat, decalage, repere, trait, axe }
let eclatValeur = 0, eclatCible = 1;
let choisi = null, survole = null, etats = null;
const cible = new THREE.Vector3();
let animation = null;

export function demarrer(element, refDotnet) {
  arreter();
  hote = element;
  dotnet = refDotnet;
  rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
  hote.appendChild(rendu.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.02, 40);
  controles = new OrbitControls(camera, rendu.domElement);
  controles.enableDamping = true;
  controles.minDistance = 0.3;
  controles.maxDistance = 30;
  controles.addEventListener('start', () => { animation = null; });

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d6cf, 1.9));
  const lumiere = new THREE.DirectionalLight(0xffffff, 1.1);
  lumiere.position.set(2, 4, 3);
  scene.add(lumiere);

  // Calque des repères : numéros HTML et traits de rappel SVG.
  calque = document.createElement('div');
  calque.className = 'reperes-planche';
  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  calque.appendChild(svg);
  hote.appendChild(calque);

  const ray = new THREE.Raycaster();
  const souris = new THREE.Vector2();
  const viser = ev => {
    const r = rendu.domElement.getBoundingClientRect();
    souris.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(souris, camera);
    const hit = ray.intersectObjects(elements.map(e => e.objet), true).find(h => h.object.isMesh);
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.element) o = o.parent;
    return o?.userData.element ?? null;
  };
  let depart = null;
  rendu.domElement.addEventListener('pointerdown', ev => { depart = [ev.clientX, ev.clientY]; });
  rendu.domElement.addEventListener('pointerup', ev => {
    if (!depart || Math.hypot(ev.clientX - depart[0], ev.clientY - depart[1]) > 6) return;
    const e = viser(ev);
    if (e) cliquer(e); else if (choisi) { choisi = null; peindre(); dotnet?.invokeMethodAsync('PositionChoisie', null); }
  });
  rendu.domElement.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse') return;
    const e = viser(ev);
    if (e !== survole) { survole = e; peindre(); dotnet?.invokeMethodAsync('PositionSurvolee', e?.cle ?? null); }
    rendu.domElement.style.cursor = e ? 'pointer' : 'grab';
  });
  rendu.domElement.addEventListener('pointerleave', () => { if (survole) { survole = null; peindre(); dotnet?.invokeMethodAsync('PositionSurvolee', null); } });

  new ResizeObserver(redimensionner).observe(hote);
  redimensionner();
  boucle();
}

function cliquer(e) {
  dotnet?.invokeMethodAsync('PositionChoisie', e.cle);
}

/**
 * Affiche une planche.
 * planche = { code, positions: [{ pos, cle }] } ; code « ensemble » : tout le moteur,
 * positions = [{ pos, cle: code du groupe }].
 */
export function afficher(planche) {
  vider();
  actuelle = planche;
  choisi = null; survole = null;
  const ensemble = planche.code === 'ensemble';
  const groupesAffiches = ensemble ? planche.positions.map(p => p.cle) : [planche.code];

  for (const code of groupesAffiches) {
    const pieces = PIECES[code];
    if (!pieces) { console.warn('Planche inconnue', code); continue; }
    const repere = ensemble ? planche.positions.find(p => p.cle === code) : null;
    for (const [cle, def] of Object.entries(pieces)) {
      if (ensemble && def.doublon) continue;
      const position = ensemble ? repere : planche.positions.find(p => p.cle === cle);
      if (!ensemble && !position) continue;
      // Conteneur neutre : l'éclaté déplace le conteneur sans écraser la place de la pièce.
      const objet = g(def.faire());
      habiller(objet);
      const boite = new THREE.Box3().setFromObject(objet);
      const element = {
        cle: ensemble ? code : cle, pos: position.pos, groupe: code, objet,
        centre: boite.getCenter(new THREE.Vector3()),
        eclat: new THREE.Vector3(...def.eclat).multiplyScalar(ensemble ? 0.35 : 1),
        decalage: new THREE.Vector3(...(ensemble ? MISE_EN_PAGE[code].ensemble : [0, 0, 0])),
      };
      objet.userData.element = element;
      scene.add(objet);
      elements.push(element);
    }
  }
  // Pièces de contexte : le moteur en filigrane sur les planches de détail.
  if (!ensemble && planche.code !== '103') scene.add(filigrane());

  // Un seul numéro par position (en vue complète, un par groupe).
  const parPos = new Map();
  for (const e of elements) if (!parPos.has(e.pos)) parPos.set(e.pos, e);
  for (const e of parPos.values()) {
    const div = document.createElement('button');
    div.type = 'button';
    div.className = 'repere-planche';
    div.textContent = ensemble ? e.groupe : e.pos;
    div.addEventListener('click', () => cliquer(e));
    div.addEventListener('mouseenter', () => { survole = e; peindre(); dotnet?.invokeMethodAsync('PositionSurvolee', e.cle); });
    div.addEventListener('mouseleave', () => { survole = null; peindre(); dotnet?.invokeMethodAsync('PositionSurvolee', null); });
    calque.appendChild(div);
    const trait = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    svg.appendChild(trait);
    e.repere = div; e.trait = trait;
  }
  // Axes d'éclaté en tirets fins, comme sur les planches imprimées.
  for (const e of elements) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    e.axe = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x77756f, dashSize: 0.012, gapSize: 0.008, transparent: true, opacity: 0.8 }));
    scene.add(e.axe);
  }
  peindre();
  eclatValeur = 0;
  cadrer(true);
}

function habiller(objet) {
  const traits = new THREE.LineBasicMaterial({ color: TRAIT });
  const ajouts = [];
  objet.traverse(o => {
    if (!o.isMesh) return;
    o.userData.teinte = o.material.color.getHex();
    ajouts.push([o, new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), traits)]);
  });
  for (const [o, l] of ajouts) o.add(l);
  objet.userData.traits = traits;
}

function filigrane() {
  const mt = new THREE.LineBasicMaterial({ color: 0xa9a69c, transparent: true, opacity: 0.55 });
  const gr = new THREE.Group();
  for (const [l, h, p, y] of [[0.62, 0.30, 0.26, 0.10], [0.64, 0.10, 0.24, 0.30], [0.60, 0.06, 0.20, 0.435], [0.60, 0.12, 0.24, -0.11]]) {
    const ls = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(l, h, p)), mt);
    ls.position.y = y;
    gr.add(ls);
  }
  gr.userData.filigrane = true;
  return gr;
}

function vider() {
  for (const e of elements) {
    scene.remove(e.objet, e.axe);
    e.objet.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
    e.axe.geometry.dispose();
  }
  scene?.children.filter(o => o.userData.filigrane).forEach(o => scene.remove(o));
  elements = [];
  calque?.querySelectorAll('.repere-planche').forEach(d => d.remove());
  if (svg) svg.innerHTML = '';
}

function peindre() {
  for (const e of elements) {
    const estChoisi = choisi && (e.cle === choisi);
    const estSurvole = survole && e.cle === survole.cle;
    const etat = etats?.[e.cle];
    e.objet.traverse(o => {
      if (!o.isMesh) return;
      const teinte = estChoisi ? REMPLI_CHOISI : estSurvole ? REMPLI_SURVOL : (etat && TEINTES_ETAT[etat]) || o.userData.teinte;
      o.material.color.setHex(teinte);
    });
    e.objet.userData.traits.color.setHex(estChoisi || estSurvole ? TRAIT_CHOISI : TRAIT);
    e.objet.userData.traits.opacity = choisi && !estChoisi ? 0.45 : 1;
    e.objet.userData.traits.transparent = !!choisi && !estChoisi;
    e.repere?.classList.toggle('choisi', !!estChoisi);
    e.repere?.classList.toggle('survole', !!estSurvole && !estChoisi);
  }
}

// ---------- Cadrage ----------
function boiteEclatee(valeur) {
  const b = new THREE.Box3();
  for (const e of elements) {
    const bo = new THREE.Box3().setFromObject(e.objet);
    const d = e.decalage.clone().add(e.eclat).multiplyScalar(valeur).sub(e.objet.position);
    bo.min.add(d); bo.max.add(d);
    b.union(bo);
  }
  return b;
}

function cadrer(immediat = false) {
  if (!elements.length) return;
  const b = boiteEclatee(Math.max(eclatCible, 0.0001));
  const centre = b.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(...(MISE_EN_PAGE[actuelle.code]?.vue ?? [1, 0.5, 1])).normalize();
  // Repère de la caméra pour cette direction.
  const droite = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const haut = new THREE.Vector3().crossVectors(dir, droite);
  // Marge pour les numéros autour des pièces (≈ 50 px de chaque côté).
  const l = hote.clientWidth || 1, h = hote.clientHeight || 1;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (1 - Math.min(110, h * 0.16) / h);
  const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * (1 - Math.min(110, l * 0.16) / l);
  let dist = 0.3;
  const c = new THREE.Vector3();
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    c.set(x, y, z).sub(centre);
    const avant = c.dot(dir);
    dist = Math.max(dist, avant + Math.abs(c.dot(droite)) / tanH, avant + Math.abs(c.dot(haut)) / tanV);
  }
  const pos = centre.clone().addScaledVector(dir, dist);
  if (immediat) {
    camera.position.copy(pos);
    controles.target.copy(centre);
    animation = null;
  } else animation = { pos, cible: centre };
}

export function recentrer() { cadrer(); }

export function eclater(valeur) {
  eclatCible = valeur;
  cadrer();
}

export function selectionner(cle) {
  choisi = cle;
  peindre();
}

export function survoler(cle) {
  survole = cle ? elements.find(e => e.cle === cle) ?? null : null;
  peindre();
}

export function colorer(carte) { etats = carte; peindre(); }

// ---------- Boucle ----------
const _p = new THREE.Vector3(), _q = new THREE.Vector3();

function boucle() {
  raf = requestAnimationFrame(boucle);
  eclatValeur += (eclatCible - eclatValeur) * 0.08;
  for (const e of elements) {
    e.objet.position.copy(e.decalage).add(e.eclat).multiplyScalar(eclatValeur);
    const depart = _p.copy(e.centre).addScaledVector(e.decalage, eclatValeur);
    const arrivee = _q.copy(depart).addScaledVector(e.eclat, eclatValeur);
    const attr = e.axe.geometry.attributes.position;
    attr.setXYZ(0, depart.x, depart.y, depart.z);
    attr.setXYZ(1, arrivee.x, arrivee.y, arrivee.z);
    attr.needsUpdate = true;
    e.axe.computeLineDistances();
    e.axe.visible = eclatValeur > 0.05 && e.eclat.lengthSq() > 0.0004;
  }
  if (animation) {
    camera.position.lerp(animation.pos, 0.1);
    controles.target.lerp(animation.cible, 0.1);
    if (camera.position.distanceTo(animation.pos) < 0.002) animation = null;
  }
  controles.update();
  rendu.render(scene, camera);
  placerReperes();
}

/** Numéros autour de la pièce, écartés du centre de la planche, puis désemmêlés. */
function placerReperes() {
  if (!elements.length) return;
  const l = hote.clientWidth, h = hote.clientHeight;
  const ecran = v => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * l, (1 - p.y) / 2 * h, p.z]; };
  const avecRepere = elements.filter(e => e.repere);
  const centre = new THREE.Vector3();
  const points = avecRepere.map(e => {
    // Centre des pièces de la même position (ex. les 5 injecteurs ou un groupe entier).
    const memes = elements.filter(x => x.pos === e.pos);
    const c = new THREE.Vector3();
    for (const m of memes) c.add(m.centre).add(m.objet.position);
    return c.divideScalar(memes.length);
  });
  points.forEach(p => centre.add(p));
  centre.divideScalar(points.length || 1);
  const [cx, cy] = ecran(centre);
  const places = points.map(p => {
    const [x, y, z] = ecran(p);
    let dx = x - cx, dy = y - cy;
    const n = Math.hypot(dx, dy) || 1;
    dx /= n; dy /= n;
    return { ax: x, ay: y, x: x + dx * 38, y: y + dy * 38, z };
  });
  for (let it = 0; it < 8; it++)
    for (let i = 0; i < places.length; i++)
      for (let j = i + 1; j < places.length; j++) {
        const A = places[i], B = places[j];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy);
        if (d < 26 && d > 0.01) { const k = (26 - d) / 2 / d; A.x -= dx * k; A.y -= dy * k; B.x += dx * k; B.y += dy * k; }
        else if (d <= 0.01) { A.x -= 13; B.x += 13; }
      }
  avecRepere.forEach((e, i) => {
    const p = places[i];
    const visible = p.z < 1;
    e.repere.style.display = visible ? '' : 'none';
    e.repere.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    e.trait.setAttribute('x1', p.ax); e.trait.setAttribute('y1', p.ay);
    e.trait.setAttribute('x2', p.x); e.trait.setAttribute('y2', p.y);
    e.trait.setAttribute('class', e.repere.classList.contains('choisi') ? 'choisi' : '');
  });
}

function redimensionner() {
  if (!hote) return;
  const l = hote.clientWidth, h = hote.clientHeight;
  rendu.setSize(l, h);
  svg.setAttribute('width', l); svg.setAttribute('height', h);
  camera.aspect = l / h;
  camera.updateProjectionMatrix();
  if (actuelle) cadrer(true);
}

export function arreter() {
  cancelAnimationFrame(raf);
  if (scene) vider();
  rendu?.dispose();
  hote?.replaceChildren();
  rendu = scene = camera = controles = hote = dotnet = calque = svg = actuelle = null;
  etats = null;
}
