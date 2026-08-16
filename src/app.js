/*
 * Deukjes · Tesla Model Y — 3D schadekaart
 *
 * Bouw met `npm run build` (esbuild bundelt dit bestand samen met three.js en
 * jsPDF tot app.bundle.js). Daardoor heeft de app geen internet nodig: je kunt
 * index.html gewoon openen, ook offline.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { jsPDF } from 'jspdf';

/* =====================================================================
   1. Constanten
   ===================================================================== */

const CAR = { L: 4.751, W: 1.921, H: 1.624, WHEELBASE: 2.89 };
const STORE_KEY = 'tesla-deukjes-v1';

const TYPES = [
  { id: 'deuk',    label: 'Deuk',        color: '#ff5b4a' },
  { id: 'kras',    label: 'Kras',        color: '#ffc23d' },
  { id: 'lak',     label: 'Lakschade',   color: '#4db2ff' },
  { id: 'hagel',   label: 'Hagelschade', color: '#a97bff' },
  { id: 'glas',    label: 'Glas / ster', color: '#37d6c0' },
  { id: 'velg',    label: 'Velg / rand', color: '#8ea2b6' },
  { id: 'overig',  label: 'Overig',      color: '#ff86c8' }
];

const SIZES = [
  { id: 's',  label: 'Klein',  range: '< 1 cm',  radius: 0.045 },
  { id: 'm',  label: 'Middel', range: '1–3 cm',  radius: 0.075 },
  { id: 'l',  label: 'Groot',  range: '3–8 cm',  radius: 0.115 },
  { id: 'xl', label: 'Fors',   range: '> 8 cm',  radius: 0.17 }
];

const typeById = id => TYPES.find(t => t.id === id) || TYPES[0];
const sizeById = id => SIZES.find(s => s.id === id) || SIZES[1];
const sizeText = s => s.label + ' · ' + s.range;
const sizeTextLong = s => s.label + ' (' + s.range + ')';

/* =====================================================================
   2. Opslag (localStorage + import/export)
   ===================================================================== */

const today = () => new Date().toISOString().slice(0, 10);

const state = {
  info: {
    eigenaar: '', kenteken: '', model: 'Tesla Model Y',
    kleur: '', datum: today(), km: '', ingevuld: '', notitie: ''
  },
  marks: [],
  nextNr: 1,
  /* ui */
  addMode: true,
  type: 'deuk',
  size: 'm',
  selected: null,
  xray: false
};

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      info: state.info, marks: state.marks, nextNr: state.nextNr, v: 1
    }));
  } catch (e) { /* privé-modus: gewoon doorgaan */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    adopt(data);
    return true;
  } catch (e) { return false; }
}

function adopt(data) {
  if (!data || typeof data !== 'object') throw new Error('Ongeldig bestand');
  state.info = Object.assign({}, state.info, data.info || {});
  state.marks = Array.isArray(data.marks) ? data.marks.filter(m => m && m.pos) : [];
  state.nextNr = data.nextNr || (state.marks.reduce((a, m) => Math.max(a, m.nr || 0), 0) + 1);
}

const saveSoon = (() => {
  let t = null;
  return () => { clearTimeout(t); t = setTimeout(save, 250); };
})();

/* =====================================================================
   3. Carrosserie-wiskunde
   Het model wordt volledig parametrisch opgebouwd: voor elke positie t
   over de lengte kennen we de daklijn, de bodem, de halve breedte en de
   gordellijn. Daarmee ontstaat een gesloten oppervlak met de verhoudingen
   van een Model Y (4,75 × 1,92 × 1,62 m).
   ===================================================================== */

