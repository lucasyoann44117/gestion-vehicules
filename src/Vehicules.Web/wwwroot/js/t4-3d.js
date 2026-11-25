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

// ---------- Cotes du véhicule ----------
const AV = 1.44;          // essieu avant
const AR = -1.48;         // essieu arrière (empattement 2,92 m)
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
  carrosserie: { nom: 'Carrosserie et éclairage', eclat: [0, 2.1, 0] },
  moteur: { nom: 'Moteur 2.5 TDI', eclat: [1.3, 0.7, 0.2] },
  refroidissement: { nom: 'Refroidissement et clim', eclat: [2.3, 0.45, 0] },
  transmission: { nom: 'Boîte et transmission', eclat: [0.7, 0.15, -1.35] },
  trainAvant: { nom: 'Train avant et direction', eclat: [0.9, -0.05, 0] },
  trainArriere: { nom: 'Train arrière', eclat: [-0.9, -0.05, 0] },
  roues: { nom: 'Roues et freins', eclat: [0, 0, 0] },
  freinage: { nom: 'Commande de freinage', eclat: [-0.4, 0.55, -1.6] },
  echappement: { nom: 'Échappement', eclat: [-0.3, 0.05, 1.75] },
  electricite: { nom: 'Électricité et équipements', eclat: [0.2, 1.0, -1.7] },
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
  groupes[systeme].add(objet);
  pieces.push({ cle, nom, organe, systeme, objet, base: objet.position.clone(), eclatLocal: new THREE.Vector3(...eclatLocal) });
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
    placer(boite(0.2, 0.26, 1.9, M.peinture(), 0.08), 2.36, 0.44, 0),
    placer(boite(0.02, 0.05, 0.86, M.noir(), 0.02), 2.465, 0.47, 0),
    placer(boite(0.02, 0.05, 0.86, M.noir(), 0.02), 2.465, 0.40, 0),
  );
  const arriere = placer(boite(0.18, 0.24, 1.9, M.peinture(), 0.08), -2.42, 0.44, 0);
  piece(S, 'pare-chocs', 'Pare-chocs couleur caisse', null, grouper(avant, arriere), [0.15, 0.1, 0]);

  // Calandre couleur caisse à lamelles, sigle VW et monogramme TDI.
  const calandre = new THREE.Group();
  for (let i = 0; i < 4; i++) calandre.add(placer(boite(0.025, 0.022, 0.7, M.noir(), 0.008), 2.4, 0.74 + i * 0.045, 0));
  calandre.add(placer(boite(0.03, 0.2, 0.74, M.peinture(), 0.02), 2.385, 0.81, 0));
  const sigle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 12, 40), M.chrome());
  sigle.rotation.y = Math.PI / 2;
  sigle.position.set(2.425, 0.82, 0);
  calandre.add(sigle, placer(cylindre(0.05, 0.01, M.peinture(), 'x'), 2.42, 0.82, 0));
  calandre.add(placer(boite(0.008, 0.02, 0.09, M.chrome(), 0.004), 2.42, 0.77, 0.18));
  piece(S, 'calandre', 'Calandre', null, calandre, [0.3, 0.15, 0]);

  // Prise d'air sur le capot.
  piece(S, 'prise-air', 'Prise d\'air de capot', null,
    placer(boite(0.1, 0.03, 0.62, M.noir(), 0.012), 1.86, 1.245, 0).rotateZ(-0.33), [0.1, 0.2, 0]);

  // Phares (blocs clairs avec clignotant intégré), antibrouillards, feux arrière.
  const feux = new THREE.Group();
  for (const s of [-1, 1]) {
    feux.add(placer(boite(0.05, 0.16, 0.3, M.phare(), 0.03), 2.4, 0.82, s * 0.55));
    feux.add(placer(boite(0.05, 0.14, 0.11, M.phare(), 0.03), 2.37, 0.82, s * 0.78));
    feux.add(placer(boite(0.04, 0.07, 0.13, M.antibrouillard(), 0.02), 2.455, 0.39, s * 0.66));
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
  const pAv = plaque(); pAv.rotation.y = Math.PI / 2; plaques.add(placer(pAv, 2.468, 0.6, 0.12));
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
  piece(S, 'decors', 'Monogrammes et baguettes', null, decors, [0, 0.3, 0]);

  // Rétroviseurs couleur caisse sur leur bras, poignées de porte noires.
  const retros = new THREE.Group();
  for (const s of [-1, 1]) {
    retros.add(placer(boite(0.06, 0.04, 0.12, M.noir(), 0.015), 1.12, 1.26, s * (Z + 0.05)));
    retros.add(placer(boite(0.09, 0.24, 0.16, M.peinture(), 0.04), 1.08, 1.32, s * (Z + 0.14)));
    retros.add(placer(boite(0.07, 0.07, 0.02, M.noir(), 0.01), 0.62, 1.12, s * (Z + 0.012)));
    retros.add(placer(boite(0.07, 0.07, 0.02, M.noir(), 0.01), 0.16, 1.12, s * (Z + 0.012)));
  }
  piece(S, 'retros', 'Rétroviseurs et poignées', null, retros, [0, 0.1, 0]);

  piece(S, 'faisceau-porte', 'Faisceau de porte AV gauche', 'faisceau-porte-avg',
    tube([[0.95, 0.9, -0.86], [0.8, 0.95, -0.9], [0.55, 1.0, -0.9], [0.4, 0.95, -0.88]], 0.012, M.orangeTr()), [0, 0, -0.4]);
}

