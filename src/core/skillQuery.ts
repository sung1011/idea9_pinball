import type { BallBody } from './ballBody';
import {
  ARENA_CORNER_RADIUS,
  LEFT_PILLAR,
  MAP_HEIGHT,
  MAP_WIDTH,
  PILLAR_HEIGHT,
  PILLAR_WIDTH,
  RIGHT_PILLAR,
} from './constants';

const EPS = 1e-8;
const SAMPLE_STEP = 0.08;

export function unitVec(x: number, y: number): { x: number; y: number } | null {
  const len = Math.hypot(x, y);
  if (len < EPS) {
    return null;
  }
  return { x: x / len, y: y / len };
}

export function inFan(
  ox: number,
  oy: number,
  aimX: number,
  aimY: number,
  tx: number,
  ty: number,
  halfRad: number,
  range: number,
): boolean {
  const dx = tx - ox;
  const dy = ty - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range || dist < EPS) {
    return false;
  }
  const aimLen = Math.hypot(aimX, aimY);
  if (aimLen < EPS) {
    return false;
  }
  const dot = (dx * aimX + dy * aimY) / (dist * aimLen);
  return dot >= Math.cos(halfRad);
}

function pointInArena(x: number, y: number): boolean {
  const r = ARENA_CORNER_RADIUS;
  if (x < 0 || x > MAP_WIDTH || y < 0 || y > MAP_HEIGHT) {
    return false;
  }
  const inXMid = x >= r && x <= MAP_WIDTH - r;
  const inYMid = y >= r && y <= MAP_HEIGHT - r;
  if (inXMid || inYMid) {
    return true;
  }
  const cx = x < r ? r : MAP_WIDTH - r;
  const cy = y < r ? r : MAP_HEIGHT - r;
  return Math.hypot(x - cx, y - cy) <= r + EPS;
}

export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > EPS) {
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  }
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function pointHitsPillar(x: number, y: number): boolean {
  const halfLen = (PILLAR_WIDTH - PILLAR_HEIGHT) / 2;
  const radius = PILLAR_HEIGHT / 2;
  for (const pillar of [LEFT_PILLAR, RIGHT_PILLAR]) {
    const d = distToSegment(x, y, pillar.x - halfLen, pillar.y, pillar.x + halfLen, pillar.y);
    if (d < radius - 1e-6) {
      return true;
    }
  }
  return false;
}

/** 勾索线段是否被圆角墙或矮柱挡住（不计入端点球体）。 */
export function segmentBlocked(x0: number, y0: number, x1: number, y1: number): boolean {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < EPS) {
    return false;
  }
  const steps = Math.max(2, Math.ceil(len / SAMPLE_STEP));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (!pointInArena(x, y) || pointHitsPillar(x, y)) {
      return true;
    }
  }
  return false;
}

export type FanPick = {
  target: BallBody;
  dist: number;
};

function fanCandidates(
  caster: BallBody,
  roster: readonly BallBody[],
  aimX: number,
  aimY: number,
  halfRad: number,
  range: number,
  needLos: boolean,
): FanPick[] {
  const out: FanPick[] = [];
  for (const other of roster) {
    if (!other.inPlay || other.id === caster.id) {
      continue;
    }
    if (other.team && caster.team && other.team === caster.team) {
      continue;
    }
    if (other.invincibleRemain > 0) {
      continue;
    }
    if (!inFan(caster.x, caster.y, aimX, aimY, other.x, other.y, halfRad, range)) {
      continue;
    }
    if (needLos && segmentBlocked(caster.x, caster.y, other.x, other.y)) {
      continue;
    }
    out.push({ target: other, dist: Math.hypot(other.x - caster.x, other.y - caster.y) });
  }
  return out;
}

export function pickFanEnemy(
  caster: BallBody,
  roster: readonly BallBody[],
  aimX: number,
  aimY: number,
  halfRad: number,
  range: number,
  needLos: boolean,
): FanPick | null {
  let best: FanPick | null = null;
  for (const item of fanCandidates(caster, roster, aimX, aimY, halfRad, range, needLos)) {
    if (!best || item.dist < best.dist) {
      best = item;
    }
  }
  return best;
}

