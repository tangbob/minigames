export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }
  init() {
    if (this.ctx) return;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(ctx.destination);

    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 900;
    this.engOsc1 = ctx.createOscillator(); this.engOsc1.type = 'sawtooth'; this.engOsc1.frequency.value = 70;
    this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 35;
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    this.engOsc1.connect(this.engFilter); this.engOsc2.connect(g2); g2.connect(this.engFilter);
    this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
    this.engOsc1.start(); this.engOsc2.start();

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.skidSrc = ctx.createBufferSource(); this.skidSrc.buffer = this.noiseBuf; this.skidSrc.loop = true;
    this.skidFilter = ctx.createBiquadFilter(); this.skidFilter.type = 'bandpass'; this.skidFilter.frequency.value = 1400; this.skidFilter.Q.value = 1.2;
    this.skidGain = ctx.createGain(); this.skidGain.gain.value = 0;
    this.skidSrc.connect(this.skidFilter); this.skidFilter.connect(this.skidGain); this.skidGain.connect(this.master);
    this.skidSrc.start();

    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = this.noiseBuf; this.windSrc.loop = true;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 400;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
    this.windSrc.start();
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }
  update(speed, throttle, drifting, dt) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 0.18 + Math.min(1, Math.abs(speed) / 52) * 0.82 + throttle * 0.12;
    const f = 55 + rpm * 190;
    this.engOsc1.frequency.setTargetAtTime(f, t, 0.06);
    this.engOsc2.frequency.setTargetAtTime(f / 2, t, 0.06);
    this.engFilter.frequency.setTargetAtTime(500 + rpm * 1600 + throttle * 500, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.05 + throttle * 0.075 + rpm * 0.03, t, 0.09);
    this.skidGain.gain.setTargetAtTime(drifting ? 0.16 : 0, t, 0.05);
    this.windGain.gain.setTargetAtTime(Math.min(0.09, Math.abs(speed) / 55 * 0.09), t, 0.15);
  }
  burst(freq, dur, vol, type = 'lowpass') {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur);
  }
  crash(strength) {
    this.burst(300, 0.35, Math.min(0.6, 0.15 + strength * 0.04));
    this.burst(90, 0.25, 0.4, 'lowpass');
  }
  thud() { this.burst(140, 0.2, 0.3); }
  honk() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const f of [400, 505]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07, t + 0.02);
      g.gain.setValueAtTime(0.07, t + 0.28);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.42);
    }
  }
  chime(up = true) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = up ? [660, 990] : [990, 660];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.11);
      g.gain.linearRampToValueAtTime(0.16, t + i * 0.11 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.35);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.4);
    });
  }
  fanfare() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + i * 0.13);
      g.gain.linearRampToValueAtTime(0.18, t + i * 0.13 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.13 + 0.5);
      o.connect(g); g.connect(this.master); o.start(t + i * 0.13); o.stop(t + i * 0.13 + 0.55);
    });
  }
}