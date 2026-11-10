import { clearKitAuras, skillsBlocked, type BallBody } from './ballBody';
import { isBrakeConvoyPassenger } from './hookBrakeConvoy';
import type { CollisionHit } from './collisionDamage';
import {
  BOT_AIM_JITTER_RAD,
  BOT_INTERVAL_JITTER_SEC,
  BOT_INTERVAL_SEC,
  CONTROL_POINT,
  MAP_HEIGHT,
  MAP_WIDTH,
} from './constants';
import type { HeroId } from '../heroes/heroIds';
import { ARC_MARK, ARC_SIDESTEP } from '../heroes/arcKit';
import { CHAIN_HEAL, CHAIN_SCRAMBLE, CHAIN_SHIELD, CHAIN_TOW } from '../heroes/chainKit';
import { HOOK_PULL } from '../heroes/hookKit';
import { ULT_ENERGY_MAX } from './ultEnergy';
import { NAIL_PIN, NAIL_RAM } from '../heroes/nailKit';
import { RING_FIELD, RING_TRAP, RING_WAVE } from '../heroes/ringKit';
import { WELL_BLAST, WELL_STAKE, WELL_SWAP } from '../heroes/wellKit';
import { getStake } from './ropeStakes';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import type { MatchPhase } from './matchSession';
import { createSkillCaster, type SkillCaster, type SkillCds } from './skillCaster';
import { applyOpeningCharge } from './openingCharge';
import { applyFloorSpeed, applySteerToward } from './skillStub';
import { clearUltEnergy, tickUltEnergy } from './ultEnergy';

export type SimpleBot = {
  tick: (
    dt: number,
    roster: readonly BallBody[],
    phase: MatchPhase,
    chargeRemain?: number,
    seekMid?: boolean,
  ) => CollisionHit[];
  afterPhysics: (dt: number, roster: readonly BallBody[], wallHit: boolean) => CollisionHit[];
  reset: () => void;
  getCds: () => SkillCds;
  getCaster: () => SkillCaster;
  setHero: (ball: BallBody, hero: HeroId) => void;
};

export type SimpleBotOpts = {
  random?: () => number;
  hookChance?: number;
  hero?: HeroId;
};

function nextWait(random: () => number): number {
  return BOT_INTERVAL_SEC + random() * BOT_INTERVAL_JITTER_SEC;
}