function pchip(xs, ys) {
  const n = xs.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; }
    else {
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
         + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

/* t = 0 achterbumper … t = 1 voorbumper.
   De hoogtes komen uit het zijaanzicht van de Model Y: korte neus, sterk
   hellende voorruit, dak dat piekt boven de B-stijl en een fastback-staart. */
const fTop  = pchip([0, .02, .05, .09, .14, .20, .28, .374, .468, .532, .58, .62, .665, .711, .816, .921, .97, 1],
                    [1.15, 1.24, 1.33, 1.41, 1.48, 1.53, 1.565, 1.59, 1.60, 1.59, 1.55, 1.48, 1.34, 1.19, 1.06, .95, .90, .86]);
const fBot  = pchip([0, .03, .10, .30, .70, .90, .97, 1],
                    [.50, .34, .29, .275, .275, .29, .34, .50]);
const fHalf = pchip([0, .03, .09, .18, .30, .45, .62, .75, .86, .95, 1],
                    [.55, .75, .86, .925, .955, .961, .955, .93, .88, .76, .55]);
const fBelt = pchip([0, .10, .20, .45, .62, .72, .85, 1],
                    [1.06, 1.03, 1.02, 1.00, 1.00, 1.06, 1.10, 1.13]);

const EXP = 3.8;          /* superellips: 2 = ovaal, hoger = blokkiger */
const CAP = 0.05;         /* lengte van de afronding aan neus en kont */
const CAP_EXP = 3.2;      /* hoe stomp die afronding is: hoger = botter */

function capFactor(t) {
  let s;
  if (t < CAP) s = t / CAP;
  else if (t > 1 - CAP) s = (1 - t) / CAP;
  else return 1;
  s = Math.min(1, Math.max(0, s));
  return Math.pow(1 - Math.pow(1 - s, CAP_EXP), 1 / CAP_EXP);
}

function surfacePoint(t, u, out) {
  t = Math.min(1, Math.max(0, t));
  const c = capFactor(t);
  const yTop = fTop(t), yBot = fBot(t);
  const yc = (yTop + yBot) / 2;
  const hy = (yTop - yBot) / 2 * c;
  const hz = fHalf(t) * c;
  const p = 2 / EXP;
  const cu = Math.cos(u), su = Math.sin(u);
  let z = hz * Math.sign(cu) * Math.pow(Math.abs(cu), p);
  let y = yc + hy * Math.sign(su) * Math.pow(Math.abs(su), p);
  /* het "greenhouse" (alles boven de gordellijn) versmalt naar het dak toe */
  const belt = fBelt(t);
  if (y > belt) {
    const k = Math.min(1, (y - belt) / Math.max(.001, CAR.H - belt));
    z *= 1 - 0.32 * k * k;
  }
  /* dorpel: onderin trekt de flank weer naar binnen, zodat de wielen
     zichtbaar blijven en de auto niet als een zeepblok oogt */
  const SILL = 0.56;
  if (y < SILL) {
    const k = Math.min(1, (SILL - y) / 0.30);
    z *= 1 - 0.20 * k * k;
  }
  return out.set((t - 0.5) * CAR.L, y, z);
}

const _pa = new THREE.Vector3(), _pb = new THREE.Vector3();
const _du = new THREE.Vector3(), _dt = new THREE.Vector3();

function surfaceNormal(t, u, out) {
  const h = 0.0015;
  surfacePoint(t, u + h, _pa); surfacePoint(t, u - h, _pb);
  _du.subVectors(_pa, _pb);
  surfacePoint(Math.min(1, t + h), u, _pa); surfacePoint(Math.max(0, t - h), u, _pb);
  _dt.subVectors(_pa, _pb);
  out.crossVectors(_dt, _du);
  if (out.lengthSq() < 1e-12) { out.set(t < .5 ? -1 : 1, 0, 0); return out; }
  out.normalize();
  /* naar buiten laten wijzen t.o.v. de hartlijn van de doorsnede */
  surfacePoint(t, u, _pa);
  const yc = (fTop(t) + fBot(t)) / 2;
  _pb.set(0, _pa.y - yc, _pa.z);
  if (out.dot(_pb) < 0) out.multiplyScalar(-1);
  return out;
}

/* zoekt de u-hoek waar het oppervlak op hoogte y zit (voor lijnen op de flank) */
function findU(t, y, side) {
  const base = side > 0 ? 0 : Math.PI;
  const dir = side > 0 ? 1 : -1;
  const p = new THREE.Vector3();
  let lo = -0.48 * Math.PI, hi = 0.48 * Math.PI, prev = null, a = null, b = null;
  const N = 48;
  for (let i = 0; i <= N; i++) {
    const uu = lo + (hi - lo) * i / N;
    surfacePoint(t, base + dir * uu, p);
    if (prev !== null && ((prev.y - y) * (p.y - y) <= 0)) { a = lo + (hi - lo) * (i - 1) / N; b = uu; break; }
    prev = prev || new THREE.Vector3();
    prev.copy(p);
  }
  if (a === null) return null;
  for (let i = 0; i < 18; i++) {
    const mid = (a + b) / 2;
    surfacePoint(t, base + dir * mid, p);
    if (p.y < y) a = mid; else b = mid;
  }
  return base + dir * (a + b) / 2;
}

/* =====================================================================
   4. 3D-scène
   ===================================================================== */

const canvas = document.getElementById('scene');
let renderer, scene, camera, controls, carGroup, bodyMesh, glassMesh, markerGroup;
let groundGroup, wireOverlay;

/* draaipunt: midden van de auto, iets boven de gordellijn */
const PIVOT = new THREE.Vector3(0, 0.86, 0);
/* straal van de bol waar de hele auto in past */
const FIT_RADIUS = 2.75;

/* afstand waarop de auto precies in beeld past bij de huidige schermverhouding */
function fitDistance() {
  const vFov = camera.fov * Math.PI / 180;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  return FIT_RADIUS / Math.sin(Math.min(vFov, hFov) / 2) * 1.05;
}

function resetView() {
  const dir = new THREE.Vector3(0.92, 0.42, 0.86).normalize();
  camera.position.copy(PIVOT).addScaledVector(dir, fitDistance());
  controls.target.copy(PIVOT);
  controls.update();
}

function boot() {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e12);

  camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(5.2, 2.6, 5.6);

  controls = new OrbitControls(camera, canvas);
  controls.target.copy(PIVOT);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.85;
  controls.minDistance = 2.6;
  controls.maxPolarAngle = Math.PI * 0.502;
  controls.minPolarAngle = 0.05;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  addLights();
  groundGroup = buildGround();
  scene.add(groundGroup);

  carGroup = new THREE.Group();
  scene.add(carGroup);
  buildCar();

  markerGroup = new THREE.Group();
  carGroup.add(markerGroup);

  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 260));
  controls.maxDistance = fitDistance() * 1.8;
  resetView();
  onResize();
  renderer.setAnimationLoop(tick);
}

function addLights() {
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x0d1116, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(5, 8, 6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  fill.position.set(-6, 4, -5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7);
  rim.position.set(0, 3, -9);
  scene.add(rim);
}

function buildGround() {
  const g = new THREE.Group();

  const grid = new THREE.GridHelper(40, 40, 0x2a3442, 0x1a2028);
  g.add(grid);

  /* zachte schaduwvlek onder de auto */
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 126);
  grad.addColorStop(0, 'rgba(0,0,0,.55)');
  grad.addColorStop(.6, 'rgba(0,0,0,.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(CAR.L * 1.25, CAR.W * 1.9),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.005;
  g.add(shadow);
  return g;
}

function buildCar() {
  const NT = 132, NU = 80;

  /* --- carrosserie --- */
  const pos = [], nor = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i <= NT; i++) {
    const t = i / NT;
    const pole = capFactor(t) < 1e-6;
    for (let j = 0; j <= NU; j++) {
      const u = (j / NU) * Math.PI * 2;
      surfacePoint(t, u, p);
      pos.push(p.x, p.y, p.z);
      if (pole) { nor.push(t < 0.5 ? -1 : 1, 0, 0); }
      else { surfaceNormal(t, u, n); nor.push(n.x, n.y, n.z); }
    }
  }
  for (let i = 0; i < NT; i++) {
    for (let j = 0; j < NU; j++) {
      const a = i * (NU + 1) + j, b = a + NU + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  bodyGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  bodyGeo.setIndex(idx);
  bodyGeo.computeBoundingSphere();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xd7dde5, metalness: 0.28, roughness: 0.46,
    transparent: true, opacity: 1, depthWrite: true
  });
  bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.name = 'body';
  bodyMesh.userData.pickable = true;
  carGroup.add(bodyMesh);

  /* fijne draadstructuur over de carrosserie: geeft de technische look */
  const wireGeo = buildWireGeometry(18, 22);
  wireOverlay = new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({
    color: 0x8fa3b8, transparent: true, opacity: 0.16
  }));
  carGroup.add(wireOverlay);

  /* --- glas: alles boven de gordellijn tussen A- en D-stijl,
         inclusief het panoramadak van de Model Y --- */
  glassMesh = buildGlass();
  carGroup.add(glassMesh);

  /* --- panelnaden, gordellijn en wielkasten --- */
  carGroup.add(buildPanelLines());

  /* --- wielen --- */
  buildWheels().forEach(w => carGroup.add(w));

  /* --- verlichting (plaatsing gebeurt met raycasts op de carrosserie) --- */
  carGroup.updateMatrixWorld(true);
  buildLights().forEach(l => carGroup.add(l));
}

