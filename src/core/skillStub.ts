import { openActiveRam, type BallBody } from './ballBody';
import { FINE_TUNE_TURN_RAD_PER_SEC, REST_SPEED, SKILL_IMPULSE, SPEED_CAP } from './constants';

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

/** 窗内把速度方向朝瞄准轻扭，保持速率。 */
export function applyFineTune(ball: BallBody, aimX: number, aimY: number, dt: number): void {
  const speed = Math.hypot(ball.vx, ball.vy);
  const aimLen = Math.hypot(aimX, aimY);
  if (speed < REST_SPEED || aimLen < EPS || dt <= 0) {
    return;
  }
  const current = Math.atan2(ball.vy, ball.vx);
  const target = Math.atan2(aimY, aimX);
  const maxStep = FINE_TUNE_TURN_RAD_PER_SEC * dt;
  const step = Math.max(-maxStep, Math.min(maxStep, wrapAngle(target - current)));
  const next = current + step;
  ball.vx = Math.cos(next) * speed;
  ball.vy = Math.sin(next) * speed;
}
