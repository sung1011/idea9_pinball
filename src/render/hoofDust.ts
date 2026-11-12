import { Container, Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { BALL_RADIUS, FLOOR_SPEED, REST_SPEED, SPEED_CAP } from '../core/constants';
import { hookRiderRotation } from './hookRiderArt';
import { hookRiderJointLocal, HOOK_RIDER_RUN_JOINTS } from './hookRiderRunArt';

const HP_CLEAR_Y = -0.74 * (BALL_RADIUS / 0.5) + 0.1 * (BALL_RADIUS / 0.5);

/** 后蹄贴地扬尘：只视觉。同向少、侧滑中、反向多，再乘实际速度；近静止无尘。 */
export const HOOF_DUST = {
  cap: 128,
  ownerCap: 32,
  jumpClear: 1.6,
  rest: REST_SPEED,
  same: 0.3,
  side: 0.62,
  reverse: 1,
  emitPerSec: 36,
  minSize: 0.14,
  sizeSpan: 0.22,
  maxAlpha: 0.38,
  minLife: 0.36,
  lifeSpan: 0.2,
  colors: [0xd4c196, 0xb89a62, 0x8d7348] as const,
} as const;

export type HoofDustSample = {
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  hasAim?: boolean;
  aimX?: number;
  aimY?: number;
};

export type HoofDustView = {
  root: Container;
  sync: (balls: readonly BallBody[], dt: number) => void;
  clear: () => void;
  liveCount: () => number;
  ownerLive: (id: number) => number;
};

type Puff = {
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  growth: number;
  life: number;
  age: number;
  alpha: number;
  color: number;
  owner: number;
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
}

export function unitVec(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

export function hoofDustHeading(sample: Pick<HoofDustSample, 'facingX' | 'facingY' | 'hasAim' | 'aimX' | 'aimY'>): { x: number; y: number } {
  if (sample.hasAim) {
    return unitVec(sample.aimX ?? 0, sample.aimY ?? 0);
  }
  return unitVec(sample.facingX, sample.facingY);
}

/** 朝向与位移点积：1 同向，0 侧滑，-1 反向。 */
export function hoofDustAlong(sample: HoofDustSample): number {
  const speed = Math.hypot(sample.vx, sample.vy);
  if (speed <= HOOF_DUST.rest) {
    return 1;
  }
  const head = hoofDustHeading(sample);
  const vel = unitVec(sample.vx, sample.vy);
  return vel.x * head.x + vel.y * head.y;
}

/** 同向少、侧滑中、反向多。 */
export function hoofDustAlignFactor(along: number): number {
  const a = Math.max(-1, Math.min(1, along));
  if (a >= 0) {
    return HOOF_DUST.side + (HOOF_DUST.same - HOOF_DUST.side) * a;
  }
  return HOOF_DUST.side + (HOOF_DUST.reverse - HOOF_DUST.side) * -a;
}

/** 近静止无尘，低速减弱，高速才满。不单独看角度。 */
export function hoofDustSpeedFactor(speed: number): number {
  if (!(speed > HOOF_DUST.rest)) {
    return 0;
  }
  const rise = smoothstep(HOOF_DUST.rest, FLOOR_SPEED, speed);
  return rise * (0.52 + 0.48 * clamp01(speed / SPEED_CAP));
}

export function hoofDustIntensity(sample: HoofDustSample): number {
  const speed = Math.hypot(sample.vx, sample.vy);
  return hoofDustAlignFactor(hoofDustAlong(sample)) * hoofDustSpeedFactor(speed);
}

export function hoofDustPuffSize(intensity: number): number {
  return HOOF_DUST.minSize + HOOF_DUST.sizeSpan * clamp01(intensity);
}

export function hoofDustDragDir(vx: number, vy: number): { x: number; y: number } {
  const vel = unitVec(vx, vy);
  return { x: -vel.x, y: -vel.y };
}

function rotateLocal(lx: number, ly: number, rot: number): { x: number; y: number } {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: lx * c - ly * s, y: lx * s + ly * c };
}

/** 后左/后右蹄在世界坐标，贴地、在马头反向。 */
export function hoofDustEmitOrigins(ball: Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY' | 'hasAim' | 'aimX' | 'aimY'>): readonly [
  { x: number; y: number },
  { x: number; y: number },
] {
  const head = hoofDustHeading(ball);
  const rot = hookRiderRotation(head.x, head.y);
  const hl = hookRiderJointLocal(HOOK_RIDER_RUN_JOINTS.hl.x, HOOK_RIDER_RUN_JOINTS.hl.y);
  const hr = hookRiderJointLocal(HOOK_RIDER_RUN_JOINTS.hr.x, HOOK_RIDER_RUN_JOINTS.hr.y);
  const a = rotateLocal(hl.x, hl.y, rot);
  const b = rotateLocal(hr.x, hr.y, rot);
  return [
    { x: ball.x + a.x, y: ball.y + a.y },
    { x: ball.x + b.x, y: ball.y + b.y },
  ];
}

export function hoofDustBelowChrome(ballY: number, puffY: number): boolean {
  return puffY > ballY + HP_CLEAR_Y;
}

function hash01(n: number): number {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function makePuff(): Puff {
  return {
    live: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 0,
    growth: 0,
    life: 0,
    age: 0,
    alpha: 0,
    color: HOOF_DUST.colors[0],
    owner: -1,
  };
}

function drawPuffs(g: Graphics, puffs: readonly Puff[]): void {
  g.clear();
  for (const puff of puffs) {
    if (!puff.live) {
      continue;
    }
    const t = clamp01(puff.age / puff.life);
    const fade = (1 - t) * (1 - t);
    const radius = puff.size * (1 + puff.growth * t);
    g.circle(puff.x, puff.y, radius);
    g.fill({ color: puff.color, alpha: puff.alpha * fade });
  }
}

/** 世界层扬尘，画在骑装之下，不进残影、不改物理。 */
export function createHoofDustView(): HoofDustView {
  const root = new Container();
  root.eventMode = 'none';
  const gfx = new Graphics();
  gfx.eventMode = 'none';
  root.addChild(gfx);
  const puffs: Puff[] = Array.from({ length: HOOF_DUST.cap }, makePuff);
  const last = new Map<number, { x: number; y: number }>();
  const accrue = new Map<number, number>();
  let stamp = 1;

  const clearOwner = (owner: number): void => {
    for (const puff of puffs) {
      if (puff.owner === owner) {
        puff.live = false;
      }
    }
    accrue.set(owner, 0);
  };

  const ownerLive = (id: number): number => {
    let n = 0;
    for (const puff of puffs) {
      if (puff.live && puff.owner === id) {
        n += 1;
      }
    }
    return n;
  };

  const oldestOf = (id: number): Puff | null => {
    let oldest: Puff | null = null;
    let oldestAge = -1;
    for (const puff of puffs) {
      if (!puff.live || puff.owner !== id) {
        continue;
      }
      const age = puff.age / puff.life;
      if (age > oldestAge) {
        oldest = puff;
        oldestAge = age;
      }
    }
    return oldest;
  };

  const alloc = (owner: number): Puff | null => {
    for (const puff of puffs) {
      if (!puff.live) {
        return puff;
      }
    }
    const own = ownerLive(owner);
    if (own >= HOOF_DUST.ownerCap) {
      return oldestOf(owner);
    }
    if (own > 0) {
      return oldestOf(owner);
    }
    const counts = new Map<number, number>();
    for (const puff of puffs) {
      if (!puff.live) {
        continue;
      }
      counts.set(puff.owner, (counts.get(puff.owner) ?? 0) + 1);
    }
    let richest = -1;
    let richestN = 0;
    for (const [id, n] of counts) {
      if (n > richestN) {
        richest = id;
        richestN = n;
      }
    }
    if (richestN > HOOF_DUST.ownerCap) {
      return oldestOf(richest);
    }
    return null;
  };

  const emit = (ball: BallBody, intensity: number, drag: { x: number; y: number }, dt: number): void => {
    if (intensity <= 1e-4 || dt <= 0) {
      accrue.set(ball.id, 0);
      return;
    }
    const add = intensity * HOOF_DUST.emitPerSec * dt;
    const next = (accrue.get(ball.id) ?? 0) + add;
    const n = Math.floor(next);
    accrue.set(ball.id, next - n);
    if (n <= 0) {
      return;
    }
    const origins = hoofDustEmitOrigins(ball);
    const size = hoofDustPuffSize(intensity);
    const speed = Math.hypot(ball.vx, ball.vy);
    for (let i = 0; i < n; i += 1) {
      stamp += 1;
      const origin = origins[stamp & 1];
      const side = hash01(stamp) - 0.5;
      const along = 0.35 + 0.55 * hash01(stamp + 17);
      const puff = alloc(ball.id);
      if (!puff) {
        continue;
      }
      puff.live = true;
      puff.owner = ball.id;
      puff.x = origin.x + drag.y * side * 0.16;
      puff.y = origin.y - drag.x * side * 0.16;
      puff.vx = drag.x * (0.55 + 0.9 * along) * (0.35 + 0.08 * speed);
      puff.vy = drag.y * (0.55 + 0.9 * along) * (0.35 + 0.08 * speed);
      puff.size = size * (0.78 + 0.4 * hash01(stamp + 3));
      puff.growth = 0.7 + 0.5 * intensity;
      puff.life = HOOF_DUST.minLife + HOOF_DUST.lifeSpan * intensity;
      puff.age = 0;
      puff.alpha = Math.min(HOOF_DUST.maxAlpha, 0.17 + 0.21 * intensity);
      puff.color = HOOF_DUST.colors[stamp % HOOF_DUST.colors.length];
    }
  };

  const sync = (balls: readonly BallBody[], dt: number): void => {
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const seen = new Set<number>();
    for (const ball of balls) {
      seen.add(ball.id);
      const prev = last.get(ball.id);
      if (prev && Math.hypot(ball.x - prev.x, ball.y - prev.y) > HOOF_DUST.jumpClear) {
        clearOwner(ball.id);
      }
      last.set(ball.id, { x: ball.x, y: ball.y });
      if (!ball.inPlay) {
        clearOwner(ball.id);
        continue;
      }
      const intensity = hoofDustIntensity(ball);
      emit(ball, intensity, hoofDustDragDir(ball.vx, ball.vy), step);
    }
    for (const id of [...last.keys()]) {
      if (!seen.has(id)) {
        clearOwner(id);
        last.delete(id);
        accrue.delete(id);
      }
    }
    for (const puff of puffs) {
      if (!puff.live) {
        continue;
      }
      puff.age += step;
      puff.x += puff.vx * step;
      puff.y += puff.vy * step;
      puff.vx *= 0.86;
      puff.vy *= 0.86;
      if (puff.age >= puff.life) {
        puff.live = false;
      }
    }
    drawPuffs(gfx, puffs);
  };

  const clear = (): void => {
    for (const puff of puffs) {
      puff.live = false;
    }
    last.clear();
    accrue.clear();
    gfx.clear();
  };

  const liveCount = (): number => puffs.reduce((n, puff) => n + (puff.live ? 1 : 0), 0);

  return { root, sync, clear, liveCount, ownerLive };
}
