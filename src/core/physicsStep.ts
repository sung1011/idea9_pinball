import {
  openFineTune,
  tickActiveRam,
  tickSpearCd,
  tickArmor,
  tickEchoMark,
  tickFineTune,
  tickGraze,
  tickHeal,
  tickBurn,
  tickInvincible,
  tickPin,
  tickReflect,
  tickRefract,
  tickShield,
  tickSilence,
  tickStun,
  type BallBody,
} from './ballBody';
import { NAIL_ARMOR, NAIL_PIN } from '../heroes/nailKit';
import type { HealPulse } from './combatFloat';
import { applyCollisionCombat, type CollisionHit } from './collisionDamage';
import { FRICTION, SPEED_CAP } from './constants';
import { applyFloorSpeed } from './skillStub';
import { resolveAllMirrorWalls, tickAllMirrorWalls } from './mirrorWalls';
import { resolveAllStakes } from './ropeStakes';
import { resolveStallInner, stallForBall, type StallFence } from './stallFences';
import { resolveTrapCages } from './trapZones';
import { resolveArenaObstacles, resolveBallBall } from './wallBounce';

export type PhysicsExtras = {
  stalls?: readonly StallFence[];
};

const MAX_DT = 1 / 20;
const COLLISION_ITERS = 3;

function capSpeed(ball: BallBody): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= SPEED_CAP) {
    ball.allowOverCap = false;
    return;
  }
  if (ball.allowOverCap) {
    return;
  }
  const s = SPEED_CAP / speed;
  ball.vx *= s;
  ball.vy *= s;
}

function applyFrictionAndFacing(ball: BallBody, dt: number): void {
  const mul = Number.isFinite(ball.frictionMul) ? Math.max(0, ball.frictionMul) : 1;
  const damp = Math.exp(-FRICTION * mul * dt);
  ball.vx *= damp;
  ball.vy *= damp;
  if (mul === 1 && ball.pinRemain <= 0) {
    applyFloorSpeed(ball);
  }
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= 1e-8) {
    return;
  }
  if (ball.stunRemain > 0) {
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
  heals: HealPulse[];
  collidedIds: number[];
  wallHitIds: number[];
};

/** 每帧：积分位移 → 墙/柱/球/困圈夹边 → 枪尖碰撞掉血弹开 → 摩擦 / 保底 → 速度盖帽。 */
export function stepPhysics(
  balls: readonly BallBody[],
  dt: number,
  extras: PhysicsExtras = {},
): PhysicsStepResult {
  const stepDt = Math.min(Math.max(dt, 0), MAX_DT);
  tickAllMirrorWalls(stepDt);
  const live = balls.filter((ball) => ball.inPlay);

  for (const ball of live) {
    if (ball.pinLocked && ball.pinRemain > 0) {
      ball.vx = 0;
      ball.vy = 0;
      continue;
    }
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;
  }

  const seen = new Set<string>();
  const collided = new Set<number>();
  const wallHits = new Set<number>();
  const pending: Array<{
    a: BallBody;
    b: BallBody;
    nx: number;
    ny: number;
    relSpeed: number;
    relVx: number;
    relVy: number;
  }> = [];

  for (let i = 0; i < COLLISION_ITERS; i += 1) {
    for (const ball of live) {
      let blocked = resolveArenaObstacles(ball);
      if (resolveAllStakes(ball)) {
        blocked = true;
      }
      if (resolveAllMirrorWalls(ball)) {
        blocked = true;
      }
      const fence = extras.stalls && extras.stalls.length > 0 ? stallForBall(ball, extras.stalls) : null;
      if (fence && resolveStallInner(ball, fence)) {
        blocked = true;
      }
      if (blocked) {
        collided.add(ball.id);
        wallHits.add(ball.id);
      }
    }
    resolveTrapCages(live);
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
          relVx: contact.relVx,
          relVy: contact.relVy,
        });
      }
    }
    resolveTrapCages(live);
  }

  const hits: CollisionHit[] = [];
  const heals: HealPulse[] = [];
  for (const contact of pending) {
    hits.push(
      ...applyCollisionCombat(
        contact.a,
        contact.b,
        contact.nx,
        contact.ny,
        contact.relSpeed,
        contact.relVx,
        contact.relVy,
      ),
    );
  }

  for (const ball of live) {
    applyFrictionAndFacing(ball, stepDt);
    capSpeed(ball);
    tickActiveRam(ball, stepDt);
    tickSpearCd(ball, stepDt);
    tickFineTune(ball, stepDt);
    tickInvincible(ball, stepDt);
    tickStun(ball, stepDt);
    tickSilence(ball, stepDt);
    const healed = tickHeal(ball, stepDt);
    if (healed > 0) {
      heals.push({ unitId: ball.id, amount: healed, x: ball.x, y: ball.y });
    }
    const burner = live.find((item) => item.id === ball.burnSourceId);
    const burned = tickBurn(ball, stepDt, burner);
    if (burned) {
      hits.push(burned);
    }
    tickShield(ball, stepDt);
    tickArmor(ball, stepDt, (item) => {
      const before = item.hp;
      item.hp = Math.min(item.maxHp, item.hp + NAIL_ARMOR.heal);
      const gained = item.hp - before;
      if (gained > 0) {
        heals.push({ unitId: item.id, amount: gained, x: item.x, y: item.y });
      }
    });
    tickReflect(ball, stepDt);
    tickPin(ball, stepDt, NAIL_PIN.breakDist);
    tickGraze(ball, stepDt);
    tickEchoMark(ball, stepDt);
    tickRefract(ball, stepDt);
    if (collided.has(ball.id)) {
      openFineTune(ball);
    }
  }

  return { hits, heals, collidedIds: [...collided], wallHitIds: [...wallHits] };
}