function construireMoteur() {
  const S = 'moteur';
  const g = groupes[S];
  g.position.set(1.86, 0.72, 0.08);
  piece(S, 'bloc', 'Bloc moteur 5 cylindres', 'joints-moteur', boite(0.4, 0.34, 0.66, M.fonte(), 0.03), [0, -0.05, 0]);
  piece(S, 'carter', 'Carter et huile moteur', 'huile-moteur', placer(boite(0.36, 0.09, 0.58, M.noir(), 0.02), 0, -0.23, 0), [0, -0.4, 0]);
  piece(S, 'culasse', 'Culasse (arbre à cames, soupapes, joint)', 'culasse', placer(boite(0.38, 0.12, 0.64, M.alu(), 0.02), 0, 0.23, 0), [0, 0.35, 0]);
  piece(S, 'couvre-culasse', 'Couvre-culasse et joints', 'joints-moteur', placer(boite(0.3, 0.06, 0.6, M.noir(), 0.025), 0, 0.32, 0), [0, 0.65, 0]);
  piece(S, 'distribution', 'Kit de distribution', 'distribution', grouper(
    placer(boite(0.4, 0.5, 0.025, M.noir(), 0.04), 0, 0.03, 0.345),
    placer(new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 8, 40), M.gomme()), 0.02, 0.05, 0.37),
  ), [0, 0.05, 0.5]);
  piece(S, 'pompe-eau', 'Pompe à eau', 'pompe-eau', placer(cylindre(0.05, 0.06, M.alu(), 'z'), 0.1, -0.08, 0.36), [0.15, -0.05, 0.42]);
  piece(S, 'alternateur', 'Alternateur', 'alternateur', placer(cylindre(0.075, 0.16, M.alu(), 'z'), 0.27, 0.08, 0.16), [0.42, 0.12, 0.05]);
  piece(S, 'compresseur', 'Compresseur de clim', 'compresseur-clim', placer(cylindre(0.07, 0.18, M.acier(), 'z'), 0.26, -0.14, 0.14), [0.42, -0.18, 0.05]);
  piece(S, 'courroie-acc', 'Courroie et galets d\'accessoires', 'courroie-accessoires',
    tube([[0.05, -0.22, 0.27], [0.3, -0.24, 0.27], [0.36, 0.1, 0.27], [0.24, 0.17, 0.27], [0.04, 0.0, 0.27]], 0.011, M.gomme(), true), [0.25, 0, 0.3]);
  piece(S, 'turbo', 'Turbo', 'turbo', grouper(
    placer(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.035, 12, 30), M.rouille()), 0, 0, 0),
    placer(cylindre(0.04, 0.1, M.rouille(), 'z'), 0, 0, 0.05),
  ), [-0.4, 0.15, 0]).position.set(-0.27, 0.1, -0.12);
  pieces.at(-1).base.copy(pieces.at(-1).objet.position);
  piece(S, 'demarreur', 'Démarreur', 'demarreur', placer(cylindre(0.045, 0.2, M.noir(), 'x'), -0.18, -0.14, -0.38), [-0.3, -0.1, -0.2]);
  piece(S, 'filtre-huile', 'Filtre à huile', 'filtre-huile', placer(cylindre(0.04, 0.1, M.orange()), 0.23, -0.12, -0.2), [0.35, -0.12, -0.1]);
  piece(S, 'filtre-gazole', 'Filtre à gazole', 'filtre-gasoil', placer(cylindre(0.045, 0.13, M.noir()), 0.15, 0.36, 0.22), [0.2, 0.35, 0.1]);
  piece(S, 'filtre-air', 'Boîte à air et filtre', 'filtre-air', placer(boite(0.22, 0.13, 0.28, M.noir(), 0.04), 0.02, 0.44, -0.2), [0, 0.6, -0.2]);
  piece(S, 'pompe-vide', 'Pompe à vide (master vac)', 'pompe-vide', placer(cylindre(0.05, 0.07, M.acier(), 'z'), -0.12, 0.2, -0.37), [-0.2, 0.2, -0.25]);
  piece(S, 'pompe-injection', 'Pompe d\'injection', null, placer(boite(0.12, 0.16, 0.12, M.alu(), 0.02), -0.15, 0.05, 0.25), [-0.3, 0, 0.2]);
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
  piece(S, 'vase', 'Vase d\'expansion', 'liquide-refroidissement', placer(boite(0.12, 0.12, 0.16, M.liquide(), 0.03), -0.35, 0.2, 0.55), [-0.1, 0.3, 0.2]);
}

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
  piece(S, 'ligne', 'Ligne d\'échappement', 'echappement',
    tube([[1.62, 0.62, -0.15], [1.45, 0.4, 0.05], [1.1, 0.27, 0.32], [-0.6, 0.26, 0.4], [-1.7, 0.27, 0.42], [-2.42, 0.3, 0.42]], 0.028, M.rouille()), [0, 0, 0]);
  piece(S, 'catalyseur', 'Catalyseur', 'echappement', placer(cylindre(0.08, 0.38, M.acier(), 'x'), 0.75, 0.27, 0.34), [0, 0.1, 0.15]);
  piece(S, 'silencieux', 'Silencieux arrière', 'echappement', placer(grouper(cylindre(0.13, 0.55, M.acier(), 'x')), -1.95, 0.3, 0.42), [-0.1, 0.1, 0.15]);
  groupes[S].children.at(-1).children[0].scale.set(1, 1, 0.65);
}

