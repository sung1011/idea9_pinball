import { applyHealHot, applyShield, consumeAimBreak, type BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  CHAIN_HEAL,
  CHAIN_SCRAMBLE,
  CHAIN_SHIELD,
  CHAIN_TOW,
  chainIsDisplace,
  chainSkillCd,
  chainWindup,
} from '../heroes/chainKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { applySkillDamage } from './skillHits';
import { pickFanAlly, pickFanEnemy, pickNearestAlly, unitVec } from './skillQuery';
import type { SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { setFacingFrom } from './skillStub';
import { isInEnemyTrap } from './trapZones';
import { resolveArenaObstacles } from './wallBounce';

const TIME_EPS = 1e-7;
const ARRIVE_PAD = 0.08;

type Effect =
  | { kind: 'windup'; slot: SkillSlot; remain: number; aimX: number; aimY: number }
  | { kind: 'allyFly'; targetId: number };

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

function rotateFacing(ball: BallBody, rad: number): void {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const fx = ball.facingX * c - ball.facingY * s;
  const fy = ball.facingX * s + ball.facingY * c;
  const face = unitVec(fx, fy) ?? { x: 1, y: 0 };
  ball.facingX = face.x;
  ball.facingY = face.y;
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > 1e-8) {
    ball.vx = face.x * speed;
    ball.vy = face.y * speed;
  }
}

/** 链生施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createChainCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = chainSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return chainIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const resolveHeal = (ball: BallBody, aimX: number, aimY: number, roster: readonly BallBody[]): void => {
    const dir = unitVec(aimX, aimY) ?? { x: ball.facingX, y: ball.facingY };
    const picked = pickFanAlly(
      ball,
      roster,
      dir.x,
      dir.y,
      (CHAIN_HEAL.fanDeg * Math.PI) / 360,
      CHAIN_HEAL.range,
    );
    applyHealHot(ball, CHAIN_HEAL.dps, CHAIN_HEAL.duration);
    if (picked) {
      applyHealHot(picked.target, CHAIN_HEAL.dps, CHAIN_HEAL.duration);
    }
  };

  const resolveShield = (ball: BallBody, roster: readonly BallBody[]): void => {
    const picked = pickNearestAlly(ball, roster, CHAIN_SHIELD.range);
    const target = picked?.target ?? ball;
    applyShield(target, CHAIN_SHIELD.mul, CHAIN_SHIELD.duration);
  };

  const pullAlly = (ball: BallBody, ally: BallBody): void => {
    const dir = unitVec(ball.x - ally.x, ball.y - ally.y);
    if (!dir) {
      return;
    }
    ally.x += dir.x * CHAIN_TOW.pullDist;
    ally.y += dir.y * CHAIN_TOW.pullDist;
    resolveArenaObstacles(ally);
  };

  const resolveTow = (ball: BallBody, roster: readonly BallBody[]): void => {
    const picked = pickNearestAlly(ball, roster, CHAIN_TOW.range);
    if (!picked) {
      return;
    }
    const low = picked.target.hp < picked.target.maxHp * CHAIN_TOW.lowHpRatio;
    if (low) {
      pullAlly(ball, picked.target);
      return;
    }
    const gap = Math.hypot(picked.target.x - ball.x, picked.target.y - ball.y);
    const touch = ball.radius + picked.target.radius;
    if (gap <= touch + ARRIVE_PAD) {
      return;
    }
    effect = { kind: 'allyFly', targetId: picked.target.id };
  };

  const resolveScramble = (
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
      (CHAIN_SCRAMBLE.fanDeg * Math.PI) / 360,
      CHAIN_SCRAMBLE.range,
      false,
    );
    if (!picked) {
      return [];
    }
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(picked.target, ball, CHAIN_SCRAMBLE.damage);
    if (dmg) {
      hits.push(dmg);
    }
    rotateFacing(picked.target, CHAIN_SCRAMBLE.turnRad);
    picked.target.aimBreak = true;
    return hits;
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
      resolveHeal(ball, aimX, aimY, roster);
      return [];
    }
    if (slot === 2) {
      resolveShield(ball, roster);
      return [];
    }
    if (slot === 3) {
      resolveTow(ball, roster);
      return [];
    }
    return resolveScramble(ball, aimX, aimY, roster);
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || (effect && effect.kind === 'windup') || ball.stunRemain > 0) {
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
    const delay = chainWindup(slot);
    if (delay <= 0) {
      finishWindup(ball, slot, ball.facingX, ball.facingY, roster);
      return;
    }
    effect = {
      kind: 'windup',
      slot,
      remain: delay,
      aimX: ball.facingX,
      aimY: ball.facingY,
    };
  };

  const handleInput = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[] = []): void => {
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
        tryRelease(ball, sample, roster);
      } else if (cds[sample.skillPress - 1] <= 0 && !(effect && effect.kind === 'windup')) {
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample, roster);
    }
  };

  const applyAllyFly = (ball: BallBody, roster: readonly BallBody[]): void => {
    if (effect?.kind !== 'allyFly') {
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
      effect = null;
      return;
    }
    ball.vx = dir.x * CHAIN_TOW.flySpeed;
    ball.vy = dir.y * CHAIN_TOW.flySpeed;
    ball.facingX = dir.x;
    ball.facingY = dir.y;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
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
      return [];
    }

    const hits: CollisionHit[] = [];
    if (effect?.kind === 'windup') {
      effect.remain -= step;
      if (effect.remain <= TIME_EPS) {
        const { slot, aimX, aimY } = effect;
        effect = null;
        hits.push(...finishWindup(ball, slot, aimX, aimY, roster));
      }
    }

    applyAllyFly(ball, roster);
    return hits;
  };

  const afterPhysics = (ball: BallBody, _dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    if (!ball.inPlay) {
      effect = null;
      return [];
    }
    if (effect?.kind !== 'allyFly') {
      return [];
    }
    const fly = effect;
    const target = roster.find((other) => other.id === fly.targetId);
    if (!target || !target.inPlay) {
      effect = null;
      return [];
    }
    const dist = Math.hypot(target.x - ball.x, target.y - ball.y);
    if (dist <= ball.radius + target.radius + ARRIVE_PAD) {
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
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup' ? { slot: effect.slot, remain: effect.remain } : null,
    isHardBusy: () => effect?.kind === 'windup',
    isDisplacing: () => effect?.kind === 'allyFly',
    getHero: (): HeroId => 'chain',
  };
}
