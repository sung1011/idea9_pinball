import { applyEchoMark, consumeAimBreak, skillsBlocked, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  ARC_GRAZE,
  ARC_MARK,
  ARC_PHASE,
  arcIsDisplace,
  arcSkillCd,
  arcWindup,
  sideStepOffset,
} from '../heroes/arcKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import type { SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { pickNearestEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';

const TIME_EPS = 1e-7;

type Effect = {
  kind: 'windup';
  slot: SkillSlot;
  remain: number;
  aimX: number;
  aimY: number;
  dirX: number;
  dirY: number;
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

/** 闪弧施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createArcCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let phaseRemain = 0;

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = arcSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return arcIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const clearPhase = (ball?: BallBody): void => {
    phaseRemain = 0;
    if (ball) {
      ball.phaseRemain = 0;
    }
  };

  const resolveSidestep = (ball: BallBody, dirX: number, dirY: number): void => {
    ball.x += dirX;
    ball.y += dirY;
    resolveArenaObstacles(ball);
  };

  const resolveGraze = (ball: BallBody): void => {
    ball.grazeRemain = Math.max(ball.grazeRemain, ARC_GRAZE.duration);
  };

  const resolveMark = (ball: BallBody, roster: readonly BallBody[]): void => {
    const picked = pickNearestEnemy(ball, roster, ARC_MARK.range);
    if (!picked) {
      return;
    }
    applyEchoMark(picked.target, ARC_MARK.duration, ball.id);
  };

  const startPhase = (ball: BallBody): void => {
    phaseRemain = ARC_PHASE.duration;
    ball.phaseRemain = phaseRemain;
  };

  const finishWindup = (
    ball: BallBody,
    slot: SkillSlot,
    _aimX: number,
    _aimY: number,
    dirX: number,
    dirY: number,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      resolveSidestep(ball, dirX, dirY);
      return [];
    }
    if (slot === 2) {
      resolveGraze(ball);
      return [];
    }
    if (slot === 3) {
      resolveMark(ball, roster);
      return [];
    }
    startPhase(ball);
    return [];
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || effect || skillsBlocked(ball) || phaseRemain > 0) {
      return;
    }
    const slot = aimingSlot;
    if (cds[slot - 1] > 0) {
      return;
    }
    const aim = aimOf(ball, sample);
    const side = sideStepOffset(ball.facingX, ball.facingY, aim.x, aim.y);
    if (slot !== 1 && !setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return;
    }
    startCd(slot);
    aimingSlot = 0;
    const delay = arcWindup(slot);
    if (delay <= 0) {
      finishWindup(ball, slot, ball.facingX, ball.facingY, side.x, side.y, roster);
      return;
    }
    effect = {
      kind: 'windup',
      slot,
      remain: delay,
      aimX: ball.facingX,
      aimY: ball.facingY,
      dirX: side.x,
      dirY: side.y,
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
      } else if (cds[sample.skillPress - 1] <= 0 && !effect && phaseRemain <= 0) {
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample, roster);
    }
  };

  const tickPhase = (ball: BallBody, dt: number): void => {
    if (phaseRemain <= 0) {
      ball.phaseRemain = 0;
      return;
    }
    phaseRemain -= dt;
    if (phaseRemain <= TIME_EPS) {
      clearPhase(ball);
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed + 1e-9 >= ARC_PHASE.minSpeed) {
        ball.activeRamRemain = Math.max(ball.activeRamRemain, ARC_PHASE.ramWindow);
      }
      return;
    }
    ball.phaseRemain = phaseRemain;
  };

  const tick = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    const step = Math.max(0, dt);
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
      clearPhase(ball);
      return [];
    }

    const hits: CollisionHit[] = [];
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const { slot, aimX, aimY, dirX, dirY } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, dirX, dirY, roster));
      }
    }

    tickPhase(ball, step);
    if (phaseRemain > 0) {
      ball.frictionMul = 0;
    }
    return hits;
  };

  const afterPhysics = (ball: BallBody): CollisionHit[] => {
    if (!ball.inPlay) {
      effect = null;
      clearPhase(ball);
      return [];
    }
    if (phaseRemain > 0) {
      ball.phaseRemain = phaseRemain;
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
      phaseRemain = 0;
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup' ? { slot: effect.slot, remain: effect.remain } : null,
    isHardBusy: () => !!effect || phaseRemain > 0,
    isDisplacing: () => phaseRemain > 0 || (!!effect && effect.slot === 1),
    getHero: (): HeroId => 'arc',
  };
}
