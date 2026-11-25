// Vue 3D éclatée du T4 Multivan (2.5 TDI ACV, 2002, bleu Atlantis).
// Modèle schématique dessiné en code avec Three.js : chaque pièce porte l'identifiant
// de l'« organe » suivi dans l'application, pour relier la 3D à l'historique.
//
// Repère : X vers l'avant, Y vers le haut, Z vers la droite (côté passager), en mètres.
// Origine au milieu du véhicule, au sol.

import * as THREE from 'https://esm.sh/three@0.170.0';
import { OrbitControls } from 'https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'https://esm.sh/three@0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.170.0/examples/jsm/environments/RoomEnvironment.js';
import { piecesMoteur } from './planches-3d.js';

// ---------- Cotes du véhicule ----------
const AV = 1.60;          // essieu avant (sous le bas du pare-brise, mesuré sur la photo de profil)
const AR = -1.45;         // essieu arrière
const R_ROUE = 0.324;     // 205/65 R15
const VOIE = 0.79;        // demi-voie

// ---------- Matières ----------
const M = {
  // Bleu Atlantis métallisé, relevé sur les photos du camion.
  peinture: () => new THREE.MeshPhysicalMaterial({ color: 0x0f55e0, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
  chrome: () => new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.12 }),
  antibrouillard: () => new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 0.9, roughness: 0.2 }),
  vitre: () => new THREE.MeshPhysicalMaterial({ color: 0x0a1220, metalness: 0.1, roughness: 0.04, transparent: true, opacity: 0.72 }),
  fonte: () => new THREE.MeshStandardMaterial({ color: 0x51575e, metalness: 0.55, roughness: 0.55 }),
  alu: () => new THREE.MeshStandardMaterial({ color: 0xc4c9cf, metalness: 0.85, roughness: 0.28 }),
  acier: () => new THREE.MeshStandardMaterial({ color: 0x8e979f, metalness: 0.8, roughness: 0.35 }),
  noir: () => new THREE.MeshStandardMaterial({ color: 0x1d2024, metalness: 0.1, roughness: 0.75 }),
  gomme: () => new THREE.MeshStandardMaterial({ color: 0x141618, metalness: 0, roughness: 0.92 }),
  rouille: () => new THREE.MeshStandardMaterial({ color: 0x6b4a36, metalness: 0.5, roughness: 0.7 }),
  rouge: () => new THREE.MeshStandardMaterial({ color: 0xb3261e, metalness: 0.3, roughness: 0.45 }),
  orange: () => new THREE.MeshStandardMaterial({ color: 0xe08a1e, metalness: 0.2, roughness: 0.5 }),
  phare: () => new THREE.MeshPhysicalMaterial({ color: 0xe9eef5, metalness: 0.2, roughness: 0.05, transmission: 0.4, emissive: 0x2a2f36 }),
  orangeTr: () => new THREE.MeshStandardMaterial({ color: 0xf08c00, emissive: 0x4a2600, roughness: 0.4 }),
  liquide: () => new THREE.MeshPhysicalMaterial({ color: 0xe9e2c8, roughness: 0.2, transparent: true, opacity: 0.75 }),
  cuivre: () => new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.8, roughness: 0.35 }),
};

const COULEURS_ETAT = { ok: 0x16a34a, att: 0xf59e0b, mal: 0xdc2626, neutre: 0x6b7280 };

// ---------- Systèmes : position éclatée de chaque groupe ----------
const SYSTEMES = {
  carrosserie: { nom: 'Carrosserie et éclairage', eclat: [0, 3.1, 0] },
  moteur: { nom: 'Moteur 2.5 TDI', eclat: [1.3, 0.7, 0.2] },
  refroidissement: { nom: 'Refroidissement et clim', eclat: [2.3, 0.45, 0] },
  transmission: { nom: 'Boîte et transmission', eclat: [0.7, 0.15, -1.35] },
  trainAvant: { nom: 'Train avant et direction', eclat: [0.9, -0.05, 0] },
  trainArriere: { nom: 'Train arrière', eclat: [-0.9, -0.05, 0] },
  roues: { nom: 'Roues et freins', eclat: [0, 0, 0] },
  freinage: { nom: 'Commande de freinage', eclat: [-0.4, 0.55, -1.6] },
  echappement: { nom: 'Échappement', eclat: [-0.3, 0.05, 1.75] },
  electricite: { nom: 'Électricité et équipements', eclat: [0.2, 1.0, -1.7] },
  habitacle: { nom: 'Habitacle Multivan', eclat: [-0.3, 1.25, 0] },
};

// ---------- État ----------
let rendu, scene, camera, controles, hote, dotnet, etiquette, raf;
const pieces = [];              // { cle, nom, organe, systeme, objet, base, eclatLocal }
const groupes = {};             // systeme -> THREE.Group
let eclatGlobal = 0, eclatCible = 0;
let focus = null, eclatFocus = 0;
let selection = null, survol = null;
let couleursEtat = null, carrosserieFantome = false;
const cible = new THREE.Vector3(0, 0.9, 0);
const camCible = new THREE.Vector3(5.8, 3.0, 6.4);
let animationCamera = false;

// ---------- Construction ----------

function boite(l, h, p, mat, r = 0.02) {
  return new THREE.Mesh(new RoundedBoxGeometry(l, h, p, 3, Math.min(r, l / 2.1, h / 2.1, p / 2.1)), mat);
}
function cylindre(r, h, mat, axe = 'y', seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  if (axe === 'z') m.rotation.x = Math.PI / 2;
  if (axe === 'x') m.rotation.z = Math.PI / 2;
  return m;
}
function tube(points, r, mat, ferme = false) {
  const courbe = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), ferme);
  return new THREE.Mesh(new THREE.TubeGeometry(courbe, 80, r, 10, ferme), mat);
}
function sphere(r, mat) { return new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat); }
function placer(o, x, y, z) { o.position.set(x, y, z); return o; }
function grouper(...objets) { const g = new THREE.Group(); objets.forEach(o => g.add(o)); return g; }

/** Déclare une pièce cliquable. */
function piece(systeme, cle, nom, organe, objet, eclatLocal = [0, 0, 0]) {
  objet.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.userData.couleur = o.material.color.clone();
    o.userData.opacite = o.material.opacity;
    o.userData.transparent = o.material.transparent;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  objet.userData.cle = cle;
  // Centre de la pièce par rapport à son point d'ancrage : les traits de l'éclaté partent de là.
  const centre = new THREE.Box3().setFromObject(objet).getCenter(new THREE.Vector3()).sub(objet.position);
  groupes[systeme].add(objet);
  pieces.push({ cle, nom, organe, systeme, objet, base: objet.position.clone(), centre, eclatLocal: new THREE.Vector3(...eclatLocal) });
  return objet;
}

