import {
  openFineTune,
  tickActiveRam,
  tickFineTune,
  tickInvincible,
  type BallBody,
} from './ballBody';
import { applyCollisionCombat, type CollisionHit } from './collisionDamage';
import { FRICTION, SPEED_CAP } from './constants';
import { applyFloorSpeed } from './skillStub';
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
  applyFloorSpeed(ball);
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= 1e-8) {
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
  const live = balls.filter((ball) => ball.inPlay);

  for (const ball of live) {
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
    for (const ball of live) {
      if (resolveArenaObstacles(ball)) {
        collided.add(ball.id);
      }
    }
    for (let a = 0; a < live.length; a += 1) {
      for (let b = a + 1; b < live.length; b += 1) {
        const contact = resolveBallBall(live[a], live[b]);
        if (!contact || !contact.approaching) {
          continue;
        }
        collided.add(live[a].id);
        collided.add(live[b].id);
        const key = pairKey(live[a], live[b]);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        pending.push({
          a: live[a],
          b: live[b],
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

  for (const ball of live) {
    applyFrictionAndFacing(ball, stepDt);
    capSpeed(ball);
    tickActiveRam(ball, stepDt);
    tickFineTune(ball, stepDt);
    tickInvincible(ball, stepDt);
    if (collided.has(ball.id)) {
      openFineTune(ball);
    }
  }

  return { hits, collidedIds: [...collided] };
}