function buildWireGeometry(nt, nu) {
  const pts = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const off = 0.004;
  const nrm = new THREE.Vector3();
  const push = (t1, u1, t2, u2) => {
    surfacePoint(t1, u1, a); surfaceNormal(t1, u1, nrm); a.addScaledVector(nrm, off);
    surfacePoint(t2, u2, b); surfaceNormal(t2, u2, nrm); b.addScaledVector(nrm, off);
    pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
  };
  /* niet tot in de punt doorlopen: daar vallen alle lijnen samen in één punt */
  const T0 = 0.035, T1 = 0.965;
  for (let i = 1; i < nt; i++) {
    const t = T0 + (T1 - T0) * i / nt;
    for (let j = 0; j < nu * 3; j++) {
      push(t, (j / (nu * 3)) * Math.PI * 2, t, ((j + 1) / (nu * 3)) * Math.PI * 2);
    }
  }
  for (let j = 0; j < nu; j++) {
    const u = (j / nu) * Math.PI * 2;
    for (let i = 0; i < nt * 3; i++) {
      push(T0 + (T1 - T0) * i / (nt * 3), u, T0 + (T1 - T0) * (i + 1) / (nt * 3), u);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/* De ruiten (voorruit, zijruiten, panoramadak en achterruit vormen bij de
   Model Y één doorlopende band) lopen van gordellijn naar gordellijn over het
   dak heen. Door precies op die lijn te beginnen krijgt de rand geen trapjes. */
function buildGlass() {
  const NT = 96, NU = 44;
  const T0 = 0.105, T1 = 0.80;
  const pos = [], nor = [], idx = [];
  const p = new THREE.Vector3(), n = new THREE.Vector3();
  const rows = [];

  for (let i = 0; i <= NT; i++) {
    const t = T0 + (T1 - T0) * i / NT;
    const belt = fBelt(t);
    if (fTop(t) < belt + 0.07) { rows.push(-1); continue; }
    const uA = findU(t, belt, 1), uB = findU(t, belt, -1);
    if (uA === null || uB === null) { rows.push(-1); continue; }
    rows.push(pos.length / 3);
    for (let j = 0; j <= NU; j++) {
      const u = uA + (uB - uA) * j / NU;
      surfacePoint(t, u, p);
      surfaceNormal(t, u, n);
      p.addScaledVector(n, 0.008);
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < NT; i++) {
    if (rows[i] < 0 || rows[i + 1] < 0) continue;
    for (let j = 0; j < NU; j++) {
      const a = rows[i] + j, b = rows[i + 1] + j;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x243040, metalness: 0.5, roughness: 0.12,
    transparent: true, opacity: 0.86, side: THREE.DoubleSide
  });
  const m = new THREE.Mesh(g, mat);
  m.name = 'glass';
  m.userData.pickable = true;
  return m;
}

function curveFromParams(list, offset = 0.006) {
  const p = new THREE.Vector3(), n = new THREE.Vector3(), out = [];
  for (const [t, u] of list) {
    surfacePoint(t, u, p);
    surfaceNormal(t, u, n);
    out.push(p.clone().addScaledVector(n, offset));
  }
  return out;
}

function buildPanelLines() {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x39434f, transparent: true, opacity: 0.95 });
  const add = pts => {
    if (pts.length < 2) return;
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  };
  const xToT = x => x / CAR.L + 0.5;

  /* deurnaden + motorkap + achterklep, als doorsnede over de flank */
  const shuts = [
    { x: 0.75,  from: -0.30, to: 0.40 },   /* voorportier – voorkant  */
    { x: -0.15, from: -0.30, to: 0.44 },   /* B-stijl                  */
    { x: -1.15, from: -0.30, to: 0.40 },   /* achterportier – achter   */
    { x: 1.02,  from: -0.14, to: 0.50 },   /* motorkap                 */
    { x: -1.55, from: -0.12, to: 0.50 }    /* achterklep               */
  ];
  for (const s of shuts) {
    const t = xToT(s.x);
    for (const side of [1, -1]) {
      const pts = [];
      const steps = 46;
      for (let i = 0; i <= steps; i++) {
        const k = s.from + (s.to - s.from) * i / steps;
        const u = side > 0 ? k * Math.PI : Math.PI - k * Math.PI;
        pts.push([t, u]);
      }
      add(curveFromParams(pts));
    }
  }

  /* gordellijn over de volledige flank */
  for (const side of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 90; i++) {
      const t = 0.045 + (0.955 - 0.045) * i / 90;
      const u = findU(t, fBelt(t), side);
      if (u !== null) pts.push([t, u]);
    }
    add(curveFromParams(pts));
  }

  /* wielkasten */
  const axles = [CAR.WHEELBASE / 2, -CAR.WHEELBASE / 2];
  for (const ax of axles) {
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI * (i / 40);
        const x = ax + Math.cos(a) * 0.50;
        const y = 0.38 + Math.sin(a) * 0.50;
        const t = xToT(x);
        if (t < 0.02 || t > 0.98) continue;
        const u = findU(t, y, side);
        if (u !== null) pts.push([t, u]);
      }
      add(curveFromParams(pts));
    }
  }
  return group;
}

function buildWheels() {
  const out = [];
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.9, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x8d97a3, roughness: 0.35, metalness: 0.85 });
  for (const x of [CAR.WHEELBASE / 2, -CAR.WHEELBASE / 2]) {
    for (const z of [1, -1]) {
      const g = new THREE.Group();
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.372, 0.372, 0.26, 40), tyreMat);
      tyre.rotation.x = Math.PI / 2;
      g.add(tyre);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.268, 32), rimMat);
      rim.rotation.x = Math.PI / 2;
      g.add(rim);
      g.position.set(x, 0.372, z * 0.80);
      g.name = 'wheel';
      out.push(g);
    }
  }
  return out;
}

/* koplampen en achterlichten: we schieten een straal van buitenaf op de
   carrosserie en plakken het vlakje op het raakpunt, haaks op het oppervlak. */
function decalOnBody(w, h, color, emissive, from, dir) {
  const rc = new THREE.Raycaster(new THREE.Vector3().fromArray(from), new THREE.Vector3().fromArray(dir).normalize());
  const hit = rc.intersectObject(bodyMesh, false)[0];
  if (!hit) return null;
  const n = hit.face.normal.clone().normalize();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: 0.5, roughness: 0.22, metalness: 0.2,
      transparent: true, opacity: 0.96, side: THREE.DoubleSide
    })
  );
  mesh.position.copy(hit.point).addScaledVector(n, 0.012);
  /* het vlakje volgt het oppervlak, maar blijft waterpas i.p.v. mee te kantelen */
  const ax = new THREE.Vector3(0, 1, 0).cross(n).normalize();
  const ay = new THREE.Vector3().crossVectors(n, ax).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ax, ay, n));
  return mesh;
}

function buildLights() {
  const out = [];
  for (const s of [1, -1]) {
    out.push(decalOnBody(0.30, 0.10, 0xf2f6ff, 0x8fb0ff, [4, 0.94, s * 0.40], [-1, 0, 0]));
    out.push(decalOnBody(0.30, 0.09, 0xff3b30, 0x6e0c09, [-4, 1.02, s * 0.44], [1, 0, 0]));
  }
  return out.filter(Boolean);
}

