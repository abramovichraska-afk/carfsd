'use strict';
const T = THREE, L = 120, N = 16, LW = 3.6, HW = 7.2, CITY_LIMIT = 650, Y = new T.Vector3(0, 1, 0);
const $ = id => document.getElementById(id);
const R = (a, b) => a + Math.random() * (b - a);
const AVENUES = [];
for (let x = -600; x <= 600; x += 120) AVENUES.push(x);

const ASSET_CDN = {
  'CesiumMilkTruck.glb': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@main/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
  'CesiumMan.glb': 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@main/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
  'docklands_02_1k.hdr': 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/docklands_02_1k.hdr',
  'asphalt_01_diff_2k.jpg': 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_01/asphalt_01_diff_2k.jpg',
  'asphalt_01_nor_gl_2k.jpg': 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_01/asphalt_01_nor_gl_2k.jpg',
  'asphalt_01_rough_2k.jpg': 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/asphalt_01/asphalt_01_rough_2k.jpg'
};
const assetUrl = name => location.protocol === 'file:' ? ASSET_CDN[name] : `assets/${name}`;
function assetError(name, error) {
  console.error(`Unable to load ${name}:`, error);
  const notice = $('asset-warning');
  notice.textContent = `Asset unavailable: ${name}. See assets/ASSETS.md for sources.`;
  notice.classList.add('on');
}

/* ---------- renderer / scene ---------- */
const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.outputEncoding = T.sRGBEncoding;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
$('app').appendChild(renderer.domElement);
const scene = new T.Scene();
scene.background = new T.Color(0x78838c);
scene.fog = new T.FogExp2(0x78838c, 0.0017);
const cam = new T.PerspectiveCamera(62, 1, 0.1, 1600);
const hemi = new T.HemisphereLight(0xc3d7e8, 0x272b2c, 1.05);
scene.add(hemi);
const sun = new T.DirectionalLight(0xffefd9, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.radius = 3;
sun.shadow.bias = -0.00015;
Object.assign(sun.shadow.camera, { left: -100, right: 100, top: 100, bottom: -100, near: 1, far: 300 });
sun.shadow.camera.updateProjectionMatrix();
scene.add(sun, sun.target);
let environmentTarget = null, backgroundHDR = null, isNight = false;
if (T.RGBELoader) {
  new T.RGBELoader().load(assetUrl('docklands_02_1k.hdr'), hdr => {
    hdr.mapping = T.EquirectangularReflectionMapping;
    backgroundHDR = hdr;
    const pmrem = new T.PMREMGenerator(renderer);
    environmentTarget = pmrem.fromEquirectangular(hdr);
    if (!isNight) scene.environment = environmentTarget.texture;
    if (!isNight) scene.background = hdr;
    pmrem.dispose();
  }, undefined, error => assetError('docklands_02_1k.hdr', error));
}

/* ---------- shared geometry & materials ---------- */
const box = new T.BoxGeometry(1, 1, 1), boxE = new T.EdgesGeometry(box);
const plane = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const cyl = new T.CylinderGeometry(0.5, 0.5, 1, 10);
const wheel = new T.CylinderGeometry(0.5, 0.5, 1, 14).rotateZ(Math.PI / 2);
const rim = new T.CylinderGeometry(0.27, 0.27, 0.08, 20).rotateZ(Math.PI / 2);
const sph = new T.SphereGeometry(0.5, 12, 10);
const bikeWheel = new T.TorusGeometry(0.36, 0.035, 8, 24).rotateY(Math.PI / 2);
const treeTrunkGeometry = new T.CylinderGeometry(0.5, 0.65, 1, 14);
const treeCanopyGeometry = new T.IcosahedronGeometry(1, 2);
const std = (c, o = {}) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o));
const glow = (c, o, blend) => new T.LineBasicMaterial({ color: c, transparent: true, opacity: o, blending: blend ? T.AdditiveBlending : T.NormalBlending, depthWrite: false });

