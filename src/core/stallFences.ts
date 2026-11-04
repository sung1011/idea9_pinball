import type { BallBody, TeamId } from './ballBody';
import { BALL_RADIUS, MAP_HEIGHT, MAP_WIDTH, STALL_DEPTH, STALL_Y_PAD } from './constants';
import { bounceAlongInwardNormal } from './wallBounce';

export type StallFence = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  team: TeamId;
  /** 朝向领地的一侧：红 +x，蓝 −x（视觉开口，物理仍四面封死） */
  openToward: 1 | -1;
};

export function redBaselineStall(): StallFence {
  return {
    minX: 0,
    maxX: STALL_DEPTH,
    minY: STALL_Y_PAD,
    maxY: MAP_HEIGHT - STALL_Y_PAD,
    team: 'red',
    openToward: 1,
  };
}

export function blueBaselineStall(): StallFence {
  return {
    minX: MAP_WIDTH - STALL_DEPTH,
    maxX: MAP_WIDTH,
    minY: STALL_Y_PAD,
    maxY: MAP_HEIGHT - STALL_Y_PAD,
    team: 'blue',
    openToward: -1,
  };
}

export function stallForTeam(team: TeamId): StallFence {
  return team === 'red' ? redBaselineStall() : blueBaselineStall();
}

/** 每队一栏，贴半场底线；同队多球共用。 */
export function stallsForBalls(balls: readonly BallBody[]): StallFence[] {
  const seen = new Set<TeamId>();
  const out: StallFence[] = [];
  for (const ball of balls) {
    if (!ball.team || seen.has(ball.team)) {
      continue;
    }
    seen.add(ball.team);
    out.push(stallForTeam(ball.team));
  }
  return out;
}

export function stallContains(fence: StallFence, x: number, y: number): boolean {
  return x >= fence.minX && x <= fence.maxX && y >= fence.minY && y <= fence.maxY;
}

export function stallForBall(ball: BallBody, stalls: readonly StallFence[]): StallFence | null {
  if (!ball.team) {
    return null;
  }
  for (const fence of stalls) {
    if (fence.team === ball.team) {
      return fence;
    }
  }
  return null;
}

/** 栏内约束：圆心不得穿出内缩矩形，穿墙则沿内法线反弹。 */
export function resolveStallInner(ball: BallBody, fence: StallFence): boolean {
  const left = fence.minX + BALL_RADIUS;
  const right = fence.maxX - BALL_RADIUS;
  const top = fence.minY + BALL_RADIUS;
  const bottom = fence.maxY - BALL_RADIUS;
  let hit = false;

  if (ball.x < left) {
    ball.x = left;
    bounceAlongInwardNormal(ball, 1, 0);
    hit = true;
  } else if (ball.x > right) {
    ball.x = right;
    bounceAlongInwardNormal(ball, -1, 0);
    hit = true;
  }

  if (ball.y < top) {
    ball.y = top;
    bounceAlongInwardNormal(ball, 0, 1);
    hit = true;
  } else if (ball.y > bottom) {
    ball.y = bottom;
    bounceAlongInwardNormal(ball, 0, -1);
    hit = true;
  }

  return hit;
}