function construireCarrosserie() {
  const S = 'carrosserie';
  // Profil latéral (x, y), extrudé sur la largeur.
  const f = new THREE.Shape();
  f.moveTo(-2.40, 0.44);
  f.lineTo(-2.40, 1.84);
  f.quadraticCurveTo(-2.40, 1.94, -2.28, 1.94);
  f.lineTo(0.90, 1.94);
  f.quadraticCurveTo(1.02, 1.93, 1.08, 1.84);
  f.lineTo(1.62, 1.31);
  f.quadraticCurveTo(1.66, 1.28, 1.74, 1.26);
  f.lineTo(2.24, 1.09);
  f.quadraticCurveTo(2.38, 1.04, 2.39, 0.92);
  f.lineTo(2.39, 0.46);
  f.quadraticCurveTo(2.39, 0.32, 2.26, 0.32);
  f.lineTo(AV + 0.43, 0.32);
  f.absarc(AV, R_ROUE, 0.43, 0, Math.PI, false);
  f.lineTo(AR + 0.43, 0.32);
  f.absarc(AR, R_ROUE, 0.43, 0, Math.PI, false);
  f.lineTo(-2.28, 0.32);
  f.quadraticCurveTo(-2.40, 0.32, -2.40, 0.44);
  const largeur = 1.76;
  const geo = new THREE.ExtrudeGeometry(f, { depth: largeur, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 4, curveSegments: 24 });
  geo.translate(0, 0, -largeur / 2);
  piece(S, 'caisse', 'Caisse bleu Atlantis', null, new THREE.Mesh(geo, M.peinture()), [0, 0.25, 0]);

  // ----- Détails relevés sur les photos du camion -----
  const Z = 0.922;   // flanc de caisse

  // Vitrages : vitre de porte avant (montant incliné), vitre coulissante en deux parties,
  // grande vitre de custode, lunette arrière, pare-brise. Encadrements en caoutchouc noir.
  const vitres = new THREE.Group();
  const vitre = (points, z) => {
    const v = points.map(([x, y]) => new THREE.Vector2(x, y));
    const b = new THREE.Box2().setFromPoints(v);
    const c = b.getCenter(new THREE.Vector2()), t = b.getSize(new THREE.Vector2());
    const kx = (t.x - 0.05) / t.x, ky = (t.y - 0.05) / t.y;
    const interieur = v.map(p => new THREE.Vector2(c.x + (p.x - c.x) * kx, c.y + (p.y - c.y) * ky));
    const face = (pts, mat, decalage) => {
      mat.side = THREE.DoubleSide;
      const m = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(pts)), mat);
      m.position.z = z + decalage * Math.sign(z);
      return m;
    };
    return grouper(face(v, M.noir(), 0.002), face(interieur, M.vitre(), 0.006));
  };
  for (const z of [-Z, Z]) {
    vitres.add(vitre([[1.36, 1.27], [0.50, 1.27], [0.50, 1.79], [1.04, 1.79]], z));    // porte avant
    vitres.add(vitre([[0.30, 1.27], [-0.33, 1.27], [-0.33, 1.79], [0.30, 1.79]], z));  // coulissante avant
    vitres.add(vitre([[-0.37, 1.27], [-0.93, 1.27], [-0.93, 1.79], [-0.37, 1.79]], z)); // coulissante arrière
    vitres.add(vitre([[-1.05, 1.27], [-2.12, 1.27], [-2.12, 1.79], [-1.05, 1.79]], z)); // custode
  }
  vitres.add(placer(boite(0.012, 0.6, 1.46, M.vitre(), 0.05), -2.445, 1.5, 0));
  const pare = boite(0.012, 0.76, 1.62, M.vitre(), 0.05);
  pare.position.set(1.36, 1.59, 0);
  pare.rotation.z = Math.atan2(1.84 - 1.31, 1.62 - 1.08);
  vitres.add(pare);
  piece(S, 'vitrages', 'Vitrages', null, vitres, [0, 0.35, 0]);

  // Pare-chocs couleur caisse, avec la grille basse noire.
  const avant = grouper(
    placer(boite(0.2, 0.42, 1.9, M.peinture(), 0.1), 2.36, 0.54, 0),
    placer(boite(0.02, 0.05, 0.9, M.noir(), 0.02), 2.465, 0.66, 0),
    placer(boite(0.02, 0.05, 0.9, M.noir(), 0.02), 2.465, 0.59, 0),
  );
  const arriere = placer(boite(0.18, 0.34, 1.9, M.peinture(), 0.1), -2.42, 0.5, 0);
  piece(S, 'pare-chocs', 'Pare-chocs couleur caisse', null, grouper(avant, arriere), [0.15, 0.1, 0]);

  // Calandre couleur caisse à lamelles, sigle VW et monogramme TDI.
  const calandre = new THREE.Group();
  for (let i = 0; i < 4; i++) calandre.add(placer(boite(0.025, 0.022, 0.7, M.noir(), 0.008), 2.4, 0.84 + i * 0.045, 0));
  calandre.add(placer(boite(0.03, 0.2, 0.74, M.peinture(), 0.02), 2.385, 0.91, 0));
  const sigle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 12, 40), M.chrome());
  sigle.rotation.y = Math.PI / 2;
  sigle.position.set(2.425, 0.92, 0);
  calandre.add(sigle, placer(cylindre(0.05, 0.01, M.peinture(), 'x'), 2.42, 0.92, 0));
  calandre.add(placer(boite(0.008, 0.02, 0.09, M.chrome(), 0.004), 2.42, 0.87, 0.18));
  piece(S, 'calandre', 'Calandre', null, calandre, [0.3, 0.15, 0]);

  // Prise d'air sur le capot.
  piece(S, 'prise-air', 'Prise d\'air de capot', null,
    placer(boite(0.1, 0.03, 0.62, M.noir(), 0.012), 1.86, 1.245, 0).rotateZ(-0.33), [0.1, 0.2, 0]);

  // Phares (blocs clairs avec clignotant intégré), antibrouillards, feux arrière.
  const feux = new THREE.Group();
  for (const s of [-1, 1]) {
    feux.add(placer(boite(0.05, 0.17, 0.32, M.phare(), 0.03), 2.4, 0.93, s * 0.56));
    feux.add(placer(boite(0.05, 0.15, 0.12, M.phare(), 0.03), 2.37, 0.93, s * 0.79));
    feux.add(placer(boite(0.04, 0.07, 0.14, M.antibrouillard(), 0.02), 2.465, 0.46, s * 0.66));
    feux.add(placer(boite(0.05, 0.26, 0.1, M.rouge(), 0.02), -2.44, 0.74, s * 0.84));
  }
  piece(S, 'feux', 'Phares, antibrouillards et feux', 'eclairage', feux, [0.3, 0.2, 0]);

  // Essuie-glaces
  const balais = new THREE.Group();
  for (const s of [-0.38, 0.32]) {
    const b = boite(0.02, 0.02, 0.6, M.noir(), 0.008);
    b.position.set(1.68, 1.33, s);
    b.rotation.y = 0.3;
    balais.add(b);
  }
  balais.add(placer(boite(0.02, 0.32, 0.02, M.noir(), 0.008), -2.47, 1.42, 0.2));
  piece(S, 'essuie-glaces', 'Balais d\'essuie-glace', 'essuie-glace', balais, [0.4, 0.4, 0]);

  // Plaques (texte dessiné sur une texture).
  const texturePlaque = numero => {
    const c = document.createElement('canvas');
    c.width = 520; c.height = 112;
    const x = c.getContext('2d');
    x.fillStyle = '#f4f4f2'; x.fillRect(0, 0, 520, 112);
    x.fillStyle = '#1f4fb8'; x.fillRect(0, 0, 46, 112); x.fillRect(474, 0, 46, 112);
    x.fillStyle = '#fff'; x.font = 'bold 30px sans-serif'; x.textAlign = 'center'; x.fillText('F', 23, 98);
    x.fillText('35', 497, 98);
    x.fillStyle = '#111'; x.font = 'bold 66px sans-serif'; x.fillText(numero, 260, 80);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const plaque = () => new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshStandardMaterial({ map: texturePlaque('HL-472-CA'), roughness: 0.4 }));
  const plaques = new THREE.Group();
  const pAv = plaque(); pAv.rotation.y = Math.PI / 2; plaques.add(placer(pAv, 2.468, 0.5, 0.12));
  const pAr = plaque(); pAr.rotation.y = -Math.PI / 2; plaques.add(placer(pAr, -2.512, 0.62, 0));
  piece(S, 'plaques', 'Plaques HL-472-CA', 'plaques', plaques, [0.3, -0.1, 0]);

  // Logo « ATLANTIS » de custode.
  const texteAtlantis = (() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 96;
    const x = c.getContext('2d');
    x.font = 'italic bold 74px sans-serif';
    x.lineWidth = 4; x.strokeStyle = 'rgba(200,215,240,.9)'; x.strokeText('ATLANTIS', 16, 74);
    x.fillStyle = 'rgba(20,60,140,.55)'; x.fillText('ATLANTIS', 16, 74);
    x.fillStyle = '#e0312a'; x.beginPath(); x.arc(250, 14, 8, 0, 7); x.fill();
    x.fillStyle = '#2bb24c'; x.beginPath(); x.arc(470, 60, 8, 0, 7); x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const decors = new THREE.Group();
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.086), new THREE.MeshStandardMaterial({ map: texteAtlantis, transparent: true, roughness: 0.4 }));
    d.position.set(-1.68, 1.12, s * (Z + 0.004));
    if (s < 0) d.rotation.y = Math.PI;
    decors.add(d);
  }
  // Baguette de bas de caisse et ligne de ceinture.
  for (const s of [-1, 1]) {
    decors.add(placer(boite(4.3, 0.012, 0.01, new THREE.MeshStandardMaterial({ color: 0x163f94, roughness: 0.5 }), 0.004), -0.05, 0.83, s * (Z + 0.002)));
  }
  // Joints de portes relevés sur la photo de profil : porte avant, porte coulissante, trappe à carburant.
  const joint = () => new THREE.MeshStandardMaterial({ color: 0x0b2a6b, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const z = s * (Z + 0.002);
    decors.add(placer(boite(0.008, 1.42, 0.006, joint(), 0.002), 0.5, 1.12, z));
    decors.add(placer(boite(0.008, 1.42, 0.006, joint(), 0.002), -1.0, 1.12, z));
    decors.add(placer(boite(1.5, 0.008, 0.006, joint(), 0.002), -0.25, 0.42, z));
  }
  decors.add(placer(boite(0.13, 0.17, 0.006, joint(), 0.01), 0.38, 0.64, -(Z + 0.003)));
  piece(S, 'decors', 'Monogrammes, baguettes et joints', null, decors, [0, 0.3, 0]);

  // Rétroviseurs couleur caisse sur leur bras, poignées de porte noires.
  const retros = new THREE.Group();
  for (const s of [-1, 1]) {
    retros.add(placer(boite(0.06, 0.04, 0.12, M.noir(), 0.015), 1.12, 1.26, s * (Z + 0.05)));
    retros.add(placer(boite(0.09, 0.24, 0.16, M.peinture(), 0.04), 1.08, 1.32, s * (Z + 0.14)));
    retros.add(placer(boite(0.07, 0.07, 0.02, M.noir(), 0.01), 0.46, 1.15, s * (Z + 0.012)));
    retros.add(placer(boite(0.07, 0.07, 0.02, M.noir(), 0.01), 0.24, 1.15, s * (Z + 0.012)));
  }
  piece(S, 'retros', 'Rétroviseurs et poignées', null, retros, [0, 0.1, 0]);

  piece(S, 'faisceau-porte', 'Faisceau de porte AV gauche', 'faisceau-porte-avg',
    tube([[0.95, 0.9, -0.86], [0.8, 0.95, -0.9], [0.55, 1.0, -0.9], [0.4, 0.95, -0.88]], 0.012, M.orangeTr()), [0, 0, -0.4]);
}