function dashTexture() {
  const c = document.createElement('canvas'); c.width = 16; c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(6, 0, 4, 64);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(1, (L - 12) / 6); return t;
}
function blobTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c);
}
function facadeTexture(glassTower) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  const base = x.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, glassTower ? '#273b4b' : '#65635f');
  base.addColorStop(0.5, glassTower ? '#182b3b' : '#3f474a');
  base.addColorStop(1, glassTower ? '#344655' : '#74716b');
  x.fillStyle = base; x.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 14; row++) {
    const y = row * 36 + 5;
    x.fillStyle = glassTower ? 'rgba(177,208,222,.2)' : 'rgba(211,205,186,.18)';
    x.fillRect(0, y + 28, 512, 2);
    for (let col = 0; col < 9; col++) {
      const xx = col * 56 + 8;
      const lit = Math.random() > 0.35;
      x.fillStyle = glassTower
        ? (lit ? 'rgba(153,205,225,.52)' : 'rgba(8,21,32,.75)')
        : (lit ? 'rgba(238,193,119,.72)' : 'rgba(18,30,39,.85)');
      x.fillRect(xx, y, 39, 24);
      x.fillStyle = 'rgba(218,231,236,.16)'; x.fillRect(xx + 2, y + 2, 2, 20);
    }
  }
  const texture = new T.CanvasTexture(c);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.encoding = T.sRGBEncoding;
  return texture;
}
function pavementTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); x.fillStyle = '#60656a'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2500; i++) {
    const shade = Math.floor(R(65, 155));
    x.fillStyle = `rgba(${shade},${shade},${shade},${R(0.03, 0.12)})`;
    x.fillRect(R(0, 128), R(0, 128), 2, 2);
  }
  const texture = new T.CanvasTexture(c);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.encoding = T.sRGBEncoding;
  return texture;
}
const M = {
  ground: std(0x18251e), road: std(0xb9bec0, { roughness: 0.94 }),
  walk: std(0x929496, { roughness: 0.93, map: pavementTexture() }),
  bld: new T.MeshStandardMaterial({ map: facadeTexture(false), roughness: 0.78, metalness: 0.12 }),
  bldFar: std(0x46525b, { roughness: 0.86 }),
  glassTower: new T.MeshPhysicalMaterial({ map: facadeTexture(true), roughness: 0.22, metalness: 0.55, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
  roof: std(0x45484b, { roughness: 0.88 }),
  grass: std(0x405a3d, { roughness: 1 }),
  glass: new T.MeshPhysicalMaterial({ color: 0x182d3b, metalness: 0.6, roughness: 0.12, clearcoat: 0.9, clearcoatRoughness: 0.1 }),
  tire: std(0x050607), dark: std(0x1b232c), ped: std(0xdde6ee, { emissive: 0x223344 }),
  rim: std(0x8494a2, { metalness: 0.88, roughness: 0.24 }),
  paintTrim: std(0x111820, { metalness: 0.45, roughness: 0.32 }),
  bike: std(0x4c5f6b, { metalness: 0.72, roughness: 0.3 }),
  windows: std(0x07121d, { metalness: 0.65, roughness: 0.16 }),
  windowsLit: std(0x91c8d8, { emissive: 0x315161, emissiveIntensity: 0.28, roughness: 0.32 }),
  leaf: std(0x34563b, { roughness: 0.92 }), sign: std(0xffffff, { emissive: 0x555555 }),
  lamp: new T.MeshBasicMaterial({ color: 0xfff0cf }), head: new T.MeshBasicMaterial({ color: 0xfff5dd }),
  tail: new T.MeshBasicMaterial({ color: 0xff2a2a }), brake: new T.MeshBasicMaterial({ color: 0xff0808 }),
  line: new T.MeshBasicMaterial({ color: 0xdfeaff, transparent: true, opacity: 0.65 }),
  yel: new T.MeshBasicMaterial({ color: 0xffd37a, transparent: true, opacity: 0.7 }),
  dash: new T.MeshBasicMaterial({ map: dashTexture(), transparent: true, opacity: 0.75 }),
  blob: new T.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }),
  fill: new T.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.07, depthWrite: false }),
  fillR: new T.MeshBasicMaterial({ color: 0xff4040, transparent: true, opacity: 0.14, depthWrite: false }),
  edge: glow(0x4fd8ff, 0.22, true), det: glow(0x4fd8ff, 0.95, true), detR: glow(0xff4a4a, 1, true),
  detP: glow(0xffffff, 0.95, true), ego: glow(0x7fe6ff, 0.35, true), traj: glow(0x4fd8ff, 0.55, true), signE: glow(0xe5484d, 0.9, false),
  bodies: [
    new T.MeshPhysicalMaterial({ color: 0xcfd8e3, metalness: 0.62, roughness: 0.22, clearcoat: 0.95, clearcoatRoughness: 0.13 }),
    new T.MeshPhysicalMaterial({ color: 0x8a96a3, metalness: 0.66, roughness: 0.24, clearcoat: 0.9, clearcoatRoughness: 0.16 }),
    new T.MeshPhysicalMaterial({ color: 0x263e58, metalness: 0.64, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 })
  ]
};
const textureLoader = new T.TextureLoader();
const roadTextures = [
  ['asphalt_01_diff_2k.jpg', 'map', T.sRGBEncoding],
  ['asphalt_01_nor_gl_2k.jpg', 'normalMap', null],
  ['asphalt_01_rough_2k.jpg', 'roughnessMap', null]
];
for (const [name, slot, encoding] of roadTextures) {
  textureLoader.load(assetUrl(name), texture => {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (encoding !== null) texture.encoding = encoding;
    M.road[slot] = texture; M.road.needsUpdate = true;
  }, undefined, error => assetError(name, error));
}
M.road.normalScale.set(0.42, 0.42);
const gltfLoader = T.GLTFLoader ? new T.GLTFLoader() : null;
let truckAsset = null, humanAsset = null;
const cars = [], chunks = [];
function markModelShadows(root) {
  root.traverse(node => {
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
}
function loadGLB(name, ready) {
  if (!gltfLoader) { assetError(name, new Error('THREE.GLTFLoader did not load')); return; }
  gltfLoader.load(assetUrl(name), gltf => {
    markModelShadows(gltf.scene);
    ready(gltf);
  }, undefined, error => assetError(name, error));
}
function attachModel(visual, gltf, dimensions) {
  visual.clear();
  const model = T.SkeletonUtils ? T.SkeletonUtils.clone(gltf.scene) : gltf.scene.clone(true);
  let bounds = new T.Box3().setFromObject(model);
  const size = bounds.getSize(new T.Vector3());
  if (!size.x || !size.y || !size.z) throw new Error('The model has empty or invalid dimensions');
  if (size.x > size.z) model.rotation.y = Math.PI / 2;
  model.updateMatrixWorld(true);
  bounds = new T.Box3().setFromObject(model);
  const orientedSize = bounds.getSize(new T.Vector3());
  const scale = Math.min(dimensions.length / Math.max(orientedSize.x, orientedSize.z), dimensions.height / orientedSize.y);
  model.scale.setScalar(scale);
  model.position.set(0, -bounds.min.y * scale, 0);
  visual.add(model);
  if (gltf.animations.length) {
    const mixer = new T.AnimationMixer(model);
    mixer.clipAction(gltf.animations[0]).play();
    visual.userData.mixer = mixer;
  }
  return model;
}
loadGLB('CesiumMilkTruck.glb', gltf => {
  truckAsset = gltf;
  for (const car of cars) if (car.vehicleType === 'delivery') {
    car.model = attachModel(car.visual, truckAsset, { length: 5.8, height: 2.8 });
  }
});
loadGLB('CesiumMan.glb', gltf => {
  humanAsset = gltf;
  for (const chunk of chunks) {
    for (const person of chunk.peds) person.model = attachModel(person.visual, humanAsset, { length: 0.8, height: 1.82 });
    for (const rider of chunk.cyclists) rider.person.model = attachModel(rider.person.visual, humanAsset, { length: 0.8, height: 1.65 });
  }
});
const mk = (geo, mat, x, y, z, sx, sy, sz, par, cs) => {
  const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = !!cs; m.receiveShadow = true; par.add(m); return m;
};
const edge = (par, x, y, z, sx, sy, sz, mat) => {
  const l = new T.LineSegments(boxE, mat); l.position.set(x, y, z); l.scale.set(sx, sy, sz); par.add(l); return l;
};
const ground = mk(plane, M.ground, 0, -0.05, 0, 3000, 1, 3000, scene);
const roadGeometries = new Map();
function roadPlane(width, depth, tileMeters) {
  const key = `${width}:${depth}:${tileMeters}`;
  if (!roadGeometries.has(key)) {
    const geo = new T.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * width / tileMeters, uv.getY(i) * depth / tileMeters);
    }
    uv.needsUpdate = true;
    roadGeometries.set(key, geo);
  }
  return roadGeometries.get(key);
}

