import { openActiveRam, type BallBody } from '../core/ballBody';
import { SPEED_CAP } from '../core/constants';

export type CollisionTestKind = 'back' | 'side' | 'front' | 'graze';

export type DebugVelocityHandle = {
  runCollision: (kind: CollisionTestKind) => boolean;
};

const KEY_TO_KIND: Record<string, CollisionTestKind> = {
  z: 'back',
  x: 'side',
  c: 'front',
  v: 'graze',
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
  ball.stunRemain = 0;
  ball.frictionMul = 1;
  ball.allowOverCap = false;
  ball.suppressCombat = false;
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

/** 碰撞测：Z 背后×1.35 / X 侧面×0.7 / C 正面×1.0 / V 轻蹭。双方在场才生效。 */
export function applyCollisionTest(
  balls: readonly BallBody[],
  kind: CollisionTestKind,
  onPairDebug?: () => void,
): boolean {
  const pair = debugPair(balls as BallBody[]);
  if (!pair || !pair[0].inPlay || !pair[1].inPlay) {
    return false;
  }
  onPairDebug?.();
  if (kind === 'front') {
    placeBall(pair[0], 8.7, 6, 1, 0);
    placeBall(pair[1], 11.3, 6, -1, 0);
    impart(pair[0], 1, 0);
    impart(pair[1], -1, 0);
    return true;
  }
  if (kind === 'back') {
    placeBall(pair[0], 8.7, 6, 1, 0);
    placeBall(pair[1], 11.3, 6, 1, 0);
    impart(pair[0], 1, 0);
    return true;
  }
  if (kind === 'side') {
    placeBall(pair[0], 10, 5.15, 0, 1);
    placeBall(pair[1], 10, 6.85, 1, 0);
    impart(pair[0], 0, 1);
    return true;
  }
  placeBall(pair[0], 9.5, 6, 1, 0);
  placeBall(pair[1], 10.35, 6.5, 1, 0);
  impart(pair[0], 1, 0, 2.5, false);
  impart(pair[1], 1, 0, 2.5, false);
  return true;
}

/** 调试：Z/X/C/V 碰撞测（GM 开时）；R 只重开，正式也可用。 */
export function bindDebugVelocity(opts: {
  balls: BallBody[];
  onReset?: () => void;
  onPairDebug?: () => void;
  isGmOn?: () => boolean;
}): DebugVelocityHandle {
  const runCollision = (kind: CollisionTestKind): boolean =>
    applyCollisionTest(opts.balls, kind, opts.onPairDebug);

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.repeat) {
      return;
    }
    const key = ev.key.toLowerCase();
    if (key === 'r') {
      ev.preventDefault();
      opts.onReset?.();
      return;
    }
    if (!(opts.isGmOn?.() ?? true)) {
      return;
    }
    const kind = KEY_TO_KIND[key];
    if (!kind) {
      return;
    }
    ev.preventDefault();
    runCollision(kind);
  };

  window.addEventListener('keydown', onKey);

  return { runCollision };
}
