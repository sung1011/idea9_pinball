import type { BallBody, TeamId } from './ballBody';

const RIM_EPS = 1e-8;

export type TrapZone = {
  ownerId: number;
  ownerTeam?: TeamId;
  x: number;
  y: number;
  radius: number;
  remain: number;
  /** 已进圈的敌；圈在期间出不去。 */
  containedIds: Set<number>;
};

const zones = new Map<number, TrapZone>();

function isEnemyOfZone(zone: TrapZone, ball: Pick<BallBody, 'id' | 'team'>): boolean {
  if (zone.ownerId === ball.id) {
    return false;
  }
  if (zone.ownerTeam && ball.team && zone.ownerTeam === ball.team) {
    return false;
  }
  return true;
}

export function setTrapZone(zone: Omit<TrapZone, 'containedIds'> & { containedIds?: Set<number> }): void {
  zones.set(zone.ownerId, {
    ...zone,
    containedIds: zone.containedIds ?? new Set(),
  });
}

export function clearTrapZone(ownerId: number): void {
  zones.delete(ownerId);
}

export function resetTrapZones(): void {
  zones.clear();
}

export function tickTrapZone(ownerId: number, dt: number): void {
  const zone = zones.get(ownerId);
  if (!zone) {
    return;
  }
  zone.remain -= Math.max(0, dt);
  if (zone.remain <= 0) {
    zones.delete(ownerId);
  }
}

export function listTrapZones(): TrapZone[] {
  return [...zones.values()].filter((zone) => zone.remain > 0);
}

export function isInsideTrap(zone: TrapZone, x: number, y: number): boolean {
  return Math.hypot(x - zone.x, y - zone.y) <= zone.radius;
}

/** 敌方困圈内：禁位移技。友军不受困；外进圈不挡。 */
export function isInEnemyTrap(ball: Pick<BallBody, 'id' | 'x' | 'y' | 'team'>): boolean {
  for (const zone of zones.values()) {
    if (zone.remain <= 0 || !isEnemyOfZone(zone, ball)) {
      continue;
    }
    if (isInsideTrap(zone, ball.x, ball.y)) {
      return true;
    }
  }
  return false;
}

/** 把当前在圈内的敌记进 containedIds；外进圈后也关死。 */
export function markTrapOccupants(balls: readonly Pick<BallBody, 'id' | 'x' | 'y' | 'team' | 'inPlay'>[]): void {
  for (const zone of zones.values()) {
    if (zone.remain <= 0) {
      continue;
    }
    for (const ball of balls) {
      if (!ball.inPlay || !isEnemyOfZone(zone, ball)) {
        continue;
      }
      if (isInsideTrap(zone, ball.x, ball.y)) {
        zone.containedIds.add(ball.id);
      }
    }
  }
}

function clampToRim(ball: BallBody, zone: TrapZone): boolean {
  const dx = ball.x - zone.x;
  const dy = ball.y - zone.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= zone.radius + RIM_EPS) {
    return false;
  }
  if (dist < RIM_EPS) {
    ball.x = zone.x + zone.radius;
    ball.y = zone.y;
    return true;
  }
  const nx = dx / dist;
  const ny = dy / dist;
  ball.x = zone.x + nx * zone.radius;
  ball.y = zone.y + ny * zone.radius;
  const outward = ball.vx * nx + ball.vy * ny;
  if (outward > 0) {
    ball.vx -= outward * nx;
    ball.vy -= outward * ny;
  }
  return true;
}

/**
 * 物理关死：已进圈的敌不能滑出，位置夹在边缘并削掉向外速度。
 * 友军 / 施放者不受困；圈外仍可滑进。
 */
export function resolveTrapCages(balls: readonly BallBody[]): boolean {
  markTrapOccupants(balls);
  let hit = false;
  for (const zone of zones.values()) {
    if (zone.remain <= 0) {
      continue;
    }
    for (const ball of balls) {
      if (!ball.inPlay || !isEnemyOfZone(zone, ball)) {
        continue;
      }
      if (!zone.containedIds.has(ball.id)) {
        continue;
      }
      if (clampToRim(ball, zone)) {
        hit = true;
      }
    }
  }
  return hit;
}
