import type { BallBody } from './ballBody';
import { consumeAimBreak, openActiveRam, skillsBlocked } from './ballBody';
import { spearAimDir, type CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import { applyHardCc } from './hardCc';
import {
  HOOK_BRAKE,
  HOOK_PULL,
  HOOK_SHOVE,
  HOOK_STAB,
  HOOK_ULT,
  hookAimShape,
  hookIsDisplace,
  hookSkillCd,
  hookWindup,
} from '../heroes/hookKit';
import {
  applyUltBackVel,
  applyUltChargeVel,
  beginUltBack,
  beginUltCharge,
  finishUltThrust,
  keepUltFacing,
  restoreUltChargeVel,
  sweepUltHits,
  ultOutOfBounds,
  type UltEffect,
} from './hookUlt';
import { canSpendUlt, spendUltEnergy, ULT_ENERGY_MAX } from './ultEnergy';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createArcCaster } from './arcCaster';
import { createChainCaster } from './chainCaster';
import { createNailCaster } from './nailCaster';
import { createRingCaster } from './ringCaster';
import { createMirrorCaster } from './mirrorCaster';
import { createWellCaster } from './wellCaster';
import { applyPinRamBonus } from './nailCombat';
import { applySkillDamage } from './skillHits';
import { pickFanEnemy, segmentBlocked, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';
import { applyHookBleed } from './hookBleed';
import { armHookBrakePop, isValidTechEnemy } from './hookBrakePop';
import { grantHookShoveShield } from './hookShield';
import { HOOK_BRAKE_TECH, HOOK_PULL_TECH } from './hookTech';
import { copyCombatTechs, EMPTY_COMBAT_TECHS, type CombatTechSnapshot } from './techIds';

const EPS = 1e-8;
const TIME_EPS = 1e-7;
const ARRIVE_PAD = 0.08;
const TOUCH_PAD = 0.12;

export type SkillCds = [number, number, number, number];

export type WindupInfo = {
  slot: SkillSlot;
  remain: number;
  markX?: number;
  markY?: number;
  lockX?: number;
  lockY?: number;
  aimStage?: 1 | 2;
};

export type AimHint = {
  slot: SkillSlot;
  stage: 1 | 2;
  lockX?: number;
  lockY?: number;
};

type Effect =
  | { kind: 'windup'; slot: SkillSlot; remain: number; aimX: number; aimY: number; targetId?: number }
  | { kind: 'hookFly'; targetId: number }
  | { kind: 'stab'; nextIn: number; index: number; aimX: number; aimY: number }
  | {
      kind: 'dash';
      dirX: number;
      dirY: number;
      remainTime: number;
      remainDist: number;
      speed: number;
      shieldUsed: boolean;
    }
  | UltEffect;

export { applyHardCc, scaleHardCc } from './hardCc';

function emptyCds(): SkillCds {
  return [0, 0, 0, 0];
}

/** 瞄准朝向：有指针跟 aim，否则跟 facing。钩爪预览与二次释放共用。 */
export function aimDirOf(ball: BallBody, sample: ActionSample): { x: number; y: number } {
  if (sample.hasAim) {
    const u = unitVec(sample.aimX, sample.aimY);
    if (u) {
      return u;
    }
  }
  const face = unitVec(ball.facingX, ball.facingY);
  return face ?? { x: 1, y: 0 };
}

function pickHookPull(
  ball: BallBody,
  roster: readonly BallBody[],
  aimX: number,
  aimY: number,
): ReturnType<typeof pickFanEnemy> {
  const shape = hookAimShape(1);
  if (!shape) {
    return null;
  }
  return pickFanEnemy(ball, roster, aimX, aimY, shape.halfRad, shape.radius, true);
}

function lockedPullTarget(ball: BallBody, roster: readonly BallBody[], lockId: number): BallBody | null {
  if (lockId < 0) {
    return null;
  }
  const target = roster.find((other) => other.id === lockId) ?? null;
  if (!target || !target.inPlay || target.id === ball.id) {
    return null;
  }
  if (target.team && ball.team && target.team === ball.team) {
    return null;
  }
  if (target.invincibleRemain > 0) {
    return null;
  }
  if (segmentBlocked(ball.x, ball.y, target.x, target.y)) {
    return null;
  }
  return target;
}

function isUltEffect(effect: Effect | null): effect is UltEffect {
  return !!effect && (effect.kind === 'ultBack' || effect.kind === 'ultCharge');
}

function isHardBusy(effect: Effect | null): boolean {
  return !!effect && (effect.kind === 'windup' || effect.kind === 'stab' || effect.kind === 'dash' || isUltEffect(effect));
}

function isDisplacing(effect: Effect | null): boolean {
  return !!effect && (effect.kind === 'hookFly' || effect.kind === 'dash' || isUltEffect(effect));
}

export type SkillCasterOpts = {
  techs?: () => CombatTechSnapshot;
};

export type SkillCaster = {
  handleInput: (ball: BallBody, sample: ActionSample, roster?: readonly BallBody[]) => void;
  tick: (ball: BallBody, dt: number, roster: readonly BallBody[]) => CollisionHit[];
  afterPhysics: (
    ball: BallBody,
    dt: number,
    roster: readonly BallBody[],
    wallHit: boolean,
  ) => CollisionHit[];
  reset: () => void;
  getAimingSlot: () => SkillSlot | 0;
  getCds: () => SkillCds;
  getWindup: () => WindupInfo | null;
  getAimHint?: () => AimHint | null;
  isHardBusy: () => boolean;
  isDisplacing: () => boolean;
  getHero: () => HeroId;
};

/** 按英雄建施放器；默认钩刺，避免拆坏既有 verify。科技只给传入快照的钩刺，AI 默认空。 */
export function createSkillCaster(hero: HeroId = 'hook', opts: SkillCasterOpts = {}): SkillCaster {
  if (hero === 'ring') {
    return createRingCaster();
  }
  if (hero === 'chain') {
    return createChainCaster();
  }
  if (hero === 'nail') {
    return createNailCaster();
  }
  if (hero === 'arc') {
    return createArcCaster();
  }
  if (hero === 'well') {
    return createWellCaster();
  }
  if (hero === 'mirror') {
    return createMirrorCaster();
  }
  return createHookCaster(opts.techs);
}

/** 钩刺施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createHookCaster(getTechs?: () => CombatTechSnapshot): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let brakeRemain = 0;
  let brakeArmed = false;
  let brakeElapsed = 0;
  let brakeMax = HOOK_BRAKE.brakeTime;
  let pullOriginX = 0;
  let pullOriginY = 0;
  let pullFullCd: number = HOOK_PULL.cd;
  let pullFarDone = false;
  const stabLanded = [false, false, false];
  let now = 0;

  const techsOf = (): CombatTechSnapshot => copyCombatTechs(getTechs?.() ?? EMPTY_COMBAT_TECHS);

  const cancelBrake = (): void => {
    brakeRemain = 0;
    brakeArmed = false;
    brakeElapsed = 0;
  };

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = hookSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || isHardBusy(effect) || skillsBlocked(ball)) {
      return;
    }
    const slot = aimingSlot;
    if (slot !== 5 && cds[slot - 1] > 0) {
      return;
    }
    if (slot === 5 && !canSpendUlt(ball, HOOK_ULT.energyCost)) {
      return;
    }
    const aim = aimDirOf(ball, sample);
    if (!setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    if (hookIsDisplace(slot) && isInEnemyTrap(ball)) {
      if (slot !== 5) {
        punishDisplace(slot);
      }
      return;
    }
    if (slot === 5) {
      if (!spendUltEnergy(ball, HOOK_ULT.energyCost)) {
        return;
      }
      aimingSlot = 0;
      cancelBrake();
      effect = beginUltBack(ball, 1);
      return;
    }
    startCd(slot);
    aimingSlot = 0;
    if (slot === 1) {
      pullOriginX = ball.x;
      pullOriginY = ball.y;
      pullFullCd = hookSkillCd(1);
      pullFarDone = false;
    }
    const delay = hookWindup(slot);
    const lockId = slot === 1 ? (pickHookPull(ball, roster, ball.facingX, ball.facingY)?.target.id ?? -1) : -1;
    if (slot === 4 || delay <= 0) {
      if (effect?.kind === 'hookFly') {
        effect = null;
      }
      brakeMax = HOOK_BRAKE.brakeTime;
      brakeElapsed = 0;
      brakeRemain = brakeMax;
      brakeArmed = true;
      return;
    }
    effect = {
      kind: 'windup',
      slot,
      remain: delay,
      aimX: ball.facingX,
      aimY: ball.facingY,
      targetId: lockId,
    };
  };

  const handleInput = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[] = []): void => {
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
    }
    if (!ball.inPlay || skillsBlocked(ball)) {
      aimingSlot = 0;
      return;
    }
    if (sample.cancelAim) {
      aimingSlot = 0;
      return;
    }
    if (sample.skillPress) {
      if (aimingSlot === sample.skillPress) {
        tryRelease(ball, sample, roster);
      } else if (sample.skillPress === 5) {
        if (canSpendUlt(ball, ULT_ENERGY_MAX) && !isHardBusy(effect)) {
          aimingSlot = 5;
        }
      } else if ((cds[sample.skillPress - 1] ?? 1) <= 0 && !isHardBusy(effect)) {
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample, roster);
    }
  };

  const resolveHook = (ball: BallBody, roster: readonly BallBody[], lockId: number): CollisionHit[] => {
    const target = lockedPullTarget(ball, roster, lockId);
    if (!target) {
      cds[0] = Math.min(cds[0], HOOK_PULL.missCd);
      return [];
    }
    cancelBrake();
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(target, ball, HOOK_PULL.damage);
    if (dmg) {
      hits.push(dmg);
    }
    const techs = techsOf();
    const path = Math.hypot(target.x - pullOriginX, target.y - pullOriginY);
    if (
      techs.pull &&
      !pullFarDone &&
      isValidTechEnemy(ball, target) &&
      path + 1e-9 >= HOOK_PULL.range * HOOK_PULL_TECH.farPathRatio
    ) {
      cds[0] = Math.max(0, cds[0] - pullFullCd * HOOK_PULL_TECH.cdRefundRatio);
      pullFarDone = true;
    }
    const gap = Math.hypot(target.x - ball.x, target.y - ball.y);
    const touch = ball.radius + target.radius;
    if (gap <= touch + TOUCH_PAD) {
      openActiveRam(ball);
      return hits;
    }
    effect = { kind: 'hookFly', targetId: target.id };
    return hits;
  };

  const doStab = (
    ball: BallBody,
    index: number,
    aimX: number,
    aimY: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    const dir = unitVec(aimX, aimY) ?? { x: ball.facingX, y: ball.facingY };
    ball.x += dir.x * HOOK_STAB.selfPush;
    ball.y += dir.y * HOOK_STAB.selfPush;
    resolveArenaObstacles(ball);
    const picked = pickFanEnemy(
      ball,
      roster,
      dir.x,
      dir.y,
      (HOOK_STAB.fanDeg * Math.PI) / 360,
      HOOK_STAB.range,
      false,
    );
    if (!picked) {
      return [];
    }
    if (isValidTechEnemy(ball, picked.target) && index >= 0 && index < stabLanded.length) {
      stabLanded[index] = true;
    }
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(picked.target, ball, HOOK_STAB.damages[index] ?? 0);
    if (dmg) {
      hits.push(dmg);
    }
    if (index === HOOK_STAB.hits - 1) {
      applyHardCc(picked.target, HOOK_STAB.thirdStun, now);
      if (techsOf().stab && stabLanded[0] && stabLanded[1] && stabLanded[2]) {
        applyHookBleed(picked.target, ball);
      }
    }
    return hits;
  };

  const startDash = (ball: BallBody, aimX: number, aimY: number): void => {
    const dir = unitVec(aimX, aimY);
    if (!dir) {
      return;
    }
    cancelBrake();
    const speed = HOOK_SHOVE.dashDist / HOOK_SHOVE.dashTime;
    effect = {
      kind: 'dash',
      dirX: dir.x,
      dirY: dir.y,
      remainTime: HOOK_SHOVE.dashTime,
      remainDist: HOOK_SHOVE.dashDist,
      speed,
      shieldUsed: false,
    };
    ball.vx = dir.x * speed;
    ball.vy = dir.y * speed;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
    ball.suppressCombat = true;
  };

  const finishWindup = (
    ball: BallBody,
    slot: SkillSlot,
    aimX: number,
    aimY: number,
    roster: readonly BallBody[],
    lockId: number,
  ): CollisionHit[] => {
    if (hookIsDisplace(slot) && isInEnemyTrap(ball)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      return resolveHook(ball, roster, lockId);
    }
    if (slot === 2) {
      cancelBrake();
      stabLanded[0] = false;
      stabLanded[1] = false;
      stabLanded[2] = false;
      const hits = doStab(ball, 0, aimX, aimY, roster);
      effect = { kind: 'stab', nextIn: HOOK_STAB.interval, index: 1, aimX, aimY };
      return hits;
    }
    if (slot === 3) {
      startDash(ball, aimX, aimY);
    }
    return [];
  };

  const applyHookFly = (ball: BallBody, roster: readonly BallBody[]): void => {
    if (effect?.kind !== 'hookFly') {
      return;
    }
    const fly = effect;
    const target = roster.find((other) => other.id === fly.targetId);
    if (!target || !target.inPlay) {
      effect = null;
      return;
    }
    const dir = unitVec(target.x - ball.x, target.y - ball.y);
    if (!dir) {
      openActiveRam(ball);
      effect = null;
      return;
    }
    ball.vx = dir.x * HOOK_PULL.flySpeed;
    ball.vy = dir.y * HOOK_PULL.flySpeed;
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
    const dist = Math.hypot(target.x - ball.x, target.y - ball.y);
    const touch = ball.radius + target.radius;
    if (dist <= touch + HOOK_PULL.flySpeed / 60 + ARRIVE_PAD) {
      openActiveRam(ball);
    }
  };

  const applyDashVel = (ball: BallBody): void => {
    if (effect?.kind !== 'dash') {
      return;
    }
    ball.vx = effect.dirX * effect.speed;
    ball.vy = effect.dirY * effect.speed;
    ball.facingX = effect.dirX;
    ball.facingY = effect.dirY;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
    ball.suppressCombat = true;
  };

  const popBrake = (ball: BallBody): void => {
    const dir = spearAimDir(ball);
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.vx = dir.x * HOOK_BRAKE.popSpeed;
    ball.vy = dir.y * HOOK_BRAKE.popSpeed;
    ball.allowOverCap = true;
    openActiveRam(ball);
    const charged = brakeElapsed + 1e-9 >= brakeMax * HOOK_BRAKE_TECH.chargeRatio;
    if (techsOf().brake && charged) {
      armHookBrakePop(ball);
    } else {
      ball.hookBrakePopPending = false;
    }
  };

  const tick = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    const step = Math.max(0, dt);
    now += step;
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
    }
    for (let i = 0; i < cds.length; i += 1) {
      cds[i] = Math.max(0, cds[i] - step);
    }
    ball.frictionMul = 1;
    ball.suppressCombat = false;
    if (!ball.inPlay) {
      if (isUltEffect(effect)) {
        finishUltThrust(ball);
      }
      aimingSlot = 0;
      effect = null;
      cancelBrake();
      return [];
    }

    const hits: CollisionHit[] = [];
    if (isUltEffect(effect) && skillsBlocked(ball)) {
      finishUltThrust(ball);
      effect = null;
      aimingSlot = 0;
      return hits;
    }
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const slot = effect.slot;
        const { aimX, aimY, targetId } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, roster, targetId ?? -1));
      }
    } else if (effect?.kind === 'stab') {
      effect.nextIn -= step;
      while (effect?.kind === 'stab' && effect.nextIn <= TIME_EPS) {
        hits.push(...doStab(ball, effect.index, effect.aimX, effect.aimY, roster));
        effect.index += 1;
        if (effect.index >= HOOK_STAB.hits) {
          effect = null;
          break;
        }
        effect.nextIn += HOOK_STAB.interval;
      }
    }

    if (brakeArmed) {
      brakeRemain -= step;
      brakeElapsed += step;
      if (brakeRemain <= TIME_EPS) {
        brakeArmed = false;
        brakeRemain = 0;
        popBrake(ball);
      } else {
        ball.frictionMul = HOOK_BRAKE.frictionMul;
      }
    }

    applyHookFly(ball, roster);
    applyDashVel(ball);
    if (effect?.kind === 'ultBack') {
      effect.remain -= step;
      applyUltBackVel(ball, effect);
      if (effect.remain <= TIME_EPS) {
        const nextStep = effect.step + 1;
        if (nextStep <= HOOK_ULT.steps) {
          effect = beginUltBack(ball, nextStep);
          applyUltBackVel(ball, effect);
        } else {
          effect = beginUltCharge(ball);
        }
      }
    } else if (effect?.kind === 'ultCharge') {
      applyUltChargeVel(ball, effect, step);
    }
    return hits;
  };

  const afterPhysics = (
    ball: BallBody,
    dt: number,
    roster: readonly BallBody[],
    wallHit: boolean,
  ): CollisionHit[] => {
    if (!ball.inPlay) {
      if (isUltEffect(effect)) {
        finishUltThrust(ball);
      }
      effect = null;
      cancelBrake();
      return [];
    }
    if (effect?.kind === 'hookFly') {
      const fly = effect;
      const target = roster.find((other) => other.id === fly.targetId);
      if (!target || !target.inPlay) {
        effect = null;
        return [];
      }
      const dist = Math.hypot(target.x - ball.x, target.y - ball.y);
      if (dist <= ball.radius + target.radius + ARRIVE_PAD) {
        openActiveRam(ball);
        effect = null;
      }
      return [];
    }
    if (isUltEffect(effect) && skillsBlocked(ball)) {
      finishUltThrust(ball);
      effect = null;
      aimingSlot = 0;
      return [];
    }
    if (effect?.kind === 'ultBack') {
      if (wallHit) {
        effect.remainDist = 0;
        ball.vx = 0;
        ball.vy = 0;
      } else {
        effect.remainDist -= (HOOK_ULT.stepDist / HOOK_ULT.stepTime) * Math.max(0, dt);
      }
      keepUltFacing(ball, effect);
      return [];
    }
    if (effect?.kind === 'ultCharge') {
      const chargeHits = sweepUltHits(ball, roster, effect, dt);
      if (
        wallHit ||
        ultOutOfBounds(ball) ||
        !Number.isFinite(ball.vx) ||
        !Number.isFinite(ball.vy) ||
        effect.stall >= HOOK_ULT.stallAbortSec
      ) {
        finishUltThrust(ball);
        effect = null;
        return chargeHits;
      }
      restoreUltChargeVel(ball, effect);
      keepUltFacing(ball, effect);
      return chargeHits;
    }
    if (effect?.kind !== 'dash') {
      return [];
    }
    const hits: CollisionHit[] = [];
    let touched: BallBody | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const other of roster) {
      if (!other.inPlay || other.id === ball.id) {
        continue;
      }
      if (other.team && ball.team && other.team === ball.team) {
        continue;
      }
      const dist = Math.hypot(other.x - ball.x, other.y - ball.y);
      if (dist <= ball.radius + other.radius + TOUCH_PAD && dist < best) {
        best = dist;
        touched = other;
      }
    }
    if (touched) {
      const dmg = applySkillDamage(touched, ball, HOOK_SHOVE.damage);
      if (dmg) {
        hits.push(dmg);
      }
      touched.vx = effect.dirX * HOOK_SHOVE.hitPush;
      touched.vy = effect.dirY * HOOK_SHOVE.hitPush;
      touched.allowOverCap = true;
      const keep = HOOK_SHOVE.keepSpeed;
      ball.vx = effect.dirX * effect.speed * keep;
      ball.vy = effect.dirY * effect.speed * keep;
      ball.allowOverCap = true;
      openActiveRam(ball);
      const extra = applyPinRamBonus(touched, ball);
      if (extra) {
        hits.push(extra);
      }
      if (techsOf().shove && !effect.shieldUsed && isValidTechEnemy(ball, touched) && ball.inPlay && ball.hp > 0) {
        grantHookShoveShield(ball);
        effect.shieldUsed = true;
      }
      effect = null;
      return hits;
    }
    if (wallHit) {
      effect = null;
      return [];
    }
    effect.remainTime -= Math.max(0, dt);
    effect.remainDist -= effect.speed * Math.max(0, dt);
    if (effect.remainTime <= TIME_EPS || effect.remainDist <= EPS) {
      effect = null;
    }
    return [];
  };

  return {
    handleInput,
    tick,
    afterPhysics,
    reset() {
      aimingSlot = 0;
      cds[0] = 0;
      cds[1] = 0;
      cds[2] = 0;
      cds[3] = 0;
      effect = null;
      cancelBrake();
      pullFarDone = false;
      stabLanded[0] = false;
      stabLanded[1] = false;
      stabLanded[2] = false;
      now = 0;
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: () => {
      if (effect?.kind === 'windup') {
        return { slot: effect.slot, remain: effect.remain };
      }
      if (effect?.kind === 'ultBack') {
        return { slot: 5, remain: effect.remain };
      }
      if (effect?.kind === 'ultCharge') {
        return { slot: 5, remain: 0 };
      }
      return null;
    },
    isHardBusy: () => isHardBusy(effect),
    isDisplacing: () => isDisplacing(effect),
    getHero: (): HeroId => 'hook',
  };
}
