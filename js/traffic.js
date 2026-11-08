import * as THREE from 'three';
import { GRID_N, PITCH, gridPos, blockCenter, LANE_IN, LANE_OUT, lightPhase, isPark, isPlaza } from './config.js';

const CAR_COLORS = [0xd8d8d8, 0x2b2f36, 0x7a1f1f, 0x1f3a6e, 0xc9c2ae, 0x3f6b3a, 0xe0a030, 0x6b6f76];
const STOP_T = 111;
const CROSS_END = 135;

function nodePos(i, j) { return new THREE.Vector3(gridPos(i), 0, gridPos(j)); }

export class Traffic {
  constructor(scene, count = 26) {
    this.scene = scene;
    this.cars = [];
    this.peds = [];
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d0, emissiveIntensity: 0.5 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x440000, emissive: 0xff2211, emissiveIntensity: 0.6 });
    this.glassMat = new THREE.MeshStandardMaterial({ color: 0x182028, metalness: 0.8, roughness: 0.2 });
    this.tireMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.9 });
    this.paints = CAR_COLORS.map(c => new THREE.MeshStandardMaterial({ color: c, metalness: 0.5, roughness: 0.4 }));
    for (let k = 0; k < count; k++) this.cars.push(this.spawnCar(k));
    this.buildPeds(36);
  }

  spawnCar(k) {
    const i = Math.floor(Math.random() * (GRID_N + 1)), j = Math.floor(Math.random() * (GRID_N + 1));
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([di, dj]) => i + di >= 0 && i + di <= GRID_N && j + dj >= 0 && j + dj <= GRID_N);
    const [di, dj] = dirs[Math.floor(Math.random() * dirs.length)];
    const car = {
      i, j, di, dj, t: 20 + Math.random() * 80,
      off: Math.random() < 0.5 ? LANE_IN : LANE_OUT,
      speed: 8 + Math.random() * 5, cruise: 9 + Math.random() * 4,
      pos: new THREE.Vector3(), heading: 0,
      knock: new THREE.Vector3(), next: null,
      mesh: this.buildCarMesh(this.paints[k % this.paints.length])
    };
    this.scene.add(car.mesh);
    return car;
  }

  buildCarMesh(paint) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.2), paint);
    body.position.y = 0.55; body.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.2), this.glassMat);
    cab.position.set(0, 1.05, -0.2); cab.castShadow = true;
    g.add(body, cab);
    const wg = new THREE.CylinderGeometry(0.33, 0.33, 0.26, 12); wg.rotateZ(Math.PI / 2);
    for (const [x, z] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
      const w = new THREE.Mesh(wg, this.tireMat); w.position.set(x, 0.33, z); g.add(w);
    }
    const hl = new THREE.BoxGeometry(0.34, 0.12, 0.06);
    for (const x of [-0.55, 0.55]) {
      const h = new THREE.Mesh(hl, this.headMat); h.position.set(x, 0.62, 2.11); g.add(h);
      const t = new THREE.Mesh(hl, this.tailMat); t.position.set(x, 0.62, -2.11); g.add(t);
    }
    return g;
  }

  buildPeds(n) {
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a679, roughness: 0.8 });
    const shirts = [0xb0413e, 0x3e6bb0, 0x4a4a4a, 0xd0c060, 0x60a060, 0xe0e0e0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
    const pants = new THREE.MeshStandardMaterial({ color: 0x2f3238, roughness: 0.9 });
    const blocks = [];
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) blocks.push([i, j]);
    for (let k = 0; k < n; k++) {
      const [i, j] = blocks[k % blocks.length];
      const g = new THREE.Group();
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.72, 0.22), pants); legs.position.y = 0.36;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.58, 0.26), shirts[k % shirts.length]); torso.position.y = 1.0;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin); head.position.y = 1.45;
      torso.castShadow = true;
      g.add(legs, torso, head);
      this.scene.add(g);
      this.peds.push({
        i, j, s: Math.random() * 400, dir: Math.random() < 0.5 ? 1 : -1,
        speed: 1.1 + Math.random() * 0.7, mesh: g, legs,
        state: 'walk', hitT: 0, vel: new THREE.Vector3(), spin: 0, phase: Math.random() * 6
      });
    }
  }

  pedPath(p, s) {
    const x0 = gridPos(p.i) + 13, x1 = gridPos(p.i + 1) - 13;
    const z0 = gridPos(p.j) + 13, z1 = gridPos(p.j + 1) - 13;
    const w = x1 - x0, h = z1 - z0, per = 2 * (w + h);
    let d = ((s % per) + per) % per;
    if (d < w) return { x: x0 + d, z: z0, h: Math.PI / 2 };
    d -= w;
    if (d < h) return { x: x1, z: z0 + d, h: 0 };
    d -= h;
    if (d < w) return { x: x1 - d, z: z1, h: -Math.PI / 2 };
    d -= w;
    return { x: x0, z: z1 - d, h: Math.PI };
  }

  edgeFrame(c) {
    const A = nodePos(c.i, c.j);
    const dir = new THREE.Vector3(c.di, 0, c.dj);
    const right = new THREE.Vector3(-dir.z, 0, dir.x);
    return { A, dir, right };
  }

  chooseNext(c) {
    const ni = c.i + c.di, nj = c.j + c.dj;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .filter(([di, dj]) => !(di === -c.di && dj === -c.dj))
      .filter(([di, dj]) => ni + di >= 0 && ni + di <= GRID_N && nj + dj >= 0 && nj + dj <= GRID_N);
    const straight = opts.find(([di, dj]) => di === c.di && dj === c.dj);
    let pick;
    if (straight && Math.random() < 0.62) pick = straight;
    else pick = opts[Math.floor(Math.random() * opts.length)];
    const off = Math.random() < 0.5 ? LANE_IN : LANE_OUT;
    const B = nodePos(ni, nj);
    const { dir, right } = this.edgeFrame(c);
    const ndir = new THREE.Vector3(pick[0], 0, pick[1]);
    const nright = new THREE.Vector3(-ndir.z, 0, ndir.x);
    c.next = {
      di: pick[0], dj: pick[1], off,
      p0: B.clone().addScaledVector(dir, -11).addScaledVector(right, c.off),
      p1: B.clone().addScaledVector(ndir, 11).addScaledVector(nright, off),
      pc: B.clone().addScaledVector(right, c.off * 0.25).addScaledVector(nright, off * 0.25)
    };
  }

  update(dt, player, t, audio) {
    const ph = lightPhase(t);
    for (const c of this.cars) {
      const { A, dir, right } = this.edgeFrame(c);
      let target = c.cruise;
      const axis = c.dj !== 0 ? 'ns' : 'ew';
      if (ph[axis] !== 'green' && c.t > STOP_T - 26 && c.t < STOP_T) target = 0;
      for (const o of this.cars) {
        if (o === c) continue;
        const rel = o.pos.clone().sub(c.pos);
        const ahead = rel.dot(dir), lat = Math.abs(rel.dot(right));
        if (ahead > 0 && ahead < 13 && lat < 2.3) target = Math.min(target, Math.max(0, o.speed * (ahead - 4.5) / 8));
      }
      const relP = player.pos.clone().sub(c.pos);
      const aheadP = relP.dot(dir), latP = Math.abs(relP.dot(right));
      if (aheadP > 0 && aheadP < 15 && latP < 2.6) target = Math.min(target, Math.max(0, (aheadP - 5) * 1.2));
      const acc = target > c.speed ? 3.6 : -9;
      c.speed = Math.max(0, c.speed + acc * dt);
      if (target > c.speed && c.speed > target - 0.1) c.speed = target;
      c.t += c.speed * dt;

      if (c.t >= STOP_T && !c.next) this.chooseNext(c);
      let pos, heading;
      if (c.t < STOP_T || !c.next) {
        pos = A.clone().addScaledVector(dir, c.t).addScaledVector(right, c.off);
        heading = Math.atan2(dir.x, dir.z);
      } else if (c.t < CROSS_END) {
        const u = (c.t - STOP_T) / (CROSS_END - STOP_T);
        const n = c.next;
        pos = n.p0.clone().multiplyScalar((1 - u) ** 2)
          .addScaledVector(n.pc, 2 * (1 - u) * u)
          .addScaledVector(n.p1, u * u);
        const tan = n.pc.clone().sub(n.p0).multiplyScalar(1 - u).addScaledVector(n.p1.clone().sub(n.pc), u);
        heading = Math.atan2(tan.x, tan.z);
        if (c.t + c.speed * dt >= CROSS_END) {
          c.i += c.di; c.j += c.dj;
          c.di = n.di; c.dj = n.dj; c.off = n.off;
          c.t = 11 + (c.t + c.speed * dt - CROSS_END);
          c.next = null;
        }
      } else {
        const n = c.next;
        pos = n.p1.clone();
        heading = Math.atan2(n.di, n.dj);
        c.i += c.di; c.j += c.dj;
        c.di = n.di; c.dj = n.dj; c.off = n.off;
        c.t = 11; c.next = null;
      }
      c.pos.copy(pos).add(c.knock);
      c.heading = heading;
      c.knock.multiplyScalar(Math.exp(-3 * dt));
      c.mesh.position.copy(c.pos);
      c.mesh.rotation.y = heading;

      const d = c.pos.distanceTo(player.pos);
      if (d < 3.1) {
        const n = c.pos.clone().sub(player.pos).setY(0);
        const len = n.length() || 1; n.divideScalar(len);
        const impact = Math.max(0, -player.vel.dot(n));
        c.knock.addScaledVector(n, (2.9 - d) * 0.6 + impact * 0.08);
        c.speed *= 0.4;
        player.vel.addScaledVector(n, -impact * 0.35);
        if (impact > 2.5 && !c.honkCd) { audio.honk(); audio.crash(impact * 0.6); c.honkCd = 1.2; player.events.crash = Math.max(player.events.crash || 0, impact * 0.7); }
      }
      if (c.honkCd) c.honkCd -= dt;
    }

    for (const p of this.peds) {
      if (p.state === 'hit') {
        p.hitT -= dt;
        p.vel.y -= 18 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        if (p.mesh.position.y < 0) { p.mesh.position.y = 0; p.vel.multiplyScalar(0.6); p.vel.y = 0; }
        p.mesh.rotation.x += p.spin * dt;
        p.mesh.rotation.z += p.spin * 0.6 * dt;
        if (p.hitT <= 0) {
          p.state = 'walk';
          p.mesh.rotation.set(0, 0, 0);
          p.s = Math.random() * 400;
        }
        continue;
      }
      const dp = p.mesh.position.distanceTo(player.pos);
      const flee = dp < 11 && Math.abs(player.speed) > 6;
      p.s += p.dir * p.speed * (flee ? 3.4 : 1) * dt;
      const pt = this.pedPath(p, p.s);
      p.mesh.position.set(pt.x, Math.abs(Math.sin(t * 7 + p.phase)) * 0.05, pt.z);
      p.mesh.rotation.y = pt.h + (p.dir < 0 ? Math.PI : 0);
      p.legs.rotation.x = Math.sin(t * (flee ? 14 : 7) + p.phase) * 0.5;
      if (dp < 1.5 && Math.abs(player.speed) > 2) {
        p.state = 'hit'; p.hitT = 3.5;
        p.vel.copy(player.vel).multiplyScalar(0.45); p.vel.y = 3.2;
        p.spin = 6 + Math.random() * 4;
        audio.thud();
      }
    }
  }

  setNight(mode) {
    const on = mode !== 'day';
    this.headMat.emissiveIntensity = on ? 2.2 : 0.5;
    this.tailMat.emissiveIntensity = on ? 1.8 : 0.6;
  }
}