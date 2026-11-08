export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    addEventListener('keydown', e => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  down(...codes) { return codes.some(c => this.keys.has(c)); }
  hit(...codes) { return codes.some(c => this.pressed.has(c)); }
  get throttle() { return this.down('KeyW', 'ArrowUp') ? 1 : 0; }
  get brake() { return this.down('KeyS', 'ArrowDown') ? 1 : 0; }
  get steer() { return (this.down('KeyA', 'ArrowLeft') ? 1 : 0) - (this.down('KeyD', 'ArrowRight') ? 1 : 0); }
  get handbrake() { return this.down('Space'); }
  endFrame() { this.pressed.clear(); }
}