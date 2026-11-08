import * as THREE from 'three';
import { BOUND, nearestRoadPoint } from './config.js';

const SKID_MAX = 900;
const SMOKE_MAX = 110;

export class PlayerCar {
  constructor(scene, color = 0xc41e2a) {
    this.scene = scene;
    this.pos = new THREE.Vector3(2.6, 0, 340);
    this.heading = Math.PI;
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.airborne = false;
    this.steer = 0;
    this.speed = 0;
    this.drifting = false;
    this.roll = 0; this.pitch = 0;
    this.spin = 0;
    this.events = {};

    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    scene.add(this.root);
    this.buildMesh(color);

    this.headlights = [];
    for (const sx of [-0.62, 0.62]) {
      const sl = new THREE.SpotLight(0xfff6d8, 0, 70, 0.46, 0.45, 1.2);
      sl.position.set(sx, 0.62, 2.2);
      sl.target.position.set(sx * 1.6, 0.1, 30);
      this.root.add(sl, sl.target);
      this.headlights.push(sl);
    }

    const blobC = document.createElement('canvas'); blobC.width = blobC.height = 64;
    const bg = blobC.getContext('2d');
    const gr = bg.createRadialGradient(32, 32, 4, 32, 32, 30);
    gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    bg.fillStyle = gr; bg.fillRect(0, 0, 64, 64);
    this.blob = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 3.1),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blobC), transparent: true, depthWrite: false })
    );
    this.blob.rotation.x = -Math.PI / 2;
    scene.add(this.blob);

    this.initSkids();
    this.initSmoke();
    this.prevRear = null;
  }

  buildMesh(color) {
    const paint = new THREE.MeshStandardMaterial({ color, metalness: 0.65, roughness: 0.32 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.9, roughness: 0.12 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xb9bec6, metalness: 0.85, roughness: 0.3 });

    const profile = new THREE.Shape();
    profile.moveTo(2.35, 0.3);
    profile.lineTo(2.42, 0.55); profile.lineTo(2.2, 0.72); profile.lineTo(1.1, 0.8);
    profile.lineTo(0.55, 1.12); profile.lineTo(-0.75, 1.15); profile.lineTo(-1.35, 0.82);
    profile.lineTo(-2.15, 0.78); profile.lineTo(-2.4, 0.6); profile.lineTo(-2.35, 0.3);
    profile.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(profile, { depth: 1.86, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    bodyGeo.translate(0, 0, -0.93);
    bodyGeo.rotateY(-Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, paint);
    bodyMesh.castShadow = true;
    this.body.add(bodyMesh);

    const cab = new THREE.Shape();
    cab.moveTo(1.08, 0.8); cab.lineTo(0.55, 1.1); cab.lineTo(-0.72, 1.13); cab.lineTo(-1.3, 0.8); cab.closePath();
    const cabGeo = new THREE.ExtrudeGeometry(cab, { depth: 1.6, bevelEnabled: false });
    cabGeo.translate(0, 0, -0.8); cabGeo.rotateY(-Math.PI / 2);
    this.body.add(new THREE.Mesh(cabGeo, glass));

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true;
      this.body.add(m); return m;
    };
    add(new THREE.BoxGeometry(1.9, 0.1, 0.34), dark, 0, 0.27, 2.3);
    add(new THREE.BoxGeometry(1.75, 0.07, 0.36), dark, 0, 1.02, -2.12);
    add(new THREE.BoxGeometry(0.09, 0.22, 0.12), dark, -0.7, 0.9, -2.12);
    add(new THREE.BoxGeometry(0.09, 0.22, 0.12), dark, 0.7, 0.9, -2.12);
    add(new THREE.BoxGeometry(0.12, 0.1, 0.24), paint, -1.0, 0.86, 0.72);
    add(new THREE.BoxGeometry(0.12, 0.1, 0.24), paint, 1.0, 0.86, 0.72);

    this.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff8dc, emissiveIntensity: 0.7 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2211, emissiveIntensity: 0.8 });
    add(new THREE.BoxGeometry(0.44, 0.13, 0.08), this.headMat, -0.62, 0.62, 2.36);
    add(new THREE.BoxGeometry(0.44, 0.13, 0.08), this.headMat, 0.62, 0.62, 2.36);
    add(new THREE.BoxGeometry(1.7, 0.11, 0.07), this.tailMat, 0, 0.66, -2.38);
    const exGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8);
    exGeo.rotateX(Math.PI / 2);
    add(exGeo, silver, -0.5, 0.34, -2.4); add(exGeo, silver, 0.5, 0.34, -2.4);

    this.wheels = []; this.steerPivots = [];
    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 18); tireGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.32, 10); rimGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.92 });
    for (const [x, z, front] of [[-0.92, 1.45, 1], [0.92, 1.45, 1], [-0.92, -1.45, 0], [0.92, -1.45, 0]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, 0.36, z);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat); tire.castShadow = true;
      spin.add(tire, new THREE.Mesh(rimGeo, silver));
      pivot.add(spin);
      this.root.add(pivot);
      this.wheels.push(spin);
      if (front) this.steerPivots.push(pivot);
    }
  }

  setColor(color) {
    this.body.children[0].material.color.set(color);
  }

  initSkids() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(SKID_MAX * 4 * 3);
    const idx = [];
    for (let i = 0; i < SKID_MAX; i++) {
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      pos.fill(-999, b * 3, b * 3 + 12);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(idx);
    this.skidMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x14161a, transparent: true, opacity: 0.42, depthWrite: false }));
    this.skidMesh.frustumCulled = false;
    this.skidIdx = 0;
    this.scene.add(this.skidMesh);
  }

  emitSkid(a, b) {
    const attr = this.skidMesh.geometry.attributes.position;
    const arr = attr.array;
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05 || d > 4) return;
    const nx = -dz / d * 0.13, nz = dx / d * 0.13;
    const y = 0.035;
    const i = this.skidIdx * 12;
    arr[i] = a.x + nx; arr[i + 1] = y; arr[i + 2] = a.z + nz;
    arr[i + 3] = a.x - nx; arr[i + 4] = y; arr[i + 5] = a.z - nz;
    arr[i + 6] = b.x - nx; arr[i + 7] = y; arr[i + 8] = b.z - nz;
    arr[i + 9] = b.x + nx; arr[i + 10] = y; arr[i + 11] = b.z + nz;
    attr.needsUpdate = true;
    this.skidIdx = (this.skidIdx + 1) % SKID_MAX;
  }

  initSmoke() {
    const geo = new THREE.BufferGeometry();
    this.smokePos = new Float32Array(SMOKE_MAX * 3).fill(-999);
    this.smokeVel = new Float32Array(SMOKE_MAX * 3);
    this.smokeLife = new Float32Array(SMOKE_MAX);
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePos, 3).setUsage(THREE.DynamicDrawUsage));
    const sc = document.createElement('canvas'); sc.width = sc.height = 64;
    const sg = sc.getContext('2d');
    const sgr = sg.createRadialGradient(32, 32, 2, 32, 32, 30);
    sgr.addColorStop(0, 'rgba(255,255,255,0.85)');
    sgr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    sgr.addColorStop(1, 'rgba(255,255,255,0)');
    sg.fillStyle = sgr; sg.fillRect(0, 0, 64, 64);
    this.smoke = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xc9c9c9, size: 1.6, map: new THREE.CanvasTexture(sc), transparent: true, opacity: 0.4, depthWrite: false
    }));
    this.smoke.frustumCulled = false;
    this.smokeIdx = 0;
    this.scene.add(this.smoke);
  }

  emitSmoke(x, y, z) {
    const i = this.smokeIdx * 3;
    this.smokePos[i] = x + (Math.random() - 0.5) * 0.4;
    this.smokePos[i + 1] = y + 0.2;
    this.smokePos[i + 2] = z + (Math.random() - 0.5) * 0.4;
    this.smokeVel[i] = (Math.random() - 0.5) * 1.4;
    this.smokeVel[i + 1] = 1.4 + Math.random();
    this.smokeVel[i + 2] = (Math.random() - 0.5) * 1.4;
    this.smokeLife[this.smokeIdx] = 0.9;
    this.smokeIdx = (this.smokeIdx + 1) % SMOKE_MAX;
  }

  reset() {
    const p = nearestRoadPoint(this.pos.x, this.pos.z);
    this.pos.set(p.x, 0, p.z);
    this.heading = p.h;
    this.vel.set(0, 0, 0); this.vy = 0; this.airborne = false;
  }

  update(dt, input, world) {
    this.events = {};
    const f = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const r = new THREE.Vector3(-Math.cos(this.heading), 0, Math.sin(this.heading));
    let vf = this.vel.dot(f), vl = this.vel.dot(r);
    const absV = Math.abs(vf);

    const maxSteer = 0.55 / (1 + absV * 0.055);
    const steerTarget = input.steer * maxSteer;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 7);

    const hb = input.handbrake;
    if (!this.airborne) {
      if (input.throttle) vf += (14.5 * (1 - Math.min(1, absV / 56)) + 2) * dt;
      if (input.brake) {
        if (vf > 0.5) vf -= 24 * dt;
        else vf = Math.max(-12, vf - 8 * dt);
      }
      if (hb) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 4 * dt);
      vf -= (0.0022 * vf * absV + Math.sign(vf) * Math.min(Math.abs(vf), 0.7)) * dt;
      const grip = hb ? 2.4 : 9;
      vl *= Math.exp(-grip * dt);
    } else {
      vl *= Math.exp(-0.3 * dt);
    }
    vf = Math.max(-12, Math.min(56, vf));

    this.vel.copy(f).multiplyScalar(vf).addScaledVector(r, vl);
    let yawRate = (vf / 2.9) * Math.tan(this.steer) * (hb ? 1.2 : 1);
    yawRate = Math.max(-2.6, Math.min(2.6, yawRate));
    this.heading += yawRate * dt * (this.airborne ? 0.25 : 1);

    this.pos.addScaledVector(this.vel, dt);
    this.speed = vf;
    this.drifting = Math.abs(vl) > 3.2 && !this.airborne && absV > 6;

    const gh = world.groundHeight(this.pos.x, this.pos.z);
    if (this.airborne) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gh) {
        this.pos.y = gh; this.airborne = false;
        this.events.land = this.vy; this.vy = 0;
      }
    } else {
      const prevGh = world.groundHeight(this.pos.x - this.vel.x * dt, this.pos.z - this.vel.z * dt);
      if (prevGh - gh > 0.5 && absV > 8) {
        this.airborne = true;
        this.vy = Math.min(11, absV * 0.28 + 1.5);
        this.pos.y = prevGh;
      } else this.pos.y = gh;
    }

    const hit = world.collideCircle(this.pos.x, this.pos.z, 1.15);
    if (hit) {
      this.pos.x += hit.nx * hit.depth; this.pos.z += hit.nz * hit.depth;
      const vn = this.vel.x * hit.nx + this.vel.z * hit.nz;
      if (vn < 0) {
        this.vel.x -= hit.nx * vn * 1.55; this.vel.z -= hit.nz * vn * 1.55;
        this.vel.multiplyScalar(0.82);
        if (-vn > 3) this.events.crash = -vn;
      }
    }
    for (const axis of ['x', 'z']) {
      if (Math.abs(this.pos[axis]) > BOUND) {
        this.pos[axis] = Math.sign(this.pos[axis]) * BOUND;
        if (Math.abs(this.vel[axis]) > 3) this.events.crash = Math.abs(this.vel[axis]);
        this.vel[axis] *= -0.3;
      }
    }

    const latAcc = yawRate * vf;
    const longAcc = (vf - (this._prevVf ?? vf)) / Math.max(dt, 1e-4);
    this._prevVf = vf;
    this.roll += (Math.max(-0.13, Math.min(0.13, -latAcc * 0.006)) - this.roll) * Math.min(1, dt * 6);
    this.pitch += (Math.max(-0.07, Math.min(0.07, -longAcc * 0.0035)) - this.pitch) * Math.min(1, dt * 6);

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.heading;
    this.body.rotation.z = this.roll;
    this.body.rotation.x = this.pitch;
    this.spin += vf / 0.36 * dt;
    for (const w of this.wheels) w.rotation.x = this.spin;
    for (const p of this.steerPivots) p.rotation.y = this.steer;
    this.tailMat.emissiveIntensity = input.brake ? 2.6 : (world.mode === 'day' ? 0.8 : 1.6);

    this.blob.position.set(this.pos.x, world.groundHeight(this.pos.x, this.pos.z) + 0.03, this.pos.z);
    this.blob.rotation.z = this.heading - Math.PI / 2;
    const blobScale = this.airborne ? Math.max(0.5, 1 - (this.pos.y - gh) * 0.06) : 1;
    this.blob.scale.set(blobScale, blobScale, 1);

    const rearL = new THREE.Vector3(-0.92, 0, -1.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.pos);
    const rearR = new THREE.Vector3(0.92, 0, -1.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.pos);
    if ((this.drifting || (hb && absV > 5)) && !this.airborne) {
      if (this.prevRear) { this.emitSkid(this.prevRear[0], rearL); this.emitSkid(this.prevRear[1], rearR); }
      this.emitSmoke(rearL.x, this.pos.y, rearL.z);
      this.emitSmoke(rearR.x, this.pos.y, rearR.z);
      this.prevRear = [rearL, rearR];
    } else this.prevRear = null;

    for (let i = 0; i < SMOKE_MAX; i++) {
      if (this.smokeLife[i] > 0) {
        this.smokeLife[i] -= dt;
        const j = i * 3;
        this.smokePos[j] += this.smokeVel[j] * dt;
        this.smokePos[j + 1] += this.smokeVel[j + 1] * dt;
        this.smokePos[j + 2] += this.smokeVel[j + 2] * dt;
        if (this.smokeLife[i] <= 0) this.smokePos[j + 1] = -999;
      }
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;
  }

  setNight(mode) {
    const on = mode !== 'day';
    for (const sl of this.headlights) sl.intensity = on ? (mode === 'night' ? 260 : 120) : 0;
    this.headMat.emissiveIntensity = on ? 2.4 : 0.7;
  }

  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
}