/* =====================================================================
   5. Markeringen in 3D
   ===================================================================== */

const labelCache = new Map();

function labelTexture(nr, color) {
  const key = nr + '|' + color;
  if (labelCache.has(key)) return labelCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 8; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 68px -apple-system, Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(nr), 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  labelCache.set(key, tex);
  return tex;
}

function buildMarkerObject(m) {
  const type = typeById(m.type);
  const col = new THREE.Color(type.color);
  const r = sizeById(m.size).radius;
  const pos = new THREE.Vector3(m.pos.x, m.pos.y, m.pos.z);
  const nrm = new THREE.Vector3(m.nrm.x, m.nrm.y, m.nrm.z).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);

  const g = new THREE.Group();
  g.userData.markId = m.id;
  g.userData.normal = nrm.clone();

  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(r, 28),
    new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
  );
  disc.position.copy(pos).addScaledVector(nrm, 0.006);
  disc.quaternion.copy(quat);
  disc.userData.markId = m.id;
  g.add(disc);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(r * 1.12, r * 1.45, 36),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
  );
  ring.position.copy(pos).addScaledVector(nrm, 0.007);
  ring.quaternion.copy(quat);
  ring.userData.markId = m.id;
  g.add(ring);

  const stemLen = 0.26;
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, stemLen, 8),
    new THREE.MeshBasicMaterial({ color: col })
  );
  stem.position.copy(pos).addScaledVector(nrm, stemLen / 2 + 0.005);
  stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nrm);
  g.add(stem);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: labelTexture(m.nr, type.color), depthTest: true, transparent: true, sizeAttenuation: true
  }));
  sprite.position.copy(pos).addScaledVector(nrm, stemLen + 0.09);
  sprite.scale.setScalar(0.2);
  sprite.userData.markId = m.id;
  g.add(sprite);

  /* onzichtbaar, ruim aanraakvlak */
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.11, r * 1.7), 10, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.copy(pos).addScaledVector(nrm, 0.05);
  hit.userData.markId = m.id;
  g.add(hit);
  const hit2 = hit.clone();
  hit2.position.copy(sprite.position);
  hit2.userData.markId = m.id;
  g.add(hit2);

  if (state.selected === m.id) {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.7, r * 2.15, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 })
    );
    halo.position.copy(pos).addScaledVector(nrm, 0.008);
    halo.quaternion.copy(quat);
    g.add(halo);
  }
  return g;
}

function rebuildMarkers() {
  if (!markerGroup) return;
  for (let i = markerGroup.children.length - 1; i >= 0; i--) {
    const c = markerGroup.children[i];
    c.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      /* de nummertextures worden hergebruikt en blijven dus staan */
      if (o.material) o.material.dispose();
    });
    markerGroup.remove(c);
  }
  state.marks.forEach(m => markerGroup.add(buildMarkerObject(m)));
}

/* =====================================================================
   6. Paneelherkenning – vertaalt een 3D-punt naar een werkplaatsnaam
   ===================================================================== */

function sideName(z) {
  if (z > 0.30) return 'rechts';
  if (z < -0.30) return 'links';
  return 'midden';
}

function panelName(pos, nrm) {
  const x = pos.x, y = pos.y, z = pos.z;
  const side = sideName(z);
  const flat = Math.abs(nrm.y) > 0.55;        /* horizontaal vlak    */
  const glass = y > fBelt(x / CAR.L + 0.5) + 0.02 && x > -1.85 && x < 1.15;

  if (x >= 1.90) return y > 1.00 ? 'Motorkap voorrand' : 'Voorbumper' + (side === 'midden' ? '' : ' ' + side);
  if (x <= -1.95) return y > 0.95 ? 'Achterklep onder' : 'Achterbumper' + (side === 'midden' ? '' : ' ' + side);

  if (glass) {
    if (x > 0.62) return 'Voorruit';
    if (x < -1.20) return 'Achterruit';
    if (flat && y > 1.44) return 'Panoramadak';
    return 'Zijruit ' + (x > -0.09 ? 'voor ' : 'achter ') + side;
  }

  if (x > 1.12) return flat ? 'Motorkap' + (side === 'midden' ? '' : ' ' + side) : 'Voorscherm ' + side;
  if (x > 0.80) return 'Voorscherm ' + side;
  if (x > -0.09) return y < 0.55 ? 'Dorpel voor ' + side : 'Portier voor ' + side;
  if (x > -1.02) return y < 0.55 ? 'Dorpel achter ' + side : 'Portier achter ' + side;
  if (x > -1.62) return 'Achterscherm ' + side;
  return flat ? 'Achterklep' : 'Achterklep ' + side;
}

/* =====================================================================
   7. Aanraken: draaien vs. markeren
   ===================================================================== */

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let down = null;

canvas.addEventListener('pointerdown', e => {
  if (!e.isPrimary) { down = null; return; }
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
});

canvas.addEventListener('pointerup', e => {
  if (!down || !e.isPrimary) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  const moved = Math.hypot(dx, dy);
  const dt = performance.now() - down.t;
  down = null;
  if (moved > 9 || dt > 600) return;      /* dat was slepen, geen tik */
  handleTap(e.clientX, e.clientY);
});

function handleTap(cx, cy) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  /* eerst kijken of we een bestaande markering raken */
  const markHits = raycaster.intersectObjects(markerGroup.children, true);
  if (markHits.length) {
    const id = markHits[0].object.userData.markId;
    if (id) { openMark(id); return; }
  }

  if (!state.addMode) return;

  const hits = raycaster.intersectObjects([bodyMesh, glassMesh], false);
  if (!hits.length) { toast('Tik op de auto zelf om een deukje te zetten'); return; }

  const hit = hits[0];
  const nrm = hit.face
    ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    : new THREE.Vector3(0, 1, 0);
  addMark(hit.point.clone(), nrm);
}

function addMark(point, nrm) {
  const local = carGroup.worldToLocal(point.clone());
  const m = {
    id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nr: state.nextNr++,
    pos: { x: +local.x.toFixed(4), y: +local.y.toFixed(4), z: +local.z.toFixed(4) },
    nrm: { x: +nrm.x.toFixed(4), y: +nrm.y.toFixed(4), z: +nrm.z.toFixed(4) },
    type: state.type,
    size: state.size,
    panel: panelName(local, nrm),
    note: '',
    ts: new Date().toISOString()
  };
  state.marks.push(m);
  state.selected = m.id;
  rebuildMarkers();
  refreshChrome();
  save();
  if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
  toast('#' + m.nr + ' · ' + m.panel);
}

/* =====================================================================
   8. Render-lus
   ===================================================================== */