// Le moteur est celui des planches (planches-3d.js), dessiné pièce par pièce, ici en vraies matières.
// Repère des planches : X le long du vilebrequin (distribution), Y vers le haut, Z vers l'avant.
// Dans le camion, le 5 cylindres est en travers : distribution côté droit (+Z), avant moteur vers la calandre (+X).
const SELECTION_MOTEUR = {
  '103': null, '115': null, '109': null, '129': null, '130': null, '903': null,
  '121': ['boitier-thermostat', 'thermostat', 'sonde-g62'],
  '253': ['collecteur', 'joints-collecteur'],
  // Ce qu'on voit capot ouvert : échangeur, boîte à air ronde, vase, bocaux, batterie, traverse.
  'capot': null,
};
const VERS_CAMION = new THREE.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1);
let catalogueMoteur = null;   // noms et pièces suivies, lus dans diagnostic/planches-moteur.json

async function chargerCatalogueMoteur() {
  try {
    const r = await fetch(new URL('diagnostic/planches-moteur.json', document.baseURI));
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// Matières des pièces telles qu'on les voit capot ouvert : fonte grise, alu brut, plastique noir, papier, rouille.
const papier = () => new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.95 });
const plastiqueNoir = () => new THREE.MeshStandardMaterial({ color: 0x17191c, metalness: 0, roughness: 0.6 });
const MATIERES_REELLES = {
  'bloc': t => t === 'clair' ? M.alu() : M.fonte(),
  'joint-culasse': () => M.acier(),
  'culasse': () => M.alu(),
  'couvre-culasse': t => t === 'moyen' ? M.noir() : plastiqueNoir(),
  'joint-couvre': () => M.gomme(),
  'reniflard': t => t === 'gomme' ? M.gomme() : plastiqueNoir(),
  'carter-huile': () => M.fonte(),
  'bouchon-remplissage': () => plastiqueNoir(),
  'jauge': t => t === 'fonce' ? M.orange() : M.acier(),
  'filtre-huile': t => t === 'clair' ? plastiqueNoir() : M.alu(),
  'poulie-vilo': () => M.fonte(),
  'pignon-aac': () => M.acier(), 'pignon-vilo': () => M.acier(), 'pignon-pompe': () => M.acier(),
  'carter-distribution': () => new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.6, transparent: true, opacity: 0.35, depthWrite: false }),
  'boite-air': () => plastiqueNoir(), 'couvercle-boite': () => plastiqueNoir(),
  'element-filtrant': t => t === 'moyen' ? plastiqueNoir() : papier(),
  'debitmetre': t => t === 'clair' ? plastiqueNoir() : M.noir(),
  'n75': t => t === 'moyen' ? M.acier() : plastiqueNoir(),
  'turbo': t => t === 'clair' ? M.alu() : M.rouille(),
  'collecteur': () => M.rouille(), 'joints-collecteur': () => M.acier(),
  'pipe-admission': () => M.alu(),
  'injecteurs': () => M.acier(), 'tuyaux-hp': () => M.acier(),
  'filtre-gazole': t => t === 'clair' ? plastiqueNoir() : M.alu(),
  'bougies': t => t === 'clair' ? M.acier() : M.cuivre(),
  'supports-moteur': t => t === 'gomme' ? M.gomme() : M.noir(),
  'echangeur': t => t === 'clair' ? M.alu() : t === 'gomme' ? M.gomme() : t === 'moyen' ? M.alu() : plastiqueNoir(),
  'traverse-avant': t => t === 'moyen' ? M.acier() : plastiqueNoir(),
  'boite-air-ronde': t => t === 'moyen' ? M.acier() : plastiqueNoir(),
  'bouchon-huile': () => plastiqueNoir(),
  'lave-glace': t => t === 'clair' ? new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.5 }) : null,
  'reservoir-direction': t => t === 'fonce' ? plastiqueNoir() : null,
  'vase-expansion': t => typeof t === 'number' && t !== 0xe6cfa3 ? null : M.liquide(),
  'batterie-capot': t => t === 'moyen' ? M.acier() : plastiqueNoir(),
};

