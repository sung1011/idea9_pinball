import { applyEchoMark, consumeAimBreak, skillsBlocked, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  ARC_GRAZE,
  ARC_MARK,
  ARC_PHASE,
  ARC_SIDESTEP,
  arcIsDisplace,
  arcSkillCd,
  arcWindup,
  behindEnemyPos,
} from '../heroes/arcKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import type { SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { pickFanEnemy, pickNearestEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { convoyBlocksSkillRelease } from './hookBrakeConvoy';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';

const TIME_EPS = 1e-7;

type Effect = {
  kind: 'windup';
  slot: SkillSlot;
  remain: number;
  aimX: number;
  aimY: number;
  targetId?: number;
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

function pickSidestepEnemy(
  ball: BallBody,
  aimX: number,
  aimY: number,
  roster: readonly BallBody[],
): BallBody | null {
  const dir = unitVec(aimX, aimY) ?? { x: ball.facingX, y: ball.facingY };
  const picked = pickFanEnemy(
    ball,
    roster,
    dir.x,
    dir.y,
    (ARC_SIDESTEP.fanDeg * Math.PI) / 360,
    ARC_SIDESTEP.range,
    false,
  );
  return picked?.target ?? null;
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

  const failShort = (slot: SkillSlot): void => {
    cds[slot - 1] = ARC_SIDESTEP.failCd;
    aimingSlot = 0;
    effect = null;
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

  const resolveSidestep = (ball: BallBody, target: BallBody): void => {
    const behind = behindEnemyPos(
      target.x,
      target.y,
      target.facingX,
      target.facingY,
      ball.radius,
      target.radius,
    );
    ball.x = behind.x;
    ball.y = behind.y;
    ball.facingX = behind.faceX;
    ball.facingY = behind.faceY;
    const speed = Math.hypot(ball.vx, ball.vy);
    const keep = speed > 1e-6 ? speed : 2.5;
    ball.vx = behind.faceX * keep;
    ball.vy = behind.faceY * keep;
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
    aimX: number,
    aimY: number,
    targetId: number | undefined,
    roster: readonly BallBody[],
  ): CollisionHit[] => {
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return [];
    }
    if (slot === 1) {
      const locked = targetId != null ? roster.find((item) => item.id === targetId) : undefined;
      const target =
        locked && locked.inPlay ? locked : pickSidestepEnemy(ball, aimX, aimY, roster);
      if (!target) {
        failShort(slot);
        return [];
      }
      resolveSidestep(ball, target);
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
    if (convoyBlocksSkillRelease(ball, slot)) {
      return;
    }
    if (cds[slot - 1] > 0) {
      return;
    }
    if (blockedByTrap(ball, slot)) {
      punishDisplace(slot);
      return;
    }
    const aim = aimOf(ball, sample);
    if (!setFacingFrom(ball, aim.x, aim.y)) {
      return;
    }
    let targetId: number | undefined;
    if (slot === 1) {
      const target = pickSidestepEnemy(ball, ball.facingX, ball.facingY, roster);
      if (!target) {
        failShort(slot);
        return;
      }
      targetId = target.id;
    }
    startCd(slot);
    aimingSlot = 0;
    const delay = arcWindup(slot);
    if (delay <= 0) {
      finishWindup(ball, slot, ball.facingX, ball.facingY, targetId, roster);
      return;
    }
    effect = {
      kind: 'windup',
      slot,
      remain: delay,
      aimX: ball.facingX,
      aimY: ball.facingY,
      targetId,
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
        const { slot, aimX, aimY, targetId } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, targetId, roster));
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
