import { applyRefract, consumeAimBreak, skillsBlocked, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  MIRROR_REFLECT,
  MIRROR_REFRACT,
  MIRROR_SHATTER,
  mirrorIsDisplace,
  mirrorSkillCd,
  mirrorWallSegment,
  mirrorWindup,
} from '../heroes/mirrorKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { consumeMirrorLedger } from './hpLoss';
import { clearMirrorWall, placeMirrorWall } from './mirrorWalls';
import type { AimHint, SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { applySkillDamage } from './skillHits';
import { pickEnemiesAround, pickFanEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { isInEnemyTrap } from './trapZones';

const TIME_EPS = 1e-7;

type Effect = {
  kind: 'windup';
  slot: SkillSlot;
  remain: number;
  aimX: number;
  aimY: number;
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

/** 镜卫施放：按下进瞄可无限持有；释放后才走前摇。反照空账/无目标不进 CD。 */
export function createMirrorCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let ownerId = -1;
  let pendingHits: CollisionHit[] = [];

  const bindOwner = (ball: BallBody): void => {
    ownerId = ball.id;
  };

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = mirrorSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return mirrorIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const resolveRefract = (ball: BallBody): void => {
    applyRefract(ball, MIRROR_REFRACT.duration);
  };

  const resolveReflect = (
    ball: BallBody,
    aimX: number,
    aimY: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    const dir = unitVec(aimX, aimY) ?? { x: ball.facingX, y: ball.facingY };
    const picked = pickFanEnemy(
      ball,
      roster,
      dir.x,
      dir.y,
      (MIRROR_REFLECT.fanDeg * Math.PI) / 360,
      MIRROR_REFLECT.range,
      false,
    );
    if (!picked) {
      return [];
    }
    const spent = consumeMirrorLedger(ball, MIRROR_REFLECT.cap);
    if (spent <= 0) {
      return [];
    }
    const dmg = applySkillDamage(picked.target, ball, spent);
    return dmg ? [dmg] : [];
  };

  const resolveShatter = (ball: BallBody, roster: readonly BallBody[]): CollisionHit[] => {
    const hits: CollisionHit[] = [];
    const selfHit = applySkillDamage(ball, ball, MIRROR_SHATTER.selfDamage, {
      allowSelf: true,
      skipRefract: true,
      shatterCredit: MIRROR_SHATTER.selfDamage,
    });
    if (selfHit) {
      hits.push(selfHit);
    }
    for (const item of pickEnemiesAround(ball, roster, ball.x, ball.y, MIRROR_SHATTER.radius)) {
      const splash = applySkillDamage(item.target, ball, MIRROR_SHATTER.splash);
      if (splash) {
        hits.push(splash);
      }
    }
    return hits;
  };

  const resolveWall = (ball: BallBody, aimX: number, aimY: number): void => {
    const wall = mirrorWallSegment(ball, aimX, aimY);
    placeMirrorWall(ball, wall.x0, wall.y0, wall.x1, wall.y1, wall.halfWidth);
  };

  const finishWindup = (
    ball: BallBody,
    slot: SkillSlot,
    aimX: number,
    aimY: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      resolveRefract(ball);
      return [];
    }
    if (slot === 2) {
      return resolveReflect(ball, aimX, aimY, roster);
    }
    if (slot === 3) {
      return resolveShatter(ball, roster);
    }
    resolveWall(ball, aimX, aimY);
    return [];
  };

  const canReflect = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): boolean => {
    if (ball.mirrorLedger <= 0) {
      return false;
    }
    const aim = aimOf(ball, sample);
    const picked = pickFanEnemy(
      ball,
      roster,
      aim.x,
      aim.y,
      (MIRROR_REFLECT.fanDeg * Math.PI) / 360,
      MIRROR_REFLECT.range,
      false,
    );
    return !!picked;
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
    if (slot === 2 && !canReflect(ball, sample, roster)) {
      aimingSlot = 0;
      return;
    }
    const aim = aimOf(ball, sample);
    if (!setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    startCd(slot);
    aimingSlot = 0;
    const delay = mirrorWindup(slot);
    if (delay <= 0) {
      effect = null;
      pendingHits.push(...finishWindup(ball, slot, ball.facingX, ball.facingY, roster));
      return;
    }
    effect = { kind: 'windup', slot, remain: delay, aimX: ball.facingX, aimY: ball.facingY };
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
    bindOwner(ball);
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
      return [];
    }

    const hits: CollisionHit[] = pendingHits;
    pendingHits = [];
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const { slot, aimX, aimY } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, roster));
      }
    }
    return hits;
  };

  const afterPhysics = (ball: BallBody): CollisionHit[] => {
    bindOwner(ball);
    if (!ball.inPlay) {
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
      pendingHits = [];
      if (ownerId >= 0) {
        clearMirrorWall(ownerId);
      }
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup' ? { slot: effect.slot, remain: effect.remain } : null,
    getAimHint: (): AimHint | null => (aimingSlot === 0 ? null : { slot: aimingSlot, stage: 1 }),
    isHardBusy: () => !!effect,
    isDisplacing: () => false,
    getHero: (): HeroId => 'mirror',
  };
}