export function pickFanEnemies(
  caster: BallBody,
  roster: readonly BallBody[],
  aimX: number,
  aimY: number,
  halfRad: number,
  range: number,
  needLos: boolean,
): FanPick[] {
  return fanCandidates(caster, roster, aimX, aimY, halfRad, range, needLos);
}

function allyCandidates(
  caster: BallBody,
  roster: readonly BallBody[],
  range: number,
  aim?: { x: number; y: number; halfRad: number },
): FanPick[] {
  const out: FanPick[] = [];
  for (const other of roster) {
    if (!other.inPlay || other.id === caster.id) {
      continue;
    }
    if (!other.team || !caster.team || other.team !== caster.team) {
      continue;
    }
    const dist = Math.hypot(other.x - caster.x, other.y - caster.y);
    if (dist > range || dist < EPS) {
      continue;
    }
    if (aim && !inFan(caster.x, caster.y, aim.x, aim.y, other.x, other.y, aim.halfRad, range)) {
      continue;
    }
    out.push({ target: other, dist });
  }
  return out;
}

function nearestOf(items: readonly FanPick[]): FanPick | null {
  let best: FanPick | null = null;
  for (const item of items) {
    if (!best || item.dist < best.dist) {
      best = item;
    }
  }
  return best;
}

/** 扇内最近友军（治疗链）。无敌友仍可选。 */
export function pickFanAlly(
  caster: BallBody,
  roster: readonly BallBody[],
  aimX: number,
  aimY: number,
  halfRad: number,
  range: number,
): FanPick | null {
  return nearestOf(allyCandidates(caster, roster, range, { x: aimX, y: aimY, halfRad }));
}

/** 距内最近友军（护盾 / 勾友）。无友则空。 */
export function pickNearestAlly(
  caster: BallBody,
  roster: readonly BallBody[],
  range: number,
): FanPick | null {
  return nearestOf(allyCandidates(caster, roster, range));
}

/** 线段走廊上的敌人（收索）。宽=2*halfWidth；无敌不选。 */
export function pickEnemiesOnLine(
  caster: BallBody,
  roster: readonly BallBody[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfWidth: number,
): FanPick[] {
  const out: FanPick[] = [];
  for (const other of roster) {
    if (!other.inPlay || other.id === caster.id) {
      continue;
    }
    if (other.team && caster.team && other.team === caster.team) {
      continue;
    }
    if (other.invincibleRemain > 0) {
      continue;
    }
    const dist = distToSegment(other.x, other.y, x0, y0, x1, y1);
    if (dist > halfWidth) {
      continue;
    }
    out.push({ target: other, dist: Math.hypot(other.x - caster.x, other.y - caster.y) });
  }
  return out;
}

/** 点周围敌人（索爆炸圈）。无敌 / 友军不选。 */
export function pickEnemiesAround(
  caster: BallBody,
  roster: readonly BallBody[],
  x: number,
  y: number,
  range: number,
): FanPick[] {
  const out: FanPick[] = [];
  for (const other of roster) {
    if (!other.inPlay || other.id === caster.id) {
      continue;
    }
    if (other.team && caster.team && other.team === caster.team) {
      continue;
    }
    if (other.invincibleRemain > 0) {
      continue;
    }
    const dist = Math.hypot(other.x - x, other.y - y);
    if (dist > range) {
      continue;
    }
    out.push({ target: other, dist });
  }
  return out;
}

/** 距内全部敌人（扰锋范围沉默）。无敌不选。 */
export function pickEnemiesInRange(
  caster: BallBody,
  roster: readonly BallBody[],
  range: number,
): FanPick[] {
  return pickEnemiesAround(caster, roster, caster.x, caster.y, range);
}

/** 距内最近敌人（标记回响）。无敌不选。 */
export function pickNearestEnemy(
  caster: BallBody,
  roster: readonly BallBody[],
  range: number,
): FanPick | null {
  const out: FanPick[] = [];
  for (const other of roster) {
    if (!other.inPlay || other.id === caster.id) {
      continue;
    }
    if (other.team && caster.team && other.team === caster.team) {
      continue;
    }
    if (other.invincibleRemain > 0) {
      continue;
    }
    const dist = Math.hypot(other.x - caster.x, other.y - caster.y);
    if (dist > range || dist < EPS) {
      continue;
    }
    out.push({ target: other, dist });
  }
  return nearestOf(out);
}
