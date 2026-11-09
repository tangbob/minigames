export const GRID_N = 6;
export const PITCH = 124;
export const ROAD_W = 20;
export const SIDEWALK_W = 6;
export const BLOCK_BUILD = PITCH - ROAD_W - SIDEWALK_W * 2;
export const CITY_HALF = (GRID_N / 2) * PITCH + ROAD_W / 2 + SIDEWALK_W + 8;
export const BOUND = CITY_HALF - 4;

export const gridPos = i => (i - GRID_N / 2) * PITCH;
export const blockCenter = i => (gridPos(i) + gridPos(i + 1)) / 2;

export const LANE_IN = 2.6;
export const LANE_OUT = 7.4;

export const PARK_BLOCKS = [[1, 1], [4, 3]];
export const PLAZA_BLOCK = [2, 4];

export function isPark(i, j) {
  return PARK_BLOCKS.some(([a, b]) => a === i && b === j);
}
export function isPlaza(i, j) {
  return PLAZA_BLOCK[0] === i && PLAZA_BLOCK[1] === j;
}

export function onRoad(x, z) {
  for (let i = 0; i <= GRID_N; i++) {
    if (Math.abs(x - gridPos(i)) < ROAD_W / 2 + 1) return true;
    if (Math.abs(z - gridPos(i)) < ROAD_W / 2 + 1) return true;
  }
  return false;
}

export function nearestRoadPoint(x, z) {
  let best = null, bd = 1e9;
  for (let i = 0; i <= GRID_N; i++) {
    const g = gridPos(i);
    const cands = [
      { x: g + LANE_IN, z: Math.max(gridPos(0), Math.min(gridPos(GRID_N), z)), h: Math.PI },
      { x: g - LANE_IN, z: Math.max(gridPos(0), Math.min(gridPos(GRID_N), z)), h: 0 },
      { x: Math.max(gridPos(0), Math.min(gridPos(GRID_N), x)), z: g + LANE_IN, h: Math.PI / 2 },
      { x: Math.max(gridPos(0), Math.min(gridPos(GRID_N), x)), z: g - LANE_IN, h: -Math.PI / 2 }
    ];
    for (const c of cands) {
      const d = (c.x - x) ** 2 + (c.z - z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best;
}

export const LIGHT_PERIOD = 26;
export function lightPhase(t) {
  const p = t % LIGHT_PERIOD;
  if (p < 10) return { ns: 'green', ew: 'red' };
  if (p < 12) return { ns: 'yellow', ew: 'red' };
  if (p < 22) return { ns: 'red', ew: 'green' };
  return { ns: 'red', ew: 'yellow' };
}