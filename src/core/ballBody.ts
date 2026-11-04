import { BALL_RADIUS } from './constants';

export type BallBody = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  radius: number;
  color: number;
};

export function createBallBody(init: {
  x: number;
  y: number;
  color: number;
  vx?: number;
  vy?: number;
  facingX?: number;
  facingY?: number;
}): BallBody {
  return {
    x: init.x,
    y: init.y,
    vx: init.vx ?? 0,
    vy: init.vy ?? 0,
    facingX: init.facingX ?? 1,
    facingY: init.facingY ?? 0,
    radius: BALL_RADIUS,
    color: init.color,
  };
}
