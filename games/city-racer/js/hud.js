import { GRID_N, PITCH, ROAD_W, gridPos, CITY_HALF } from './config.js';
import { fmtTime } from './missions.js';

export class HUD {
  constructor() {
    this.speedo = document.getElementById('speedo');
    this.sctx = this.speedo.getContext('2d');
    this.minimap = document.getElementById('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.missionEl = document.getElementById('mission');
    this.toastEl = document.getElementById('toast');
    this.toastTimer = null;
    this.mapBase = this.buildMapBase();
  }

  buildMapBase() {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    const s = 512 / (CITY_HALF * 2);
    const p = v => (v + CITY_HALF) * s;
    g.fillStyle = '#141a22';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#233043';
    for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
      g.fillRect(p(gridPos(i) + ROAD_W / 2 + 4), p(gridPos(j) + ROAD_W / 2 + 4), (PITCH - ROAD_W - 8) * s, (PITCH - ROAD_W - 8) * s);
    }
    g.fillStyle = '#4a5568';
    const ext = gridPos(GRID_N) + ROAD_W / 2;
    for (let i = 0; i <= GRID_N; i++) {
      const v = gridPos(i);
      g.fillRect(p(v - ROAD_W / 2), p(-ext), ROAD_W * s, ext * 2 * s);
      g.fillRect(p(-ext), p(v - ROAD_W / 2), ext * 2 * s, ROAD_W * s);
    }
    return c;
  }

  toast(msg, ms = 2600) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastEl.classList.remove('show'), ms);
  }

  showResult(time, best, isBest) {
    document.getElementById('result-time').textContent = fmtTime(time);
    document.getElementById('result-best').textContent = `最佳 ${fmtTime(best)}`;
    document.getElementById('result-new').style.display = isBest ? 'inline-block' : 'none';
    document.getElementById('result').classList.remove('hidden');
  }
  hideResult() { document.getElementById('result').classList.add('hidden'); }

  update(car, missions, traffic, mode) {
    this.drawSpeedo(car);
    this.drawMap(car, missions, traffic);
    if (missions.state === 'running') {
      this.missionEl.classList.remove('hidden');
      const cp = missions.nextCheckpoint;
      const dist = Math.hypot(car.pos.x - cp.x, car.pos.z - cp.z);
      document.getElementById('m-cp').textContent = `检查点 ${missions.idx + 1}/${missions.checkpoints.length}`;
      document.getElementById('m-time').textContent = fmtTime(missions.time);
      document.getElementById('m-dist').textContent = `距离 ${Math.round(dist)} m`;
      document.getElementById('m-best').textContent = missions.best ? `最佳 ${fmtTime(missions.best)}` : '最佳 --';
    } else {
      this.missionEl.classList.add('hidden');
    }
    document.getElementById('env-label').textContent = { day: '白天', dusk: '黄昏', night: '夜晚' }[mode];
  }

  drawSpeedo(car) {
    const g = this.sctx, W = 170, cx = 85, cy = 88, R = 66;
    g.clearRect(0, 0, W, W);
    g.fillStyle = 'rgba(10,14,20,0.72)';
    g.beginPath(); g.arc(cx, cy, R + 14, 0, Math.PI * 2); g.fill();
    const kmh = Math.abs(car.speed) * 3.6;
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    g.strokeStyle = '#2c3644'; g.lineWidth = 7;
    g.beginPath(); g.arc(cx, cy, R, a0, a1); g.stroke();
    g.strokeStyle = car.drifting ? '#ffb020' : '#39c0ff'; g.lineWidth = 7;
    g.beginPath(); g.arc(cx, cy, R, a0, a0 + (a1 - a0) * Math.min(1, kmh / 240)); g.stroke();
    g.strokeStyle = '#8fa0b5'; g.lineWidth = 2;
    g.fillStyle = '#8fa0b5'; g.font = '9px sans-serif'; g.textAlign = 'center';
    for (let v = 0; v <= 240; v += 40) {
      const a = a0 + (a1 - a0) * v / 240;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
      g.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12));
      g.stroke();
      g.fillText(String(v), cx + Math.cos(a) * (R - 21), cy + Math.sin(a) * (R - 21) + 3);
    }
    const na = a0 + (a1 - a0) * Math.min(1, kmh / 240);
    g.strokeStyle = '#ff4438'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(na) * (R - 14), cy + Math.sin(na) * (R - 14)); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 26px sans-serif';
    g.fillText(String(Math.round(kmh)), cx, cy + 34);
    g.fillStyle = '#8fa0b5'; g.font = '10px sans-serif';
    g.fillText('km/h', cx, cy + 46);
    const gear = car.speed < -0.5 ? 'R' : kmh < 2 ? 'N' : String(Math.min(6, 1 + Math.floor(kmh / 36)));
    g.fillStyle = '#39c0ff'; g.font = 'bold 14px sans-serif';
    g.fillText(gear, cx + 34, cy + 10);
    if (car.drifting) {
      g.fillStyle = '#ffb020'; g.font = 'bold 12px sans-serif';
      g.fillText('DRIFT', cx, cy - 24);
    }
    if (car.airborne) {
      g.fillStyle = '#7fff9f'; g.font = 'bold 12px sans-serif';
      g.fillText('AIR!', cx, cy - 38);
    }
  }

  drawMap(car, missions, traffic) {
    const g = this.mctx, W = 190;
    const win = 250;
    const s = 512 / (CITY_HALF * 2);
    const srcWin = win * s;
    const sx = (car.pos.x + CITY_HALF) * s - srcWin / 2;
    const sy = (car.pos.z + CITY_HALF) * s - srcWin / 2;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#141a22'; g.fillRect(0, 0, W, W);
    g.drawImage(this.mapBase, sx, sy, srcWin, srcWin, 0, 0, W, W);
    const toMap = (x, z) => [(x - car.pos.x) / win * W + W / 2, (z - car.pos.z) / win * W + W / 2];
    g.fillStyle = '#ffd23e';
    for (const c of traffic.cars) {
      const [mx, my] = toMap(c.pos.x, c.pos.z);
      g.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    if (missions.state === 'running') {
      missions.checkpoints.forEach((cp, k) => {
        if (k < missions.idx) return;
        const [mx, my] = toMap(cp.x, cp.z);
        g.fillStyle = k === missions.idx ? '#ffc832' : 'rgba(255,200,50,0.45)';
        g.beginPath(); g.arc(mx, my, k === missions.idx ? 5 : 3, 0, Math.PI * 2); g.fill();
      });
      const cp = missions.nextCheckpoint;
      const [mx, my] = toMap(cp.x, cp.z);
      if (mx < 6 || mx > W - 6 || my < 6 || my > W - 6) {
        const a = Math.atan2(my - W / 2, mx - W / 2);
        const ex = W / 2 + Math.cos(a) * (W / 2 - 10), ey = W / 2 + Math.sin(a) * (W / 2 - 10);
        g.fillStyle = '#ffc832';
        g.save(); g.translate(ex, ey); g.rotate(a);
        g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -5); g.lineTo(-4, 5); g.closePath(); g.fill();
        g.restore();
      }
    }
    g.save();
    g.translate(W / 2, W / 2);
    g.rotate(-car.heading + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
    g.restore();
    g.restore();
    g.strokeStyle = 'rgba(120,150,190,0.6)'; g.lineWidth = 2;
    g.beginPath(); g.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); g.stroke();
    g.fillStyle = '#8fa0b5'; g.font = 'bold 10px sans-serif'; g.textAlign = 'center';
    g.fillText('N', W / 2, 12);
  }
}