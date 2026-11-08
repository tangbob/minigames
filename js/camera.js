import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.mode = 0;
    this.shake = 0;
    this.pos = new THREE.Vector3(0, 6, -12);
    this.look = new THREE.Vector3();
  }
  cycle() { this.mode = (this.mode + 1) % 3; }
  addShake(v) { this.shake = Math.min(1.2, this.shake + v); }
  update(dt, car) {
    const f = car.forward;
    const speed = Math.abs(car.speed);
    let desired, look;
    if (this.mode === 2) {
      desired = car.pos.clone().addScaledVector(f, 0.7).add(new THREE.Vector3(0, 1.12, 0));
      look = car.pos.clone().addScaledVector(f, 30).add(new THREE.Vector3(0, 1.0, 0));
      this.pos.copy(desired);
    } else {
      const dist = (this.mode === 0 ? 8.2 : 12.5) + speed * 0.075;
      const height = this.mode === 0 ? 3.3 : 5.4;
      desired = car.pos.clone().addScaledVector(f, -dist).add(new THREE.Vector3(0, height + car.pos.y * 0.4, 0));
      look = car.pos.clone().addScaledVector(f, 5).add(new THREE.Vector3(0, 1.3, 0));
      const k = 1 - Math.exp(-5.5 * dt);
      this.pos.lerp(desired, k);
    }
    this.look.lerp(look, 1 - Math.exp(-9 * dt));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const s = this.shake * 0.35;
    this.cam.position.copy(this.pos).add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    this.cam.lookAt(this.look);
    const targetFov = 62 + Math.min(17, speed * 0.3);
    this.cam.fov += (targetFov - this.cam.fov) * Math.min(1, dt * 4);
    this.cam.updateProjectionMatrix();
  }
}