function construireElectricite() {
  const S = 'electricite';
  piece(S, 'batterie', 'Batterie 95 Ah', 'batterie', grouper(
    boite(0.28, 0.2, 0.17, M.noir(), 0.015),
    placer(cylindre(0.015, 0.03, M.rouge()), 0.09, 0.11, 0.05),
    placer(cylindre(0.015, 0.03, M.noir()), -0.09, 0.11, 0.05),
  ), [0, 0.15, -0.2]).position.set(0.95, 0.5, -0.5);
  pieces.at(-1).base.copy(pieces.at(-1).objet.position);
  piece(S, 'chauffage', 'Chauffage stationnaire Eberspächer', 'chauffage-stationnaire',
    placer(boite(0.3, 0.12, 0.14, M.noir(), 0.03), 0.3, 0.36, 0.55), [0.2, 0, 0.3]);
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
  for (const g of Object.values(groupes)) g.userData.base.copy(g.position);
}

// ---------- Rendu et interaction ----------

export function demarrer(element, refDotnet) {
  arreter();
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
  controles.maxDistance = 16;
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
  camera.updateProjectionMatrix();
  if (!focus) vueInitiale(true);
}

/** Place la caméra pour voir tout le camion (et l'éclaté), quel que soit le format de l'écran. */
function vueInitiale(immediat = false) {
  const rayon = 2.9 + eclatCible * 1.9;
  const demiV = THREE.MathUtils.degToRad(camera.fov / 2);
  const demiH = Math.atan(Math.tan(demiV) * camera.aspect);
  const distance = rayon / Math.sin(Math.min(demiV, demiH));
  const direction = new THREE.Vector3(5.8, 2.6, 6.4).normalize();
  cible.set(eclatCible * 0.45, 0.9 + eclatCible * 0.5, 0);
  camCible.copy(cible).addScaledVector(direction, distance);
  if (immediat) { camera.position.copy(camCible); controles.target.copy(cible); }
  else animationCamera = true;
}

