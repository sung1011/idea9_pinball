import { openActiveRam, type BallBody } from '../core/ballBody';
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

/** 点击最近球朝点击点给满速并开 0.25s 主动撞窗；方向键 / WASD / 空格同理。 */
export function bindDebugVelocity(opts: {
  canvas: HTMLCanvasElement;
  getTransform: () => WorldTransform;
  balls: BallBody[];
  onReset?: () => void;
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
    if (key === 'c') {
      ev.preventDefault();
      const pair = debugPair(opts.balls);
      if (pair) {
        placeBall(pair[0], 8.7, 6, 1, 0);
        placeBall(pair[1], 11.3, 6, -1, 0);
        impart(pair[0], 1, 0);
        impart(pair[1], -1, 0);
      }
      return;
    }
    if (key === 'z') {
      ev.preventDefault();
      const pair = debugPair(opts.balls);
      if (pair) {
        placeBall(pair[0], 8.7, 6, 1, 0);
        placeBall(pair[1], 11.3, 6, 1, 0);
        impart(pair[0], 1, 0);
      }
      return;
    }
    if (key === 'x') {
      ev.preventDefault();
      const pair = debugPair(opts.balls);
      if (pair) {
        placeBall(pair[0], 10, 5.15, 0, 1);
        placeBall(pair[1], 10, 6.85, 1, 0);
        impart(pair[0], 0, 1);
      }
      return;
    }
    if (key === 'v') {
      ev.preventDefault();
      const pair = debugPair(opts.balls);
      if (pair) {
        placeBall(pair[0], 8.7, 6, 1, 0);
        placeBall(pair[1], 11.3, 6, -1, 0);
        impart(pair[0], 1, 0, 1.2, false);
        impart(pair[1], -1, 0, 1.2, false);
      }
      return;
    }
    if (key === 'r') {
      ev.preventDefault();
      const pair = debugPair(opts.balls);
      if (pair) {
        placeBall(pair[0], 6, 3.5, 1, 0);
        placeBall(pair[1], 14, 8.5, -1, 0);
        pair[0].hp = pair[0].maxHp;
        pair[1].hp = pair[1].maxHp;
        pair[0].activeRamRemain = 0;
        pair[1].activeRamRemain = 0;
        opts.onReset?.();
      }
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
