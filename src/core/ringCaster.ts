import type { BallBody } from './ballBody';
import { consumeAimBreak, openActiveRam, skillsBlocked } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  RING_FIELD,
  RING_SLIDE,
  RING_TRAP,
  RING_WAVE,
  ringIsDisplace,
  ringSkillCd,
  ringTrapCenter,
  ringWindup,
} from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { applySkillDamage } from './skillHits';
import { pickFanEnemies, unitVec } from './skillQuery';
import type { SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { setFacingFrom } from './skillStub';
import { clearTrapZone, isInEnemyTrap, markTrapOccupants, setTrapZone, tickTrapZone } from './trapZones';

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

function markOf(ball: BallBody, sample: ActionSample): { x: number; y: number } {
  return ringTrapCenter(ball, sample.pointerX, sample.pointerY, sample.hasPointer);
}

/** 磁环施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createRingCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let fieldRemain = 0;
  let slideRemain = 0;
  let ownerId = -1;

  const bindOwner = (ball: BallBody): void => {
    ownerId = ball.id;
  };

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = ringSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return ringIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const clearSlide = (ball?: BallBody): void => {
    slideRemain = 0;
    if (ball) {
      ball.slideWalls = false;
    }
  };

  const clearField = (ball?: BallBody): void => {
    fieldRemain = 0;
    if (ball) {
      ball.fieldRemain = 0;
    }
  };

  const startField = (ball: BallBody): void => {
    fieldRemain = RING_FIELD.duration;
    ball.fieldRemain = fieldRemain;
  };

  const startSlide = (ball: BallBody): void => {
    slideRemain = RING_SLIDE.slideTime;
    ball.slideWalls = true;
  };

  const popSlide = (ball: BallBody): void => {
    const dir = unitVec(ball.facingX, ball.facingY) ?? { x: 1, y: 0 };
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.vx = dir.x * RING_SLIDE.popSpeed;
    ball.vy = dir.y * RING_SLIDE.popSpeed;
    ball.allowOverCap = true;
    openActiveRam(ball);
  };

  const resolveWave = (
    ball: BallBody,
    aimX: number,
    aimY: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    const dir = unitVec(aimX, aimY) ?? { x: ball.facingX, y: ball.facingY };
    const hits: CollisionHit[] = [];
    const picked = pickFanEnemies(
      ball,
      roster,
      dir.x,
      dir.y,
      (RING_WAVE.fanDeg * Math.PI) / 360,
      RING_WAVE.range,
      false,
    );
    for (const item of picked) {
      const dmg = applySkillDamage(item.target, ball, RING_WAVE.damage);
      if (dmg) {
        hits.push(dmg);
      }
      item.target.vx = dir.x * RING_WAVE.knockback;
      item.target.vy = dir.y * RING_WAVE.knockback;
      item.target.allowOverCap = true;
    }
    return hits;
  };

  const placeTrap = (ball: BallBody, markX: number, markY: number, roster: readonly BallBody[]): void => {
    setTrapZone({
      ownerId: ball.id,
      ownerTeam: ball.team,
      x: markX,
      y: markY,
      radius: RING_TRAP.radius,
      remain: RING_TRAP.duration,
    });
    markTrapOccupants(roster);
  };

  const finishWindup = (
    ball: BallBody,
    slot: SkillSlot,
    aimX: number,
    aimY: number,
    markX: number,
    markY: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      startField(ball);
      return [];
    }
    if (slot === 2) {
      return resolveWave(ball, aimX, aimY, roster);
    }
    if (slot === 3) {
      startSlide(ball);
      return [];
    }
    placeTrap(ball, markX, markY, roster);
    return [];
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || effect || skillsBlocked(ball)) {
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
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return;
    }
    startCd(slot);
    aimingSlot = 0;
    const delay = ringWindup(slot);
    const mark = markOf(ball, sample);
    if (delay <= 0) {
      finishWindup(ball, slot, ball.facingX, ball.facingY, mark.x, mark.y, roster);
      return;
    }
    effect = {
      kind: 'windup',
      slot,
      remain: delay,
      aimX: ball.facingX,
      aimY: ball.facingY,
      markX: mark.x,
      markY: mark.y,
    };
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

  const tickField = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    if (fieldRemain <= 0) {
      ball.fieldRemain = 0;
      return [];
    }
    fieldRemain = Math.max(0, fieldRemain - dt);
    ball.fieldRemain = fieldRemain;
    if (fieldRemain <= 0) {
      return [];
    }
    const hits: CollisionHit[] = [];
    for (const other of roster) {
      if (!other.inPlay || other.id === ball.id) {
        continue;
      }
      if (other.team && ball.team && other.team === ball.team) {
        continue;
      }
      const dist = Math.hypot(other.x - ball.x, other.y - ball.y);
      if (dist > RING_FIELD.radius) {
        continue;
      }
      const dmg = applySkillDamage(other, ball, RING_FIELD.dps * dt);
      if (dmg) {
        hits.push(dmg);
      }
    }
    return hits;
  };

  const tickSlide = (ball: BallBody, dt: number): void => {
    if (slideRemain <= 0) {
      ball.slideWalls = false;
      return;
    }
    slideRemain -= dt;
    if (slideRemain <= TIME_EPS) {
      clearSlide(ball);
      popSlide(ball);
      return;
    }
    ball.slideWalls = true;
  };

  const tick = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    const step = Math.max(0, dt);
    bindOwner(ball);
    if (consumeAimBreak(ball)) {
      aimingSlot = 0;
    }
    for (let i = 0; i < cds.length; i += 1) {
      cds[i] = Math.max(0, cds[i] - step);
    }
    ball.frictionMul = 1;
    ball.suppressCombat = false;
    tickTrapZone(ball.id, step);

    if (!ball.inPlay) {
      aimingSlot = 0;
      effect = null;
      clearSlide(ball);
      clearField(ball);
      return [];
    }

    const hits: CollisionHit[] = [];
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const { slot, aimX, aimY, markX, markY } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, markX, markY, roster));
      }
    }

    hits.push(...tickField(ball, step, roster));
    tickSlide(ball, step);
    return hits;
  };

  const afterPhysics = (ball: BallBody): CollisionHit[] => {
    bindOwner(ball);
    if (!ball.inPlay) {
      effect = null;
      clearSlide(ball);
      clearField(ball);
      return [];
    }
    if (slideRemain > 0) {
      ball.slideWalls = true;
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
      fieldRemain = 0;
      slideRemain = 0;
      if (ownerId >= 0) {
        clearTrapZone(ownerId);
      }
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup'
        ? { slot: effect.slot, remain: effect.remain, markX: effect.markX, markY: effect.markY }
        : null,
    isHardBusy: () => !!effect,
    isDisplacing: () => slideRemain > 0,
    getHero: (): HeroId => 'ring',
  };
}
