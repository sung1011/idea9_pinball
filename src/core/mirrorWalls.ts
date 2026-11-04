import { openActiveRam, type BallBody, type TeamId } from './ballBody';
import { MIRROR_WALL } from '../heroes/mirrorKit';
import { distToSegment } from './skillQuery';
import { bounceAlongInwardNormal } from './wallBounce';

export type MirrorWall = {
  ownerId: number;
  ownerTeam?: TeamId;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  halfWidth: number;
  remain: number;
};

const EPS = 1e-8;
const walls = new Map<number, MirrorWall>();

export function setMirrorWall(wall: MirrorWall): void {
  walls.set(wall.ownerId, wall);
}

export function clearMirrorWall(ownerId: number): void {
  walls.delete(ownerId);
}

export function resetMirrorWalls(): void {
  walls.clear();
}

export function tickMirrorWall(ownerId: number, dt: number): void {
  const wall = walls.get(ownerId);
  if (!wall) {
    return;
  }
  wall.remain -= Math.max(0, dt);
  if (wall.remain <= 0) {
    walls.delete(ownerId);
  }
}

export function tickAllMirrorWalls(dt: number): void {
  for (const ownerId of [...walls.keys()]) {
    tickMirrorWall(ownerId, dt);
  }
}

export function getMirrorWall(ownerId: number): MirrorWall | null {
  const wall = walls.get(ownerId);
  return wall && wall.remain > 0 ? wall : null;
}

export function listMirrorWalls(): MirrorWall[] {
  return [...walls.values()].filter((wall) => wall.remain > 0);
}

export function placeMirrorWall(
  owner: Pick<BallBody, 'id' | 'team'>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  halfWidth: number = MIRROR_WALL.halfWidth,
): MirrorWall {
  const wall: MirrorWall = {
    ownerId: owner.id,
    ownerTeam: owner.team,
    x0,
    y0,
    x1,
    y1,
    halfWidth,
    remain: MIRROR_WALL.duration,
  };
  setMirrorWall(wall);
  return wall;
}

function isWallAlly(ball: Pick<BallBody, 'id' | 'team'>, wall: MirrorWall): boolean {
  if (ball.id === wall.ownerId) {
    return true;
  }
  return !!wall.ownerTeam && !!ball.team && wall.ownerTeam === ball.team;
}

/** 薄胶囊墙：敌方改速度方向反弹；己方反弹并开 0.25s 主动撞窗。 */
export function resolveMirrorWallHit(ball: BallBody, wall: MirrorWall): boolean {
  const minDist = ball.radius + wall.halfWidth;
  const dist = distToSegment(ball.x, ball.y, wall.x0, wall.y0, wall.x1, wall.y1);
  if (dist >= minDist) {
    return false;
  }

  const dx = wall.x1 - wall.x0;
  const dy = wall.y1 - wall.y0;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > EPS) {
    t = Math.max(0, Math.min(1, ((ball.x - wall.x0) * dx + (ball.y - wall.y0) * dy) / len2));
  }
  const closestX = wall.x0 + dx * t;
  const closestY = wall.y0 + dy * t;
  let nx = ball.x - closestX;
  let ny = ball.y - closestY;
  let nlen = Math.hypot(nx, ny);
  if (nlen < EPS) {
    nx = -dy;
    ny = dx;
    nlen = Math.hypot(nx, ny);
    if (nlen < EPS) {
      nx = 1;
      ny = 0;
      nlen = 1;
    }
  }
  nx /= nlen;
  ny /= nlen;
  ball.x = closestX + nx * minDist;
  ball.y = closestY + ny * minDist;
  bounceAlongInwardNormal(ball, nx, ny);
  if (isWallAlly(ball, wall)) {
    openActiveRam(ball);
  }
  return true;
}

export function resolveAllMirrorWalls(ball: BallBody): boolean {
  let hit = false;
  for (const wall of listMirrorWalls()) {
    if (resolveMirrorWallHit(ball, wall)) {
      hit = true;
    }
  }
  return hit;
}
