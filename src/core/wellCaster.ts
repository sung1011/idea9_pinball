import { consumeAimBreak, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import { RING_TRAP } from '../heroes/ringKit';
import {
  WELL_HOOK,
  WELL_REEL,
  WELL_STAKE,
  WELL_SWAP,
  dropSpeedOneTier,
  lightPullToward,
  wellIsDisplace,
  wellPoint,
  wellSkillCd,
  wellWindup,
} from '../heroes/wellKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import type { AimHint, SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { applySkillDamage } from './skillHits';
import { pickEnemiesOnLine, pickNearestEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { clearStake, getStake, placeStake, tickStake } from './ropeStakes';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';

const TIME_EPS = 1e-7;
const ARRIVE_PAD = 0.12;

type HookLock = {
  targetId: number;
  x: number;
  y: number;
};

type Effect =
  | {
      kind: 'windup';
      slot: SkillSlot;
      remain: number;
      aimX: number;
      aimY: number;
      markX: number;
      markY: number;
      targetId: number;
    }
  | { kind: 'hookFly'; destX: number; destY: number; dirX: number; dirY: number };

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

/** 井绳施放：按下进瞄可无限持有；双索两段确认（先锁敌再点落点）；释放后才走前摇。 */
export function createWellCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let hookLock: HookLock | null = null;
  let ownerId = -1;

  const bindOwner = (ball: BallBody): void => {
    ownerId = ball.id;
  };

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = wellSkillCd(slot);
  };

  const clearLock = (): void => {
    hookLock = null;
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
    clearLock();
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return wellIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const commitCast = (
    ball: BallBody,
    slot: SkillSlot,
    sample: ActionSample,
    roster: readonly BallBody[],
    targetId: number,
    markX: number,
    markY: number,
  ): void => {
    const aim = aimOf(ball, sample);
    if (slot === 1) {
      if (!setFacingFrom(ball, markX - ball.x, markY - ball.y) && !setFacingFrom(ball, aim.x, aim.y)) {
        return;
      }
    } else if (!setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    startCd(slot);
    aimingSlot = 0;
    clearLock();
    const delay = wellWindup(slot);
    if (delay <= 0) {
      finishWindup(ball, slot, ball.facingX, ball.facingY, markX, markY, targetId, roster);
      return;
    }
    effect = {
      kind: 'windup',
      slot,
      remain: delay,
      aimX: ball.facingX,
      aimY: ball.facingY,
      markX,
      markY,
      targetId,
    };
  };

  const resolveHook = (
    ball: BallBody,
    destX: number,
    destY: number,
    targetId: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    const hits: CollisionHit[] = [];
    const target = roster.find((other) => other.id === targetId && other.inPlay) ?? null;
    if (target) {
      const dmg = applySkillDamage(target, ball, WELL_HOOK.damage);
      if (dmg) {
        hits.push(dmg);
      }
      const midX = (target.x + destX) / 2;
      const midY = (target.y + destY) / 2;
      lightPullToward(target, midX, midY, WELL_HOOK.pullDist);
      resolveArenaObstacles(target);
    }
    const dir = unitVec(destX - ball.x, destY - ball.y);
    if (!dir) {
      ball.vx = ball.facingX * WELL_HOOK.landSpeed;
      ball.vy = ball.facingY * WELL_HOOK.landSpeed;
      ball.allowOverCap = true;
      return hits;
    }
    const gap = Math.hypot(destX - ball.x, destY - ball.y);
    if (gap <= ARRIVE_PAD) {
      ball.x = destX;
      ball.y = destY;
      ball.vx = dir.x * WELL_HOOK.landSpeed;
      ball.vy = dir.y * WELL_HOOK.landSpeed;
      ball.facingX = dir.x;
      ball.facingY = dir.y;
      ball.allowOverCap = true;
      resolveArenaObstacles(ball);
      return hits;
    }
    effect = { kind: 'hookFly', destX, destY, dirX: dir.x, dirY: dir.y };
    return hits;
  };

  const resolveSwap = (ball: BallBody, targetId: number, roster: readonly BallBody[]): CollisionHit[] => {
    const target = roster.find((other) => other.id === targetId && other.inPlay) ?? null;
    if (!target) {
      return [];
    }
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(target, ball, WELL_SWAP.damage);
    if (dmg) {
      hits.push(dmg);
    }
    const ax = ball.x;
    const ay = ball.y;
    const avx = ball.vx;
    const avy = ball.vy;
    ball.x = target.x;
    ball.y = target.y;
    target.x = ax;
    target.y = ay;
    ball.vx = target.vx * WELL_SWAP.speedKeep;
    ball.vy = target.vy * WELL_SWAP.speedKeep;
    target.vx = avx * WELL_SWAP.speedKeep;
    target.vy = avy * WELL_SWAP.speedKeep;
    ball.allowOverCap = true;
    target.allowOverCap = true;
    resolveArenaObstacles(ball);
    resolveArenaObstacles(target);
    return hits;
  };

  const resolveStake = (ball: BallBody, markX: number, markY: number): void => {
    placeStake(ball, markX, markY);
  };

  const resolveReel = (ball: BallBody, roster: readonly BallBody[]): CollisionHit[] => {
    const stake = getStake(ball.id);
    if (!stake) {
      return [];
    }
    const hits: CollisionHit[] = [];
    const midX = (ball.x + stake.x) / 2;
    const midY = (ball.y + stake.y) / 2;
    const picked = pickEnemiesOnLine(
      ball,
      roster,
      ball.x,
      ball.y,
      stake.x,
      stake.y,
      WELL_REEL.width / 2,
    );
    for (const item of picked) {
      const dmg = applySkillDamage(item.target, ball, WELL_REEL.damage);
      if (dmg) {
        hits.push(dmg);
      }
      lightPullToward(item.target, midX, midY, WELL_REEL.pullDist);
      dropSpeedOneTier(item.target);
      resolveArenaObstacles(item.target);
    }
    return hits;
  };

  const finishWindup = (
    ball: BallBody,
    slot: SkillSlot,
    _aimX: number,
    _aimY: number,
    markX: number,
    markY: number,
    targetId: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      return resolveHook(ball, markX, markY, targetId, roster);
    }
    if (slot === 2) {
      return resolveSwap(ball, targetId, roster);
    }
    if (slot === 3) {
      resolveStake(ball, markX, markY);
      return [];
    }
    return resolveReel(ball, roster);
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || effect || ball.stunRemain > 0) {
      return;
    }
    const slot = aimingSlot;
    if (cds[slot - 1] > 0) {
      return;
    }
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return;
    }
    if (slot === 1 && !hookLock) {
      const picked = pickNearestEnemy(ball, roster, WELL_HOOK.lockRange);
      if (!picked) {
        return;
      }
      hookLock = { targetId: picked.target.id, x: picked.target.x, y: picked.target.y };
      return;
    }
    if (slot === 4 && !getStake(ball.id)) {
      return;
    }
    if (slot === 1 && hookLock) {
      const mark = wellPoint(
        ball,
        WELL_HOOK.landRange,
        sample.pointerX,
        sample.pointerY,
        sample.hasPointer,
      );
      commitCast(ball, slot, sample, roster, hookLock.targetId, mark.x, mark.y);
      return;
    }
    if (slot === 2) {
      const picked = pickNearestEnemy(ball, roster, WELL_SWAP.range);
      if (!picked) {
        startCd(slot);
        aimingSlot = 0;
        return;
      }
      commitCast(ball, slot, sample, roster, picked.target.id, picked.target.x, picked.target.y);
      return;
    }
    if (slot === 3) {
      const mark = wellPoint(ball, WELL_STAKE.range, sample.pointerX, sample.pointerY, sample.hasPointer);
      commitCast(ball, slot, sample, roster, -1, mark.x, mark.y);
      return;
    }
    commitCast(ball, slot, sample, roster, -1, ball.x, ball.y);
  };

  const handleInput = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[] = []): void => {
    bindOwner(ball);
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
      clearLock();
    }
    if (!ball.inPlay || ball.stunRemain > 0) {
      aimingSlot = 0;
      clearLock();
      return;
    }
    if (sample.cancelAim) {
      aimingSlot = 0;
      clearLock();
      return;
    }
    if (sample.skillPress) {
      if (aimingSlot === sample.skillPress) {
        tryRelease(ball, sample, roster);
      } else if (cds[sample.skillPress - 1] <= 0 && !effect) {
        clearLock();
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample, roster);
    }
  };

  const applyHookFly = (ball: BallBody): void => {
    if (effect?.kind !== 'hookFly') {
      return;
    }
    const fly = effect;
    const dir = unitVec(fly.destX - ball.x, fly.destY - ball.y) ?? { x: fly.dirX, y: fly.dirY };
    ball.vx = dir.x * WELL_HOOK.flySpeed;
    ball.vy = dir.y * WELL_HOOK.flySpeed;
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
  };

  const landFly = (ball: BallBody): void => {
    if (effect?.kind !== 'hookFly') {
      return;
    }
    const fly = effect;
    const dir = unitVec(fly.dirX, fly.dirY) ?? { x: 1, y: 0 };
    ball.x = fly.destX;
    ball.y = fly.destY;
    ball.vx = dir.x * WELL_HOOK.landSpeed;
    ball.vy = dir.y * WELL_HOOK.landSpeed;
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.allowOverCap = true;
    resolveArenaObstacles(ball);
    effect = null;
  };

  const tick = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    const step = Math.max(0, dt);
    bindOwner(ball);
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
      clearLock();
    }
    for (let i = 0; i < cds.length; i += 1) {
      cds[i] = Math.max(0, cds[i] - step);
    }
    ball.frictionMul = 1;
    ball.suppressCombat = false;
    tickStake(ball.id, step);

    if (!ball.inPlay) {
      aimingSlot = 0;
      effect = null;
      clearLock();
      return [];
    }

    const hits: CollisionHit[] = [];
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const { slot, aimX, aimY, markX, markY, targetId } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, markX, markY, targetId, roster));
      }
    }

    applyHookFly(ball);
    return hits;
  };

  const afterPhysics = (ball: BallBody): CollisionHit[] => {
    bindOwner(ball);
    if (!ball.inPlay) {
      effect = null;
      clearLock();
      return [];
    }
    if (effect?.kind !== 'hookFly') {
      return [];
    }
    const dist = Math.hypot(effect.destX - ball.x, effect.destY - ball.y);
    if (dist <= WELL_HOOK.flySpeed / 60 + ARRIVE_PAD) {
      landFly(ball);
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
      clearLock();
      if (ownerId >= 0) {
        clearStake(ownerId);
      }
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup'
        ? {
            slot: effect.slot,
            remain: effect.remain,
            markX: effect.markX,
            markY: effect.markY,
            lockX: hookLock?.x,
            lockY: hookLock?.y,
            aimStage: effect.slot === 1 ? 2 : 1,
          }
        : null,
    getAimHint: (): AimHint | null => {
      if (aimingSlot === 0) {
        return null;
      }
      if (aimingSlot === 1 && hookLock) {
        return { slot: 1, stage: 2, lockX: hookLock.x, lockY: hookLock.y };
      }
      return { slot: aimingSlot, stage: 1 };
    },
    isHardBusy: () => !!effect,
    isDisplacing: () =>
      effect?.kind === 'hookFly' || (!!effect && effect.kind === 'windup' && wellIsDisplace(effect.slot)),
    getHero: (): HeroId => 'well',
  };
}
