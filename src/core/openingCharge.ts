import type { BallBody } from './ballBody';
import {
  CONTROL_POINT,
  OPENING_CHARGE_RAMP_SEC,
  OPENING_CHARGE_SEC,
  OPENING_CHARGE_SPEED,
  OPENING_CHARGE_START_SPEED,
  OPENING_CHARGE_STEER_RAD_PER_SEC,
} from './constants';
import { applySteerToward, setFacingFrom } from './skillStub';

const EPS = 1e-8;

/** 冲锋瞄准：朝领地中心（红向右、蓝向左偏中）。 */
export function chargeAim(ball: BallBody): { x: number; y: number } {
  const dx = CONTROL_POINT.x - ball.x;
  const dy = CONTROL_POINT.y - ball.y;
  const len = Math.hypot(dx, dy);
  if (len > EPS) {
    return { x: dx / len, y: dy / len };
  }
  if (ball.team === 'blue') {
    return { x: -1, y: 0 };
  }
  return { x: 1, y: 0 };
}

/** 栏开后前 0.4s 从起步速 lerp 到峰值 7.5。 */
export function chargeSpeedAt(remain: number): number {
  const elapsed = OPENING_CHARGE_SEC - Math.max(0, remain);
  if (OPENING_CHARGE_RAMP_SEC <= 0) {
    return OPENING_CHARGE_SPEED;
  }
  const t = Math.max(0, Math.min(1, elapsed / OPENING_CHARGE_RAMP_SEC));
  return OPENING_CHARGE_START_SPEED + (OPENING_CHARGE_SPEED - OPENING_CHARGE_START_SPEED) * t;
}

export function applyChargeSpeed(ball: BallBody, speed: number): void {
  let dx = ball.facingX;
  let dy = ball.facingY;
  const cur = Math.hypot(ball.vx, ball.vy);
  if (cur > EPS) {
    dx = ball.vx / cur;
    dy = ball.vy / cur;
  }
  const len = Math.hypot(dx, dy);
  if (len < EPS) {
    const aim = chargeAim(ball);
    dx = aim.x;
    dy = aim.y;
  } else {
    dx /= len;
    dy /= len;
  }
  ball.vx = dx * speed;
  ball.vy = dy * speed;
}

export function snapChargeFacing(ball: BallBody): void {
  const aim = chargeAim(ball);
  setFacingFrom(ball, aim.x, aim.y);
  ball.vx = ball.facingX * OPENING_CHARGE_START_SPEED;
  ball.vy = ball.facingY * OPENING_CHARGE_START_SPEED;
  ball.aimX = ball.facingX;
  ball.aimY = ball.facingY;
  ball.hasAim = true;
}

/** 朝领地几乎锁拧，并按冲锋曲线拉速。dt=0 时只拉速。 */
export function applyOpeningCharge(ball: BallBody, dt: number, remain: number): void {
  if (!ball.inPlay) {
    return;
  }
  const aim = chargeAim(ball);
  const speed = chargeSpeedAt(remain);
  applyChargeSpeed(ball, speed);
  if (dt > 0 && ball.stunRemain <= 0) {
    applySteerToward(ball, aim.x, aim.y, dt, OPENING_CHARGE_STEER_RAD_PER_SEC);
    applyChargeSpeed(ball, speed);
  }
  ball.aimX = aim.x;
  ball.aimY = aim.y;
  ball.hasAim = true;
}
