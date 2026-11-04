import { applyPin, consumeAimBreak, skillsBlocked, type BallBody } from './ballBody';
import { clearBoomFlashes, spawnBoomFlash, tickBoomFlashes } from './boomFlashes';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import { RING_TRAP } from '../heroes/ringKit';
import {
  WELL_BLAST,
  WELL_REEL,
  WELL_STAKE,
  WELL_SWAP,
  wellIsDisplace,
  wellPoint,
  wellSkillCd,
  wellWindup,
} from '../heroes/wellKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { applyHardCc } from './hardCc';
import type { AimHint, SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { applySkillDamage } from './skillHits';
import { pickEnemiesAround, pickEnemiesOnLine, pickNearestEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { clearStake, getStake, placeStake, tickStake } from './ropeStakes';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';

const TIME_EPS = 1e-7;

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
  | {
      kind: 'blast';
      nextIn: number;
      index: number;
      stakeX: number | null;
      stakeY: number | null;
    };

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

/** 井绳施放：按下进瞄可无限持有；索爆单段即放范围炸；释放后才走前摇。 */
export function createWellCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let ownerId = -1;
  let now = 0;

  const bindOwner = (ball: BallBody): void => {
    ownerId = ball.id;
  };

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = wellSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return wellIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const finishBlast = (ball: BallBody, stakeX: number | null): void => {
    if (stakeX !== null) {
      clearStake(ball.id);
    }
    effect = null;
  };

  const resolveBlastPulse = (
    ball: BallBody,
    roster: readonly BallBody[],
    stakeX: number | null,
    stakeY: number | null,
  ): CollisionHit[] => {
    const hits: CollisionHit[] = [];
    const applyAt = (x: number, y: number): void => {
      spawnBoomFlash(ball.id, x, y, WELL_BLAST.radius);
      for (const item of pickEnemiesAround(ball, roster, x, y, WELL_BLAST.radius)) {
        const dmg = applySkillDamage(item.target, ball, WELL_BLAST.damage);
        if (dmg) {
          hits.push(dmg);
        }
      }
    };
    applyAt(ball.x, ball.y);
    if (stakeX !== null && stakeY !== null) {
      applyAt(stakeX, stakeY);
    }
    return hits;
  };

  const startBlast = (ball: BallBody, roster: readonly BallBody[]): CollisionHit[] => {
    const stake = getStake(ball.id);
    const stakeX = stake ? stake.x : null;
    const stakeY = stake ? stake.y : null;
    const hits = resolveBlastPulse(ball, roster, stakeX, stakeY);
    if (WELL_BLAST.pulses <= 1) {
      finishBlast(ball, stakeX);
      return hits;
    }
    effect = {
      kind: 'blast',
      nextIn: WELL_BLAST.interval,
      index: 1,
      stakeX,
      stakeY,
    };
    return hits;
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
    if (!setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    startCd(slot);
    aimingSlot = 0;
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
      const scaled = applyHardCc(item.target, WELL_REEL.duration, now);
      item.target.vx = 0;
      item.target.vy = 0;
      applyPin(item.target, scaled, undefined, true);
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
      return startBlast(ball, roster);
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
    if (aimingSlot === 0 || effect || skillsBlocked(ball)) {
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
    if (slot === 4 && !getStake(ball.id)) {
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
      } else if (cds[sample.skillPress - 1] <= 0 && !effect) {
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample, roster);
    }
  };

  const tick = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    const step = Math.max(0, dt);
    now += step;
    bindOwner(ball);
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
    }
    for (let i = 0; i < cds.length; i += 1) {
      cds[i] = Math.max(0, cds[i] - step);
    }
    ball.frictionMul = 1;
    ball.suppressCombat = false;
    tickStake(ball.id, step);
    tickBoomFlashes(ball.id, step);

    if (!ball.inPlay) {
      if (effect?.kind === 'blast') {
        finishBlast(ball, effect.stakeX);
      }
      aimingSlot = 0;
      effect = null;
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
    } else if (effect?.kind === 'blast') {
      effect.nextIn -= step;
      while (effect?.kind === 'blast' && effect.nextIn <= TIME_EPS) {
        hits.push(...resolveBlastPulse(ball, roster, effect.stakeX, effect.stakeY));
        effect.index += 1;
        if (effect.index >= WELL_BLAST.pulses) {
          finishBlast(ball, effect.stakeX);
          break;
        }
        effect.nextIn += WELL_BLAST.interval;
      }
    }

    return hits;
  };

  const afterPhysics = (ball: BallBody): CollisionHit[] => {
    bindOwner(ball);
    if (!ball.inPlay) {
      if (effect?.kind === 'blast') {
        finishBlast(ball, effect.stakeX);
      }
      effect = null;
      return [];
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
      now = 0;
      if (ownerId >= 0) {
        clearStake(ownerId);
        clearBoomFlashes(ownerId);
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
          }
        : null,
    getAimHint: (): AimHint | null => (aimingSlot === 0 ? null : { slot: aimingSlot, stage: 1 }),
    isHardBusy: () => !!effect,
    isDisplacing: () => !!effect && effect.kind === 'windup' && wellIsDisplace(effect.slot),
    getHero: (): HeroId => 'well',
  };
}