function onResize() {
  const w = innerWidth, h = innerHeight;
  const before = fitDistance();
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  /* zelfde beelduitsnede houden als het scherm draait of van formaat verandert */
  const ratio = fitDistance() / before;
  if (isFinite(ratio) && ratio > 0 && Math.abs(ratio - 1) > 0.001) {
    const off = camera.position.clone().sub(controls.target).multiplyScalar(ratio);
    camera.position.copy(controls.target).add(off);
  }
  controls.maxDistance = fitDistance() * 1.8;
  controls.update();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(w, h, false);
}

function tick() {
  controls.update();
  renderer.render(scene, camera);
}

/* =====================================================================
   9. Interface
   ===================================================================== */

const $ = sel => document.querySelector(sel);
const el = (tag, props = {}, kids = []) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  (Array.isArray(kids) ? kids : [kids]).forEach(k => k && n.append(k));
  return n;
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2100);
}

function buildChips() {
  const tr = $('#typeRow');
  tr.innerHTML = '';
  TYPES.forEach(t => {
    const b = el('button', { className: 'chip' + (state.type === t.id ? ' on' : '') });
    b.style.color = state.type === t.id ? t.color : '';
    b.append(el('i', { className: 'dot' }), document.createTextNode(t.label));
    b.querySelector('.dot').style.background = t.color;
    b.onclick = () => { state.type = t.id; buildChips(); };
    tr.append(b);
  });
  const sr = $('#sizeRow');
  sr.innerHTML = '';
  SIZES.forEach(s => {
    const b = el('button', { className: 'chip' + (state.size === s.id ? ' on' : ''), textContent: sizeText(s) });
    b.onclick = () => { state.size = s.id; buildChips(); };
    sr.append(b);
  });
}

function refreshChrome() {
  const n = state.marks.length;
  const sub = $('#subtitle');
  const parts = [];
  if (state.info.kenteken) parts.push(state.info.kenteken.toUpperCase());
  parts.push(n === 0 ? 'Nog geen schade gemarkeerd' : n + (n === 1 ? ' markering' : ' markeringen'));
  sub.textContent = parts.join(' · ');
  $('#modeLabel').textContent = state.addMode ? 'Markeren aan' : 'Alleen draaien';
  $('#btnMode').classList.toggle('primary', state.addMode);
  $('#btnXray').classList.toggle('on', state.xray);
}

/* ---- sheet ---- */
function openSheet(title, nodes) {
  $('#sheetTitle').textContent = title;
  const body = $('#sheetBody');
  body.innerHTML = '';
  (Array.isArray(nodes) ? nodes : [nodes]).forEach(n => n && body.append(n));
  $('#sheet').classList.add('open');
  $('#scrim').classList.add('open');
}
function closeSheet() {
  $('#sheet').classList.remove('open');
  $('#scrim').classList.remove('open');
  if (state.selected) { state.selected = null; rebuildMarkers(); }
}
$('#scrim').onclick = closeSheet;
$('#sheetClose').onclick = closeSheet;

/* ---- markering bewerken ---- */
function openMark(id) {
  const m = state.marks.find(x => x.id === id);
  if (!m) return;
  state.selected = id;
  rebuildMarkers();

  const typeSel = el('select');
  TYPES.forEach(t => typeSel.append(el('option', { value: t.id, textContent: t.label, selected: t.id === m.type })));
  typeSel.onchange = () => { m.type = typeSel.value; rebuildMarkers(); saveSoon(); };

  const sizeSel = el('select');
  SIZES.forEach(s => sizeSel.append(el('option', { value: s.id, textContent: sizeText(s), selected: s.id === m.size })));
  sizeSel.onchange = () => { m.size = sizeSel.value; rebuildMarkers(); saveSoon(); };

  const panel = el('input', { type: 'text', value: m.panel });
  panel.oninput = () => { m.panel = panel.value; saveSoon(); };

  const note = el('textarea', { value: m.note, placeholder: 'Bijv. "vanaf 2 m zichtbaar", "lak niet beschadigd", "van winkelwagen"' });
  note.oninput = () => { m.note = note.value; saveSoon(); };

  const del = el('button', { className: 'bigbtn', textContent: 'Verwijderen' });
  del.style.color = '#ff6b6b';
  del.onclick = () => {
    state.marks = state.marks.filter(x => x.id !== id);
    state.selected = null;
    rebuildMarkers(); refreshChrome(); save(); closeSheet();
    toast('Markering verwijderd');
  };

  openSheet('Markering #' + m.nr, [
    el('label', { className: 'field' }, [document.createTextNode('Plek op de auto'), panel]),
    el('div', { className: 'grid2' }, [
      el('label', { className: 'field' }, [document.createTextNode('Soort schade'), typeSel]),
      el('label', { className: 'field' }, [document.createTextNode('Grootte'), sizeSel])
    ]),
    el('label', { className: 'field' }, [document.createTextNode('Notitie voor de reparateur'), note]),
    del
  ]);
}

/* ---- lijst ---- */
function openList() {
  const wrap = el('div', { className: 'body' });
  wrap.style.padding = '0';
  if (!state.marks.length) {
    wrap.append(el('p', { className: 'empty', textContent: 'Nog niets gemarkeerd. Zet "Markeren aan" en tik op de auto waar een deukje zit.' }));
  } else {
    state.marks.forEach(m => {
      const t = typeById(m.type);
      const num = el('div', { className: 'num', textContent: String(m.nr) });
      num.style.background = t.color;
      const txt = el('div', { className: 'txt' }, [
        el('b', { textContent: m.panel }),
        el('span', { textContent: t.label + ' · ' + sizeText(sizeById(m.size)) + (m.note ? ' · ' + m.note : '') })
      ]);
      const del = el('button', { className: 'del', innerHTML: '&times;' });
      del.onclick = ev => {
        ev.stopPropagation();
        state.marks = state.marks.filter(x => x.id !== m.id);
        rebuildMarkers(); refreshChrome(); save(); openList();
      };
      const item = el('div', { className: 'listitem' }, [num, txt, del]);
      item.onclick = () => { focusMark(m); openMark(m.id); };
      wrap.append(item);
    });
  }
  openSheet('Schadelijst (' + state.marks.length + ')', wrap);
}

function focusMark(m) {
  /* de auto blijft gecentreerd; we draaien hem zo dat de markering
     recht naar de kijker toe wijst */
  const dir = new THREE.Vector3(m.nrm.x, m.nrm.y, m.nrm.z).normalize();
  dir.y += 0.25;
  /* recht van boven kijken geeft een onbruikbaar beeld: altijd iets opzij */
  if (Math.hypot(dir.x, dir.z) < 0.3) { dir.x += 0.55; dir.z += 0.35; }
  dir.normalize();
  controls.target.copy(PIVOT);
  camera.position.copy(PIVOT).addScaledVector(dir, fitDistance() * 0.92);
  camera.up.set(0, 1, 0);
  controls.update();
}

