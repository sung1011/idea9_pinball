import type { BallBody } from './ballBody';
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

/** 每帧：积分位移 → 墙/柱/球分离反弹 → 摩擦 → 速度盖帽。 */
export function stepPhysics(balls: BallBody[], dt: number): void {
  const stepDt = Math.min(Math.max(dt, 0), MAX_DT);

  for (const ball of balls) {
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;
  }

  for (let i = 0; i < COLLISION_ITERS; i += 1) {
    for (const ball of balls) {
      resolveArenaObstacles(ball);
    }
    for (let a = 0; a < balls.length; a += 1) {
      for (let b = a + 1; b < balls.length; b += 1) {
        resolveBallBall(balls[a], balls[b]);
      }
    }
  }

  for (const ball of balls) {
    applyFrictionAndFacing(ball, stepDt);
    capSpeed(ball);
  }
}
