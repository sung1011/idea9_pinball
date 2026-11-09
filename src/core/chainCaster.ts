import {
  applyBurn,
  applyHealHot,
  applySilence,
  consumeAimBreak,
  skillsBlocked,
  type BallBody,
} from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  CHAIN_FAIL_CD,
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
import {
  pickEnemiesInRange,
  pickFanAllyOrEnemy,
  pickNearestAllyOrEnemy,
  pickNearestEnemy,
  unitVec,
} from './skillQuery';
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

function sameTeam(a: BallBody, b: BallBody): boolean {
  return !!a.team && !!b.team && a.team === b.team;
}

function stickTo(caster: BallBody, target: BallBody, ox: number, oy: number): void {
  caster.x = target.x + ox;
  caster.y = target.y + oy;
  caster.vx = target.vx;
  caster.vy = target.vy;
  const dir = unitVec(target.x - caster.x, target.y - caster.y);
  if (dir) {
    caster.facingX = dir.x;
    caster.facingY = dir.y;
  }
  resolveArenaObstacles(caster);
}

function bindOffset(caster: BallBody, target: BallBody): { x: number; y: number } {
  const dx = caster.x - target.x;
  const dy = caster.y - target.y;
  const dist = Math.hypot(dx, dy);
  const gap = caster.radius + target.radius;
  if (dist < TIME_EPS) {
    const face = unitVec(target.facingX, target.facingY) ?? { x: 1, y: 0 };
    return { x: face.x * gap, y: face.y * gap };
  }
  const s = gap / dist;
  return { x: dx * s, y: dy * s };
}

