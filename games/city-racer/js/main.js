import * as THREE from 'three';
import { World } from './world.js';
import { PlayerCar } from './car.js';
import { Traffic } from './traffic.js';
import { ChaseCamera } from './camera.js';
import { HUD } from './hud.js';
import { Missions } from './missions.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 2200);

const world = new World(scene);
world.setMode('day');
const car = new PlayerCar(scene, 0xc41e2a);
car.reset();
car.pos.set(2.6, 0, 340); car.heading = Math.PI;
const traffic = new Traffic(scene, 26);
const rig = new ChaseCamera(camera);
const hud = new HUD();
const audio = new GameAudio();
const missions = new Missions(scene, hud, audio);
const input = new Input();

let state = 'menu';
let envMode = 'day';
const clock = new THREE.Clock();
let elapsed = 0;

const MODES = ['day', 'dusk', 'night'];
function cycleEnv() {
  envMode = MODES[(MODES.indexOf(envMode) + 1) % 3];
  world.setMode(envMode);
  car.setNight(envMode);
  traffic.setNight(envMode);
  hud.toast({ day: '☀️ 白天', dusk: '🌇 黄昏', night: '🌙 夜晚' }[envMode]);
}

function startGame() {
  audio.init(); audio.resume();
  document.getElementById('menu').classList.add('hidden');
  state = 'playing';
  hud.toast('🚗 WASD 驾驶 · 空格 手刹漂移 · T 计时赛');
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-resume').addEventListener('click', () => { state = 'playing'; document.getElementById('pause').classList.add('hidden'); });
document.getElementById('btn-again').addEventListener('click', () => { hud.hideResult(); missions.start(car); });
document.getElementById('btn-free').addEventListener('click', () => { hud.hideResult(); missions.stop(); });
document.getElementById('btn-env').addEventListener('click', cycleEnv);
document.getElementById('btn-cam').addEventListener('click', () => { rig.cycle(); hud.toast(['🎥 追逐近', '🎥 追逐远', '🎥 引擎盖'][rig.mode]); });
document.getElementById('btn-race').addEventListener('click', () => { if (state === 'playing') missions.start(car); });
document.getElementById('btn-mute').addEventListener('click', e => {
  audio.setMuted(!audio.muted);
  e.currentTarget.textContent = audio.muted ? '🔇 声音关' : '🔊 声音开';
});
document.getElementById('btn-pause').addEventListener('click', () => {
  if (state === 'playing') { state = 'paused'; document.getElementById('pause').classList.remove('hidden'); }
});

for (const el of document.querySelectorAll('.swatch')) {
  el.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
    el.classList.add('sel');
    car.setColor(parseInt(el.dataset.color));
  });
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function handleKeys() {
  if (input.hit('KeyC')) { rig.cycle(); hud.toast(['🎥 追逐近', '🎥 追逐远', '🎥 引擎盖'][rig.mode]); }
  if (input.hit('KeyN')) cycleEnv();
  if (input.hit('KeyR')) { car.reset(); hud.toast('🔄 已复位到最近车道'); }
  if (input.hit('KeyT') && state === 'playing') missions.start(car);
  if (input.hit('KeyM')) {
    audio.setMuted(!audio.muted);
    document.getElementById('btn-mute').textContent = audio.muted ? '🔇 声音关' : '🔊 声音开';
  }
  if (input.hit('KeyP', 'Escape')) {
    if (state === 'playing') { state = 'paused'; document.getElementById('pause').classList.remove('hidden'); }
    else if (state === 'paused') { state = 'playing'; document.getElementById('pause').classList.add('hidden'); }
  }
}

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (state === 'playing') {
    elapsed += dt;
    handleKeys();
    car.update(dt, input, world);
    traffic.update(dt, car, elapsed, audio);
    missions.update(dt, car, elapsed);
    if (car.events.crash) { audio.crash(car.events.crash); rig.addShake(car.events.crash * 0.06); }
    if (car.events.land && car.events.land < -7) { audio.thud(); rig.addShake(0.3); }
    audio.update(car.speed, input.throttle, car.drifting, dt);
    world.updateShadow(car.pos);
    world.updateTrafficLights(elapsed);
    rig.update(dt, car);
    hud.update(car, missions, traffic, envMode);
  } else {
    handleKeys();
    if (state === 'menu') {
      elapsed += dt;
      const a = elapsed * 0.12;
      camera.position.set(car.pos.x + Math.sin(a) * 14, 6.5, car.pos.z + Math.cos(a) * 14);
      camera.lookAt(car.pos.x, 1, car.pos.z);
      world.updateShadow(car.pos);
      world.updateTrafficLights(elapsed);
      traffic.update(dt, car, elapsed, audio);
    }
  }
  input.endFrame();
  renderer.render(scene, camera);
}
loop();

window.__game = { car, world, traffic, missions, rig, audio, hud, renderer, getState: () => state, set state(v) { state = v; }, startGame };