import {
  applyArmor,
  applyPin,
  applyReflectWindow,
  consumeAimBreak,
  openActiveRam,
  skillsBlocked,
  type BallBody,
} from './ballBody';
import type { CollisionHit } from './collisionDamage';
import type { HeroId } from '../heroes/heroIds';
import {
  NAIL_ARMOR,
  NAIL_PIN,
  NAIL_RAM,
  NAIL_THORN,
  nailIsDisplace,
  nailSkillCd,
  nailWindup,
} from '../heroes/nailKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { applyNailReflect, applyPinRamBonus } from './nailCombat';
import { applyHardCc, scaleHardCc } from './hardCc';
import { convoyBlocksSkillRelease } from './hookBrakeConvoy';
import type { SkillCaster, SkillCds, WindupInfo } from './skillCaster';
import { applySkillDamage } from './skillHits';
import { pickFanEnemy, unitVec } from './skillQuery';
import { setFacingFrom } from './skillStub';
import { isInEnemyTrap } from './trapZones';

const EPS = 1e-8;
const TIME_EPS = 1e-7;
const TOUCH_PAD = 0.12;

type Effect =
  | { kind: 'windup'; slot: SkillSlot; remain: number; aimX: number; aimY: number }
  | { kind: 'dash'; dirX: number; dirY: number; remainTime: number; remainDist: number; speed: number };

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

/** 钉壳施放：按下进瞄可无限持有；释放后才走前摇，再出效果。 */
export function createNailCaster(): SkillCaster {
  let aimingSlot: SkillSlot | 0 = 0;
  const cds = emptyCds();
  let effect: Effect | null = null;
  let now = 0;

  const startCd = (slot: SkillSlot): void => {
    cds[slot - 1] = nailSkillCd(slot);
  };

  const punishDisplace = (slot: SkillSlot): void => {
    cds[slot - 1] = RING_TRAP.punishCd;
    aimingSlot = 0;
    effect = null;
  };

  const blockedByTrap = (ball: BallBody, slot: SkillSlot): boolean => {
    return nailIsDisplace(slot) && isInEnemyTrap(ball);
  };

  const resolveArmor = (ball: BallBody): void => {
    applyArmor(ball, NAIL_ARMOR.mul, NAIL_ARMOR.duration);
  };

  const resolveThorn = (ball: BallBody): void => {
    applyReflectWindow(ball, NAIL_THORN.activeDamage, NAIL_THORN.activeWindow, true);
  };

  const startDash = (ball: BallBody, aimX: number, aimY: number): void => {
    const dir = unitVec(aimX, aimY);
    if (!dir) {
      return;
    }
    const speed = NAIL_RAM.dashDist / NAIL_RAM.dashTime;
    effect = {
      kind: 'dash',
      dirX: dir.x,
      dirY: dir.y,
      remainTime: NAIL_RAM.dashTime,
      remainDist: NAIL_RAM.dashDist,
      speed,
    };
    ball.vx = dir.x * speed;
    ball.vy = dir.y * speed;
    ball.allowOverCap = true;
    ball.frictionMul = 0;
    ball.suppressCombat = true;
  };

  const resolvePin = (
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
      (NAIL_PIN.fanDeg * Math.PI) / 360,
      NAIL_PIN.range,
      false,
    );
    if (!picked) {
      return [];
    }
    const lastAt = picked.target.lastHardCcAt;
    const dmg = scaleHardCc(NAIL_PIN.damage, lastAt, now);
    const scaled = applyHardCc(picked.target, NAIL_PIN.duration, now);
    picked.target.vx = 0;
    picked.target.vy = 0;
    applyPin(picked.target, scaled, ball.team);
    const hit = applySkillDamage(picked.target, ball, dmg);
    return hit ? [hit] : [];
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
      resolveArmor(ball);
      return [];
    }
    if (slot === 2) {
      resolveThorn(ball);
      return [];
    }
    if (slot === 3) {
      startDash(ball, aimX, aimY);
      return [];
    }
    return resolvePin(ball, aimX, aimY, roster);
  };

  const tryRelease = (ball: BallBody, sample: ActionSample, roster: readonly BallBody[]): void => {
    if (aimingSlot === 0 || (effect && effect.kind === 'windup') || skillsBlocked(ball)) {
      return;
    }
    if (effect && effect.kind === 'dash') {
      return;
    }
    const slot = aimingSlot;
    if (convoyBlocksSkillRelease(ball, slot)) {
      return;
    }
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
    const delay = nailWindup(slot);
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
      } else if (
        cds[sample.skillPress - 1] <= 0 &&
        !(effect && (effect.kind === 'windup' || effect.kind === 'dash'))
      ) {
        aimingSlot = sample.skillPress;
      }
    }
    if (sample.confirmRelease && aimingSlot !== 0) {
      tryRelease(ball, sample, roster);
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
      const dmg = applySkillDamage(touched, ball, NAIL_RAM.damage);
      if (dmg) {
        hits.push(dmg);
      }
      openActiveRam(ball);
      const extra = applyPinRamBonus(touched, ball);
      if (extra) {
        hits.push(extra);
      }
      const reflect = applyNailReflect(touched, ball, true);
      if (reflect) {
        hits.push(reflect);
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
      now = 0;
    },
    getAimingSlot: () => aimingSlot,
    getCds: () => [cds[0], cds[1], cds[2], cds[3]],
    getWindup: (): WindupInfo | null =>
      effect?.kind === 'windup' ? { slot: effect.slot, remain: effect.remain } : null,
    isHardBusy: () => !!effect && (effect.kind === 'windup' || effect.kind === 'dash'),
    isDisplacing: () => effect?.kind === 'dash',
    getHero: (): HeroId => 'nail',
  };
}
