import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import {
  BOT_AIM_JITTER_RAD,
  BOT_INTERVAL_JITTER_SEC,
  BOT_INTERVAL_SEC,
  CONTROL_POINT,
} from './constants';
import { HOOK_PULL } from '../heroes/hookKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import type { MatchPhase } from './matchSession';
import { createSkillCaster, type SkillCaster, type SkillCds } from './skillCaster';
import { applyFloorSpeed, applySteerToward } from './skillStub';

export type SimpleBot = {
  tick: (dt: number, roster: readonly BallBody[], phase: MatchPhase) => CollisionHit[];
  afterPhysics: (dt: number, roster: readonly BallBody[], wallHit: boolean) => CollisionHit[];
  reset: () => void;
  getCds: () => SkillCds;
  getCaster: () => SkillCaster;
};

export type SimpleBotOpts = {
  random?: () => number;
  hookChance?: number;
};

function nextWait(random: () => number): number {
  return BOT_INTERVAL_SEC + random() * BOT_INTERVAL_JITTER_SEC;
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

function idleSample(aimX: number, aimY: number): ActionSample {
  return {
    aimX,
    aimY,
    hasAim: true,
    steerAim: true,
    skillPress: 0,
    confirmRelease: false,
    cancelAim: false,
  };
}

function castSample(slot: SkillSlot, aimX: number, aimY: number): ActionSample {
  return {
    aimX,
    aimY,
    hasAim: true,
    steerAim: true,
    skillPress: slot,
    confirmRelease: true,
    cancelAim: false,
  };
}

function pickApproachAim(
  bot: BallBody,
  enemy: BallBody | null,
): { x: number; y: number; enemyD: number; midD: number } {
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
  return { x: aimX, y: aimY, enemyD, midD };
}

/**
 * 简化 AI：保底冲靠近 + 急停 + 偶勾。不打满编连招，不用方向捅。
 */
export function createSimpleBot(bot: BallBody, opts: SimpleBotOpts = {}): SimpleBot {
  const random = opts.random ?? Math.random;
  const hookChance = opts.hookChance ?? 0.35;
  const caster = createSkillCaster();
  let wait = nextWait(random) * 0.35;

  return {
    tick(dt, roster, phase) {
      if (!bot.inPlay || phase === 'result') {
        bot.hasAim = false;
        caster.tick(bot, dt, roster);
        return [];
      }

      const enemy = nearestEnemy(bot, roster);
      const approach = pickApproachAim(bot, enemy);
      const aimLen = Math.hypot(approach.x, approach.y);
      let aimX = bot.facingX;
      let aimY = bot.facingY;
      if (aimLen > 1e-6) {
        aimX = approach.x / aimLen;
        aimY = approach.y / aimLen;
      }
      if (enemy) {
        const toEx = enemy.x - bot.x;
        const toEy = enemy.y - bot.y;
        const elen = Math.hypot(toEx, toEy);
        if (elen > 1e-6) {
          aimX = toEx / elen;
          aimY = toEy / elen;
        }
      }

      bot.aimX = aimX;
      bot.aimY = aimY;
      bot.hasAim = true;
      if (bot.stunRemain <= 0 && !caster.isDisplacing() && bot.frictionMul === 1) {
        applyFloorSpeed(bot);
        applySteerToward(bot, aimX, aimY, dt);
      }

      if (phase === 'countdown') {
        return caster.tick(bot, dt, roster);
      }

      wait -= dt;
      let sample = idleSample(aimX, aimY);
      const cds = caster.getCds();
      const speed = Math.hypot(bot.vx, bot.vy);
      const canAct = wait <= 0 && !caster.isHardBusy() && bot.stunRemain <= 0;

      if (canAct) {
        wait = nextWait(random);
        const jitter = (random() - 0.5) * 2 * BOT_AIM_JITTER_RAD;
        const ang = Math.atan2(aimY, aimX) + jitter;
        const jx = Math.cos(ang);
        const jy = Math.sin(ang);
        const inHookRange = !!enemy && approach.enemyD <= HOOK_PULL.range && approach.enemyD > 0.8;
        if (inHookRange && cds[0] <= 0 && random() < hookChance) {
          sample = castSample(1, jx, jy);
        } else if (cds[3] <= 0 && speed > 3) {
          sample = castSample(4, jx, jy);
        } else if (cds[2] <= 0) {
          sample = castSample(3, jx, jy);
        } else if (cds[3] <= 0) {
          sample = castSample(4, jx, jy);
        }
      }

      caster.handleInput(bot, sample);
      return caster.tick(bot, dt, roster);
    },
    afterPhysics(dt, roster, wallHit) {
      return caster.afterPhysics(bot, dt, roster, wallHit);
    },
    reset() {
      caster.reset();
      wait = nextWait(random) * 0.35;
    },
    getCds: () => caster.getCds(),
    getCaster: () => caster,
  };
}