function matiereMoteur(teinte, cle) {
  const reelle = MATIERES_REELLES[cle]?.(teinte);
  if (reelle) return reelle;
  // Couleur imposée par la pièce (bouchons bleu, jaune, vert ; vase beige).
  if (typeof teinte === 'number') return new THREE.MeshStandardMaterial({ color: teinte, roughness: 0.45 });
  switch (teinte) {
    case 'clair': return M.alu();
    case 'moyen': return M.acier();
    case 'fonce': return M.noir();
    case 'gomme': return M.gomme();
    case 'verre': return new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.7, transparent: true, opacity: 0.3, depthWrite: false });
    default: return M.alu();
  }
}

function construireMoteur() {
  const S = 'moteur';
  groupes[S].position.set(1.86, 0.62, 0.08);
  const positions = new Map();
  for (const p of catalogueMoteur?.planches ?? [])
    for (const x of p.positions) positions.set(`${p.code}/${x.cle}`, { ...x, planche: `${p.code} ${p.titre}` });
  for (const { code, cle, eclat, objet } of piecesMoteur(SELECTION_MOTEUR, matiereMoteur)) {
    const info = positions.get(`${code}/${cle}`);
    const tourne = new THREE.Group();
    tourne.matrixAutoUpdate = false;
    tourne.matrix.copy(VERS_CAMION);
    tourne.add(objet);
    const [ex, ey, ez] = eclat;
    piece(S, cle, info?.nom ?? cle, info?.organe ?? null, grouper(tourne), [ez * 0.85, ey * 0.85, ex * 0.85]);
  }
}
function construireRefroidissement() {
  const S = 'refroidissement';
  const g = groupes[S];
  g.position.set(2.27, 0.66, 0);
  piece(S, 'radiateur', 'Radiateur et liquide de refroidissement', 'liquide-refroidissement', grouper(
    boite(0.05, 0.42, 1.05, M.noir(), 0.01),
    placer(boite(0.07, 0.42, 0.04, M.alu(), 0.01), 0, 0, 0.54),
    placer(boite(0.07, 0.42, 0.04, M.alu(), 0.01), 0, 0, -0.54),
  ), [0, 0, 0]);
  piece(S, 'condenseur', 'Condenseur de clim', 'clim', placer(boite(0.03, 0.38, 0.98, M.cuivre(), 0.01), 0.07, 0, 0), [0.35, 0, 0]);
  const ventilos = new THREE.Group();
  for (const z of [-0.26, 0.26]) {
    const v = placer(cylindre(0.17, 0.05, M.noir(), 'x'), -0.07, 0, z);
    for (let k = 0; k < 7; k++) {
      const pale = boite(0.01, 0.15, 0.035, M.noir(), 0.004);
      pale.position.set(-0.1, Math.cos(k * 0.9) * 0.08, z + Math.sin(k * 0.9) * 0.08);
      pale.rotation.x = k * 0.9;
      ventilos.add(pale);
    }
    ventilos.add(v);
  }
  piece(S, 'ventilateurs', 'Ventilateurs de radiateur (Siemens 450 W)', 'ventilateurs-radiateur', ventilos, [-0.35, 0, 0]);
  piece(S, 'pompe-aux', 'Pompe à eau auxiliaire', 'pompe-eau-auxiliaire', placer(cylindre(0.03, 0.09, M.noir(), 'z'), -0.55, -0.15, -0.45), [-0.2, -0.1, -0.25]);}

function construireTransmission() {
  const S = 'transmission';
  const g = groupes[S];
  g.position.set(1.62, 0.5, -0.42);
  piece(S, 'boite', 'Boîte de vitesses et huile', 'huile-boite', grouper(
    boite(0.34, 0.32, 0.36, M.alu(), 0.04),
    placer(cylindre(0.17, 0.08, M.alu(), 'z'), 0.05, 0.03, 0.2),
  ), [0, 0, -0.1]);
  piece(S, 'commande', 'Commande de boîte', 'commande-boite', grouper(
    placer(cylindre(0.012, 0.5, M.acier(), 'x'), -0.4, 0.12, 0),
    placer(cylindre(0.012, 0.18, M.acier()), -0.62, 0.22, 0),
  ), [-0.2, 0.25, 0]);
  piece(S, 'cardan-g', 'Cardan AV gauche et soufflets', 'soufflets-cardan', grouper(
    placer(cylindre(0.022, 0.38, M.acier(), 'z'), AV - 1.62, R_ROUE - 0.5, -0.36),
    placer(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 16), M.gomme()), AV - 1.62, R_ROUE - 0.5, -0.56).rotateX(Math.PI / 2),
  ), [0, -0.05, -0.3]);
  piece(S, 'cardan-d', 'Cardan AV droit et soufflets', 'cardan-avd', grouper(
    placer(cylindre(0.022, 1.0, M.acier(), 'z'), AV - 1.62, R_ROUE - 0.5, 0.82),
    placer(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 16), M.gomme()), AV - 1.62, R_ROUE - 0.5, 1.29).rotateX(-Math.PI / 2),
  ), [0, -0.05, 0.4]);
}

function construireTrainAvant() {
  const S = 'trainAvant';
  const g = groupes[S];
  g.position.set(AV, R_ROUE, 0);
  for (const s of [-1, 1]) {
    const cote = s > 0 ? 'D' : 'G';
    const e = (x, y, z) => [x, y, z * s];
    piece(S, `triangle-inf-${cote}`, `Triangle inférieur AV ${cote === 'D' ? 'droit' : 'gauche'}`, s > 0 ? 'triangle-inf-avd' : null,
      placer(boite(0.36, 0.035, 0.32, M.noir(), 0.015), 0, -0.1, s * 0.5), e(0, -0.15, 0.25));
    piece(S, `rotule-inf-${cote}`, `Rotule inférieure AV ${cote === 'D' ? 'droite' : 'gauche'}`, s > 0 ? 'rotule-inf-avd' : 'rotule-inf-avg',
      placer(sphere(0.038, M.acier()), 0, -0.08, s * 0.67), e(0, -0.25, 0.45));
    piece(S, `triangle-sup-${cote}`, `Triangle supérieur AV ${cote === 'D' ? 'droit' : 'gauche'}`, null,
      placer(boite(0.28, 0.03, 0.26, M.noir(), 0.012), 0, 0.2, s * 0.52), e(0, 0.15, 0.25));
    piece(S, `rotule-sup-${cote}`, `Rotule supérieure AV ${cote === 'D' ? 'droite' : 'gauche'}`, 'rotules-sup-av',
      placer(sphere(0.034, M.acier()), 0, 0.2, s * 0.66), e(0, 0.3, 0.45));
    piece(S, `amortisseur-av-${cote}`, `Amortisseur AV ${cote === 'D' ? 'droit' : 'gauche'}`, 'amortisseurs',
      placer(grouper(cylindre(0.03, 0.36, M.noir()), placer(cylindre(0.018, 0.16, M.acier()), 0, 0.24, 0)), 0.12, 0.12, s * 0.48), e(0.25, 0.25, 0.2));
    piece(S, `biellette-${cote}`, `Biellette de stabilisateur ${cote === 'D' ? 'droite' : 'gauche'}`, 'biellettes-stab',
      placer(cylindre(0.012, 0.16, M.acier()), -0.2, -0.02, s * 0.46), e(-0.25, 0, 0.3));
    piece(S, `moyeu-${cote}`, `Moyeu et roulement AV ${cote === 'D' ? 'droit' : 'gauche'}`, s > 0 ? 'roulement-avd' : null,
      placer(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.018, 10, 24), M.acier()), 0, 0, s * 0.7), e(0, 0, 0.6));
  }
  piece(S, 'barre-stab', 'Barre stabilisatrice', 'biellettes-stab', placer(cylindre(0.014, 0.95, M.acier(), 'z'), -0.2, -0.1, 0), [-0.35, -0.1, 0]);
  piece(S, 'direction', 'Crémaillère, biellettes et rotules de direction', 'direction', grouper(
    placer(cylindre(0.03, 0.6, M.alu(), 'z'), -0.12, 0.08, 0),
    placer(cylindre(0.012, 0.32, M.acier(), 'z'), -0.12, 0.08, -0.46),
    placer(cylindre(0.012, 0.32, M.acier(), 'z'), -0.12, 0.08, 0.46),
  ), [-0.4, 0.2, 0]);
}

