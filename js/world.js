import * as THREE from 'three';
import { GRID_N, PITCH, ROAD_W, SIDEWALK_W, BLOCK_BUILD, CITY_HALF, gridPos, blockCenter, isPark, isPlaza, lightPhase } from './config.js';

const TEX_SIZE = 4096;
const WORLD_SIZE = CITY_HALF * 2;
const S = TEX_SIZE / WORLD_SIZE;
const px = v => (v + CITY_HALF) * S;

function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = TEX_SIZE;
  const g = c.getContext('2d');
  const m = v => v * S;

  g.fillStyle = '#57744a';
  g.fillRect(0, 0, TEX_SIZE, TEX_SIZE);

  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const x0 = gridPos(i) + ROAD_W / 2, z0 = gridPos(j) + ROAD_W / 2;
    const w = PITCH - ROAD_W;
    g.fillStyle = '#b3b0a6';
    g.fillRect(px(x0), px(z0), m(w), m(w));
    const bx = x0 + SIDEWALK_W, bz = z0 + SIDEWALK_W;
    if (isPark(i, j)) {
      g.fillStyle = '#4c7a40';
      g.fillRect(px(bx), px(bz), m(BLOCK_BUILD), m(BLOCK_BUILD));
      g.fillStyle = '#c9bd97';
      const cx = blockCenter(i), cz = blockCenter(j);
      g.fillRect(px(bx), px(cz - 2), m(BLOCK_BUILD), m(4));
      g.fillRect(px(cx - 2), px(bz), m(4), m(BLOCK_BUILD));
    } else if (isPlaza(i, j)) {
      g.fillStyle = '#a9a498';
      g.fillRect(px(bx), px(bz), m(BLOCK_BUILD), m(BLOCK_BUILD));
      g.strokeStyle = '#948f83'; g.lineWidth = m(0.6);
      for (let r = 8; r < 44; r += 8) {
        g.beginPath(); g.arc(px(blockCenter(i)), px(blockCenter(j)), m(r), 0, Math.PI * 2); g.stroke();
      }
    } else {
      g.fillStyle = '#8e8e87';
      g.fillRect(px(bx), px(bz), m(BLOCK_BUILD), m(BLOCK_BUILD));
    }
    g.strokeStyle = '#8f8c82'; g.lineWidth = m(0.35);
    g.strokeRect(px(x0 + 0.2), px(z0 + 0.2), m(w - 0.4), m(w - 0.4));
  }

  const ext = gridPos(GRID_N) + ROAD_W / 2;
  g.fillStyle = '#43474e';
  for (let i = 0; i <= GRID_N; i++) {
    const p = gridPos(i);
    g.fillRect(px(p - ROAD_W / 2), px(-ext), m(ROAD_W), m(ext * 2));
    g.fillRect(px(-ext), px(p - ROAD_W / 2), m(ext * 2), m(ROAD_W));
  }

  const nearCross = v => {
    for (let i = 0; i <= GRID_N; i++) if (Math.abs(v - gridPos(i)) < 13) return true;
    return false;
  };
  const line = (x1, z1, x2, z2, w, color) => {
    g.strokeStyle = color; g.lineWidth = m(w);
    g.beginPath(); g.moveTo(px(x1), px(z1)); g.lineTo(px(x2), px(z2)); g.stroke();
  };

  for (let i = 0; i <= GRID_N; i++) {
    const p = gridPos(i);
    for (let seg = -ext; seg < ext; seg += 2) {
      if (nearCross(seg + 1)) continue;
      line(p - 9.3, seg, p - 9.3, seg + 2, 0.25, '#d8d8d2');
      line(p + 9.3, seg, p + 9.3, seg + 2, 0.25, '#d8d8d2');
      line(seg, p - 9.3, seg + 2, p - 9.3, 0.25, '#d8d8d2');
      line(seg, p + 9.3, seg + 2, p + 9.3, 0.25, '#d8d8d2');
      line(p - 0.4, seg, p - 0.4, seg + 2, 0.18, '#d8b13a');
      line(p + 0.4, seg, p + 0.4, seg + 2, 0.18, '#d8b13a');
      line(seg, p - 0.4, seg + 2, p - 0.4, 0.18, '#d8b13a');
      line(seg, p + 0.4, seg + 2, p + 0.4, 0.18, '#d8b13a');
    }
    for (let seg = -ext; seg < ext; seg += 8) {
      if (nearCross(seg + 1.5)) continue;
      line(p - 5, seg, p - 5, seg + 3, 0.22, '#e6e6e0');
      line(p + 5, seg, p + 5, seg + 3, 0.22, '#e6e6e0');
      line(seg, p - 5, seg + 3, p - 5, 0.22, '#e6e6e0');
      line(seg, p + 5, seg + 3, p + 5, 0.22, '#e6e6e0');
    }
  }

  g.fillStyle = '#e8e8e2';
  for (let i = 0; i <= GRID_N; i++) for (let j = 0; j <= GRID_N; j++) {
    const gx = gridPos(i), gz = gridPos(j);
    for (let k = -8.4; k <= 8.4; k += 1.5) {
      g.fillRect(px(gx + k), px(gz - 14.6), m(0.75), m(3.2));
      g.fillRect(px(gx + k), px(gz + 11.4), m(0.75), m(3.2));
      g.fillRect(px(gx - 14.6), px(gz + k), m(3.2), m(0.75));
      g.fillRect(px(gx + 11.4), px(gz + k), m(3.2), m(0.75));
    }
    g.fillRect(px(gx - 9.4), px(gz - 10.6), m(8.8), m(0.6));
    g.fillRect(px(gx + 0.6), px(gz + 10.0), m(8.8), m(0.6));
    g.fillRect(px(gx - 10.6), px(gz + 0.6), m(0.6), m(8.8));
    g.fillRect(px(gx + 10.0), px(gz - 9.4), m(0.6), m(8.8));
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const FACADES = [
  { wall: '#5d6b78', win: '#9fc6dd', lit: '#ffd98f', frame: '#414c57' },
  { wall: '#8b8578', win: '#3d4a55', lit: '#ffcf7d', frame: '#6e6a5e' },
  { wall: '#96543c', win: '#2e3a44', lit: '#ffd98f', frame: '#7a4230' },
  { wall: '#c9c2ae', win: '#4a5a66', lit: '#ffe2a0', frame: '#a89f8a' },
  { wall: '#4a4f57', win: '#7fb2cc', lit: '#cfe4ff', frame: '#33383f' },
  { wall: '#d8d5cd', win: '#5d7585', lit: '#ffd98f', frame: '#b5b2aa' }
];

function makeFacadeTextures(style) {
  const W = 256, H = 512, cols = 8, rows = 16;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const ge = e.getContext('2d');
  g.fillStyle = style.wall; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const cw = W / cols, ch = H / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = i * cw + cw * 0.18, y = j * ch + ch * 0.18, w = cw * 0.64, h = ch * 0.6;
    g.fillStyle = style.frame; g.fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    g.fillStyle = style.win; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, y, w, h * 0.35);
    if (Math.random() < 0.34) { ge.fillStyle = style.lit; ge.fillRect(x, y, w, h); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const em = new THREE.CanvasTexture(e); em.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return { map, em };
}

function wedgeGeometry(len, rise, width) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0); shape.lineTo(len, 0); shape.lineTo(len, rise); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geo.translate(0, 0, -width / 2);
  return geo;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = [];
    this.ramps = [];
    this.buildingMats = [];
    this.mode = 'day';

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
      new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 0.94, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ color: 0x275d78, roughness: 0.22, metalness: 0.35 })
    );
    outer.rotation.x = -Math.PI / 2; outer.position.y = -0.15;
    this.group.add(outer);

    const edge = gridPos(GRID_N) + ROAD_W / 2 + 4;
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.85 });
    const barGeo = new THREE.BoxGeometry(1, 0.9, 1);
    for (const [x, z, hw, hd] of [[0, edge, edge + 2, 0.6], [0, -edge, edge + 2, 0.6], [edge, 0, 0.6, edge + 2], [-edge, 0, 0.6, edge + 2]]) {
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.scale.set(hw * 2, 1, hd * 2);
      bar.position.set(x, 0.45, z);
      bar.castShadow = true;
      this.group.add(bar);
      this.addCollider(x, z, hw, hd);
    }

    this.facades = FACADES.map(makeFacadeTextures);
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0x3c3f44, roughness: 0.95 });
    this.buildBuildings();
    this.buildRamps();
    this.buildTrees();
    this.buildLamps();
    this.buildTrafficLights();
    this.buildFountain();
    this.buildStars();
    this.buildLights();
  }

  addCollider(x, z, hw, hd) { this.colliders.push({ x, z, hw, hd }); }

  buildBuildings() {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const rng = mulberry(42);
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      if (isPark(i, j) || isPlaza(i, j)) continue;
      const cx = blockCenter(i), cz = blockCenter(j);
      const downtown = Math.max(0.35, 1.6 - Math.hypot(cx, cz) / 300);
      const slots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [sx, sz] of slots) {
        if (rng() < 0.14) continue;
        const w = 20 + rng() * 18, d = 20 + rng() * 18;
        const h = Math.min(125, (16 + rng() * 46) * downtown + rng() * 12);
        const x = cx + sx * (BLOCK_BUILD / 4) + (rng() - 0.5) * 6;
        const z = cz + sz * (BLOCK_BUILD / 4) + (rng() - 0.5) * 6;
        const f = this.facades[Math.floor(rng() * this.facades.length)];
        const map = f.map.clone(); map.needsUpdate = true; map.repeat.set(w / 24, h / 32);
        const em = f.em.clone(); em.needsUpdate = true; em.repeat.set(w / 24, h / 32);
        const mat = new THREE.MeshStandardMaterial({
          map, emissiveMap: em, emissive: 0xffcf8a, emissiveIntensity: 0, roughness: 0.82, metalness: 0.12
        });
        this.buildingMats.push(mat);
        const mesh = new THREE.Mesh(box, [mat, mat, this.roofMat, this.roofMat, mat, mat]);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true; mesh.receiveShadow = true;
        this.group.add(mesh);
        this.addCollider(x, z, w / 2, d / 2);
        if (h > 55) {
          const ac = new THREE.Mesh(box, this.roofMat);
          ac.scale.set(w * 0.3, 2.5, d * 0.3);
          ac.position.set(x + w * 0.15, h + 1.25, z - d * 0.1);
          ac.castShadow = true;
          this.group.add(ac);
        }
      }
    }
  }

  buildRamps() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd8a13a, roughness: 0.7 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.8 });
    const defs = [
      { block: [1, 1], rot: 0, ox: -20, oz: -24 },
      { block: [4, 3], rot: Math.PI / 2, ox: 24, oz: -20 }
    ];
    for (const d of defs) {
      const cx = blockCenter(d.block[0]) + d.ox, cz = blockCenter(d.block[1]) + d.oz;
      const len = 14, rise = 3.4, width = 9;
      const mesh = new THREE.Mesh(wedgeGeometry(len, rise, width), mat);
      mesh.rotation.y = d.rot;
      mesh.position.set(cx, 0, cz);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.group.add(mesh);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, width), stripe);
      top.rotation.y = d.rot;
      const ex = cx + Math.cos(d.rot) * len, ez = cz - Math.sin(d.rot) * len;
      top.position.set(ex, rise + 0.02, ez);
      this.group.add(top);
      this.ramps.push({ x: cx, z: cz, rot: d.rot, len, rise, width });
    }
  }

  buildTrees() {
    const rng = mulberry(7);
    const spots = [];
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      const cx = blockCenter(i), cz = blockCenter(j);
      if (isPark(i, j)) {
        for (let k = 0; k < 16; k++) {
          const x = cx + (rng() - 0.5) * (BLOCK_BUILD - 10);
          const z = cz + (rng() - 0.5) * (BLOCK_BUILD - 10);
          if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4) continue;
          if (this.ramps.some(r => Math.hypot(x - r.x, z - r.z) < 20)) continue;
          spots.push([x, z, 1 + rng() * 0.7]);
        }
      } else if (isPlaza(i, j)) {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
          spots.push([cx + sx * 36, cz + sz * 36, 1.1]);
      } else {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          if (rng() < 0.5) spots.push([cx + sx * (BLOCK_BUILD / 2 + 3), cz + sz * (BLOCK_BUILD / 2 + 3), 0.8 + rng() * 0.4]);
        }
      }
    }
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 2.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });
    const leafGeo = new THREE.IcosahedronGeometry(1.9, 0);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.9, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    const col = new THREE.Color();
    spots.forEach(([x, z, s], k) => {
      pos.set(x, 1.3 * s, z); sc.set(s, s, s); q.identity();
      mtx.compose(pos, q, sc); trunks.setMatrixAt(k, mtx);
      pos.set(x, (2.6 + 1.4) * s, z); sc.set(s, s * 1.25, s);
      mtx.compose(pos, q, sc); leaves.setMatrixAt(k, mtx);
      col.setHSL(0.28 + Math.random() * 0.06, 0.45, 0.28 + Math.random() * 0.12);
      leaves.setColorAt(k, col);
      this.addCollider(x, z, 0.45, 0.45);
    });
    trunks.castShadow = true; leaves.castShadow = true;
    this.group.add(trunks, leaves);
  }

  buildLamps() {
    const pts = [];
    const ext = gridPos(GRID_N);
    for (let i = 0; i <= GRID_N; i++) {
      const p = gridPos(i);
      for (let v = -ext + 18; v <= ext - 18; v += 41) {
        let skip = false;
        for (let k = 0; k <= GRID_N; k++) if (Math.abs(v - gridPos(k)) < 15) skip = true;
        if (skip) continue;
        pts.push({ x: p - ROAD_W / 2 - 3, z: v, dx: 1, dz: 0 });
        pts.push({ x: p + ROAD_W / 2 + 3, z: v, dx: -1, dz: 0 });
        pts.push({ x: v, z: p - ROAD_W / 2 - 3, dx: 0, dz: 1 });
        pts.push({ x: v, z: p + ROAD_W / 2 + 3, dx: 0, dz: -1 });
      }
    }
    const poleGeo = new THREE.CylinderGeometry(0.11, 0.14, 7, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.6, metalness: 0.5 });
    const headGeo = new THREE.BoxGeometry(1.1, 0.22, 0.45);
    this.lampHeadMat = new THREE.MeshStandardMaterial({ color: 0x555a60, emissive: 0xfff2c0, emissiveIntensity: 0 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, pts.length);
    const heads = new THREE.InstancedMesh(headGeo, this.lampHeadMat, pts.length);
    const poolGeo = new THREE.PlaneGeometry(11, 11);
    const pc = document.createElement('canvas'); pc.width = pc.height = 128;
    const pg = pc.getContext('2d');
    const grad = pg.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,236,170,0.5)');
    grad.addColorStop(1, 'rgba(255,236,170,0)');
    pg.fillStyle = grad; pg.fillRect(0, 0, 128, 128);
    const poolMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(pc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    });
    this.pools = new THREE.InstancedMesh(poolGeo, poolMat, pts.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    pts.forEach((p, k) => {
      pos.set(p.x, 3.5, p.z); q.identity();
      mtx.compose(pos, q, one); poles.setMatrixAt(k, mtx);
      pos.set(p.x + p.dx * 1.6, 7, p.z + p.dz * 1.6);
      e.set(0, p.dx !== 0 ? 0 : Math.PI / 2, 0); q.setFromEuler(e);
      mtx.compose(pos, q, one); heads.setMatrixAt(k, mtx);
      pos.set(p.x + p.dx * 2.2, 0.06, p.z + p.dz * 2.2);
      e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e);
      mtx.compose(pos, q, one); this.pools.setMatrixAt(k, mtx);
    });
    this.pools.visible = false;
    this.group.add(poles, heads, this.pools);
  }

  buildTrafficLights() {
    this.tlEntries = [];
    const pts = [];
    for (let i = 0; i <= GRID_N; i++) for (let j = 0; j <= GRID_N; j++) {
      const gx = gridPos(i), gz = gridPos(j);
      pts.push({ x: gx - 11.5, z: gz - 11.5, axis: 'ns' });
      pts.push({ x: gx + 11.5, z: gz + 11.5, axis: 'ns' });
      pts.push({ x: gx + 11.5, z: gz - 11.5, axis: 'ew' });
      pts.push({ x: gx - 11.5, z: gz + 11.5, axis: 'ew' });
    }
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.11, 5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.6, metalness: 0.4 });
    const headGeo = new THREE.BoxGeometry(0.4, 1.05, 0.4);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, pts.length);
    this.tlHeads = new THREE.InstancedMesh(headGeo, headMat, pts.length);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    pts.forEach((p, k) => {
      pos.set(p.x, 2.5, p.z); q.identity();
      mtx.compose(pos, q, one); poles.setMatrixAt(k, mtx);
      pos.set(p.x, 5.2, p.z);
      mtx.compose(pos, q, one); this.tlHeads.setMatrixAt(k, mtx);
      this.tlEntries.push(p.axis);
    });
    this.tlPhaseKey = '';
    this.group.add(poles, this.tlHeads);
  }

  buildFountain() {
    const cx = blockCenter(2), cz = blockCenter(4);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9.6, 1, 24),
      new THREE.MeshStandardMaterial({ color: 0x9a968a, roughness: 0.9 })
    );
    base.position.set(cx, 0.5, cz); base.castShadow = true; base.receiveShadow = true;
    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(8.4, 8.4, 0.3, 24),
      new THREE.MeshStandardMaterial({ color: 0x3f7f9f, roughness: 0.15, metalness: 0.4 })
    );
    water.position.set(cx, 1.0, cz);
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.2, 4, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a867a, roughness: 0.9 })
    );
    column.position.set(cx, 2.5, cz); column.castShadow = true;
    this.group.add(base, water, column);
    this.addCollider(cx, cz, 9.6, 9.6);
  }

  buildStars() {
    const n = 700, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * Math.PI * 2, p = Math.random() * Math.PI * 0.45;
      arr[i * 3] = Math.cos(t) * Math.cos(p) * 1500;
      arr[i * 3 + 1] = Math.sin(p) * 1500 + 60;
      arr[i * 3 + 2] = Math.sin(t) * Math.cos(p) * 1500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xcdd6ff, size: 2.2, sizeAttenuation: false, fog: false }));
    this.stars.visible = false;
    this.group.add(this.stars);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x6a6f5a, 0.9);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 20; sc.far = 600;
    this.sun.shadow.bias = -0.0006;
    this.sunDir = new THREE.Vector3(0.5, 0.8, 0.35).normalize();
    this.scene.add(this.hemi, this.sun, this.sun.target);
  }

  setMode(mode) {
    this.mode = mode;
    const cfg = {
      day: { bg: 0x87b5e0, fog: 0x9cc0e0, hemi: 0.9, sunI: 2.2, sunC: 0xfff2dc, dir: [0.5, 0.8, 0.35], emis: 0, lamp: 0, pools: false, stars: false },
      dusk: { bg: 0x2e3a5c, fog: 0x6a5a70, hemi: 0.42, sunI: 1.5, sunC: 0xff8c4a, dir: [0.9, 0.22, 0.3], emis: 0.55, lamp: 1.4, pools: true, stars: false },
      night: { bg: 0x070b16, fog: 0x0a1020, hemi: 0.16, sunI: 0.22, sunC: 0x8fa8ff, dir: [-0.4, 0.7, -0.3], emis: 1.1, lamp: 2.4, pools: true, stars: true }
    }[mode];
    this.scene.background = new THREE.Color(cfg.bg);
    this.scene.fog = new THREE.Fog(cfg.fog, 120, mode === 'night' ? 520 : 760);
    this.hemi.intensity = cfg.hemi;
    this.sun.intensity = cfg.sunI;
    this.sun.color.set(cfg.sunC);
    this.sunDir.set(...cfg.dir).normalize();
    for (const m of this.buildingMats) m.emissiveIntensity = cfg.emis;
    this.lampHeadMat.emissiveIntensity = cfg.lamp;
    this.pools.visible = cfg.pools;
    this.stars.visible = cfg.stars;
  }

  updateShadow(target) {
    this.sun.position.copy(target).addScaledVector(this.sunDir, 260);
    this.sun.target.position.copy(target);
  }

  updateTrafficLights(t) {
    const ph = lightPhase(t);
    const key = ph.ns + ph.ew;
    if (key === this.tlPhaseKey) return;
    this.tlPhaseKey = key;
    const colors = { green: 0x2eff5e, yellow: 0xffd23e, red: 0xff3b30 };
    const col = new THREE.Color();
    this.tlEntries.forEach((axis, k) => {
      col.set(colors[ph[axis]]);
      this.tlHeads.setColorAt(k, col);
    });
    this.tlHeads.instanceColor.needsUpdate = true;
  }

  groundHeight(x, z) {
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z;
      const lx = dx * Math.cos(r.rot) - dz * Math.sin(r.rot);
      const lz = dx * Math.sin(r.rot) + dz * Math.cos(r.rot);
      if (lx >= 0 && lx <= r.len && Math.abs(lz) <= r.width / 2) return r.rise * lx / r.len;
    }
    return 0;
  }

  collideCircle(x, z, r) {
    let hit = null;
    for (const c of this.colliders) {
      const cx = Math.max(c.x - c.hw, Math.min(x, c.x + c.hw));
      const cz = Math.max(c.z - c.hd, Math.min(z, c.z + c.hd));
      let dx = x - cx, dz = z - cz;
      let d = Math.hypot(dx, dz);
      if (d < r) {
        if (d < 1e-4) { dx = x - c.x; dz = z - c.z; d = Math.hypot(dx, dz) || 1; }
        hit = { nx: dx / d, nz: dz / d, depth: r - d };
        break;
      }
    }
    return hit;
  }
}

function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}