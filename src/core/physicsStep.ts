import { openFineTune, tickActiveRam, tickFineTune, type BallBody } from './ballBody';
import { applyCollisionCombat, type CollisionHit } from './collisionDamage';
import { FRICTION, REST_SPEED, SPEED_CAP } from './constants';
import { resolveArenaObstacles, resolveBallBall } from './wallBounce';

const MAX_DT = 1 / 20;
const COLLISION_ITERS = 3;

function capSpeed(ball: BallBody): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= SPEED_CAP) {
    return;
  }
  const s = SPEED_CAP / speed;
  ball.vx *= s;
  ball.vy *= s;
}

function applyFrictionAndFacing(ball: BallBody, dt: number): void {
  const damp = Math.exp(-FRICTION * dt);
  ball.vx *= damp;
  ball.vy *= damp;

  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed < REST_SPEED) {
    ball.vx = 0;
    ball.vy = 0;
    return;
  }
  ball.facingX = ball.vx / speed;
  ball.facingY = ball.vy / speed;
}

function pairKey(a: BallBody, b: BallBody): string {
  return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
}

export type PhysicsStepResult = {
  hits: CollisionHit[];
  collidedIds: number[];
};

/** 每帧：积分位移 → 墙/柱/球弹性分离 → 达标碰撞掉血弹开 → 摩擦 → 速度盖帽。 */
export function stepPhysics(balls: BallBody[], dt: number): PhysicsStepResult {
  const stepDt = Math.min(Math.max(dt, 0), MAX_DT);

  for (const ball of balls) {
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;
  }

  const seen = new Set<string>();
  const collided = new Set<number>();
  const pending: Array<{
    a: BallBody;
    b: BallBody;
    nx: number;
    ny: number;
    relSpeed: number;
  }> = [];

  for (let i = 0; i < COLLISION_ITERS; i += 1) {
    for (const ball of balls) {
      if (resolveArenaObstacles(ball)) {
        collided.add(ball.id);
      }
    }
    for (let a = 0; a < balls.length; a += 1) {
      for (let b = a + 1; b < balls.length; b += 1) {
        const contact = resolveBallBall(balls[a], balls[b]);
        if (!contact || !contact.approaching) {
          continue;
        }
        collided.add(balls[a].id);
        collided.add(balls[b].id);
        const key = pairKey(balls[a], balls[b]);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        pending.push({
          a: balls[a],
          b: balls[b],
          nx: contact.nx,
          ny: contact.ny,
          relSpeed: contact.relSpeed,
        });
      }
    }
  }

  const hits: CollisionHit[] = [];
  for (const contact of pending) {
    hits.push(
      ...applyCollisionCombat(contact.a, contact.b, contact.nx, contact.ny, contact.relSpeed),
    );
  }

  for (const ball of balls) {
    applyFrictionAndFacing(ball, stepDt);
    capSpeed(ball);
    tickActiveRam(ball, stepDt);
    tickFineTune(ball, stepDt);
    if (collided.has(ball.id)) {
      openFineTune(ball);
    }
  }

  return { hits, collidedIds: [...collided] };
}