function construireTrainArriere() {
  const S = 'trainArriere';
  const g = groupes[S];
  g.position.set(AR, R_ROUE, 0);
  for (const s of [-1, 1]) {
    const cote = s > 0 ? 'droit' : 'gauche';
    piece(S, `bras-${s}`, `Bras tiré AR ${cote}`, null, placer(boite(0.6, 0.06, 0.08, M.noir(), 0.02), 0.25, -0.02, s * 0.55), [0.2, -0.1, s * 0.25]);
    piece(S, `ressort-${s}`, `Ressort AR ${cote}`, null,
      placer(new THREE.Mesh(new THREE.TorusKnotGeometry(0.06, 0.008, 80, 6, 1, 8), M.rouge()), 0.1, 0.15, s * 0.5).rotateX(Math.PI / 2), [0, 0.3, s * 0.2]);
    piece(S, `amortisseur-ar-${s}`, `Amortisseur AR ${cote}`, 'amortisseurs',
      placer(grouper(cylindre(0.028, 0.34, M.noir()), placer(cylindre(0.016, 0.14, M.acier()), 0, 0.22, 0)), -0.12, 0.12, s * 0.58), [-0.3, 0.25, s * 0.3]);
  }
}

function construireRoues() {
  const S = 'roues';
  for (const [x, nomEssieu, organePneu, organeFrein] of [[AV, 'AV', 'pneus-av', 'freins-av'], [AR, 'AR', 'pneus-ar', 'freins-ar']]) {
    for (const s of [-1, 1]) {
      const cote = s > 0 ? 'D' : 'G';
      const roue = grouper(
        new THREE.Mesh(new THREE.TorusGeometry(R_ROUE - 0.075, 0.078, 20, 48), M.gomme()),
        placer(cylindre(0.2, 0.17, M.alu(), 'z'), 0, 0, s * -0.005),
      );
      roue.children[0].scale.z = 1.3;
      // Rayons de jante
      for (let i = 0; i < 5; i++) {
        const r = boite(0.035, 0.17, 0.02, M.alu(), 0.008);
        r.position.set(Math.cos(i * 1.2566) * 0.1, Math.sin(i * 1.2566) * 0.1, s * 0.09);
        r.rotation.z = i * 1.2566 + Math.PI / 2;
        roue.add(r);
      }
      piece(S, `pneu-${nomEssieu}${cote}`, `Pneu ${nomEssieu} ${cote === 'D' ? 'droit' : 'gauche'}`, organePneu,
        placer(roue, x, R_ROUE, s * VOIE), [0, 0, s * 0.75]);
      piece(S, `frein-${nomEssieu}${cote}`, `Disque et plaquettes ${nomEssieu} ${cote === 'D' ? 'droit' : 'gauche'}`, organeFrein, grouper(
        placer(cylindre(nomEssieu === 'AV' ? 0.15 : 0.13, 0.026, M.acier(), 'z'), x, R_ROUE, s * (VOIE - 0.13)),
        placer(boite(0.08, 0.1, 0.06, M.rouge(), 0.015), x - 0.1, R_ROUE + 0.09, s * (VOIE - 0.12)),
      ), [0, 0, s * 0.35]);
    }
  }
  // Flexibles de frein AV
  for (const s of [-1, 1]) {
    piece(S, `flexible-${s}`, `Flexible de frein AV ${s > 0 ? 'droit' : 'gauche'}`, 'flexibles-frein',
      tube([[AV - 0.1, R_ROUE + 0.12, s * (VOIE - 0.12)], [AV - 0.18, R_ROUE + 0.28, s * (VOIE - 0.22)], [AV - 0.3, R_ROUE + 0.32, s * (VOIE - 0.32)]], 0.009, M.noir()),
      [0, 0.15, s * 0.3]);
  }
}

function construireFreinage() {
  const S = 'freinage';
  piece(S, 'maitre-cylindre', 'Maître-cylindre et liquide de frein', 'liquide-frein', grouper(
    placer(cylindre(0.035, 0.22, M.alu(), 'x'), 1.72, 0.98, -0.58),
    placer(boite(0.1, 0.08, 0.1, M.liquide(), 0.02), 1.72, 1.06, -0.58),
  ), [0, 0.2, 0]);
  piece(S, 'cable-frein-main', 'Câble de frein à main', 'cable-frein-main',
    tube([[0.6, 0.36, -0.05], [-0.3, 0.3, 0], [-1.2, 0.3, 0.1], [AR + 0.05, R_ROUE + 0.05, 0.55]], 0.008, M.acier()), [0, -0.1, 0]);
}

function construireEchappement() {
  const S = 'echappement';
  // Ligne inox (2009) ; le catalyseur est désormais juste avant le silencieux arrière.
  piece(S, 'ligne', 'Ligne d\'échappement inox', 'echappement',
    tube([[1.6, 0.78, -0.2], [1.48, 0.5, 0.0], [1.15, 0.28, 0.3], [-0.6, 0.26, 0.4], [-1.25, 0.27, 0.42], [-2.42, 0.3, 0.42]], 0.028, M.acier()), [0, 0, 0]);
  piece(S, 'catalyseur', 'Catalyseur (juste avant le silencieux)', 'echappement', placer(cylindre(0.085, 0.36, M.acier(), 'x'), -1.44, 0.28, 0.42), [0.15, 0.12, 0.2]);
  piece(S, 'silencieux', 'Silencieux arrière', 'echappement', placer(grouper(cylindre(0.13, 0.5, M.acier(), 'x')), -1.98, 0.3, 0.42), [-0.15, 0.1, 0.15]);
  groupes[S].children.at(-1).children[0].scale.set(1, 1, 0.65);
}

function construireElectricite() {
  const S = 'electricite';
  // La batterie principale est dans le compartiment moteur, côté conducteur : voir les pièces « capot ».
  piece(S, 'batterie-aux', 'Batterie auxiliaire 70 Ah', 'batterie-auxiliaire', grouper(
    boite(0.26, 0.19, 0.17, M.noir(), 0.015),
    placer(cylindre(0.015, 0.03, M.rouge()), 0.08, 0.1, 0.05),
  ), [0, 0.15, 0.25]).position.set(0.95, 0.49, 0.5);
  pieces.at(-1).base.copy(pieces.at(-1).objet.position);
  piece(S, 'chauffage', 'Chauffage stationnaire Eberspächer', 'chauffage-stationnaire',
    placer(boite(0.3, 0.12, 0.14, M.noir(), 0.03), 0.3, 0.36, 0.55), [0.2, 0, 0.3]);
}