/* ---------- vehicles & pedestrians ---------- */
function makeCarGeometry(roofHeight) {
  const shape = new T.Shape();
  shape.moveTo(-2.22, 0.47);
  shape.quadraticCurveTo(-2.28, 0.56, -2.12, 0.88);
  shape.lineTo(-1.7, 1.02); shape.lineTo(-1.12, roofHeight - 0.05);
  shape.quadraticCurveTo(-0.96, roofHeight, -0.74, roofHeight);
  shape.lineTo(0.48, roofHeight);
  shape.quadraticCurveTo(0.73, roofHeight, 0.92, roofHeight - 0.14);
  shape.lineTo(1.48, 1.06); shape.lineTo(2.06, 0.96);
  shape.quadraticCurveTo(2.24, 0.89, 2.22, 0.65);
  shape.lineTo(2.12, 0.47); shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: 1.72, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.045, bevelThickness: 0.04 });
  geo.rotateY(-Math.PI / 2);
  return geo;
}
const carGeometries = [makeCarGeometry(1.65), makeCarGeometry(1.78), makeCarGeometry(1.52)];
function makeWindowGeometry(points) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false });
  geo.rotateY(-Math.PI / 2);
  return geo;
}
const glassGeometries = [
  makeWindowGeometry([[-1.42, 1.1], [-1.04, 1.53], [-0.78, 1.58], [-0.78, 1.1]]),
  makeWindowGeometry([[-0.68, 1.58], [0.42, 1.58], [0.78, 1.17], [-0.68, 1.17]])
];
function makeCar(bm, isEgo, variant) {
  const g = new T.Group(), wheels = [], frontWheels = [];
  const body = new T.Mesh(carGeometries[variant || 0], bm);
  body.position.set(0.86, 0, 0); body.castShadow = true; body.receiveShadow = true; g.add(body);
  const roofHeight = [1.65, 1.78, 1.52][variant || 0];
  mk(box, M.glass, 0, roofHeight - 0.012, 0.02, 1.34, 0.035, 1.18, g, 1);
  for (const s of [-1, 1]) for (const glass of glassGeometries) {
    const pane = new T.Mesh(glass, M.glass);
    pane.position.x = s < 0 ? -0.835 : 0.86;
    pane.castShadow = true; g.add(pane);
  }
  const windshield = mk(box, M.glass, 0, 1.12, -0.95, 1.55, 0.035, 0.72, g, 1); windshield.rotation.x = -0.6;
  const rearGlass = mk(box, M.glass, 0, 1.12, 0.99, 1.55, 0.035, 0.65, g, 1); rearGlass.rotation.x = 0.6;
  mk(box, M.paintTrim, 0, 0.48, 0, 1.78, 0.07, 3.35, g);
  mk(box, M.paintTrim, 0, 0.48, -1.35, 1.78, 0.06, 1.1, g);
  mk(box, M.paintTrim, 0, 0.48, 1.38, 1.78, 0.06, 1.0, g);
  for (const s of [-1, 1]) {
    for (const z of [-1.42, 1.42]) {
      const tire = mk(wheel, M.tire, s * 0.91, 0.37, z, 0.32, 0.72, 0.72, g);
      wheels.push(tire); if (z < 0) frontWheels.push(tire);
      mk(rim, M.rim, s * 1.08, 0.37, z, 1, 1, 1, g);
      for (let spoke = 0; spoke < 5; spoke++) {
        const angle = spoke * Math.PI * 2 / 5;
        const bar = mk(box, M.rim, s * 1.13, 0.37 + Math.cos(angle) * 0.1, z + Math.sin(angle) * 0.1, 0.035, 0.2, 0.045, g);
        bar.rotation.x = angle;
      }
    }
    mk(box, M.head, s * 0.57, 0.72, -2.18, 0.42, 0.09, 0.07, g);
    mk(box, M.paintTrim, s * 0.91, 1.18, -0.75, 0.26, 0.12, 0.28, g);
    mk(box, M.rim, s * 0.91, 1.15, -0.82, 0.08, 0.22, 0.14, g);
    for (const z of [-0.48, 0.55]) mk(box, M.rim, s * 0.87, 0.96, z, 0.035, 0.035, 0.28, g);
  }
  mk(box, M.tail, 0, 0.83, 2.17, 1.42, 0.09, 0.07, g);
  mk(box, M.brake, 0, 0.83, 2.215, 0.92, 0.035, 0.025, g);
  if (isEgo) for (const side of [-1, 1]) {
    const beam = new T.SpotLight(0xffe6bd, 0, 60, Math.PI / 7, 0.45, 1.2);
    beam.position.set(side * 0.55, 0.76, -2.02); beam.target.position.set(side * 0.7, 0.2, -18);
    g.add(beam, beam.target);
    g.userData.headlights = g.userData.headlights || [];
    g.userData.headlights.push(beam);
  }
  mk(plane, M.blob, 0, 0.03, 0, 3.4, 1, 6.4, g);
  const lines = edge(g, 0, 1.03, 0, 2.15, 2.05, 4.5, isEgo ? M.ego : M.det);
  let fill = null, traj = null;
  if (!isEgo) {
    fill = mk(box, M.fill, 0, 1.03, 0, 2.15, 2.05, 4.5, g); fill.castShadow = false;
    traj = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0.1, 0), new T.Vector3(0, 0.1, -1)]), M.traj);
    traj.position.z = -2.4; g.add(traj);
  }
  const visual = new T.Group(), overlays = new Set([lines, fill, traj]);
  for (const child of [...g.children]) if (!overlays.has(child)) {
    g.remove(child); visual.add(child);
  }
  g.add(visual);
  scene.add(g);
  return { m: g, visual, lines, fill, traj, wheels, frontWheels };
}
function makePed() {
  const g = new T.Group();
  mk(cyl, M.ped, 0, 0.85, 0, 0.5, 1.3, 0.5, g, 1); mk(sph, M.ped, 0, 1.72, 0, 0.4, 0.4, 0.4, g, 1);
  const lines = edge(g, 0, 0.9, 0, 0.8, 1.8, 0.8, M.detP), fill = mk(box, M.fill, 0, 0.9, 0, 0.8, 1.8, 0.8, g);
  const visual = new T.Group(), overlays = new Set([lines, fill]);
  for (const child of [...g.children]) if (!overlays.has(child)) {
    g.remove(child); visual.add(child);
  }
  g.add(visual);
  scene.add(g);
  return { m: g, visual, kind: 'ped', w: 0.7, l: 0.7, speed: 0, vf: 0, dir: Math.random() < 0.5 ? 1 : -1, state: 'wait', t: R(0, 5), lines, fill };
}
function makeCyclist() {
  const g = new T.Group(), frame = new T.Group(), rider = new T.Group();
  for (const z of [-0.62, 0.62]) {
    const tire = new T.Mesh(bikeWheel, M.tire); tire.position.set(0, 0.43, z); frame.add(tire);
  }
  const points = [
    [[0, 0.43, -0.62], [0, 0.43, 0.08], [0, 0.98, 0.62], [0, 0.43, -0.62]],
    [[0, 0.43, 0.08], [0, 1.0, -0.36], [0, 0.98, 0.62]],
    [[0, 1.0, -0.36], [0, 0.43, -0.62]]
  ];
  for (const path of points) {
    const curve = new T.CatmullRomCurve3(path.map(point => new T.Vector3(...point)));
    frame.add(new T.Mesh(new T.TubeGeometry(curve, 18, 0.035, 8, false), M.bike));
  }
  mk(box, M.dark, 0, 0.99, 0.46, 0.28, 0.06, 0.34, frame);
  mk(cyl, M.dark, 0, 1.03, -0.36, 0.08, 0.08, 0.48, frame);
  rider.position.set(0, 0.27, 0.04); frame.add(rider); g.add(frame);
  const lines = edge(g, 0, 0.95, 0, 1.75, 2.0, 1.8, M.detP);
  const fill = mk(box, M.fill, 0, 0.95, 0, 1.75, 2.0, 1.8, g); fill.castShadow = false;
  scene.add(g);
  return { m: g, visual: frame, person: { visual: rider }, kind: 'cyclist', w: 1.75, l: 1.8, speed: 5, vf: 0, dir: 1, lines, fill, x: 0, z: 0 };
}

