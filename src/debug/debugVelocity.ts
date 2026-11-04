import type { BallBody } from '../core/ballBody';
import { SPEED_CAP } from '../core/constants';
import { screenToLogical, type WorldTransform } from '../render/worldTransform';

export type DebugVelocityHandle = {
  getTargetIndex: () => number;
};

const KEY_DIR: Record<string, readonly [number, number]> = {
  arrowup: [0, -1],
  w: [0, -1],
  arrowdown: [0, 1],
  s: [0, 1],
  arrowleft: [-1, 0],
  a: [-1, 0],
  arrowright: [1, 0],
  d: [1, 0],
};

function impart(ball: BallBody, dx: number, dy: number): void {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    ball.vx = ball.facingX * SPEED_CAP;
    ball.vy = ball.facingY * SPEED_CAP;
    return;
  }
  const inv = 1 / len;
  ball.facingX = dx * inv;
  ball.facingY = dy * inv;
  ball.vx = ball.facingX * SPEED_CAP;
  ball.vy = ball.facingY * SPEED_CAP;
}

function nearestBallIndex(balls: BallBody[], x: number, y: number): number {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < balls.length; i += 1) {
    const d = Math.hypot(balls[i].x - x, balls[i].y - y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** 点击最近球朝点击点给满速；方向键 / WASD / 空格给当前目标球满速。 */
export function bindDebugVelocity(opts: {
  canvas: HTMLCanvasElement;
  getTransform: () => WorldTransform;
  balls: BallBody[];
}): DebugVelocityHandle {
  let targetIndex = 0;

  const canvas = opts.canvas;
  canvas.addEventListener('pointerdown', (ev: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const world = screenToLogical(
      ev.clientX - rect.left,
      ev.clientY - rect.top,
      opts.getTransform(),
    );
    targetIndex = nearestBallIndex(opts.balls, world.x, world.y);
    const ball = opts.balls[targetIndex];
    impart(ball, world.x - ball.x, world.y - ball.y);
  });

  window.addEventListener('keydown', (ev: KeyboardEvent) => {
    if (ev.repeat) {
      return;
    }
    const key = ev.key.toLowerCase();
    const ball = opts.balls[targetIndex] ?? opts.balls[0];
    if (!ball) {
      return;
    }
    if (key === ' ' || key === 'spacebar') {
      ev.preventDefault();
      impart(ball, ball.facingX, ball.facingY);
      return;
    }
    const dir = KEY_DIR[key];
    if (!dir) {
      return;
    }
    ev.preventDefault();
    impart(ball, dir[0], dir[1]);
  });

  return {
    getTargetIndex: () => targetIndex,
  };
}