function construireHabitacle() {
  const S = 'habitacle';
  const tissu = () => new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.95 });
  const tissuBleu = () => new THREE.MeshStandardMaterial({ color: 0x2b3f66, roughness: 0.95 });
  const planche = () => new THREE.MeshStandardMaterial({ color: 0x2a2d32, roughness: 0.7 });

  // Siège : assise, dossier, appui-tête ; orientation +1 vers l'avant, -1 dos à la route.
  const siege = (sens = 1, largeur = 0.5) => {
    const g = new THREE.Group();
    g.add(placer(boite(0.5, 0.12, largeur, tissu(), 0.05), 0, 0, 0));
    const dossier = placer(boite(0.12, 0.6, largeur, tissuBleu(), 0.05), -0.22 * sens, 0.33, 0);
    dossier.rotation.z = 0.12 * sens;
    g.add(dossier, placer(boite(0.1, 0.17, largeur * 0.55, tissu(), 0.04), -0.26 * sens, 0.72, 0));
    g.add(placer(cylindre(0.05, 0.2, M.noir()), 0, -0.14, 0));
    return g;
  };

  // Plancher et rails (Multivan à partir de 2000).
  const plancher = grouper(placer(boite(3.6, 0.03, 1.66, planche(), 0.01), -0.55, 0.42, 0));
  for (const z of [-0.62, -0.18, 0.18, 0.62]) plancher.add(placer(boite(2.4, 0.015, 0.04, M.alu(), 0.005), -0.9, 0.44, z));
  piece(S, 'plancher', 'Plancher et rails de sièges', null, plancher, [0, -0.25, 0]);

  // Tableau de bord, Climatronic, volant (conduite à gauche, côté -Z), levier de vitesses.
  const tdb = grouper(
    placer(boite(0.38, 0.32, 1.62, planche(), 0.08), 1.32, 1.02, 0),
    placer(boite(0.04, 0.12, 0.2, M.noir(), 0.02), 1.12, 1.06, 0.02),
    placer(boite(0.02, 0.09, 0.16, new THREE.MeshStandardMaterial({ color: 0x0b2a6b, emissive: 0x1a56c8, emissiveIntensity: 0.6 }), 0.01), 1.1, 1.07, 0.02),
  );
  piece(S, 'tableau-de-bord', 'Tableau de bord et Climatronic', 'tableau-de-bord', tdb, [0.45, 0.2, 0]);
  const volant = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 40), M.noir());
  volant.rotation.y = Math.PI / 2;
  volant.rotation.x = 0.4;
  piece(S, 'volant', 'Volant et colonne de direction', 'direction', grouper(
    placer(volant, 1.02, 1.12, -0.45),
    placer(cylindre(0.03, 0.38, M.noir(), 'x'), 1.2, 1.04, -0.45).rotateZ(0.5),
  ), [0.25, 0.35, -0.2]);
  piece(S, 'levier', 'Levier de vitesses', 'commande-boite', grouper(
    placer(cylindre(0.012, 0.32, M.noir()), 1.05, 0.8, -0.05).rotateZ(-0.35),
    placer(sphere(0.035, M.noir()), 0.99, 0.95, -0.05),
  ), [0.3, 0.2, 0.05]);

  // Sièges avant (conducteur à gauche).
  piece(S, 'siege-conducteur', 'Siège conducteur', null, placer(siege(1), 0.68, 0.62, -0.45), [0.15, 0.35, -0.55]);
  piece(S, 'siege-passager', 'Siège passager', null, placer(siege(1), 0.68, 0.62, 0.45), [0.15, 0.35, 0.55]);

  // Deux sièges individuels pivotants sur rails, dos à la route.
  piece(S, 'sieges-pivotants', 'Sièges pivotants sur rails', 'sieges-pivotants', grouper(
    placer(siege(-1, 0.5), -0.15, 0.62, -0.42),
    placer(siege(-1, 0.5), -0.15, 0.62, 0.42),
  ), [0.1, 0.55, 0]);

  // Table pliante du Multivan.
  piece(S, 'table', 'Table pliante', 'table-multivan', grouper(
    placer(boite(0.55, 0.03, 0.38, new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.6 }), 0.02), -0.72, 0.98, 0.55),
    placer(cylindre(0.02, 0.5, M.alu()), -0.72, 0.72, 0.55),
  ), [-0.1, 0.75, 0.45]);

  // Banquette arrière 3 places rabattable en lit, chauffage arrière dessous.
  const banquette = grouper(
    placer(boite(0.55, 0.16, 1.5, tissu(), 0.06), -1.45, 0.66, 0),
    placer(boite(0.13, 0.62, 1.5, tissuBleu(), 0.06), -1.75, 1.02, 0).rotateZ(0.12),
  );
  for (const z of [-0.5, 0, 0.5]) banquette.add(placer(boite(0.1, 0.16, 0.3, tissu(), 0.04), -1.8, 1.42, z));
  piece(S, 'banquette', 'Banquette-lit arrière', 'banquette-lit', banquette, [-0.35, 0.65, 0]);
  piece(S, 'chauffage-ar', 'Chauffage arrière (radiateur et pulseur)', 'chauffage-arriere',
    placer(boite(0.3, 0.16, 0.35, M.noir(), 0.03), -1.45, 0.5, 0.4), [-0.2, -0.1, 0.65]);
}

function construire() {
  for (const id of Object.keys(SYSTEMES)) {
    groupes[id] = new THREE.Group();
    groupes[id].userData.base = new THREE.Vector3();
    scene.add(groupes[id]);
  }
  construireCarrosserie();
  construireMoteur();
  construireRefroidissement();
  construireTransmission();
  construireTrainAvant();
  construireTrainArriere();
  construireRoues();
  construireFreinage();
  construireEchappement();
  construireElectricite();
  construireHabitacle();
  for (const g of Object.values(groupes)) g.userData.base.copy(g.position);
}

// ---------- Rendu et interaction ----------

export async function demarrer(element, refDotnet) {
  arreter();
  catalogueMoteur ??= await chargerCatalogueMoteur();
  hote = element;
  dotnet = refDotnet;
  rendu = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
  rendu.toneMapping = THREE.ACESFilmicToneMapping;
  rendu.toneMappingExposure = 1.15;
  rendu.shadowMap.enabled = true;
  rendu.shadowMap.type = THREE.PCFSoftShadowMap;
  hote.appendChild(rendu.domElement);

  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
  camera.position.copy(camCible);
  controles = new OrbitControls(camera, rendu.domElement);
  controles.target.copy(cible);
  controles.enableDamping = true;
  controles.minDistance = 0.6;
  // Assez de recul pour cadrer tout le camion éclaté dans la bande libre d'un écran de téléphone.
  controles.maxDistance = 45;
  controles.maxPolarAngle = Math.PI * 0.495;
  controles.addEventListener('start', () => { animationCamera = false; });

  const soleil = new THREE.DirectionalLight(0xffffff, 2.2);
  soleil.position.set(4, 8, 5);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(soleil, new THREE.HemisphereLight(0xdfe8ff, 0x20242a, 0.6));

  const sol = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  scene.add(sol);
  const grille = new THREE.PolarGridHelper(7, 16, 10, 64, 0x3a4048, 0x2a2f35);
  grille.material.transparent = true;
  grille.material.opacity = 0.35;
  scene.add(grille);

  construire();
  creerTraits();

  etiquette = document.createElement('div');
  etiquette.className = 'etiquette-3d';
  etiquette.hidden = true;
  hote.appendChild(etiquette);

  const ray = new THREE.Raycaster();
  const souris = new THREE.Vector2();
  const viser = ev => {
    const r = rendu.domElement.getBoundingClientRect();
    souris.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(souris, camera);
    const visibles = pieces.filter(p => !focus || p.systeme === focus).map(p => p.objet);
    const hit = ray.intersectObjects(visibles, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !o.userData.cle) o = o.parent;
    return pieces.find(p => p.objet === o) ?? null;
  };
  let depart = null;
  rendu.domElement.addEventListener('pointerdown', ev => { depart = [ev.clientX, ev.clientY]; });
  rendu.domElement.addEventListener('pointerup', ev => {
    if (!depart || Math.hypot(ev.clientX - depart[0], ev.clientY - depart[1]) > 6) return;
    const p = viser(ev);
    if (!p) return;
    if (focus !== p.systeme) focaliser(p.systeme);
    else choisir(p);
  });
  rendu.domElement.addEventListener('pointermove', ev => {
    if (ev.pointerType !== 'mouse') return;
    const p = viser(ev);
    survol = p;
    if (p) {
      etiquette.hidden = false;
      etiquette.textContent = focus === p.systeme ? p.nom : SYSTEMES[p.systeme].nom;
      const r = hote.getBoundingClientRect();
      etiquette.style.left = `${ev.clientX - r.left + 14}px`;
      etiquette.style.top = `${ev.clientY - r.top + 14}px`;
    } else etiquette.hidden = true;
    rendu.domElement.style.cursor = p ? 'pointer' : 'grab';
  });
  rendu.domElement.addEventListener('pointerleave', () => { etiquette.hidden = true; survol = null; });

  new ResizeObserver(redimensionner).observe(hote);
  redimensionner();
  boucle();
}