/* ---------- procedural road chunks ---------- */
const phaseOf = c => { const t = (clock.t + c.idx * 5) % 16; return t < 8 ? 0 : t < 10 ? 1 : 2; };
function populate(c) {
  const g = c.g; g.clear();
  c.peds.forEach(p => scene.remove(p.m)); c.peds = [];
  c.cyclists.forEach(p => scene.remove(p.m)); c.cyclists = [];
  const treeInstances = [];
  g.position.set(0, 0, c.z0); c.idx = Math.round((60 - c.z0) / L);
  for (const ax of AVENUES) {
    mk(roadPlane(HW * 2, L, 7), M.road, ax, 0, -L / 2 + 6, 1, 1, 1, g);
    for (const s of [-1, 1]) {
      mk(plane, M.yel, ax + s * 0.18, 0.02, -L / 2, 0.12, 1, L - 12, g);
      mk(plane, M.dash, ax + s * LW, 0.02, -L / 2, 0.8, 1, L - 12, g);
      mk(plane, M.line, ax + s * 7, 0.02, -L / 2, 0.15, 1, L - 12, g);
      mk(roadPlane(3.6, L - 12, 5), M.walk, ax + s * (HW + 1.8), 0.09, -L / 2, 1, 1, 1, g);
    }
  }
  mk(roadPlane(1400, 14.4, 7), M.road, 0, 0.01, 13, 1, 1, 1, g);
  const crossDash = plane.clone().rotateY(Math.PI / 2);
  for (const s of [-1, 1]) {
    const marking = mk(crossDash, M.dash, 0, 0.025, 13 + s * 3.6, 0.8, 1, 700, g);
    marking.material = M.dash;
    mk(roadPlane(1400, 3.6, 5), M.walk, 0, 0.09, 13 + s * 9.6, 1, 1, 1, g);
  }
  for (const ax of AVENUES) for (const s of [-1, 1]) {
    const lotId = Math.abs(c.idx + Math.round(ax / 120) * 3 + s);
    if (lotId % 13 === 0) {
      const parkX = ax + s * 59, parkZ = -L / 2 + 6;
      mk(roadPlane(76, 82, 8), M.grass, parkX, 0.025, parkZ, 1, 1, 1, g);
      for (let i = 0; i < 7; i++) {
        const tx = parkX + R(-31, 31), tz = parkZ + R(-35, 35), height = R(3.8, 6.4);
        treeInstances.push({ x: tx, z: tz, height, crown: [R(1.7, 2.6), R(2.0, 3.0), R(1.7, 2.6)] });
      }
      for (let z = parkZ - 15; z < parkZ + 20; z += 13) {
        mk(box, M.dark, parkX + s * 31, 0.38, z, 2.2, 0.12, 0.42, g, 1);
      }
      continue;
    }
    if (lotId % 17 === 0) {
      const stationX = ax + s * 58;
      mk(roadPlane(72, 76, 7), M.walk, stationX, 0.035, -L / 2 + 6, 1, 1, 1, g);
      mk(box, M.roof, stationX, 5.2, -L / 2 + 6, 42, 0.7, 20, g, 1);
      for (const px of [-13, 0, 13]) {
        mk(box, M.dark, stationX + px, 1.3, -L / 2 + 6, 0.32, 2.6, 0.32, g, 1);
        mk(box, M.tail, stationX + px, 0.75, -L / 2 + 6, 0.5, 1.1, 0.65, g);
      }
      mk(box, M.glassTower, stationX, 2.2, -L / 2 + 27, 24, 4.4, 12, g, 1);
      continue;
    }
    if (ax === 0) {
      for (let tz = -16; tz > -L + 8; tz -= 14) {
        const x = s * (HW + 3.2) + R(-.3, .3);
        treeInstances.push({ x, z: tz, height: 2, crown: [2.1, 2.2, 2.1] });
      }
    }
    if (s === -1) for (let lz = -25; lz > -L + 10; lz -= 30) {
      const x = ax + s * (HW + 0.7);
      mk(cyl, M.dark, x, 3.2, lz, 0.18, 6.4, 0.18, g, 1);
      mk(box, M.lamp, x - s * 0.9, 6.3, lz, 1.4, 0.12, 0.35, g);
    }
    const buildingMaterial = Math.abs(ax) <= 240 ? M.glassTower : M.bld;
    let z = -10;
    while (z > -L + 12) {
      const d = Math.min(R(15, 25), z + L - 10);
      if (d < 8) break;
      const w = R(12, 24), distance = HW + 2 + w / 2;
      const x = ax + s * distance;
      const downtown = Math.abs(ax) <= 240;
      const h = downtown ? R(52, 136) : Math.abs(ax) <= 480 ? R(18, 54) : R(8, 26);
      const buildingLOD = new T.LOD(), near = new T.Group(), far = new T.Group();
      mk(box, buildingMaterial, x, h / 2, z - d / 2, w, h, d, near, 1);
      mk(box, M.bldFar, x, h / 2, z - d / 2, w, h, d, far, 1);
      mk(box, M.roof, x, h + 0.14, z - d / 2, w * 0.94, 0.28, d * 0.94, near, 1);
      if (h > 48) {
        mk(box, M.roof, x + s * 1.5, h + 1.1, z - d / 2, w * 0.45, 1.9, d * 0.42, near, 1);
        mk(cyl, M.dark, x, h + 1.6, z - d / 2, 0.3, 2.4, 0.3, near, 1);
      } else {
        for (let store = 0; store < 4; store++) {
          mk(box, M.glass, x - s * (w / 2 + 0.012), 1.45, z - d / 2 + 2.3 + store * 4.4, 0.025, 2.6, 2.8, near);
        }
      }
      buildingLOD.addLevel(near, 0); buildingLOD.addLevel(far, 210); g.add(buildingLOD);
      z -= d + R(2, 5);
    }
  }
  if (treeInstances.length) {
    const trunkMesh = new T.InstancedMesh(treeTrunkGeometry, M.dark, treeInstances.length);
    const canopyMesh = new T.InstancedMesh(treeCanopyGeometry, M.leaf, treeInstances.length);
    const instance = new T.Object3D();
    treeInstances.forEach((tree, i) => {
      instance.position.set(tree.x, tree.height / 2, tree.z);
      instance.scale.set(0.24, tree.height, 0.24); instance.updateMatrix(); trunkMesh.setMatrixAt(i, instance.matrix);
      instance.position.set(tree.x, tree.height + 1.15, tree.z);
      instance.scale.set(...tree.crown); instance.updateMatrix(); canopyMesh.setMatrixAt(i, instance.matrix);
    });
    trunkMesh.castShadow = canopyMesh.castShadow = true;
    trunkMesh.frustumCulled = canopyMesh.frustumCulled = false;
    trunkMesh.instanceMatrix.needsUpdate = canopyMesh.instanceMatrix.needsUpdate = true;
    g.add(trunkMesh, canopyMesh);
  }
  for (const ax of AVENUES) {
    for (let offset = -6.5; offset <= 6.5; offset += 1.5) mk(plane, M.line, ax + offset, 0.02, 9.5, 0.8, 1, 2.6, g);
    mk(plane, M.line, ax + 3.6, 0.02, 13, 7, 1, 0.4, g);
    const poleX = ax + HW + 1.1;
    mk(cyl, M.dark, poleX, 2.7, 13, 0.18, 5.4, 0.18, g, 1);
    mk(box, M.dark, poleX - 1.1, 5.2, 13, 2.5, 0.15, 0.15, g, 1);
  }
  mk(cyl, M.dark, HW + 1.6, 1.4, -40, 0.1, 2.8, 0.1, g, 1);
  mk(box, M.sign, HW + 1.6, 2.9, -40, 0.1, 0.9, 0.9, g, 1);
  edge(g, HW + 1.6, 2.9, -40, 0.12, 0.92, 0.92, M.signE);
  c.signals = [];
  c.lamps = AVENUES.map(ax => {
    const bulbs = [0x30ff88, 0xffc400, 0xff3b30].map((col, i) => {
      const material = new T.MeshBasicMaterial({ color: col, transparent: true });
      mk(sph, material, ax + HW + 1.1, 5.7 - i * 0.45, 13.25, 0.3, 0.3, 0.3, g);
      return material;
    });
    c.signals.push({ x: ax + HW + 1.1, y: 5.25, z: 13.25, lines: edge(g, ax + HW + 1.1, 5.25, 13.25, 0.86, 1.55, 0.72, M.det) });
    return bulbs;
  });
  for (let i = 0; i < 3; i++) {
    const p = makePed(), roadIndex = 3 + (Math.abs(c.idx + i) % 5);
    p.id = `P${Math.abs(c.idx)}-${i + 1}`; p.roadX = AVENUES[roadIndex]; p.x = p.roadX + R(-8, 8); c.peds.push(p);
    if (humanAsset) p.model = attachModel(p.visual, humanAsset, { length: 0.8, height: 1.82 });
  }
  if (c.idx % 2 === 0) {
    const rider = makeCyclist();
    rider.id = `C${Math.abs(c.idx)}`;
    rider.x = AVENUES[3 + (Math.abs(c.idx) % 5)] + (rider.dir > 0 ? 5.2 : -5.2);
    rider.z = c.z0 + R(-35, 25); rider.m.rotation.y = Math.PI;
    if (humanAsset) rider.person.model = attachModel(rider.person.visual, humanAsset, { length: 0.8, height: 1.65 });
    c.cyclists.push(rider);
  }
}
for (let i = 0; i < N; i++) { const c = { g: new T.Group(), z0: 60 - i * L, peds: [], cyclists: [] }; scene.add(c.g); chunks.push(c); }
const clock = { t: 0 };
chunks.forEach(populate);

