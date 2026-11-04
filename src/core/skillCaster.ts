import type { BallBody } from './ballBody';
import { consumeAimBreak, openActiveRam } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { HARD_CC_DIMINISH_WINDOW } from './constants';
import type { HeroId } from '../heroes/heroIds';
import {
  HOOK_BRAKE,
  HOOK_PULL,
  HOOK_SHOVE,
  HOOK_STAB,
  hookIsDisplace,
  hookSkillCd,
  hookWindup,
} from '../heroes/hookKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createChainCaster } from './chainCaster';
import { createRingCaster } from './ringCaster';
import { applySkillDamage } from './skillHits';
import { pickFanEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';

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
};

type Effect =
  | { kind: 'windup'; slot: SkillSlot; remain: number; aimX: number; aimY: number }
  | { kind: 'hookFly'; targetId: number }
  | { kind: 'stab'; nextIn: number; index: number; aimX: number; aimY: number }
  | { kind: 'dash'; dirX: number; dirY: number; remainTime: number; remainDist: number; speed: number };

export function scaleHardCc(duration: number, lastAt: number, now: number): number {
  if (now - lastAt < HARD_CC_DIMINISH_WINDOW && lastAt > -1e8) {
    return duration * 0.5;
  }
  return duration;
}

export function applyHardCc(target: BallBody, duration: number, now: number): number {
  const scaled = scaleHardCc(duration, target.lastHardCcAt, now);
  target.stunRemain = Math.max(target.stunRemain, scaled);
  target.lastHardCcAt = now;
  return scaled;
}

function emptyCds(): SkillCds {
  return [0, 0, 0, 0];
}

function aimOf(ball: BallBody, sample: ActionSample): { x: number; y: number } {
  if (sample.hasAim) {
    const u = unitVec(sample.aimX, sample.aimY);
    if (u) {
      return u;
    }
  }
  const face = unitVec(ball.facingX, ball.facingY);
  return face ?? { x: 1, y: 0 };
}

function isHardBusy(effect: Effect | null): boolean {
  return !!effect && (effect.kind === 'windup' || effect.kind === 'stab' || effect.kind === 'dash');
}

function isDisplacing(effect: Effect | null): boolean {
  return !!effect && (effect.kind === 'hookFly' || effect.kind === 'dash');
}

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
  isHardBusy: () => boolean;
  isDisplacing: () => boolean;
  getHero: () => HeroId;
};

/** 按英雄建施放器；默认钩刺，避免拆坏既有 verify。 */
export function createSkillCaster(hero: HeroId = 'hook'): SkillCaster {
  if (hero === 'ring') {
    return createRingCaster();
  }
  if (hero === 'chain') {
    return createChainCaster();
  }
  return createHookCaster();
}

/** 钩刺施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createHookCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let brakeRemain = 0;
  let brakeArmed = false;
  let now = 0;

  const cancelBrake = (): void => {
    brakeRemain = 0;
    brakeArmed = false;
  };

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = hookSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const tryRelease = (ball: BallBody, sample: ActionSample): void => {
    if (aimingSlot === 0 || isHardBusy(effect) || ball.stunRemain > 0) {
      return;
    }
    const slot = aimingSlot;
    if (cds[slot - 1] > 0) {
      return;
    }
    const aim = aimOf(ball, sample);
    if (!setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    if (hookIsDisplace(slot) && isInEnemyTrap(ball)) {
      punishDisplace(slot);
      return;
    }
    startCd(slot);
    aimingSlot = 0;
    const delay = hookWindup(slot);
    if (slot === 4 || delay <= 0) {
      if (effect?.kind === 'hookFly') {
        effect = null;
      }
      brakeRemain = HOOK_BRAKE.brakeTime;
      brakeArmed = true;
      return;
    }
    effect = { kind: 'windup', slot, remain: delay, aimX: ball.facingX, aimY: ball.facingY };
  };

  const handleInput = (ball: BallBody, sample: ActionSample, _roster: readonly BallBody[] = []): void => {
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
    }
    if (!ball.inPlay || ball.stunRemain > 0) {
      aimingSlot = 0;
      return;
    }
    if (sample.cancelAim) {
      aimingSlot = 0;
      return;
    }
    if (sample.skillPress) {
      if (aimingSlot === sample.skillPress) {
        tryRelease(ball, sample);
      } else if (cds[sample.skillPress - 1] <= 0 && !isHardBusy(effect)) {
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample);
    }
  };

  const resolveHook = (ball: BallBody, aimX: number, aimY: number, roster: readonly BallBody[]): CollisionHit[] => {
    const picked = pickFanEnemy(
      ball,
      roster,
      aimX,
      aimY,
      (HOOK_PULL.fanDeg * Math.PI) / 360,
      HOOK_PULL.range,
      true,
    );
    if (!picked) {
      cds[0] = Math.min(cds[0], HOOK_PULL.missCd);
      return [];
    }
    cancelBrake();
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(picked.target, ball, HOOK_PULL.damage);
    if (dmg) {
      hits.push(dmg);
    }
    const gap = Math.hypot(picked.target.x - ball.x, picked.target.y - ball.y);
    const touch = ball.radius + picked.target.radius;
    if (gap <= touch + TOUCH_PAD) {
      openActiveRam(ball);
      return hits;
    }
    effect = { kind: 'hookFly', targetId: picked.target.id };
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
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(picked.target, ball, HOOK_STAB.damages[index] ?? 0);
    if (dmg) {
      hits.push(dmg);
    }
    if (index === HOOK_STAB.hits - 1) {
      applyHardCc(picked.target, HOOK_STAB.thirdStun, now);
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
    };
    ball.vx = dir.x * speed;
    ball.vy = dir.y * speed;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
    ball.suppressCombat = true;
  };

  const finishWindup = (ball: BallBody, slot: SkillSlot, aimX: number, aimY: number, roster: readonly BallBody[]): CollisionHit[] => {
    if (hookIsDisplace(slot) && isInEnemyTrap(ball)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      return resolveHook(ball, aimX, aimY, roster);
    }
    if (slot === 2) {
      cancelBrake();
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
    const dir = unitVec(ball.facingX, ball.facingY) ?? { x: 1, y: 0 };
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.vx = dir.x * HOOK_BRAKE.popSpeed;
    ball.vy = dir.y * HOOK_BRAKE.popSpeed;
    ball.allowOverCap = true;
    openActiveRam(ball);
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
      aimingSlot = 0;
      effect = null;
      cancelBrake();
      return [];
    }

    const hits: CollisionHit[] = [];
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const slot = effect.slot;
        const { aimX, aimY } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, roster));
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
    return hits;
  };

  const afterPhysics = (
    ball: BallBody,
    dt: number,
    roster: readonly BallBody[],
    wallHit: boolean,
  ): CollisionHit[] => {
    if (!ball.inPlay) {
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
      now = 0;
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: () => (effect?.kind === 'windup' ? { slot: effect.slot, remain: effect.remain } : null),
    isHardBusy: () => isHardBusy(effect),
    isDisplacing: () => isDisplacing(effect),
    getHero: (): HeroId => 'hook',
  };
}
