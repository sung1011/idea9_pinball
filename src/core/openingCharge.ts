import type { BallBody } from './ballBody';
import {
  CONTROL_POINT,
  OPENING_CHARGE_SPEED,
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

export function applyChargeFloor(ball: BallBody, speed = OPENING_CHARGE_SPEED): void {
  const cur = Math.hypot(ball.vx, ball.vy);
  if (cur >= speed) {
    return;
  }
  let dx = cur > EPS ? ball.vx / cur : ball.facingX;
  let dy = cur > EPS ? ball.vy / cur : ball.facingY;
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
  ball.vx = ball.facingX * OPENING_CHARGE_SPEED;
  ball.vy = ball.facingY * OPENING_CHARGE_SPEED;
  ball.aimX = ball.facingX;
  ball.aimY = ball.facingY;
  ball.hasAim = true;
}

/** 朝领地极弱拧，并保持冲锋保底速。dt=0 时只拉速。 */
export function applyOpeningCharge(ball: BallBody, dt: number): void {
  if (!ball.inPlay) {
    return;
  }
  const aim = chargeAim(ball);
  applyChargeFloor(ball);
  if (dt > 0 && ball.stunRemain <= 0) {
    applySteerToward(ball, aim.x, aim.y, dt, OPENING_CHARGE_STEER_RAD_PER_SEC);
    applyChargeFloor(ball);
  }
  ball.aimX = aim.x;
  ball.aimY = aim.y;
  ball.hasAim = true;
}
