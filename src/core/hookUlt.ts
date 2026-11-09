import type { BallBody } from './ballBody';
import { spearAimDir } from './collisionDamage';
import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { HOOK_ULT } from '../heroes/hookKit';
import { applySkillDamage } from './skillHits';
import { distToSegment, unitVec } from './skillQuery';
import { capBallSpeed } from './skillStub';
import type { CollisionHit } from './collisionDamage';

const EPS = 1e-8;
const TOUCH_PAD = 0.12;

export type UltBackEffect = {
  kind: 'ultBack';
  step: number;
  remain: number;
  remainDist: number;
  dirX: number;
  dirY: number;
};

export type UltChargeEffect = {
  kind: 'ultCharge';
  speed: number;
  dirX: number;
  dirY: number;
  hitIds: number[];
  lastX: number;
  lastY: number;
  stall: number;
};

export type UltEffect = UltBackEffect | UltChargeEffect;

function wrapAngle(delta: number): number {
  if (delta > Math.PI) {
    return delta - Math.PI * 2;
  }
  if (delta < -Math.PI) {
    return delta + Math.PI * 2;
  }
  return delta;
}

export function liveSpear(ball: BallBody): { x: number; y: number } {
  return spearAimDir(ball);
}

export function beginUltBack(ball: BallBody, step: number): UltBackEffect {
  const spear = liveSpear(ball);
  const back = unitVec(-spear.x, -spear.y) ?? { x: -1, y: 0 };
  return {
    kind: 'ultBack',
    step,
    remain: HOOK_ULT.stepTime,
    remainDist: HOOK_ULT.stepDist,
    dirX: back.x,
    dirY: back.y,
  };
}

export function beginUltCharge(ball: BallBody): UltChargeEffect {
  const spear = liveSpear(ball);
  const dir = unitVec(spear.x, spear.y) ?? { x: 1, y: 0 };
  ball.vx = dir.x * HOOK_ULT.chargeSpeed0;
  ball.vy = dir.y * HOOK_ULT.chargeSpeed0;
  ball.facingX = dir.x;
  ball.facingY = dir.y;
  ball.allowOverCap = true;
  ball.frictionMul = 0;
  ball.suppressCombat = true;
  return {
    kind: 'ultCharge',
    speed: HOOK_ULT.chargeSpeed0,
    dirX: dir.x,
    dirY: dir.y,
    hitIds: [],
    lastX: ball.x,
    lastY: ball.y,
    stall: 0,
  };
}

export function applyUltBackVel(ball: BallBody, effect: UltBackEffect): void {
  const spear = liveSpear(ball);
  ball.facingX = spear.x;
  ball.facingY = spear.y;
  ball.suppressCombat = true;
  ball.frictionMul = 0;
  if (effect.remainDist <= EPS) {
    ball.vx = 0;
    ball.vy = 0;
    return;
  }
  const speed = HOOK_ULT.stepDist / HOOK_ULT.stepTime;
  ball.vx = effect.dirX * speed;
  ball.vy = effect.dirY * speed;
  ball.allowOverCap = true;
}

export function applyUltChargeVel(ball: BallBody, effect: UltChargeEffect, dt: number): void {
  const spear = liveSpear(ball);
  const want = unitVec(spear.x, spear.y) ?? { x: ball.facingX, y: ball.facingY };
  const step = Math.max(0, dt);
  let ang = Math.atan2(ball.vy, ball.vx);
  if (!Number.isFinite(ang) || Math.hypot(ball.vx, ball.vy) < EPS) {
    ang = Math.atan2(want.y, want.x);
  }
  const target = Math.atan2(want.y, want.x);
  const maxTurn = ((HOOK_ULT.turnDegPerSec * Math.PI) / 180) * step;
  let delta = wrapAngle(target - ang);
  if (delta > maxTurn) {
    delta = maxTurn;
  } else if (delta < -maxTurn) {
    delta = -maxTurn;
  }
  const nextAng = ang + delta;
  effect.speed = Math.min(HOOK_ULT.chargeSpeedCap, effect.speed + HOOK_ULT.chargeAccel * step);
  effect.dirX = Math.cos(nextAng);
  effect.dirY = Math.sin(nextAng);
  ball.vx = effect.dirX * effect.speed;
  ball.vy = effect.dirY * effect.speed;
  ball.facingX = effect.dirX;
  ball.facingY = effect.dirY;
  ball.allowOverCap = true;
  ball.frictionMul = 0;
  ball.suppressCombat = true;
}