function redimensionner() {
  if (!hote) return;
  const l = hote.clientWidth, h = hote.clientHeight;
  rendu.setSize(l, h);
  camera.aspect = l / h;
  appliquerMarges();
  if (!focus) vueInitiale(true);
}

// ---------- Place laissée par le panneau ----------
// Le panneau de pièces recouvre une partie de la vue : on décale le centre de l'image
// (à gauche sur grand écran, vers le haut sur téléphone) pour que le camion reste visible.
let marges = { droite: 0, bas: 0 };

export function marger(droite, bas) {
  if (Math.abs(droite - marges.droite) < 2 && Math.abs(bas - marges.bas) < 2) return;
  marges = { droite, bas };
  appliquerMarges();
  // Recadre ce qui est regardé dans la place restante.
  if (selection) cadrer([selection.objet], 2.4);
  else if (focus) cadrer([groupes[focus]], 1.1);
  else vueInitiale();
}

/** Suit la taille du panneau de pièces (côté droit sur grand écran, en bas sur téléphone). */
export function observerPanneau(panneau) {
  const maj = () => {
    if (!hote) return;
    if (panneau.classList.contains('replie')) return marger(0, 0);
    const p = panneau.getBoundingClientRect(), h = hote.getBoundingClientRect();
    if (p.width > h.width * 0.7) marger(0, Math.max(0, h.bottom - p.top + 10));
    else marger(Math.max(0, h.right - p.left + 10), 0);
  };
  new ResizeObserver(maj).observe(panneau);
  // Le panneau arrive en glissant : on mesure aussi une fois l'animation finie.
  new MutationObserver(() => { maj(); setTimeout(maj, 380); }).observe(panneau, { attributes: true, attributeFilter: ['class'] });
  panneau.addEventListener('transitionend', maj);
  maj();
}

/**
 * Partie de l'image laissée libre : sous la barre d'outils (t), au-dessus du panneau en bas (b),
 * à gauche du panneau de droite (d). H = hauteur de l'image virtuelle dont le centre tombe au milieu de cette partie.
 */
function zoneLibre() {
  const l = hote.clientWidth, h = hote.clientHeight;
  const barre = hote.parentElement?.querySelector('.barre-3d');
  const t = barre ? Math.min(Math.max(0, barre.getBoundingClientRect().bottom - hote.getBoundingClientRect().top + 6), h * 0.35) : 0;
  const d = Math.min(marges.droite, l * 0.6), b = Math.min(marges.bas, h * 0.6);
  return { l, h, t, d, b, H: h + Math.abs(b - t), decalageY: Math.max(0, b - t) };
}

/** Demi-angles de vue de la partie de l'image que ni la barre ni le panneau ne couvrent. */
function champLibre() {
  const { l, h, t, d, b, H } = zoneLibre();
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanV = tan * Math.max(h - t - b, 1) / H;
  const tanH = tan * Math.max(l - d, 1) / H;
  return { demiV: Math.atan(tanV), demiH: Math.atan(tanH) };
}

function appliquerMarges() {
  if (!camera || !hote) return;
  const { l, h, d, H, decalageY } = zoneLibre();
  if (d > 0 || H !== h) camera.setViewOffset(l + d, H, d, decalageY, l, h);
  else camera.clearViewOffset();
  camera.aspect = (l + d) / H;
  camera.updateProjectionMatrix();
}

/** Angles de vue repris des photos du camion : profil gauche, 3/4 avant gauche, face. */
const VUES = {
  profil: new THREE.Vector3(0, 0.12, -1),
  troisQuarts: new THREE.Vector3(1, 0.32, -0.95),
  face: new THREE.Vector3(1, 0.08, 0),
  libre: new THREE.Vector3(5.8, 2.6, 6.4),
};
let directionVue = VUES.libre.clone();

export function vue(nom) {
  directionVue = (VUES[nom] ?? VUES.libre).clone();
  if (focus) focaliser(null); else vueInitiale();
}
/** Place la caméra pour voir tout le camion (et l'éclaté), quel que soit le format de l'écran. */
function vueInitiale(immediat = false) {
  const rayon = 2.9 + eclatCible * 3.0;
  const { demiV, demiH } = champLibre();
  const distance = rayon / Math.sin(Math.min(demiV, demiH));
  const direction = directionVue.clone().normalize();
  cible.set(eclatCible * 0.45, 0.9 + eclatCible * 1.1, 0);
  camCible.copy(cible).addScaledVector(direction, distance);
  if (immediat) { camera.position.copy(camCible); controles.target.copy(cible); }
  else animationCamera = true;
}

// ---------- Traits de rappel de l'éclaté ----------
// Un trait fin relie chaque pièce écartée à sa place dans le camion, comme sur une planche d'atelier.
let traits = null;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

function creerTraits() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pieces.length * 6), 3));
  traits = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0, depthWrite: false }));
  traits.frustumCulled = false;
  scene.add(traits);
}

function majTraitsDeRappel() {
  if (!traits) return;
  const pos = traits.geometry.attributes.position.array;
  const visible = Math.max(focus ? eclatFocus : eclatGlobal, 0);
  traits.material.opacity = Math.min(0.55, visible * 0.7);
  traits.visible = visible > 0.05;
  if (!traits.visible) return;
  pieces.forEach((p, i) => {
    const g = groupes[p.systeme];
    const montre = !focus || p.systeme === focus;
    // Place d'origine (groupe et pièce en position montée) et place actuelle.
    _a.copy(p.base).add(g.userData.base).add(p.centre);
    p.objet.getWorldPosition(_b).add(p.centre);
    if (!montre || p.systeme === 'carrosserie' && !focus) _b.copy(_a);
    pos.set([_a.x, _a.y, _a.z, _b.x, _b.y, _b.z], i * 6);
  });
  traits.geometry.attributes.position.needsUpdate = true;
}

function boucle(temps = 0) {
  raf = requestAnimationFrame(boucle);
  animerSurbrillance(temps);
  eclatGlobal += (eclatCible - eclatGlobal) * 0.08;
  eclatFocus += ((focus ? 1 : 0) - eclatFocus) * 0.08;

  for (const [id, g] of Object.entries(groupes)) {
    const e = SYSTEMES[id].eclat;
    const t = focus === id ? Math.max(eclatGlobal, 0.35) : eclatGlobal;
    g.position.set(g.userData.base.x + e[0] * t, g.userData.base.y + e[1] * t, g.userData.base.z + e[2] * t);
  }
  // Vrai éclaté : chaque pièce s'écarte aussi de sa place, pas seulement son groupe.
  for (const p of pieces) {
    const t = Math.max(p.systeme === focus ? eclatFocus : 0, focus ? 0 : eclatGlobal * 0.9);
    p.objet.position.copy(p.base).addScaledVector(p.eclatLocal, t);
  }
  majTraitsDeRappel();
  if (animationCamera) {
    controles.target.lerp(cible, 0.08);
    camera.position.lerp(camCible, 0.08);
    if (camera.position.distanceTo(camCible) < 0.01) animationCamera = false;
  }
  controles.update();
  rendu.render(scene, camera);
}

