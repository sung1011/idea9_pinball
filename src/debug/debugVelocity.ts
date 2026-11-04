import { openActiveRam, type BallBody } from '../core/ballBody';
import { SPEED_CAP } from '../core/constants';

export type DebugVelocityHandle = {
  getTargetIndex: () => number;
};

function setFacing(ball: BallBody, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    return;
  }
  const inv = 1 / len;
  ball.facingX = dx * inv;
  ball.facingY = dy * inv;
}

function placeBall(ball: BallBody, x: number, y: number, facingX: number, facingY: number): void {
  ball.x = x;
  ball.y = y;
  ball.vx = 0;
  ball.vy = 0;
  ball.facingX = facingX;
  ball.facingY = facingY;
  ball.activeRamRemain = 0;
  ball.fineTuneRemain = 0;
  ball.invincibleRemain = 0;
}

function impart(ball: BallBody, dx: number, dy: number, speed = SPEED_CAP, ram = true): void {
  setFacing(ball, dx, dy);
  ball.vx = ball.facingX * speed;
  ball.vy = ball.facingY * speed;
  if (ram) {
    openActiveRam(ball);
  }
}

function debugPair(balls: BallBody[]): [BallBody, BallBody] | null {
  const a = balls[0];
  const b = balls[1];
  return a && b ? [a, b] : null;
}

/** 保留 C/Z/X/V/R 验收对撞。点击 / WASD / 方向键不再给速，避免抢走 Aim 与技能键。 */
export function bindDebugVelocity(opts: { balls: BallBody[]; onReset?: () => void }): DebugVelocityHandle {
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.repeat) {
      return;
    }
    const key = ev.key.toLowerCase();
    const pair = debugPair(opts.balls);
    if (!pair) {
      return;
    }
    if (key === 'c' || key === 'z' || key === 'x' || key === 'v') {
      if (!pair[0].inPlay || !pair[1].inPlay) {
        return;
      }
    }
    if (key === 'c') {
      ev.preventDefault();
      placeBall(pair[0], 8.7, 6, 1, 0);
      placeBall(pair[1], 11.3, 6, -1, 0);
      impart(pair[0], 1, 0);
      impart(pair[1], -1, 0);
      return;
    }
    if (key === 'z') {
      ev.preventDefault();
      placeBall(pair[0], 8.7, 6, 1, 0);
      placeBall(pair[1], 11.3, 6, 1, 0);
      impart(pair[0], 1, 0);
      return;
    }
    if (key === 'x') {
      ev.preventDefault();
      placeBall(pair[0], 10, 5.15, 0, 1);
      placeBall(pair[1], 10, 6.85, 1, 0);
      impart(pair[0], 0, 1);
      return;
    }
    if (key === 'v') {
      ev.preventDefault();
      placeBall(pair[0], 9.5, 6, 1, 0);
      placeBall(pair[1], 10.35, 6.5, 1, 0);
      impart(pair[0], 1, 0, 2.5, false);
      impart(pair[1], 1, 0, 2.5, false);
      return;
    }
    if (key === 'r') {
      ev.preventDefault();
      opts.onReset?.();
    }
  };

  window.addEventListener('keydown', onKey);

  return {
    getTargetIndex: () => 0,
  };
}
