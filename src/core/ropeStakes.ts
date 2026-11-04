import { openActiveRam, type BallBody, type TeamId } from './ballBody';
import { WELL_STAKE } from '../heroes/wellKit';
import { bounceAlongInwardNormal } from './wallBounce';

export type RopeStake = {
  ownerId: number;
  ownerTeam?: TeamId;
  x: number;
  y: number;
  radius: number;
  remain: number;
};

const EPS = 1e-8;
const stakes = new Map<number, RopeStake>();

export function setStake(stake: RopeStake): void {
  stakes.set(stake.ownerId, stake);
}

export function clearStake(ownerId: number): void {
  stakes.delete(ownerId);
}

export function resetStakes(): void {
  stakes.clear();
}

export function tickStake(ownerId: number, dt: number): void {
  const stake = stakes.get(ownerId);
  if (!stake) {
    return;
  }
  stake.remain -= Math.max(0, dt);
  if (stake.remain <= 0) {
    stakes.delete(ownerId);
  }
}

export function getStake(ownerId: number): RopeStake | null {
  const stake = stakes.get(ownerId);
  return stake && stake.remain > 0 ? stake : null;
}

export function listStakes(): RopeStake[] {
  return [...stakes.values()].filter((stake) => stake.remain > 0);
}

export function placeStake(
  owner: Pick<BallBody, 'id' | 'team'>,
  x: number,
  y: number,
): RopeStake {
  const stake: RopeStake = {
    ownerId: owner.id,
    ownerTeam: owner.team,
    x,
    y,
    radius: WELL_STAKE.radius,
    remain: WELL_STAKE.duration,
  };
  setStake(stake);
  return stake;
}

function isStakeAlly(ball: Pick<BallBody, 'id' | 'team'>, stake: RopeStake): boolean {
  if (ball.id === stake.ownerId) {
    return true;
  }
  return !!stake.ownerTeam && !!ball.team && stake.ownerTeam === ball.team;
}

/** 撞桩按壁反弹；己方（含自己）撞桩开 0.25s 主动撞窗。 */
export function resolveStakeHit(ball: BallBody, stake: RopeStake): boolean {
  const dx = ball.x - stake.x;
  const dy = ball.y - stake.y;
  let dist = Math.hypot(dx, dy);
  const minDist = ball.radius + stake.radius;
  if (dist >= minDist) {
    return false;
  }

  let nx: number;
  let ny: number;
  if (dist < EPS) {
    nx = 1;
    ny = 0;
    dist = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  ball.x = stake.x + nx * minDist;
  ball.y = stake.y + ny * minDist;
  bounceAlongInwardNormal(ball, nx, ny);
  if (isStakeAlly(ball, stake)) {
    openActiveRam(ball);
  }
  return true;
}

export function resolveAllStakes(ball: BallBody): boolean {
  let hit = false;
  for (const stake of listStakes()) {
    if (resolveStakeHit(ball, stake)) {
      hit = true;
    }
  }
  return hit;
}
