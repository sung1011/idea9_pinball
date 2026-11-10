import type { BallBody, TeamId } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { RING_ULT } from '../heroes/ringKit';
import { applySkillDamage } from './skillHits';

const EPS = 1e-8;
const TIME_EPS = 1e-7;

export type MagnetWell = {
  id: number;
  seq: number;
  ownerId: number;
  ownerTeam?: TeamId;
  x: number;
  y: number;
  radius: number;
  remain: number;
  duration: number;
};

let nextWellId = 1;
let nextSeq = 1;
const wells = new Map<number, MagnetWell>();

export function resetMagnetWells(): void {
  wells.clear();
  nextWellId = 1;
  nextSeq = 1;
}

export function placeMagnetWell(opts: {
  ownerId: number;
  ownerTeam?: TeamId;
  x: number;
  y: number;
  radius?: number;
  remain?: number;
}): MagnetWell {
  const well: MagnetWell = {
    id: nextWellId,
    seq: nextSeq,
    ownerId: opts.ownerId,
    ownerTeam: opts.ownerTeam,
    x: opts.x,
    y: opts.y,
    radius: opts.radius ?? RING_ULT.radius,
    remain: opts.remain ?? RING_ULT.duration,
    duration: opts.remain ?? RING_ULT.duration,
  };
  nextWellId += 1;
  nextSeq += 1;
  wells.set(well.id, well);
  return well;
}

export function listMagnetWells(): MagnetWell[] {
  return [...wells.values()].filter((well) => well.remain > TIME_EPS).sort((a, b) => a.seq - b.seq);
}

export function distToWell(well: Pick<MagnetWell, 'x' | 'y'>, x: number, y: number): number {
  return Math.hypot(x - well.x, y - well.y);
}

export function isInsideWell(well: Pick<MagnetWell, 'x' | 'y' | 'radius'>, x: number, y: number): boolean {
  return distToWell(well, x, y) <= well.radius + EPS;
}

export function isWellCountable(ball: Pick<BallBody, 'inPlay' | 'invincibleRemain' | 'hp'>): boolean {
  return ball.inPlay && ball.hp > 0 && ball.invincibleRemain <= 0;
}

export function countWellN(well: Pick<MagnetWell, 'x' | 'y' | 'radius'>, balls: readonly BallBody[]): number {
  let n = 0;
  for (const ball of balls) {
    if (!isWellCountable(ball)) {
      continue;
    }
    if (isInsideWell(well, ball.x, ball.y)) {
      n += 1;
    }
  }
  return n;
}

export function wellBlastDamage(n: number): number {
  return RING_ULT.damageBase + RING_ULT.damagePerN * Math.max(0, n);
}

/** 距圆心 taper：中心 0，softRadius 外满额。 */
export function magnetPullAccel(dist: number): number {
  if (dist <= EPS) {
    return 0;
  }
  const soft = RING_ULT.pullSoftRadius;
  const taper = dist >= soft ? 1 : dist / soft;
  return RING_ULT.pullAccel * taper;
}

function isEnemyOfWell(well: MagnetWell, ball: Pick<BallBody, 'id' | 'team'>): boolean {
  if (well.ownerId === ball.id) {
    return false;
  }
  if (well.ownerTeam && ball.team && well.ownerTeam === ball.team) {
    return false;
  }
  return true;
}

/** 每单位只跟最近圆心；等距取先生成圈，避免来回切换。无敌不受吸。 */
export function pickMagnetWellFor(ball: BallBody, list: readonly MagnetWell[] = listMagnetWells()): MagnetWell | null {
  if (!ball.inPlay || ball.invincibleRemain > 0) {
    return null;
  }
  let best: MagnetWell | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const well of list) {
    if (well.remain <= TIME_EPS) {
      continue;
    }
    const dist = distToWell(well, ball.x, ball.y);
    if (dist > well.radius + EPS) {
      continue;
    }
    if (!best) {
      best = well;
      bestDist = dist;
      continue;
    }
    const delta = dist - bestDist;
    if (delta < -RING_ULT.equalDistEps || (Math.abs(delta) <= RING_ULT.equalDistEps && well.seq < best.seq)) {
      best = well;
      bestDist = dist;
    }
  }
  return best;
}

/** 持续向心加速度改速度，不搬位置、不定身。 */
export function applyMagnetWellPull(balls: readonly BallBody[], dt: number): void {
  const step = Math.max(0, dt);
  if (step <= 0 || wells.size === 0) {
    return;
  }
  const active = listMagnetWells();
  if (active.length === 0) {
    return;
  }
  for (const ball of balls) {
    if (!ball.inPlay) {
      continue;
    }
    const well = pickMagnetWellFor(ball, active);
    if (!well) {
      continue;
    }
    const dx = well.x - ball.x;
    const dy = well.y - ball.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= EPS) {
      continue;
    }
    const accel = magnetPullAccel(dist);
    if (accel <= 0) {
      continue;
    }
    const inv = 1 / dist;
    ball.vx += dx * inv * accel * step;
    ball.vy += dy * inv * accel * step;
  }
}

function snapshotDueBlasts(
  due: readonly MagnetWell[],
  balls: readonly BallBody[],
): Array<{ well: MagnetWell; n: number; enemyIds: number[] }> {
  return due.map((well) => {
    const enemyIds: number[] = [];
    for (const ball of balls) {
      if (!ball.inPlay || ball.invincibleRemain > 0) {
        continue;
      }
      if (!isInsideWell(well, ball.x, ball.y)) {
        continue;
      }
      if (isEnemyOfWell(well, ball)) {
        enemyIds.push(ball.id);
      }
    }
    return { well, n: countWellN(well, balls), enemyIds };
  });
}

/**
 * 吸满后爆炸一次并结束吸力。同帧多圈先统一取伤前 N，再各圈独立结算。
 * 必杀伤打 noUltCredit；施法者离场仍可结算。
 */
export function tickMagnetWellBlasts(balls: readonly BallBody[], dt: number): CollisionHit[] {
  const step = Math.max(0, dt);
  if (wells.size === 0) {
    return [];
  }
  const due: MagnetWell[] = [];
  for (const well of [...wells.values()]) {
    if (well.remain - step <= TIME_EPS) {
      due.push(well);
    } else {
      well.remain -= step;
    }
  }
  due.sort((a, b) => a.seq - b.seq);
  const snaps = snapshotDueBlasts(due, balls);
  for (const well of due) {
    wells.delete(well.id);
  }

  const hits: CollisionHit[] = [];
  for (const snap of snaps) {
    const source = balls.find((ball) => ball.id === snap.well.ownerId);
    if (!source) {
      continue;
    }
    const amount = wellBlastDamage(snap.n);
    for (const enemyId of snap.enemyIds) {
      const enemy = balls.find((ball) => ball.id === enemyId);
      if (!enemy) {
        continue;
      }
      const hit = applySkillDamage(enemy, source, amount, {
        allowOfflineSource: true,
        noUltCredit: true,
      });
      if (hit) {
        hits.push(hit);
      }
    }
  }
  return hits;
}