/* ---- autogegevens ---- */
function openInfo() {
  const f = (key, label, type = 'text', ph = '') => {
    const inp = el('input', { type, value: state.info[key] || '', placeholder: ph });
    inp.oninput = () => { state.info[key] = inp.value; saveSoon(); refreshChrome(); };
    return el('label', { className: 'field' }, [document.createTextNode(label), inp]);
  };
  const notes = el('textarea', { value: state.info.notitie || '', placeholder: 'Algemene opmerkingen voor de reparateur' });
  notes.oninput = () => { state.info.notitie = notes.value; saveSoon(); };

  openSheet('Autogegevens', [
    el('div', { className: 'grid2' }, [f('kenteken', 'Kenteken', 'text', 'X-123-XX'), f('kleur', 'Kleur', 'text', 'Midnight Silver')]),
    el('div', { className: 'grid2' }, [f('model', 'Model'), f('km', 'Kilometerstand', 'text', '42.000')]),
    el('div', { className: 'grid2' }, [f('eigenaar', 'Eigenaar'), f('ingevuld', 'Ingevuld door')]),
    f('datum', 'Datum opname', 'date'),
    el('label', { className: 'field' }, [document.createTextNode('Algemene notitie'), notes]),
    el('p', { className: 'note', textContent: 'Alles wordt automatisch op dit apparaat bewaard en komt bovenaan het rapport te staan.' })
  ]);
}

/* =====================================================================
   10. Exporteren – JPG en PDF
   ===================================================================== */

const VIEWS = [
  { id: 'links',  title: 'Linkerzijde',   hint: 'voorkant links',  ortho: true,  pos: [0, 0.85, -12],   span: 5.5, up: [0, 1, 0] },
  { id: 'rechts', title: 'Rechterzijde',  hint: 'voorkant rechts', ortho: true,  pos: [0, 0.85, 12],    span: 5.5, up: [0, 1, 0] },
  { id: 'voor',   title: 'Voorkant',      hint: 'recht van voren', ortho: true,  pos: [12, 0.85, 0],    span: 3.3, up: [0, 1, 0] },
  { id: 'achter', title: 'Achterkant',    hint: 'recht van achteren', ortho: true, pos: [-12, 0.85, 0], span: 3.3, up: [0, 1, 0] },
  { id: 'boven',  title: 'Bovenaanzicht', hint: 'voorkant links',  ortho: true,  pos: [0, 12, 0],       span: 5.5, up: [0, 0, 1] },
  { id: 'schuin', title: 'Overzicht',     hint: 'linksvoor',       ortho: false, pos: [4.9, 2.7, -4.7], span: 0,   up: [0, 1, 0] }
];

function setExportLook(on) {
  scene.background = new THREE.Color(on ? 0xffffff : 0x0b0e12);
  groundGroup.visible = !on;
  wireOverlay.material.opacity = on ? 0.22 : 0.16;
  wireOverlay.material.color.set(on ? 0x7d8ea1 : 0x8fa3b8);
  bodyMesh.material.opacity = on ? 1 : (state.xray ? 0.32 : 1);
  bodyMesh.material.depthWrite = on ? true : !state.xray;
  bodyMesh.material.color.set(on ? 0xe9edf2 : 0xd7dde5);
  glassMesh.material.opacity = on ? 0.7 : (state.xray ? 0.3 : 0.86);
}

/* markeringen die van de camera weg wijzen verbergen we in het aanzicht */
function applyViewVisibility(camPos, target) {
  const dir = new THREE.Vector3().subVectors(target, camPos).normalize();
  markerGroup.children.forEach(g => {
    const n = g.userData.normal;
    g.visible = !n || n.dot(dir) < -0.12;
  });
}
function showAllMarkers() { markerGroup.children.forEach(g => (g.visible = true)); }

function renderView(view, W, H) {
  const target = new THREE.Vector3(0, 0.82, 0);
  const camPos = new THREE.Vector3().fromArray(view.pos);
  let cam;
  if (view.ortho) {
    const halfW = view.span / 2, halfH = halfW * H / W;
    cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 60);
  } else {
    cam = new THREE.PerspectiveCamera(34, W / H, 0.1, 60);
  }
  cam.position.copy(camPos);
  cam.up.fromArray(view.up);
  cam.lookAt(target);
  cam.updateProjectionMatrix();

  applyViewVisibility(camPos, target);

  const old = new THREE.Vector2();
  renderer.getSize(old);
  const oldPr = renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/jpeg', 0.92);
  renderer.setPixelRatio(oldPr);
  renderer.setSize(old.x, old.y, false);
  return url;
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

async function captionedView(view, W, H) {
  const url = renderView(view, W, H);
  const img = await loadImage(url);
  const c = document.createElement('canvas');
  const bar = 44;
  c.width = W; c.height = H + bar;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, bar);
  ctx.fillStyle = '#0b0e12';
  ctx.font = 'bold 26px -apple-system, Helvetica, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(view.title, 16, bar / 2 + 2);
  if (view.hint) {
    const w = ctx.measureText(view.title).width;
    ctx.fillStyle = '#77838f';
    ctx.font = '20px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillText('· ' + view.hint, 16 + w + 12, bar / 2 + 3);
  }
  ctx.strokeStyle = '#cbd3dc';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, c.width - 2, c.height - 2);
  return c.toDataURL('image/jpeg', 0.9);
}

async function allViews(W = 900, H = 560) {
  setExportLook(true);
  const out = [];
  try {
    for (const v of VIEWS) out.push({ view: v, url: await captionedView(v, W, H) });
  } finally {
    showAllMarkers();
    setExportLook(false);
  }
  return out;
}

function infoLine() {
  const i = state.info;
  const bits = [i.model || 'Tesla Model Y'];
  if (i.kenteken) bits.push(i.kenteken.toUpperCase());
  if (i.kleur) bits.push(i.kleur);
  if (i.km) bits.push(i.km + ' km');
  if (i.datum) bits.push(nlDate(i.datum));
  return bits.join(' · ');
}

function nlDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fileBase() {
  const k = (state.info.kenteken || 'ModelY').replace(/[^A-Za-z0-9-]/g, '');
  return 'Schaderapport-' + k + '-' + (state.info.datum || today());
}

async function saveBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: filename }); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const dataUrlToBlob = url => fetch(url).then(r => r.blob());

/* ---- JPG van het huidige beeld ---- */
async function exportCurrentJpg() {
  busy('Afbeelding maken…');
  try {
    const scale = 2;
    const W = Math.min(2400, Math.round(innerWidth * scale));
    const H = Math.min(1600, Math.round(innerHeight * scale));
    setExportLook(true);
    showAllMarkers();
    const old = new THREE.Vector2(); renderer.getSize(old);
    const oldPr = renderer.getPixelRatio();
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    const cam = camera.clone();
    cam.aspect = W / H; cam.updateProjectionMatrix();
    renderer.render(scene, cam);
    const url = renderer.domElement.toDataURL('image/jpeg', 0.94);
    renderer.setPixelRatio(oldPr); renderer.setSize(old.x, old.y, false);
    setExportLook(false);
    const composed = await composeSheet([{ view: { title: 'Huidig aanzicht' }, url }], W, H, 1);
    await saveBlob(await dataUrlToBlob(composed), fileBase() + '.jpg');
  } finally { busy(false); }
}

