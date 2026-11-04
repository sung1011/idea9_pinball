import type { BallBody } from './ballBody';
import {
  BOT_AIM_JITTER_RAD,
  BOT_INTERVAL_JITTER_SEC,
  BOT_INTERVAL_SEC,
  CONTROL_POINT,
} from './constants';
import type { MatchPhase } from './matchSession';
import { applyFloorSpeed, applySkillRelease, applySteerToward } from './skillStub';

export type SimpleBot = {
  tick: (dt: number, roster: readonly BallBody[], phase: MatchPhase) => void;
  reset: () => void;
};

function nextWait(): number {
  return BOT_INTERVAL_SEC + Math.random() * BOT_INTERVAL_JITTER_SEC;
}

function nearestEnemy(bot: BallBody, roster: readonly BallBody[]): BallBody | null {
  let best: BallBody | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const other of roster) {
    if (!other.inPlay || other.id === bot.id || other.team === bot.team) {
      continue;
    }
    const d = Math.hypot(other.x - bot.x, other.y - bot.y);
    if (d < bestD) {
      bestD = d;
      best = other;
    }
  }
  return best;
}

/** 共用保底冲 + 拧向（中点或最近敌人）；周期再给 stub 冲量。 */
export function createSimpleBot(bot: BallBody): SimpleBot {
  let wait = nextWait() * 0.35;

  return {
    tick(dt, roster, phase) {
      if (!bot.inPlay || phase === 'result') {
        bot.hasAim = false;
        return;
      }

      const enemy = nearestEnemy(bot, roster);
      const toMidX = CONTROL_POINT.x - bot.x;
      const toMidY = CONTROL_POINT.y - bot.y;
      const midD = Math.hypot(toMidX, toMidY);
      const enemyD = enemy ? Math.hypot(enemy.x - bot.x, enemy.y - bot.y) : Number.POSITIVE_INFINITY;
      let aimX = toMidX;
      let aimY = toMidY;
      if (enemy && (enemyD < midD || midD < 1.2)) {
        aimX = enemy.x - bot.x;
        aimY = enemy.y - bot.y;
      }
      const aimLen = Math.hypot(aimX, aimY);
      if (aimLen > 1e-6) {
        bot.aimX = aimX / aimLen;
        bot.aimY = aimY / aimLen;
        bot.hasAim = true;
        applyFloorSpeed(bot);
        applySteerToward(bot, bot.aimX, bot.aimY, dt);
      }

      if (phase === 'countdown') {
        return;
      }
      wait -= dt;
      if (wait > 0) {
        return;
      }
      wait = nextWait();
      const jitter = (Math.random() - 0.5) * 2 * BOT_AIM_JITTER_RAD;
      const ang = Math.atan2(aimY, aimX) + jitter;
      applySkillRelease(bot, Math.cos(ang), Math.sin(ang));
    },
    reset() {
      wait = nextWait() * 0.35;
    },
  };
}