/** Met à jour couleurs et transparences de toutes les pièces. */
function peindre() {
  for (const p of pieces) {
    const estoompe = focus && p.systeme !== focus;
    const fantome = carrosserieFantome && p.systeme === 'carrosserie' && !focus;
    const choisie = selection === p;
    // Pièce choisie : les voisines de sa zone s'effacent à moitié pour qu'elle ressorte.
    const voisine = selection && !choisie && p.systeme === focus;
    p.objet.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (couleursEtat && p.systeme !== 'carrosserie' || couleursEtat && p.organe) {
        const etat = p.organe ? couleursEtat[p.organe] ?? 'neutre' : 'neutre';
        m.color.setHex(COULEURS_ETAT[etat]);
      } else m.color.copy(o.userData.couleur);
      const opacite = estoompe ? 0.07 : voisine ? 0.22 : fantome ? 0.16 : o.userData.opacite;
      m.transparent = opacite < 1 || o.userData.transparent;
      m.opacity = opacite;
      m.depthWrite = opacite > 0.5;
      if (m.emissive) m.emissive.setHex(choisie ? 0x8a5200 : 0x000000);
      o.castShadow = !estoompe;
      // Zone ouverte : on l'isole complètement, comme une pièce sortie du puzzle.
      o.visible = !estoompe;
    });
  }
}

/**
 * Cadre des objets dans la partie de l'image que le panneau laisse libre :
 * chaque coin de leur boîte doit tenir dans le champ, en largeur comme en hauteur
 * (sur téléphone, c'est la largeur qui limite).
 * distance > 2 : une pièce seule, montrée avec un peu de son voisinage.
 */
function cadrer(objets, distance = 1.0) {
  const b = new THREE.Box3();
  objets.forEach(o => b.expandByObject(o));
  if (b.isEmpty()) return;
  if (distance > 2) b.expandByScalar(0.35);
  const centre = b.getCenter(new THREE.Vector3());
  const direction = camera.position.clone().sub(controles.target).normalize();
  if (direction.y < 0.25) direction.y = 0.35;
  direction.normalize();
  const droite = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
  const haut = new THREE.Vector3().crossVectors(direction, droite);
  const { demiV, demiH } = champLibre();
  const tanV = Math.tan(demiV) * 0.9, tanH = Math.tan(demiH) * 0.9;
  let recul = 0.8;
  const c = new THREE.Vector3();
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    c.set(x, y, z).sub(centre);
    const avant = c.dot(direction);
    recul = Math.max(recul, avant + Math.abs(c.dot(droite)) / tanH, avant + Math.abs(c.dot(haut)) / tanV);
  }
  cible.copy(centre);
  camCible.copy(cible).addScaledVector(direction, recul * (distance > 2 ? 1 : distance));
  animationCamera = true;
}

/** Zones du camion, pour les ouvrir directement (le moteur est caché sous la carrosserie). */
export function zones() {
  return Object.entries(SYSTEMES).map(([id, s]) => ({ id, nom: s.nom, pieces: pieces.filter(p => p.systeme === id).length }));
}

/** Relevé pour le débogage du cadrage (console du navigateur). */
export function releveCamera() {
  const b = focus ? new THREE.Box3().setFromObject(groupes[focus]) : null;
  return { focus, marges, champ: champLibre(), boite: b && [b.min.toArray(), b.max.toArray()], camera: camera.position.toArray(), cible: controles.target.toArray(), camCible: camCible.toArray(), distance: camera.position.distanceTo(controles.target) };
}

export function focaliser(systeme) {
  focus = systeme || null;
  selection = null;
  peindre();
  if (focus) {
    // Laisse l'éclatement se faire avant de cadrer.
    // Laisse l'éclatement se faire avant de cadrer, puis affine une fois les pièces arrivées.
    const zone = focus;
    setTimeout(() => { if (focus === zone && !selection) cadrer([groupes[zone]], 1.05); }, 320);
    setTimeout(() => { if (focus === zone && !selection) cadrer([groupes[zone]], 1.05); }, 1100);
    const liste = pieces.filter(p => p.systeme === focus).map(p => ({ cle: p.cle, nom: p.nom, organe: p.organe }));
    dotnet?.invokeMethodAsync('SystemeChoisi', focus, SYSTEMES[focus].nom, liste);
  } else {
    vueInitiale();
    dotnet?.invokeMethodAsync('SystemeChoisi', null, null, []);
  }
}

function choisir(p) {
  if (surbrillance) { const s = surbrillance; surbrillance = null; eteindre(s); }
  selection = p;
  peindre();
  setTimeout(() => cadrer([p.objet], 2.4), 50);
  // La pièce choisie clignote quelques secondes pour qu'on la repère.
  surbrillance = p;
  setTimeout(() => { if (surbrillance === p) { surbrillance = null; eteindre(p); } }, 2600);
  dotnet?.invokeMethodAsync('PieceChoisie', p.cle, p.nom, p.organe);
}

export function choisirPiece(cleOuOrgane) {
  const p = pieces.find(x => x.cle === cleOuOrgane) ?? pieces.find(x => x.organe === cleOuOrgane);
  if (!p) return;
  if (focus !== p.systeme) focaliser(p.systeme);
  setTimeout(() => choisir(p), focus === p.systeme ? 0 : 450);
}

// ---------- Trouver une pièce ----------

/** Toutes les pièces cliquables, pour la recherche. */
export function listePieces() {
  return pieces.map(p => ({ cle: p.cle, nom: p.nom, organe: p.organe, systeme: p.systeme, nomSysteme: SYSTEMES[p.systeme].nom }));
}

// Pièce qui clignote (survol d'une ligne de la liste ou d'un résultat de recherche).
let surbrillance = null;

export function surligner(cle) {
  if (surbrillance && surbrillance !== selection) eteindre(surbrillance);
  surbrillance = pieces.find(p => p.cle === cle) ?? null;
}

function eteindre(p) {
  p.objet.traverse(o => { if (o.isMesh && o.material.emissive) { o.material.emissive.setHex(p === selection ? 0x8a5200 : 0); o.material.emissiveIntensity = 1; } });
}

function animerSurbrillance(temps) {
  if (!surbrillance) return;
  const intensite = 0.55 + 0.45 * Math.sin(temps * 0.008);
  surbrillance.objet.traverse(o => {
    if (!o.isMesh || !o.material.emissive) return;
    o.material.emissive.setHex(0xffb020);
    o.material.emissiveIntensity = intensite;
  });
}

export function eclater(valeur) {
  eclatCible = valeur;
  if (!focus) vueInitiale();
}

export function colorer(etats) { couleursEtat = etats; peindre(); }

export function carrosserie(fantome) { carrosserieFantome = fantome; peindre(); }

export function arreter() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (rendu) { rendu.dispose(); rendu.domElement.remove(); }
  etiquette?.remove();
  pieces.length = 0;
  for (const k of Object.keys(groupes)) delete groupes[k];
  traits = null; surbrillance = null; marges = { droite: 0, bas: 0 };
  focus = null; selection = null; survol = null; eclatGlobal = eclatCible = eclatFocus = 0;
  cible.set(0, 0.9, 0); camCible.set(5.8, 3.0, 6.4);
  rendu = scene = camera = controles = hote = dotnet = etiquette = null;
}