function boucle() {
  raf = requestAnimationFrame(boucle);
  eclatGlobal += (eclatCible - eclatGlobal) * 0.08;
  eclatFocus += ((focus ? 1 : 0) - eclatFocus) * 0.08;

  for (const [id, g] of Object.entries(groupes)) {
    const e = SYSTEMES[id].eclat;
    const t = focus === id ? Math.max(eclatGlobal, 0.35) : eclatGlobal;
    g.position.set(g.userData.base.x + e[0] * t, g.userData.base.y + e[1] * t, g.userData.base.z + e[2] * t);
  }
  for (const p of pieces) {
    const t = p.systeme === focus ? eclatFocus : 0;
    p.objet.position.copy(p.base).addScaledVector(p.eclatLocal, t);
  }
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
    p.objet.traverse(o => {
      if (!o.isMesh) return;
      const m = o.material;
      if (couleursEtat && p.systeme !== 'carrosserie' || couleursEtat && p.organe) {
        const etat = p.organe ? couleursEtat[p.organe] ?? 'neutre' : 'neutre';
        m.color.setHex(COULEURS_ETAT[etat]);
      } else m.color.copy(o.userData.couleur);
      const opacite = estoompe ? 0.07 : fantome ? 0.16 : o.userData.opacite;
      m.transparent = opacite < 1 || o.userData.transparent;
      m.opacity = opacite;
      m.depthWrite = opacite > 0.5;
      if (m.emissive) m.emissive.setHex(choisie ? 0x8a5200 : 0x000000);
      o.castShadow = !estoompe;
    });
  }
}

function cadrer(objets, distance = 1.0) {
  const boiteEnglobante = new THREE.Box3();
  objets.forEach(o => boiteEnglobante.expandByObject(o));
  const centre = boiteEnglobante.getCenter(new THREE.Vector3());
  const rayon = Math.max(0.5, boiteEnglobante.getSize(new THREE.Vector3()).length() / 2);
  const direction = camera.position.clone().sub(controles.target).normalize();
  if (direction.y < 0.25) direction.y = 0.35;
  direction.normalize();
  // Écran étroit : on recule pour garder la pièce entière, et on la remonte au-dessus du panneau.
  const recul = camera.aspect < 1 ? 1 / Math.max(camera.aspect, 0.5) : 1;
  cible.copy(centre);
  if (hote.clientWidth < 1100) cible.y -= rayon * 0.35;
  camCible.copy(cible).addScaledVector(direction, rayon * 3.1 * distance * recul);
  animationCamera = true;
}

export function focaliser(systeme) {
  focus = systeme || null;
  selection = null;
  peindre();
  if (focus) {
    // Laisse l'éclatement se faire avant de cadrer.
    setTimeout(() => cadrer([groupes[focus]], 1.1), 320);
    const liste = pieces.filter(p => p.systeme === focus).map(p => ({ cle: p.cle, nom: p.nom, organe: p.organe }));
    dotnet?.invokeMethodAsync('SystemeChoisi', focus, SYSTEMES[focus].nom, liste);
  } else {
    vueInitiale();
    dotnet?.invokeMethodAsync('SystemeChoisi', null, null, []);
  }
}

function choisir(p) {
  selection = p;
  peindre();
  setTimeout(() => cadrer([p.objet], 1.6), 50);
  dotnet?.invokeMethodAsync('PieceChoisie', p.cle, p.nom, p.organe);
}

export function choisirPiece(cleOuOrgane) {
  const p = pieces.find(x => x.cle === cleOuOrgane) ?? pieces.find(x => x.organe === cleOuOrgane);
  if (!p) return;
  if (focus !== p.systeme) focaliser(p.systeme);
  setTimeout(() => choisir(p), focus === p.systeme ? 0 : 450);
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
  focus = null; selection = null; survol = null; eclatGlobal = eclatCible = eclatFocus = 0;
  cible.set(0, 0.9, 0); camCible.set(5.8, 3.0, 6.4);
  rendu = scene = camera = controles = hote = dotnet = etiquette = null;
}