function nearestAlly(bot: BallBody, roster: readonly BallBody[]): BallBody | null {
  let best: BallBody | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const other of roster) {
    if (!other.inPlay || other.id === bot.id || other.team !== bot.team) {
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

function idleSample(aimX: number, aimY: number, pointerX?: number, pointerY?: number): ActionSample {
  return {
    aimX,
    aimY,
    hasAim: true,
    steerAim: true,
    skillPress: 0,
    confirmRelease: false,
    cancelAim: false,
    pointerX,
    pointerY,
    hasPointer: pointerX !== undefined && pointerY !== undefined,
  };
}

function castSample(
  slot: SkillSlot,
  aimX: number,
  aimY: number,
  pointerX?: number,
  pointerY?: number,
): ActionSample {
  return {
    aimX,
    aimY,
    hasAim: true,
    steerAim: true,
    skillPress: slot,
    confirmRelease: true,
    cancelAim: false,
    pointerX,
    pointerY,
    hasPointer: pointerX !== undefined && pointerY !== undefined,
  };
}

function pickApproachAim(
  bot: BallBody,
  enemy: BallBody | null,
  seekMid: boolean,
): { x: number; y: number; enemyD: number; midD: number } {
  const toMidX = CONTROL_POINT.x - bot.x;
  const toMidY = CONTROL_POINT.y - bot.y;
  const midD = Math.hypot(toMidX, toMidY);
  const enemyD = enemy ? Math.hypot(enemy.x - bot.x, enemy.y - bot.y) : Number.POSITIVE_INFINITY;
  let aimX = toMidX;
  let aimY = toMidY;
  if (!seekMid && enemy) {
    aimX = enemy.x - bot.x;
    aimY = enemy.y - bot.y;
  } else if (enemy && (enemyD < midD || midD < 1.2)) {
    aimX = enemy.x - bot.x;
    aimY = enemy.y - bot.y;
  }
  return { x: aimX, y: aimY, enemyD, midD };
}

function nearWall(bot: BallBody): boolean {
  return bot.x < 2.2 || bot.x > MAP_WIDTH - 2.2 || bot.y < 2.2 || bot.y > MAP_HEIGHT - 2.2;
}

function pickHookAction(
  cds: SkillCds,
  speed: number,
  inHookRange: boolean,
  hookChance: number,
  random: () => number,
  jx: number,
  jy: number,
  energy = 0,
  hasEnemy = false,
): ActionSample | null {
  if (hasEnemy && energy + 1e-6 >= ULT_ENERGY_MAX) {
    return castSample(5, jx, jy);
  }
  if (inHookRange && cds[0] <= 0 && random() < hookChance) {
    return castSample(1, jx, jy);
  }
  if (cds[3] <= 0 && speed > 3) {
    return castSample(4, jx, jy);
  }
  if (cds[2] <= 0) {
    return castSample(3, jx, jy);
  }
  if (cds[3] <= 0) {
    return castSample(4, jx, jy);
  }
  return null;
}

function pickRingAction(
  bot: BallBody,
  enemy: BallBody | null,
  enemyD: number,
  cds: SkillCds,
  jx: number,
  jy: number,
): ActionSample | null {
  const px = enemy?.x ?? bot.x + jx * 2;
  const py = enemy?.y ?? bot.y + jy * 2;
  if (enemy && enemyD <= RING_WAVE.range && cds[1] <= 0) {
    return castSample(2, jx, jy, px, py);
  }
  if (enemy && enemyD <= RING_TRAP.placeRange + 1 && cds[3] <= 0) {
    return castSample(4, jx, jy, px, py);
  }
  if (enemy && enemyD <= RING_FIELD.radius + 0.6 && cds[0] <= 0) {
    return castSample(1, jx, jy, px, py);
  }
  if (cds[2] <= 0 && nearWall(bot)) {
    return castSample(3, jx, jy, px, py);
  }
  return null;
}

function pickChainAction(
  bot: BallBody,
  ally: BallBody | null,
  enemy: BallBody | null,
  cds: SkillCds,
  jx: number,
  jy: number,
): ActionSample | null {
  const allyD = ally ? Math.hypot(ally.x - bot.x, ally.y - bot.y) : Number.POSITIVE_INFINITY;
  const enemyD = enemy ? Math.hypot(enemy.x - bot.x, enemy.y - bot.y) : Number.POSITIVE_INFINITY;
  const px = ally?.x ?? enemy?.x ?? bot.x + jx * 2;
  const py = ally?.y ?? enemy?.y ?? bot.y + jy * 2;
  if (enemy && enemyD <= CHAIN_SCRAMBLE.range && cds[3] <= 0) {
    return castSample(4, jx, jy, px, py);
  }
  if (ally && ally.hp < ally.maxHp * CHAIN_TOW.lowHpRatio && allyD <= CHAIN_TOW.range && cds[2] <= 0) {
    return castSample(3, jx, jy, px, py);
  }
  if (ally && ally.hp < ally.maxHp * 0.85 && allyD <= CHAIN_HEAL.range && cds[0] <= 0) {
    return castSample(1, (ally.x - bot.x) || jx, (ally.y - bot.y) || jy, px, py);
  }
  if (enemy && enemyD <= CHAIN_HEAL.range && cds[0] <= 0) {
    return castSample(1, (enemy.x - bot.x) || jx, (enemy.y - bot.y) || jy, enemy.x, enemy.y);
  }
  if (enemy && enemyD <= CHAIN_SHIELD.range && cds[1] <= 0) {
    return castSample(2, jx, jy, enemy.x, enemy.y);
  }
  if (enemy && enemyD <= CHAIN_TOW.range && cds[2] <= 0) {
    return castSample(3, (enemy.x - bot.x) || jx, (enemy.y - bot.y) || jy, enemy.x, enemy.y);
  }
  if (ally && allyD <= CHAIN_TOW.range && cds[2] <= 0) {
    return castSample(3, jx, jy, px, py);
  }
  return null;
}

function pickNailAction(
  bot: BallBody,
  enemy: BallBody | null,
  enemyD: number,
  cds: SkillCds,
  jx: number,
  jy: number,
): ActionSample | null {
  if (enemy && enemyD <= NAIL_PIN.range && cds[3] <= 0) {
    return castSample(4, jx, jy);
  }
  if (enemy && enemyD <= NAIL_RAM.dashDist + 0.8 && cds[2] <= 0) {
    return castSample(3, jx, jy);
  }
  if (bot.hp < bot.maxHp * 0.7 && cds[0] <= 0) {
    return castSample(1, jx, jy);
  }
  if (enemy && enemyD < 3.2 && cds[1] <= 0) {
    return castSample(2, jx, jy);
  }
  return null;
}

function pickWellAction(
  bot: BallBody,
  enemy: BallBody | null,
  enemyD: number,
  cds: SkillCds,
  jx: number,
  jy: number,
): ActionSample | null {
  const px = enemy?.x ?? bot.x + jx * WELL_STAKE.range;
  const py = enemy?.y ?? bot.y + jy * WELL_STAKE.range;
  const stake = getStake(bot.id);
  if (!stake && cds[2] <= 0) {
    return castSample(3, jx, jy, px, py);
  }
  if (stake && cds[3] <= 0) {
    return castSample(4, jx, jy, px, py);
  }
  if (enemy && enemyD <= WELL_SWAP.range && cds[1] <= 0) {
    return castSample(2, jx, jy, px, py);
  }
  if (enemy && enemyD <= WELL_BLAST.radius + 0.4 && cds[0] <= 0) {
    return castSample(1, jx, jy, px, py);
  }
  return null;
}

function pickArcAction(
  bot: BallBody,
  enemy: BallBody | null,
  enemyD: number,
  cds: SkillCds,
  jx: number,
  jy: number,
): ActionSample | null {
  if (enemy && enemyD <= ARC_MARK.range && cds[2] <= 0) {
    return castSample(3, jx, jy);
  }
  if (enemy && enemyD < 3 && cds[1] <= 0) {
    return castSample(2, jx, jy);
  }
  if (enemy && enemyD <= ARC_SIDESTEP.range && cds[0] <= 0) {
    return castSample(1, (enemy.x - bot.x) || jx, (enemy.y - bot.y) || jy);
  }
  if ((bot.hp < bot.maxHp * 0.55 || enemyD < 1.6) && cds[3] <= 0) {
    return castSample(4, jx, jy);
  }
  return null;
}

/**
 * 简化 AI（红2 / 两蓝共用）：钩刺保底冲靠近 + 急停 + 偶勾；磁环推波 / 困圈 / 磁场 / 近壁粘壁；链生扰锋 / 愈链 / 盾脉 / 援勾；钉壳定锚 / 短冲顶 / 叠甲；闪弧标记 / 掠刃 / 侧闪；井绳桩 / 收索 / 换位 / 索爆。
 */
export function createSimpleBot(bot: BallBody, opts: SimpleBotOpts = {}): SimpleBot {
  const random = opts.random ?? Math.random;
  const hookChance = opts.hookChance ?? 0.35;
  bot.hero = opts.hero ?? bot.hero ?? 'hook';
  let caster = createSkillCaster(bot.hero);
  let wait = nextWait(random) * 0.35;

  return {
    tick(dt, roster, phase, chargeRemain = 0, seekMid = true) {
      tickUltEnergy(bot, dt);
      if (!bot.inPlay || phase === 'result') {
        bot.hasAim = false;
        caster.tick(bot, dt, roster);
        return [];
      }

      if (chargeRemain > 0) {
        applyOpeningCharge(bot, dt, chargeRemain);
        return caster.tick(bot, dt, roster);
      }

      const enemy = nearestEnemy(bot, roster);
      const ally = nearestAlly(bot, roster);
      const approach = pickApproachAim(bot, enemy, seekMid);
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
      if (bot.stunRemain <= 0 && !caster.isDisplacing() && !isBrakeConvoyPassenger(bot) && bot.frictionMul === 1) {
        applyFloorSpeed(bot);
        applySteerToward(bot, aimX, aimY, dt);
      }

      if (phase === 'countdown') {
        return caster.tick(bot, dt, roster);
      }

      wait -= dt;
      const pointerX = enemy?.x;
      const pointerY = enemy?.y;
      let sample = idleSample(aimX, aimY, pointerX, pointerY);
      const cds = caster.getCds();
      const speed = Math.hypot(bot.vx, bot.vy);
      const canAct = wait <= 0 && !caster.isHardBusy() && !skillsBlocked(bot);

      if (canAct) {
        wait = nextWait(random);
        const jitter = (random() - 0.5) * 2 * BOT_AIM_JITTER_RAD;
        const ang = Math.atan2(aimY, aimX) + jitter;
        const jx = Math.cos(ang);
        const jy = Math.sin(ang);
        const picked =
          bot.hero === 'ring'
            ? pickRingAction(bot, enemy, approach.enemyD, cds, jx, jy)
            : bot.hero === 'chain'
              ? pickChainAction(bot, ally, enemy, cds, jx, jy)
              : bot.hero === 'nail'
                ? pickNailAction(bot, enemy, approach.enemyD, cds, jx, jy)
                : bot.hero === 'arc'
                  ? pickArcAction(bot, enemy, approach.enemyD, cds, jx, jy)
                  : bot.hero === 'well'
                    ? pickWellAction(bot, enemy, approach.enemyD, cds, jx, jy)
            : pickHookAction(
                cds,
                speed,
                !!enemy && approach.enemyD <= HOOK_PULL.range && approach.enemyD > 0.8,
                hookChance,
                random,
                jx,
                jy,
                bot.ultEnergy,
                !!enemy,
              );
        if (picked) {
          sample = picked;
        }
      }

      caster.handleInput(bot, sample, roster);
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
    setHero(ball, hero) {
      caster.reset();
      clearKitAuras(ball);
      clearUltEnergy(ball);
      ball.hero = hero;
      caster = createSkillCaster(hero);
      wait = nextWait(random) * 0.35;
    },
  };
}
