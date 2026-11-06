import { applyHardCc } from './hardCc';
import { applyHpLoss } from './hpLoss';
import { knockbackSpeed } from './collisionDamage';
import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import {
  KNOCKBACK_SPEED_SPAN,
  MAP_HEIGHT,
  MAP_WIDTH,
  RIFT_BURST_VISUAL_SEC,
  RIFT_DAMAGE,
  RIFT_FIRST_SEC,
  RIFT_INTERVAL_SEC,
  RIFT_RADIUS,
  RIFT_STUN_SEC,
  RIFT_WARN_SEC,
} from './constants';

export type RiftPhase = 'warn' | 'burst';

export type RiftSnapshot = {
  phase: RiftPhase;
  x: number;
  y: number;
  radius: number;
  remain: number;
};

const EPS = 1e-8;

function placeCenter(random: () => number): { x: number; y: number } {
  const inset = RIFT_RADIUS;
  const spanX = Math.max(EPS, MAP_WIDTH - inset * 2);
  const spanY = Math.max(EPS, MAP_HEIGHT - inset * 2);
  return {
    x: inset + random() * spanX,
    y: inset + random() * spanY,
  };
}

function burstHits(balls: readonly BallBody[], cx: number, cy: number, now: number): CollisionHit[] {
  const hits: CollisionHit[] = [];
  const kb = knockbackSpeed(KNOCKBACK_SPEED_SPAN);
  for (const ball of balls) {
    if (!ball.inPlay || ball.invincibleRemain > 0) {
      continue;
    }
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > RIFT_RADIUS) {
      continue;
    }
    let nx = dx;
    let ny = dy;
    if (dist < EPS) {
      nx = 1;
      ny = 0;
    } else {
      nx /= dist;
      ny /= dist;
    }
    const lost = applyHpLoss(ball, RIFT_DAMAGE);
    ball.vx += nx * kb;
    ball.vy += ny * kb;
    applyHardCc(ball, RIFT_STUN_SEC, now);
    hits.push({
      victimId: ball.id,
      sourceId: -1,
      victimLabel: ball.label,
      sourceLabel: '地裂矛阵',
      damage: lost,
      knockback: kb,
      relSpeed: 0,
      threshold: 0,
      environment: true,
    });
  }
  return hits;
}

export function createRiftHazard(random: () => number = Math.random) {
  let phase: 'idle' | RiftPhase = 'idle';
  let x = MAP_WIDTH / 2;
  let y = MAP_HEIGHT / 2;
  let remain = 0;
  let nextAt = RIFT_FIRST_SEC;

  return {
    reset(): void {
      phase = 'idle';
      remain = 0;
      nextAt = RIFT_FIRST_SEC;
    },
    tick(
      dt: number,
      balls: readonly BallBody[],
      elapsedSec: number,
      now: number,
      enabled: boolean,
    ): CollisionHit[] {
      if (!enabled) {
        phase = 'idle';
        remain = 0;
        return [];
      }
      const hits: CollisionHit[] = [];
      if (phase === 'idle' && elapsedSec + 1e-9 >= nextAt) {
        const at = placeCenter(random);
        x = at.x;
        y = at.y;
        phase = 'warn';
        remain = RIFT_WARN_SEC;
        nextAt += RIFT_INTERVAL_SEC;
      }
      if (phase === 'warn') {
        remain -= dt;
        if (remain <= 0) {
          hits.push(...burstHits(balls, x, y, now));
          phase = 'burst';
          remain = RIFT_BURST_VISUAL_SEC;
        }
        return hits;
      }
      if (phase === 'burst') {
        remain -= dt;
        if (remain <= 0) {
          phase = 'idle';
          remain = 0;
        }
      }
      return hits;
    },
    snapshot(): RiftSnapshot | null {
      if (phase === 'idle') {
        return null;
      }
      return { phase, x, y, radius: RIFT_RADIUS, remain };
    },
  };
}

export type RiftHazard = ReturnType<typeof createRiftHazard>;