/* ---- overzichtsplaat met alle aanzichten ---- */
async function exportSheetJpg() {
  busy('Alle aanzichten renderen…');
  try {
    const views = await allViews(820, 512);
    const composed = await composeSheet(views, 820, 556, 2);
    await saveBlob(await dataUrlToBlob(composed), fileBase() + '-aanzichten.jpg');
  } finally { busy(false); }
}

async function composeSheet(views, cw, ch, cols) {
  const pad = 26, headH = 132, legendH = state.marks.length ? 46 : 0;
  const rows = Math.ceil(views.length / cols);
  const W = pad * 2 + cols * cw + (cols - 1) * pad;
  const listH = state.marks.length ? 40 + state.marks.length * 30 : 0;
  const H = headH + rows * (ch + pad) + legendH + listH + pad;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0b0e12';
  ctx.font = 'bold 40px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillText('Schaderapport ' + (state.info.model || 'Tesla Model Y'), pad, 60);
  ctx.font = '24px -apple-system, Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#4a5666';
  ctx.fillText(infoLine(), pad, 98);

  let y = headH;
  for (let i = 0; i < views.length; i++) {
    const img = await loadImage(views[i].url);
    const x = pad + (i % cols) * (cw + pad);
    const yy = y + Math.floor(i / cols) * (ch + pad);
    ctx.drawImage(img, x, yy, cw, ch);
  }
  y += rows * (ch + pad);

  if (state.marks.length) {
    ctx.font = 'bold 22px -apple-system, Helvetica, Arial, sans-serif';
    let lx = pad;
    const used = [...new Set(state.marks.map(m => m.type))];
    used.forEach(id => {
      const t = typeById(id);
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(lx + 9, y + 12, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0e12';
      ctx.fillText(t.label, lx + 26, y + 20);
      lx += 36 + ctx.measureText(t.label).width;
    });
    y += 46;

    ctx.font = 'bold 24px -apple-system, Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#0b0e12';
    ctx.fillText('Overzicht (' + state.marks.length + ')', pad, y + 22);
    y += 40;
    ctx.font = '21px -apple-system, Helvetica, Arial, sans-serif';
    state.marks.forEach(m => {
      const t = typeById(m.type);
      ctx.fillStyle = t.color;
      ctx.beginPath(); ctx.arc(pad + 10, y + 8, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px -apple-system, Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(m.nr), pad + 10, y + 13);
      ctx.textAlign = 'left';
      ctx.font = '21px -apple-system, Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#0b0e12';
      const line = m.panel + ' — ' + t.label + ', ' + sizeTextLong(sizeById(m.size)) + (m.note ? ' — ' + m.note : '');
      ctx.fillText(line, pad + 30, y + 15);
      y += 30;
    });
  }
  return c.toDataURL('image/jpeg', 0.92);
}

/* ---- PDF ---- */
async function exportPdf() {
  busy('PDF maken…');
  try {
    const views = await allViews(900, 520);
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const PW = 210, M = 12;
    const i = state.info;

    /* kop */
    doc.setFillColor(232, 33, 39);
    doc.rect(0, 0, PW, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(20, 24, 30);
    doc.text('Schaderapport ' + (i.model || 'Tesla Model Y'), M, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 100, 112);
    doc.text(infoLine(), M, 24.5);

    let y = 30;
    const rowsInfo = [];
    if (i.eigenaar) rowsInfo.push('Eigenaar: ' + i.eigenaar);
    if (i.ingevuld) rowsInfo.push('Ingevuld door: ' + i.ingevuld);
    rowsInfo.push('Aantal beschadigingen: ' + state.marks.length);
    doc.setTextColor(40, 48, 58);
    doc.text(rowsInfo.join('   |   '), M, y);
    y += 5;
    if (i.notitie) {
      const lines = doc.splitTextToSize(i.notitie, PW - 2 * M);
      doc.text(lines, M, y + 1);
      y += lines.length * 4.4 + 1;
    }
    doc.setDrawColor(210, 216, 224);
    doc.line(M, y, PW - M, y);
    y += 4;

    /* aanzichten, 2 kolommen */
    const iw = (PW - 2 * M - 5) / 2;
    const ih = iw * (520 + 44) / 900;
    for (let k = 0; k < views.length; k++) {
      const col = k % 2, row = Math.floor(k / 2);
      const x = M + col * (iw + 5);
      const yy = y + row * (ih + 3);
      doc.addImage(views[k].url, 'JPEG', x, yy, iw, ih);
    }
    y += Math.ceil(views.length / 2) * (ih + 3) + 2;

    /* legenda */
    if (state.marks.length) {
      const used = [...new Set(state.marks.map(m => m.type))];
      let lx = M;
      doc.setFontSize(8.5);
      used.forEach(id => {
        const t = typeById(id);
        const rgb = hexRgb(t.color);
        doc.setFillColor(rgb[0], rgb[1], rgb[2]);
        doc.circle(lx + 1.4, y - 1, 1.4, 'F');
        doc.setTextColor(40, 48, 58);
        doc.text(t.label, lx + 4, y);
        lx += 8 + doc.getTextWidth(t.label);
      });
      y += 5;
    }

    /* tabel — op pagina 1 als het past, anders op een nieuwe pagina */
    /* de rijen breken zelf af naar een volgende pagina; hier bepalen we
       alleen of er nog genoeg ruimte over is om te beginnen */
    let ty;
    if (285 - y > 30) { ty = y + 7; } else { doc.addPage(); ty = 20; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20, 24, 30);
    doc.text('Overzicht beschadigingen', M, ty);
    ty += 7;

    const cols = [
      { key: 'nr',    label: '#',        w: 9 },
      { key: 'panel', label: 'Plek',     w: 52 },
      { key: 'type',  label: 'Soort',    w: 26 },
      { key: 'size',  label: 'Grootte',  w: 30 },
      { key: 'note',  label: 'Notitie',  w: PW - 2 * M - 9 - 52 - 26 - 30 }
    ];

    const header = () => {
      doc.setFillColor(240, 243, 246);
      doc.rect(M, ty - 4.6, PW - 2 * M, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 70, 82);
      let x = M + 2;
      cols.forEach(c => { doc.text(c.label, x, ty); x += c.w; });
      ty += 5.5;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(25, 30, 38);
    };
    header();

    if (!state.marks.length) {
      doc.setTextColor(120, 130, 142);
      doc.text('Geen beschadigingen gemarkeerd.', M + 2, ty + 2);
    }

    doc.setFontSize(9);
    for (const m of state.marks) {
      const t = typeById(m.type);
      const cells = {
        nr: String(m.nr),
        panel: m.panel || '',
        type: t.label,
        size: sizeTextLong(sizeById(m.size)),
        note: m.note || '—'
      };
      const wrapped = {};
      let hMax = 1;
      cols.forEach(c => {
        wrapped[c.key] = doc.splitTextToSize(cells[c.key], c.w - 3);
        hMax = Math.max(hMax, wrapped[c.key].length);
      });
      const rowH = hMax * 4.2 + 2.6;
      if (ty + rowH > 285) { doc.addPage(); ty = 20; header(); }

      const rgb = hexRgb(t.color);
      doc.setFillColor(rgb[0], rgb[1], rgb[2]);
      doc.circle(M + 3.2, ty - 1.2, 2.4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
      doc.text(String(m.nr), M + 3.2, ty - 0.1, { align: 'center' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(25, 30, 38);

      let x = M + 2;
      cols.forEach(c => {
        if (c.key !== 'nr') doc.text(wrapped[c.key], x, ty);
        x += c.w;
      });
      ty += rowH;
      doc.setDrawColor(228, 232, 238);
      doc.line(M, ty - 2.2, PW - M, ty - 2.2);
    }

    /* voettekst op elke pagina */
    const pages = doc.getNumberOfPages();
    for (let pnum = 1; pnum <= pages; pnum++) {
      doc.setPage(pnum);
      doc.setFontSize(7.5); doc.setTextColor(150, 158, 168);
      doc.text('Opgesteld met de 3D-schadekaart · ' + nlDate(state.info.datum || today()), M, 292);
      doc.text(pnum + ' / ' + pages, PW - M, 292, { align: 'right' });
    }

    await saveBlob(doc.output('blob'), fileBase() + '.pdf');
  } catch (err) {
    console.error(err);
    toast('PDF mislukt: ' + (err.message || err));
  } finally { busy(false); }
}

function hexRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function busy(text) {
  const o = $('#loader');
  if (text === false) { o.classList.add('hidden'); return; }
  $('#loaderText').textContent = text;
  o.classList.remove('hidden');
}

/* ---- back-up ---- */
function exportJson() {
  const blob = new Blob([JSON.stringify({ info: state.info, marks: state.marks, nextNr: state.nextNr, v: 1 }, null, 2)],
    { type: 'application/json' });
  saveBlob(blob, fileBase() + '.json');
}

function importJson() {
  const inp = el('input', { type: 'file', accept: 'application/json,.json' });
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        adopt(JSON.parse(fr.result));
        rebuildMarkers(); refreshChrome(); save(); closeSheet();
        toast('Back-up geladen');
      } catch (e) { toast('Kon dit bestand niet lezen'); }
    };
    fr.readAsText(f);
  };
  inp.click();
}

function openExport() {
  const mk = (label, fn, primary) => {
    const b = el('button', { className: 'bigbtn' + (primary ? ' primary' : ''), textContent: label });
    b.onclick = () => { closeSheet(); setTimeout(fn, 260); };
    return b;
  };
  openSheet('Exporteren & opslaan', [
    el('p', { className: 'note', textContent: 'Het rapport bevat alle zes aanzichten met genummerde markeringen plus een tabel met plek, soort, grootte en notitie.' }),
    mk('PDF voor de reparateur', exportPdf, true),
    mk('Alle aanzichten als JPG', exportSheetJpg),
    mk('Huidig beeld als JPG', exportCurrentJpg),
    el('p', { className: 'note', textContent: 'Back-up: bewaar de markeringen als bestand, bijvoorbeeld om ze op een ander apparaat te openen.' }),
    el('div', { className: 'rowbtns' }, [
      mk('Back-up opslaan', exportJson),
      mk('Back-up openen', importJson)
    ]),
    el('p', { className: 'note', textContent: 'Opnieuw beginnen wist alle markeringen op dit apparaat.' }),
    (() => {
      const b = el('button', { className: 'bigbtn', textContent: 'Alles wissen' });
      b.style.color = '#ff6b6b';
      b.onclick = () => {
        if (!confirm('Alle markeringen wissen?')) return;
        state.marks = []; state.nextNr = 1; state.selected = null;
        rebuildMarkers(); refreshChrome(); save(); closeSheet();
        toast('Alles gewist');
      };
      return b;
    })()
  ]);
}

/* =====================================================================
   11. Knoppen
   ===================================================================== */

$('#btnMode').onclick = () => {
  state.addMode = !state.addMode;
  refreshChrome();
  toast(state.addMode ? 'Tik op de auto om schade te zetten' : 'Markeren staat uit — je kunt vrij draaien');
};

$('#btnUndo').onclick = () => {
  if (!state.marks.length) { toast('Nog niets om ongedaan te maken'); return; }
  const m = state.marks.pop();
  state.nextNr = Math.max(1, state.nextNr - 1);
  state.selected = null;
  rebuildMarkers(); refreshChrome(); save();
  toast('#' + m.nr + ' verwijderd');
};

$('#btnList').onclick = openList;
$('#btnExport').onclick = openExport;
$('#btnInfo').onclick = openInfo;

$('#btnXray').onclick = () => {
  state.xray = !state.xray;
  bodyMesh.material.opacity = state.xray ? 0.32 : 1;
  bodyMesh.material.depthWrite = !state.xray;
  glassMesh.material.opacity = state.xray ? 0.3 : 0.86;
  refreshChrome();
  toast(state.xray ? 'Doorzichtig: je ziet ook markeringen aan de andere kant' : 'Normale weergave');
};

$('#btnReset').onclick = () => resetView();

$('#welcomeOk').onclick = () => {
  $('#welcome').classList.add('hidden');
  try { localStorage.setItem(STORE_KEY + ':seen', '1'); } catch (e) {}
};

addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSheet();
});

/* offline beschikbaar houden zodra de app vanaf een webserver draait
   (vanaf de schijf openen kan geen service worker registreren) */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* =====================================================================
   12. Start
   ===================================================================== */

try {
  boot();
  load();
  rebuildMarkers();
  buildChips();
  refreshChrome();
  let seen = false;
  try { seen = !!localStorage.getItem(STORE_KEY + ':seen'); } catch (e) {}
  if (!seen) $('#welcome').classList.remove('hidden');
  setTimeout(() => { const h = $('#hint'); if (h) h.style.opacity = '0'; }, 7000);
} catch (err) {
  console.error(err);
  $('#fatal').classList.remove('hidden');
  $('#fatalText').textContent = (err && err.message ? err.message : String(err)) +
    ' — deze browser ondersteunt WebGL mogelijk niet. Probeer Safari of Chrome, of zet hardware-versnelling aan.';
}