/* ---------- traffic ---------- */
function spawn(o, first) {
  if (o.dir > 0) { o.lane = Math.random() < 0.6 ? LW / 2 : LW * 1.5; o.cruise = R(8, 14); }
  else { o.lane = Math.random() < 0.5 ? -LW / 2 : -LW * 1.5; o.cruise = R(9, 15); }
  o.speed = o.cruise;
  const distance = first ? R(25, 600) : R(400, 650);
  o.m.position.set(o.roadX + o.lane, 0, P.z + (o.dir > 0 ? distance : -distance));
}
const P = { x: LW / 2, z: 30, h: 0, v: 0, steer: 0, flash: 0, red: 0, aeb: 0 };
for (let i = 0; i < 13; i++) {
  const isDelivery = i === 5 || i === 12;
  const c = makeCar(M.bodies[i % 3], false, i % 3), dir = i < 7 ? 1 : -1;
  const o = Object.assign(c, { id: `V${i + 1}`, kind: 'car', vehicleType: isDelivery ? 'delivery' : 'sedan', roadX: AVENUES[3 + i % 5], w: isDelivery ? 2.3 : 1.9, l: isDelivery ? 5.8 : 4.4, dir, speed: 0, vf: 0 });
  if (isDelivery && truckAsset) o.model = attachModel(o.visual, truckAsset, { length: 5.8, height: 2.8 });
  o.m.rotation.y = dir > 0 ? 0 : Math.PI; spawn(o, true); cars.push(o);
}
const egoCar = makeCar(M.bodies[0], true, 0), ego = egoCar.m;
const DEST = { x: 480, z: -527 };

