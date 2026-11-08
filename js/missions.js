import * as THREE from 'three';
import { GRID_N, gridPos } from './config.js';

const BEST_KEY = 'cityracer_best_time';

export class Missions {
  constructor(scene, hud, audio) {
    this.scene = scene;
    this.hud = hud;
    this.audio = audio;
    this.state = 'idle';
    this.checkpoints = [];
    this.idx = 0;
    this.time = 0;
    this.best = parseFloat(localStorage.getItem(BEST_KEY)) || null;

    this.marker = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(5.5, 5.5, 40, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc832, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = 20;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(6, 0.35, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc832 })
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.4;
    this.ring = ring;
    this.marker.add(beam, ring);
    this.marker.visible = false;
    scene.add(this.marker);
  }

  start(car) {
    let i = Math.round(car.pos.x / 124 + GRID_N / 2), j = Math.round(car.pos.z / 124 + GRID_N / 2);
    i = Math.max(0, Math.min(GRID_N, i)); j = Math.max(0, Math.min(GRID_N, j));
    this.checkpoints = [];
    let pi = i, pj = j;
    for (let k = 0; k < 8; k++) {
      const oi = pi, oj = pj;
      const steps = 1 + Math.floor(Math.random() * 2);
      const horiz = Math.random() < 0.5;
      const sign = Math.random() < 0.5 ? 1 : -1;
      if (horiz) pi = Math.max(0, Math.min(GRID_N, pi + sign * steps));
      else pj = Math.max(0, Math.min(GRID_N, pj + sign * steps));
      if (pi === oi && pj === oj) {
        if (horiz) pj = pj < GRID_N ? pj + 1 : pj - 1;
        else pi = pi < GRID_N ? pi + 1 : pi - 1;
      }
      this.checkpoints.push(new THREE.Vector3(gridPos(pi), 0, gridPos(pj)));
    }
    this.idx = 0; this.time = 0; this.state = 'running';
    this.marker.visible = true;
    this.placeMarker();
    this.hud.toast('🏁 计时赛开始！穿过黄色光柱检查点');
    this.audio.chime(true);
  }

  placeMarker() {
    const cp = this.checkpoints[this.idx];
    this.marker.position.set(cp.x, 0, cp.z);
  }

  stop() {
    this.state = 'idle';
    this.marker.visible = false;
  }

  update(dt, car, t) {
    if (this.state !== 'running') return;
    this.time += dt;
    this.ring.rotation.z = t * 1.5;
    this.marker.children[0].material.opacity = 0.18 + Math.sin(t * 3) * 0.07;
    const cp = this.checkpoints[this.idx];
    if (Math.hypot(car.pos.x - cp.x, car.pos.z - cp.z) < 10) {
      this.idx++;
      if (this.idx >= this.checkpoints.length) {
        this.state = 'finished';
        this.marker.visible = false;
        const isBest = !this.best || this.time < this.best;
        if (isBest) { this.best = this.time; localStorage.setItem(BEST_KEY, String(this.time)); }
        this.audio.fanfare();
        this.hud.showResult(this.time, this.best, isBest);
      } else {
        this.placeMarker();
        this.audio.chime(true);
        this.hud.toast(`✅ 检查点 ${this.idx}/${this.checkpoints.length}`);
      }
    }
  }

  get nextCheckpoint() {
    return this.state === 'running' ? this.checkpoints[this.idx] : null;
  }
}

export function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), d = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, '0')}.${d}`;
}