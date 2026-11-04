import type { BallBody, TeamId } from './ballBody';

export type TrapZone = {
  ownerId: number;
  ownerTeam?: TeamId;
  x: number;
  y: number;
  radius: number;
  remain: number;
};

const zones = new Map<number, TrapZone>();

export function setTrapZone(zone: TrapZone): void {
  zones.set(zone.ownerId, zone);
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
    if (zone.remain <= 0 || zone.ownerId === ball.id) {
      continue;
    }
    if (zone.ownerTeam && ball.team && zone.ownerTeam === ball.team) {
      continue;
    }
    if (isInsideTrap(zone, ball.x, ball.y)) {
      return true;
    }
  }
  return false;
}