/* ---------- predicted driving path ---------- */
const S = 24, pg = new T.BufferGeometry(), pp = new Float32Array((S + 1) * 6), ix = [];
pg.setAttribute('position', new T.BufferAttribute(pp, 3));
for (let i = 0; i < S; i++) { const a = i * 2; ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
pg.setIndex(ix);
const path = new T.Mesh(pg, new T.MeshBasicMaterial({ color: 0x3aa8ff, transparent: true, opacity: 0.38, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
path.frustumCulled = false; scene.add(path);

/* ---------- input & cameras ---------- */
const keys = {};
const down = (...c) => c.some(k => keys[k]);
const CAMS = [
  { n: 'FSD View', off: [0, 5.4, 9.5], look: [0, 1, -16], fov: 62 },
  { n: 'Driver View', off: [0, 1.35, -0.2], look: [0, 1.2, -25], fov: 72 },
  { n: 'Cinematic View', off: [8, 5.6, 12], look: [0, 0.8, -14], fov: 48 },
  { n: 'Bird’s-Eye View', off: [0, 88, 0.1], look: [0, 0, -1], fov: 48 }
];
let mode = 0, camH = 0, autopilot = false;
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!e.repeat && e.code === 'KeyC') { mode = (mode + 1) % CAMS.length; $('cam').textContent = CAMS[mode].n; }
  if (!e.repeat && e.code === 'KeyF') toggleAutopilot();
  if (!e.repeat && e.code === 'KeyL') toggleLighting();
  if (e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', e => keys[e.code] = false);
const cp = new T.Vector3(), cl = new T.Vector3(), tp = new T.Vector3(), tl = new T.Vector3();
function aimCamera(dt, snap) {
  const m = CAMS[mode], headingDelta = Math.atan2(Math.sin(P.h - camH), Math.cos(P.h - camH));
  camH += headingDelta * Math.min(1, dt * 3);
  tp.set(...m.off).applyAxisAngle(Y, -camH).add(ego.position);
  tl.set(...m.look).applyAxisAngle(Y, -camH).add(ego.position);
  const k = snap ? 1 : 1 - Math.exp(-dt * (mode === 1 ? 12 : mode === 2 ? 2 : 4));
  cp.lerp(tp, k); cl.lerp(tl, k);
  cam.position.copy(cp); cam.lookAt(cl);
  cam.fov += (m.fov - cam.fov) * k; cam.updateProjectionMatrix();
  ego.visible = true;
  egoCar.visual.visible = mode !== 1;
  egoCar.lines.visible = mode !== 1;
}
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

/* ---------- simulation ---------- */
const egoO = Object.assign(egoCar, { w: 1.9, l: 4.4, vf: 0, speed: 0 });
let objs = [];
function redAhead(z) {
  for (const c of chunks) { const d = z - (c.z0 + 13), p = c.phase; if (d > -0.5 && d < 28 && (p === 2 || (p === 1 && d > 12))) return d; }
  return 99;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function routeWaypoints() {
  const forwardX = Math.sin(P.h), forwardZ = -Math.cos(P.h);
  const horizontal = Math.abs(forwardX) > Math.abs(forwardZ);
  const roadX = Math.round(P.x / 120) * 120;
  const roadZ = 73 + Math.round((P.z - 73) / 120) * 120;
  const entryX = horizontal
    ? (forwardX > 0 ? Math.floor(P.x / 120) + 1 : Math.ceil(P.x / 120) - 1) * 120
    : roadX;
  const entryZ = horizontal
    ? roadZ
    : 73 + (forwardZ < 0 ? Math.floor((P.z - 73) / 120) : Math.ceil((P.z - 73) / 120)) * 120;
  return [[entryX, entryZ], [DEST.x, entryZ], [DEST.x, DEST.z]];
}
function autopilotCommand() {
  const route = routeWaypoints();
  let index = P.routeIndex || 0;
  let target = route[index];
  while (index < route.length - 1 && Math.hypot(target[0] - P.x, target[1] - P.z) < 11) target = route[++index];
  P.routeIndex = index;
  const dx = target[0] - P.x, dz = target[1] - P.z, distance = Math.hypot(dx, dz);
  const desiredHeading = Math.atan2(dx, -dz);
  const error = Math.atan2(Math.sin(desiredHeading - P.h), Math.cos(desiredHeading - P.h));
  const targetSpeed = distance < 20 || Math.abs(error) > 0.62 ? 4.5 : 12;
  return {
    steer: clamp(error * 1.3, -0.45, 0.45),
    acceleration: P.v < targetSpeed ? 3.2 : -0.45
  };
}
function toggleAutopilot() {
  autopilot = !autopilot; P.routeIndex = 0;
  $('status').classList.toggle('autopilot', autopilot);
  $('status').querySelector('span').textContent = `FSD supervised · ${autopilot ? 'autopilot' : 'manual'}`;
}
function toggleLighting() {
  isNight = !isNight;
  sun.intensity = isNight ? 0.28 : 2.2;
  hemi.intensity = isNight ? 0.38 : 1.05;
  scene.fog.color.set(isNight ? 0x09121d : 0x78838c);
  scene.background = isNight ? new T.Color(0x07121e) : backgroundHDR || new T.Color(0x78838c);
  scene.environment = isNight ? null : environmentTarget ? environmentTarget.texture : null;
  if (ego.userData.headlights) ego.userData.headlights.forEach(light => light.intensity = isNight ? 350 : 0);
  $('lighting').textContent = isNight ? 'Night' : 'Day';
}
$('lighting').addEventListener('click', toggleLighting);
function stepPlayer(dt) {
  const acc = down('KeyW', 'ArrowUp'), br = down('KeyS', 'ArrowDown'), eb = keys.Space;
  let steerTarget = (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0);
  let acceleration = acc ? (P.v < 8 ? 6 : 3.2) : -0.35 - P.v * 0.02;
  let braking = false, hit = null;
  if (br) { acceleration = -12; braking = true; }
  if (eb) { acceleration = -26; braking = true; }
  if (autopilot && !br && !eb) {
    const command = autopilotCommand();
    steerTarget = command.steer / 0.45;
    acceleration = command.acceleration;
    braking = acceleration < -1;
  }
  const steerAngle = steerTarget * 0.45 * (1 - Math.min(P.v / 40, 0.6));
  P.steer += (steerAngle - P.steer) * Math.min(1, dt * 5);
  egoCar.wheels.forEach(wheelMesh => wheelMesh.rotation.x += P.v * dt / 0.37);
  egoCar.frontWheels.forEach(wheelMesh => wheelMesh.rotation.y = -P.steer);
  const fx = Math.sin(P.h), fz = -Math.cos(P.h), rx = Math.cos(P.h), rz = Math.sin(P.h);
  for (const o of objs) {
    const dx = o.m.position.x - P.x, dz = o.m.position.z - P.z, f = dx * fx + dz * fz, s = dx * rx + dz * rz;
    o.f = f;
    if (f > 0 && Math.abs(s) < o.w / 2 + 1.2 && (!hit || f < hit.f)) hit = o;
    if (Math.abs(f) < o.l / 2 + 2.2 && Math.abs(s) < o.w / 2 + 0.95) {
      P.flash = 1.4; P.v = 0; P.x -= fx * 0.5; P.z -= fz * 0.5;
    }
  }
  P.aeb = Math.max(0, P.aeb - dt); P.hit = hit;
  if (hit) {
    const closing = P.v - hit.vf, gap = hit.f - hit.l / 2 - 2.2;
    if (closing > 0 && gap < closing * closing / 16 + 4) { acceleration = -14; braking = true; P.aeb = 0.5; }
  }
  if (autopilot && hit && hit.f < 18) { acceleration = -12; braking = true; P.aeb = 0.5; }
  P.v = Math.min(40, Math.max(0, P.v + acceleration * dt));
  P.h += P.v / 2.9 * Math.tan(P.steer) * dt;
  P.h = Math.atan2(Math.sin(P.h), Math.cos(P.h));
  const pz = P.z;
  P.x += Math.sin(P.h) * P.v * dt; P.z -= Math.cos(P.h) * P.v * dt;
  if (Math.abs(P.x) > CITY_LIMIT) { P.x = Math.sign(P.x) * CITY_LIMIT; P.v *= 0.97; }
  for (const c of chunks) if (pz >= c.z0 + 13 && P.z < c.z0 + 13 && c.phase === 2 && P.v > 1.5) P.red = 3;
  P.flash = Math.max(0, P.flash - dt); P.red = Math.max(0, P.red - dt);
  ego.position.set(P.x, 0, P.z); ego.rotation.y = -P.h;
  path.material.color.set(braking ? 0xff4040 : 0x3aa8ff);
  let x = P.x, z = P.z, h = P.h;
  for (let i = 0; i <= S; i++) {
    const wx = Math.cos(h) * 0.85, wz = Math.sin(h) * 0.85;
    pp.set([x - wx, 0.06, z - wz, x + wx, 0.06, z + wz], i * 6);
    x += Math.sin(h) * 1.8; z -= Math.cos(h) * 1.8; h += 1.8 / 2.9 * Math.tan(P.steer);
  }
  pg.attributes.position.needsUpdate = true;
  egoO.vf = P.v; egoO.speed = P.v;
}
function stepTraffic(dt) {
  const all = objs.concat([egoO]);
  for (const o of cars) {
    const p = o.m.position;
    if (o.dir > 0) {
      let tgt = o.cruise;
      const d = redAhead(p.z); if (d < 28) tgt = Math.min(tgt, Math.max(0, (d - 3) * 0.6));
      for (const q of all) {
        if (q === o) continue;
        const f = p.z - q.m.position.z, s = Math.abs(p.x - q.m.position.x);
        if (f > 0 && f < 32 && s < q.w / 2 + 1.4) {
          const gap = f - q.l / 2 - 2.2; tgt = Math.min(tgt, gap < 2.5 ? 0 : Math.min(o.cruise, (q.vf > 0 ? q.vf : 0) + gap * 0.3));
        }
      }
      o.speed += Math.max(-9 * dt, Math.min(2.5 * dt, tgt - o.speed));
      p.z -= o.speed * dt; o.vf = o.speed;
      if (p.z < P.z - 650) spawn(o);
    } else {
      p.z += o.speed * dt; o.vf = -o.speed;
      if (p.z > P.z + 70) spawn(o);
    }
    o.traj.scale.z = 2 + o.speed * 1.3;
    if (!o.model) o.wheels.forEach(wheelMesh => wheelMesh.rotation.x += o.dir * o.speed * dt / 0.37);
    if (o.visual.userData.mixer) o.visual.userData.mixer.update(dt);
  }
}
function stepWorld(dt) {
  const worldSpan = N * L;
  for (const c of chunks) {
    if (c.z0 > P.z + L + 40) { c.z0 -= worldSpan; populate(c); }
    else if (c.z0 < P.z - worldSpan + L) { c.z0 += worldSpan; populate(c); }
    c.phase = phaseOf(c);
    c.lamps.forEach(lights => lights.forEach((material, i) => material.opacity = (i === c.phase ? 1 : 0.12)));
    for (const p of c.peds) {
      if (p.state === 'wait') { p.t -= dt; if (c.phase === 2 && p.t <= 0) p.state = 'walk'; }
      else { p.x += p.dir * 1.4 * dt; if (Math.abs(p.x - p.roadX) >= 9) { p.x = p.roadX + Math.sign(p.x - p.roadX) * 9; p.dir = -p.dir; p.state = 'wait'; p.t = R(0, 4); } }
      p.m.position.set(p.x, p.state === 'walk' ? Math.abs(Math.sin(clock.t * 9)) * 0.05 : 0, c.z0 + 9.5);
      p.m.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.vf = p.state === 'walk' ? p.dir * 1.4 : 0;
      if (p.visual.userData.mixer) p.visual.userData.mixer.update(dt);
    }
    for (const rider of c.cyclists) {
      rider.z -= rider.dir * rider.speed * dt;
      if (rider.z < c.z0 - L / 2 || rider.z > c.z0 + L / 2) rider.z = c.z0 + R(-35, 25);
      rider.m.position.set(rider.x, 0, rider.z);
      rider.vf = rider.dir * rider.speed;
      if (rider.person.visual.userData.mixer) rider.person.visual.userData.mixer.update(dt);
    }
  }
  objs = cars.concat(...chunks.map(c => c.peds.concat(c.cyclists)));
  ground.position.set(P.x, -0.05, P.z);
  sun.position.set(P.x - 30, 60, P.z + 20); sun.target.position.set(P.x, 0, P.z);
}

/* ---------- perception overlay & HUD ---------- */
const labEl = [];
for (let i = 0; i < 20; i++) { const d = document.createElement('div'); $('labels').appendChild(d); labEl.push(d); }
const v3 = new T.Vector3();
function drawMap() {
  const canvas = $('map'), ctx = canvas.getContext('2d'), size = canvas.width, scale = 0.23;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#09141c'; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.translate(size / 2, size / 2); ctx.rotate(-P.h);
  const xStart = Math.floor((P.x - 480) / 120) * 120;
  const zStart = 73 + Math.floor((P.z - 480 - 73) / 120) * 120;
  for (let x = xStart; x < P.x + 480; x += 120) {
    for (let z = zStart; z < P.z + 480; z += 120) {
      ctx.fillStyle = (Math.abs(x / 120 + z / 120) % 4 === 0) ? '#14251f' : '#111f28';
      ctx.fillRect((x + 12 - P.x) * scale, (z + 12 - P.z) * scale, 96 * scale, 96 * scale);
      ctx.fillStyle = '#26363b';
      for (let bx = 0; bx < 2; bx++) for (let bz = 0; bz < 2; bz++) {
        ctx.fillRect((x + 22 + bx * 43 - P.x) * scale, (z + 22 + bz * 43 - P.z) * scale, 24 * scale, 20 * scale);
      }
    }
  }
  ctx.strokeStyle = '#364753'; ctx.lineCap = 'butt'; ctx.lineWidth = HW * 2 * scale;
  for (let x = -720; x <= 720; x += 120) {
    ctx.beginPath(); ctx.moveTo((x - P.x) * scale, -size); ctx.lineTo((x - P.x) * scale, size); ctx.stroke();
  }
  const firstStreet = 73 + Math.round((P.z - 73) / 120) * 120;
  for (let z = firstStreet - 720; z <= firstStreet + 720; z += 120) {
    ctx.beginPath(); ctx.moveTo(-size, (z - P.z) * scale); ctx.lineTo(size, (z - P.z) * scale); ctx.stroke();
  }
  const route = routeWaypoints();
  ctx.strokeStyle = '#3ba8ff'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
  ctx.shadowColor = '#319fff'; ctx.shadowBlur = 7; ctx.beginPath(); ctx.moveTo(0, 0);
  for (const point of route) ctx.lineTo((point[0] - P.x) * scale, (point[1] - P.z) * scale);
  ctx.stroke(); ctx.shadowBlur = 0;
  for (const o of objs) {
    const dx = (o.m.position.x - P.x) * scale, dz = (o.m.position.z - P.z) * scale;
    if (Math.abs(dx) > size / 2 || Math.abs(dz) > size / 2) continue;
    ctx.fillStyle = o.kind === 'ped' ? '#ffd37a' : o.kind === 'cyclist' ? '#b293ff' : '#6fd9ff';
    ctx.beginPath(); ctx.arc(dx, dz, o.kind === 'car' ? 2.4 : 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ffcb72'; ctx.beginPath(); ctx.arc((DEST.x - P.x) * scale, (DEST.z - P.z) * scale, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff1c8'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(size / 2, size / 2);
  ctx.shadowColor = '#4fd8ff'; ctx.shadowBlur = 12;
  ctx.fillStyle = '#83e7ff'; ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(6, 8); ctx.lineTo(0, 5); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
}
$('map').addEventListener('pointerdown', event => {
  const rect = event.currentTarget.getBoundingClientRect(), size = event.currentTarget.width, scale = 0.23;
  const mapX = ((event.clientX - rect.left) / rect.width * size) - size / 2;
  const mapZ = ((event.clientY - rect.top) / rect.height * size) - size / 2;
  const cos = Math.cos(P.h), sin = Math.sin(P.h);
  const worldX = P.x + (cos * mapX - sin * mapZ) / scale;
  const worldZ = P.z + (sin * mapX + cos * mapZ) / scale;
  DEST.x = clamp(Math.round(worldX / 120) * 120, -600, 600);
  DEST.z = 73 + Math.round((worldZ - 73) / 120) * 120;
  P.routeIndex = 0;
  $('destination-hint').textContent = `Destination · ${Math.round(Math.hypot(DEST.x - P.x, DEST.z - P.z) / 100) / 10} km`;
});
function perceive() {
  let n = 0, li = 0;
  for (const c of chunks) for (const signal of c.signals) signal.lines.visible = false;
  for (const o of objs) {
    const dx = o.m.position.x - P.x, dz = o.m.position.z - P.z, d = Math.hypot(dx, dz);
    const vis = d < 90 && (mode === 3 || o.f > -10);
    o.lines.visible = o.fill.visible = vis;
    if (o.traj) o.traj.visible = vis;
    if (!vis) continue;
    n++;
    const danger = o === P.hit && o.f < 22;
    if (o.kind === 'car') o.lines.material = danger ? M.detR : M.det;
    o.fill.material = danger ? M.fillR : M.fill;
    if (li < labEl.length) {
      v3.set(o.m.position.x, 2.6, o.m.position.z).project(cam);
      const el = labEl[li];
      if (v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05) {
        li++; el.style.display = 'block';
        el.style.transform = `translate(-50%,-50%) translate(${(v3.x * 0.5 + 0.5) * innerWidth}px,${(-v3.y * 0.5 + 0.5) * innerHeight}px)`;
        const label = o.kind === 'ped' ? 'Pedestrian' : o.kind === 'cyclist' ? 'Cyclist' : o.vehicleType === 'delivery' ? 'Delivery van' : 'Vehicle';
        el.textContent = `${label} ${o.id || ''} · ${Math.round(d)} m`;
      }
    }
  }
  let nearestSignal = null, nearestSignalDistance = Infinity;
  for (const c of chunks) for (const signal of c.signals) {
    const dx = signal.x - P.x, dz = c.z0 + signal.z - P.z, distance = Math.hypot(dx, dz);
    const forward = dx * Math.sin(P.h) - dz * Math.cos(P.h);
    if (distance < 90 && (mode === 3 || forward > -10) && distance < nearestSignalDistance) {
      nearestSignal = { signal, chunk: c, distance }; nearestSignalDistance = distance;
    }
  }
  if (nearestSignal) {
    const phase = nearestSignal.chunk.phase, signal = nearestSignal.signal;
    signal.lines.visible = true; signal.lines.material = phase === 2 ? M.detR : M.det;
    n++;
    if (li < labEl.length) {
      v3.set(signal.x, signal.y, nearestSignal.chunk.z0 + signal.z).project(cam);
      if (v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05) {
        const el = labEl[li++];
        el.style.display = 'block';
        el.style.transform = `translate(-50%,-50%) translate(${(v3.x * 0.5 + 0.5) * innerWidth}px,${(-v3.y * 0.5 + 0.5) * innerHeight}px)`;
        el.textContent = `Traffic light ${['green', 'yellow', 'red'][phase]} · ${Math.round(nearestSignal.distance)} m`;
      }
    }
  }
  for (; li < labEl.length; li++) labEl[li].style.display = 'none';
  $('obj').textContent = n;
}
function hud() {
  const kmh = Math.round(P.v * 3.6); $('spd').textContent = kmh;
  drawMap();
  const waypoint = routeWaypoints()[0], intersectionDistance = Math.hypot(waypoint[0] - P.x, waypoint[1] - P.z);
  let signalChunk = null, signalError = Infinity;
  for (const c of chunks) {
    const error = Math.abs(c.z0 + 13 - waypoint[1]);
    if (error < signalError) { signalChunk = c; signalError = error; }
  }
  const signal = signalChunk ? ['green', 'yellow', 'red'][signalChunk.phase] : 'unknown';
  $('nav').textContent = `${Math.round(intersectionDistance)} m · ${signal}`;
  $('signal').textContent = intersectionDistance < 90 ? signal[0].toUpperCase() + signal.slice(1) : 'Scanning';
  $('destination-hint').textContent = `Destination · ${Math.round(Math.hypot(DEST.x - P.x, DEST.z - P.z) / 100) / 10} km`;
  const w = $('warn');
  const msg = P.flash > 0 ? 'Collision' : P.aeb > 0 ? 'Automatic emergency braking' : P.red > 0 ? 'Red light violation' : kmh > 55 ? 'Over the speed limit' : '';
  w.textContent = msg; w.classList.toggle('on', !!msg);
}

/* ---------- main loop ---------- */
let last = performance.now();
cp.set(0, 6, 40); cl.set(0, 1, 14);
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); last = now; clock.t += dt;
  stepPlayer(dt); stepTraffic(dt); stepWorld(dt);
  aimCamera(dt, false); perceive(); hud();
  renderer.render(scene, cam);
  requestAnimationFrame(loop);
}
stepWorld(0); aimCamera(0, true);
requestAnimationFrame(loop);