export function keepUltFacing(ball: BallBody, effect: UltEffect): void {
  if (effect.kind === 'ultBack') {
    const spear = liveSpear(ball);
    ball.facingX = spear.x;
    ball.facingY = spear.y;
    return;
  }
  ball.facingX = effect.dirX;
  ball.facingY = effect.dirY;
}

/** 物理球球弹开会改速度；冲锋只横向挤开敌人，恢复必杀速度。 */
export function restoreUltChargeVel(ball: BallBody, effect: UltChargeEffect): void {
  ball.vx = effect.dirX * effect.speed;
  ball.vy = effect.dirY * effect.speed;
  ball.allowOverCap = true;
  ball.frictionMul = 0;
  ball.suppressCombat = true;
  ball.facingX = effect.dirX;
  ball.facingY = effect.dirY;
}

export function finishUltThrust(ball: BallBody): void {
  ball.allowOverCap = false;
  ball.frictionMul = 1;
  ball.suppressCombat = false;
  capBallSpeed(ball);
}

export function ultOutOfBounds(ball: BallBody): boolean {
  const pad = ball.radius + 0.35;
  return (
    !Number.isFinite(ball.x) ||
    !Number.isFinite(ball.y) ||
    ball.x < -pad ||
    ball.x > MAP_WIDTH + pad ||
    ball.y < -pad ||
    ball.y > MAP_HEIGHT + pad
  );
}

function separateLateral(self: BallBody, other: BallBody, dirX: number, dirY: number): void {
  const px = -dirY;
  const py = dirX;
  const dx = other.x - self.x;
  const dy = other.y - self.y;
  let side = dx * px + dy * py;
  if (Math.abs(side) < EPS) {
    side = 1;
  }
  const n = side >= 0 ? 1 : -1;
  const need = self.radius + other.radius + 0.04;
  other.x = self.x + px * n * need;
  other.y = self.y + py * n * need;
}

export function sweepUltHits(
  ball: BallBody,
  roster: readonly BallBody[],
  effect: UltChargeEffect,
  dt = 1 / 60,
): CollisionHit[] {
  const dir = unitVec(effect.dirX, effect.dirY) ?? liveSpear(ball);
  const hits: CollisionHit[] = [];
  for (const other of roster) {
    if (!other.inPlay || other.id === ball.id) {
      continue;
    }
    if (other.team && ball.team && other.team === ball.team) {
      continue;
    }
    if (effect.hitIds.includes(other.id)) {
      continue;
    }
    const reach = ball.radius + other.radius + TOUCH_PAD;
    const swept = distToSegment(other.x, other.y, effect.lastX, effect.lastY, ball.x, ball.y);
    const now = Math.hypot(other.x - ball.x, other.y - ball.y);
    if (swept > reach && now > reach) {
      continue;
    }
    const dmg = applySkillDamage(other, ball, HOOK_ULT.damage);
    effect.hitIds.push(other.id);
    if (dmg) {
      hits.push(dmg);
    }
    separateLateral(ball, other, dir.x, dir.y);
  }
  const moved = Math.hypot(ball.x - effect.lastX, ball.y - effect.lastY);
  if (moved < 0.02 && effect.speed > 1) {
    effect.stall += Math.max(0, dt);
  } else {
    effect.stall = 0;
  }
  effect.lastX = ball.x;
  effect.lastY = ball.y;
  return hits;
}
