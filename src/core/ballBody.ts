import { ACTIVE_RAM_WINDOW, BALL_RADIUS, MAX_HP } from './constants';

let nextBallId = 1;

export type BallBody = {
  id: number;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  radius: number;
  color: number;
  hp: number;
  maxHp: number;
  /** 主动撞窗口剩余秒数；>0 时碰撞按主动撞阈值结算 */
  activeRamRemain: number;
};

export function createBallBody(init: {
  x: number;
  y: number;
  color: number;
  label?: string;
  vx?: number;
  vy?: number;
  facingX?: number;
  facingY?: number;
  hp?: number;
}): BallBody {
  const id = nextBallId;
  nextBallId += 1;
  return {
    id,
    label: init.label ?? `球${id}`,
    x: init.x,
    y: init.y,
    vx: init.vx ?? 0,
    vy: init.vy ?? 0,
    facingX: init.facingX ?? 1,
    facingY: init.facingY ?? 0,
    radius: BALL_RADIUS,
    color: init.color,
    hp: init.hp ?? MAX_HP,
    maxHp: MAX_HP,
    activeRamRemain: 0,
  };
}

export function openActiveRam(ball: BallBody): void {
  ball.activeRamRemain = ACTIVE_RAM_WINDOW;
}

export function tickActiveRam(ball: BallBody, dt: number): void {
  if (ball.activeRamRemain <= 0) {
    ball.activeRamRemain = 0;
    return;
  }
  ball.activeRamRemain = Math.max(0, ball.activeRamRemain - dt);
}
