import { openActiveRam, type BallBody } from './ballBody';
import {
  FLOOR_SPEED,
  SKILL_IMPULSE,
  SPEED_CAP,
  STRONG_STEER_RAD_PER_SEC,
  WEAK_STEER_RAD_PER_SEC,
} from './constants';

const EPS = 1e-8;

function wrapAngle(delta: number): number {
  if (delta > Math.PI) {
    return delta - Math.PI * 2;
  }
  if (delta < -Math.PI) {
    return delta + Math.PI * 2;
  }
  return delta;
}

export function capBallSpeed(ball: BallBody): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed <= SPEED_CAP) {
    return;
  }
  const s = SPEED_CAP / speed;
  ball.vx *= s;
  ball.vy *= s;
}

export function setFacingFrom(ball: BallBody, dx: number, dy: number): boolean {
  const len = Math.hypot(dx, dy);
  if (len < EPS) {
    return false;
  }
  ball.facingX = dx / len;
  ball.facingY = dy / len;
  return true;
}

/** 速度低于保底时沿当前方向拉回保底；静止则沿朝向起步。 */
export function applyFloorSpeed(ball: BallBody): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed >= FLOOR_SPEED) {
    return;
  }
  let dx = speed > EPS ? ball.vx / speed : ball.facingX;
  let dy = speed > EPS ? ball.vy / speed : ball.facingY;
  const len = Math.hypot(dx, dy);
  if (len < EPS) {
    dx = 1;
    dy = 0;
  } else {
    dx /= len;
    dy /= len;
  }
  ball.vx = dx * FLOOR_SPEED;
  ball.vy = dy * FLOOR_SPEED;
}

export function steerRateRad(ball: BallBody): number {
  return ball.fineTuneRemain > 0 ? STRONG_STEER_RAD_PER_SEC : WEAK_STEER_RAD_PER_SEC;
}

/**
 * 只拧速度方向朝瞄准，不因 Aim 加速。
 * 速率保持摩擦/保底/技能/碰撞后的值。
 */
export function applySteerToward(
  ball: BallBody,
  aimX: number,
  aimY: number,
  dt: number,
  radPerSec = steerRateRad(ball),
): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  const aimLen = Math.hypot(aimX, aimY);
  if (speed < EPS || aimLen < EPS || dt <= 0) {
    return;
  }
  const current = Math.atan2(ball.vy, ball.vx);
  const target = Math.atan2(aimY, aimX);
  const maxStep = radPerSec * dt;
  const step = Math.max(-maxStep, Math.min(maxStep, wrapAngle(target - current)));
  const next = current + step;
  ball.vx = Math.cos(next) * speed;
  ball.vy = Math.sin(next) * speed;
  ball.facingX = Math.cos(next);
  ball.facingY = Math.sin(next);
}

/** 释放 stub：朝向=瞄准方向；速度 += 瞄准单位 × Δv；开主动撞窗。 */
export function applySkillRelease(ball: BallBody, aimX: number, aimY: number): boolean {
  if (!setFacingFrom(ball, aimX, aimY)) {
    if (!setFacingFrom(ball, ball.facingX, ball.facingY)) {
      return false;
    }
  }
  ball.vx += ball.facingX * SKILL_IMPULSE;
  ball.vy += ball.facingY * SKILL_IMPULSE;
  capBallSpeed(ball);
  openActiveRam(ball);
  return true;
}

/** 强拧窗速率（120°/s）；只改方向。 */
export function applyFineTune(ball: BallBody, aimX: number, aimY: number, dt: number): void {
  applySteerToward(ball, aimX, aimY, dt, STRONG_STEER_RAD_PER_SEC);
}