/** 链生施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createChainCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let leechRemain = 0;
  let leechTargetId = -1;
  let leechOffX = 0;
  let leechOffY = 0;

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = chainSkillCd(slot);
  };

  const failShort = (slot: SkillSlot): void => {
    cds[slot - 1] = CHAIN_FAIL_CD;
    aimingSlot = 0;
    if (effect?.kind === 'windup') {
      effect = null;
    }
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return chainIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const clearLeech = (ball?: BallBody, roster: readonly BallBody[] = []): void => {
    if (ball) {
      ball.leechRemain = 0;
      ball.leechTargetId = -1;
      ball.healRemain = 0;
      ball.healDps = 0;
    }
    const bound = roster.find((item) => item.id === leechTargetId);
    if (bound) {
      bound.leechRemain = 0;
    }
    leechRemain = 0;
    leechTargetId = -1;
    leechOffX = 0;
    leechOffY = 0;
  };

  const resolveHeal = (ball: BallBody, aimX: number, aimY: number, roster: readonly BallBody[]): boolean => {
    const dir = unitVec(aimX, aimY) ?? { x: ball.facingX, y: ball.facingY };
    const picked = pickFanAllyOrEnemy(
      ball,
      roster,
      dir.x,
      dir.y,
      (CHAIN_HEAL.fanDeg * Math.PI) / 360,
      CHAIN_HEAL.range,
    );
    if (!picked) {
      return false;
    }
    if (sameTeam(ball, picked.target)) {
      applyHealHot(picked.target, CHAIN_HEAL.dps, CHAIN_HEAL.duration, ball.id);
    } else {
      applyBurn(picked.target, CHAIN_HEAL.dps, CHAIN_HEAL.duration, ball.id);
    }
    return true;
  };

  const startLeech = (ball: BallBody, target: BallBody): void => {
    const off = bindOffset(ball, target);
    leechRemain = CHAIN_SHIELD.duration;
    leechTargetId = target.id;
    leechOffX = off.x;
    leechOffY = off.y;
    ball.leechRemain = leechRemain;
    ball.leechTargetId = target.id;
    target.leechRemain = leechRemain;
    applyHealHot(ball, CHAIN_SHIELD.dps, CHAIN_SHIELD.duration, ball.id);
    ball.suppressCombat = true;
    stickTo(ball, target, leechOffX, leechOffY);
  };

  const resolveShield = (ball: BallBody, roster: readonly BallBody[]): boolean => {
    const picked = pickNearestEnemy(ball, roster, CHAIN_SHIELD.range);
    if (!picked) {
      return false;
    }
    startLeech(ball, picked.target);
    return true;
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

  const knockEnemy = (ball: BallBody, enemy: BallBody): void => {
    const dir = unitVec(enemy.x - ball.x, enemy.y - ball.y);
    if (!dir) {
      return;
    }
    enemy.vx = dir.x * CHAIN_TOW.knockback;
    enemy.vy = dir.y * CHAIN_TOW.knockback;
    enemy.allowOverCap = true;
  };

  const resolveTow = (ball: BallBody, roster: readonly BallBody[]): boolean => {
    const picked = pickNearestAllyOrEnemy(ball, roster, CHAIN_TOW.range);
    if (!picked) {
      return false;
    }
    if (!sameTeam(ball, picked.target)) {
      knockEnemy(ball, picked.target);
      return true;
    }
    const low = picked.target.hp < picked.target.maxHp * CHAIN_TOW.lowHpRatio;
    if (low) {
      pullAlly(ball, picked.target);
      return true;
    }
    const gap = Math.hypot(picked.target.x - ball.x, picked.target.y - ball.y);
    const touch = ball.radius + picked.target.radius;
    if (gap <= touch + ARRIVE_PAD) {
      return true;
    }
    effect = { kind: 'allyFly', targetId: picked.target.id };
    return true;
  };

  const resolveScramble = (ball: BallBody, roster: readonly BallBody[]): void => {
    for (const picked of pickEnemiesInRange(ball, roster, CHAIN_SCRAMBLE.range)) {
      applySilence(picked.target, CHAIN_SCRAMBLE.duration);
    }
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
      if (!resolveHeal(ball, aimX, aimY, roster)) {
        failShort(slot);
      }
      return [];
    }
    if (slot === 2) {
      if (!resolveShield(ball, roster)) {
        failShort(slot);
      }
      return [];
    }
    if (slot === 3) {
      if (!resolveTow(ball, roster)) {
        failShort(slot);
      }
      return [];
    }
    resolveScramble(ball, roster);
    return [];
  };

  const hasTarget = (
    ball: BallBody,
    slot: SkillSlot,
    aimX: number,
    aimY: number,
    roster: readonly BallBody[],
  ): boolean => {
    if (slot === 1) {
      return !!pickFanAllyOrEnemy(
        ball,
        roster,
        aimX,
        aimY,
        (CHAIN_HEAL.fanDeg * Math.PI) / 360,
        CHAIN_HEAL.range,
      );
    }
    if (slot === 2) {
      return !!pickNearestEnemy(ball, roster, CHAIN_SHIELD.range);
    }
    if (slot === 3) {
      return !!pickNearestAllyOrEnemy(ball, roster, CHAIN_TOW.range);
    }
    return true;
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || (effect && effect.kind === 'windup') || skillsBlocked(ball)) {
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
    if (!hasTarget(ball, slot, ball.facingX, ball.facingY, roster)) {
      failShort(slot);
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

  const tickLeech = (ball: BallBody, dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    if (leechRemain <= 0) {
      ball.leechRemain = 0;
      return [];
    }
    const target = roster.find((item) => item.id === leechTargetId);
    if (!target || !target.inPlay) {
      clearLeech(ball, roster);
      return [];
    }
    const step = Math.min(dt, leechRemain);
    const hits: CollisionHit[] = [];
    const dmg = applySkillDamage(target, ball, CHAIN_SHIELD.dps * step);
    if (dmg) {
      hits.push(dmg);
    }
    leechRemain = Math.max(0, leechRemain - step);
    ball.leechRemain = leechRemain;
    ball.leechTargetId = leechTargetId;
    target.leechRemain = leechRemain;
    ball.frictionMul = 0;
    ball.suppressCombat = true;
    if (leechRemain <= TIME_EPS) {
      clearLeech(ball, roster);
    }
    return hits;
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
      clearLeech(ball, roster);
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
    hits.push(...tickLeech(ball, step, roster));
    return hits;
  };

  const afterPhysics = (ball: BallBody, _dt: number, roster: readonly BallBody[]): CollisionHit[] => {
    if (!ball.inPlay) {
      effect = null;
      clearLeech(ball, roster);
      return [];
    }
    if (leechRemain > 0) {
      const target = roster.find((item) => item.id === leechTargetId);
      if (!target || !target.inPlay) {
        clearLeech(ball, roster);
        return [];
      }
      stickTo(ball, target, leechOffX, leechOffY);
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
      leechRemain = 0;
      leechTargetId = -1;
      leechOffX = 0;
      leechOffY = 0;
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup' ? { slot: effect.slot, remain: effect.remain } : null,
    isHardBusy: () => effect?.kind === 'windup',
    isDisplacing: () => effect?.kind === 'allyFly' || leechRemain > 0,
    getHero: (): HeroId => 'chain',
  };
}
