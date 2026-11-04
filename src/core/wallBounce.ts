import type { BallBody } from './ballBody';
import {
  ARENA_CORNER_RADIUS,
  BALL_RADIUS,
  LEFT_PILLAR,
  MAP_HEIGHT,
  MAP_WIDTH,
  PILLAR_HEIGHT,
  PILLAR_WIDTH,
  RIGHT_PILLAR,
  WALL_RESTITUTION,
} from './constants';

const EPS = 1e-8;

function hypot2(x: number, y: number): number {
  return Math.hypot(x, y);
}

/** 沿指向场地内部的法线反射速度；发生反弹时返回 true。粘壁只削掉内向分量。 */
export function bounceAlongInwardNormal(ball: BallBody, nx: number, ny: number): boolean {
  const vn = ball.vx * nx + ball.vy * ny;
  if (vn >= 0) {
    return false;
  }
  if (ball.slideWalls) {
    ball.vx -= vn * nx;
    ball.vy -= vn * ny;
    return true;
  }
  const scale = 1 + WALL_RESTITUTION;
  ball.vx -= scale * vn * nx;
  ball.vy -= scale * vn * ny;
  return true;
}

/**
 * 把圆心约束进「场地圆角矩形内缩球半径」的可玩区，并在穿墙时反弹。
 * 内缩后角半径 = 场地角半径 − 球半径。
 */
export function resolveArenaWall(ball: BallBody): boolean {
  const minX = BALL_RADIUS;
  const maxX = MAP_WIDTH - BALL_RADIUS;
  const minY = BALL_RADIUS;
  const maxY = MAP_HEIGHT - BALL_RADIUS;
  const cornerR = Math.max(0, ARENA_CORNER_RADIUS - BALL_RADIUS);
  const leftC = minX + cornerR;
  const rightC = maxX - cornerR;
  const topC = minY + cornerR;
  const bottomC = maxY - cornerR;

  const ox = ball.x;
  const oy = ball.y;
  let nx = 0;
  let ny = 0;
  let hit = false;

  if (ball.x >= leftC && ball.x <= rightC) {
    if (ball.y < minY) {
      ball.y = minY;
      nx = 0;
      ny = 1;
      hit = true;
    } else if (ball.y > maxY) {
      ball.y = maxY;
      nx = 0;
      ny = -1;
      hit = true;
    }
  } else if (ball.y >= topC && ball.y <= bottomC) {
    if (ball.x < minX) {
      ball.x = minX;
      nx = 1;
      ny = 0;
      hit = true;
    } else if (ball.x > maxX) {
      ball.x = maxX;
      nx = -1;
      ny = 0;
      hit = true;
    }
  } else {
    const cx = ball.x < leftC ? leftC : rightC;
    const cy = ball.y < topC ? topC : bottomC;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = hypot2(dx, dy);
    if (dist > cornerR) {
      const inv = dist > EPS ? 1 / dist : 0;
      ball.x = cx + dx * inv * cornerR;
      ball.y = cy + dy * inv * cornerR;
      nx = ball.x - ox;
      ny = ball.y - oy;
      hit = true;
    }
  }

  if (!hit) {
    return false;
  }
  const nlen = hypot2(nx, ny);
  if (nlen < EPS) {
    return false;
  }
  return bounceAlongInwardNormal(ball, nx / nlen, ny / nlen);
}

/**
 * 矮柱按 2×1 胶囊当墙：与椭圆视觉接近，圆心距段 + 球半径 + 半高。
 */
export function resolvePillarWall(
  ball: BallBody,
  pillar: { readonly x: number; readonly y: number },
): boolean {
  const halfLen = (PILLAR_WIDTH - PILLAR_HEIGHT) / 2;
  const closestX = Math.min(pillar.x + halfLen, Math.max(pillar.x - halfLen, ball.x));
  const closestY = pillar.y;
  let dx = ball.x - closestX;
  let dy = ball.y - closestY;
  let dist = hypot2(dx, dy);
  const minDist = BALL_RADIUS + PILLAR_HEIGHT / 2;

  if (dist >= minDist) {
    return false;
  }

  let nx: number;
  let ny: number;
  if (dist < EPS) {
    nx = ball.x >= pillar.x ? 1 : -1;
    ny = 0;
    dist = 0;
  } else {
    nx = dx / dist;
    ny = dy / dist;
  }

  ball.x = closestX + nx * minDist;
  ball.y = closestY + ny * minDist;
  return bounceAlongInwardNormal(ball, nx, ny);
}

export function resolveArenaObstacles(ball: BallBody): boolean {
  const wall = resolveArenaWall(ball);
  const left = resolvePillarWall(ball, LEFT_PILLAR);
  const right = resolvePillarWall(ball, RIGHT_PILLAR);
  return wall || left || right;
}

export type BallOverlap = {
  nx: number;
  ny: number;
  relSpeed: number;
  approaching: boolean;
};

/** 等质量弹性分离；伤害 / 朝向乘区 / 弹开由 collisionDamage 在接触后结算。 */
export function resolveBallBall(a: BallBody, b: BallBody): BallOverlap | null {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let dist = hypot2(dx, dy);
  const minDist = a.radius + b.radius;
  if (dist >= minDist) {
    return null;
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

  const relSpeed = hypot2(a.vx - b.vx, a.vy - b.vy);
  const vnA = a.vx * nx + a.vy * ny;
  const vnB = b.vx * nx + b.vy * ny;
  const rel = vnB - vnA;
  const approaching = rel <= 0;

  const overlap = minDist - dist;
  a.x -= nx * overlap * 0.5;
  a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5;
  b.y += ny * overlap * 0.5;

  if (rel > 0) {
    return { nx, ny, relSpeed, approaching };
  }
  a.vx += rel * nx;
  a.vy += rel * ny;
  b.vx -= rel * nx;
  b.vy -= rel * ny;
  return { nx, ny, relSpeed, approaching };
}
