import { applyArcOnCollision, consumeBladeVenom } from './arcCombat';
import { outgoingDamageMul, type BallBody } from './ballBody';
import { applyHpLoss } from './hpLoss';
import { applyNailReflect, applyPinRamBonus } from './nailCombat';
import {
  ACTIVE_RAM_SPEED_THRESHOLD,
  BALL_RADIUS,
  COLLISION_DAMAGE_CAP,
  COLLISION_DAMAGE_SCALE,
  COLLISION_SPEED_THRESHOLD,
  KNOCKBACK_FEEL_CAP,
  KNOCKBACK_SCALE,
  KNOCKBACK_SPEED_SPAN,
  SPEAR_TIP_CD,
  SPEAR_TIP_DIST,
  SPEAR_TIP_RADIUS,
} from './constants';

export type CollisionHit = {
  victimId: number;
  sourceId: number;
  victimLabel: string;
  sourceLabel: string;
  damage: number;
  knockback: number;
  relSpeed: number;
  threshold: number;
  /** 地裂矛阵等环境伤害：击破不计任何一方击杀 */
  environment?: boolean;
  /** 必杀直伤：不给施法者回充能量 */
  noUltCredit?: boolean;
};

const EPS = 1e-8;

export type SpearAim = Pick<BallBody, 'x' | 'y' | 'facingX' | 'facingY' | 'aimX' | 'aimY' | 'hasAim'>;
export type SpearVictim = Pick<BallBody, 'x' | 'y' | 'radius'>;

/** 擦伤刃等技能门槛；枪尖普攻不再读这个。 */
export function collisionThreshold(activeRam: boolean): number {
  return activeRam ? ACTIVE_RAM_SPEED_THRESHOLD : COLLISION_SPEED_THRESHOLD;
}

/** 枪尖方向：有瞄准跟 aim，否则跟 facing。与视觉矛尖一致。 */
export function spearAimDir(ball: SpearAim): { x: number; y: number } {
  if (ball.hasAim) {
    const len = Math.hypot(ball.aimX, ball.aimY);
    if (len >= EPS) {
      return { x: ball.aimX / len, y: ball.aimY / len };
    }
  }
  const facingLen = Math.hypot(ball.facingX, ball.facingY);
  if (facingLen < EPS) {
    return { x: 1, y: 0 };
  }
  return { x: ball.facingX / facingLen, y: ball.facingY / facingLen };
}

export function spearTipPos(ball: SpearAim): { x: number; y: number } {
  const dir = spearAimDir(ball);
  return {
    x: ball.x + dir.x * SPEAR_TIP_DIST,
    y: ball.y + dir.y * SPEAR_TIP_DIST,
  };
}

/** 攻击方枪尖小圆是否碰到受击方身体圆。 */
export function spearTipHitsBody(attacker: SpearAim, victim: SpearVictim): boolean {
  const tip = spearTipPos(attacker);
  const dist = Math.hypot(tip.x - victim.x, tip.y - victim.y);
  return dist <= victim.radius + SPEAR_TIP_RADIUS + EPS;
}

/** 枪尖普攻：6 × 相对速度标量，cap 28；伤≤0 不当命中。 */
export function collisionDamage(relSpeed: number): number {
  const raw = COLLISION_DAMAGE_SCALE * Math.max(0, relSpeed);
  if (raw <= 0) {
    return 0;
  }
  return Math.min(COLLISION_DAMAGE_CAP, raw);
}

export function knockbackSpeed(relSpeed: number): number {
  const t = Math.min(1, Math.max(0, relSpeed) / KNOCKBACK_SPEED_SPAN);
  if (t <= 0) {
    return 0;
  }
  return Math.min(KNOCKBACK_FEEL_CAP, KNOCKBACK_SCALE * t);
}

/** 满=可戳；冷却中从空涨到满。 */
export function spearCdFill(remain: number): number {
  if (remain <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, 1 - remain / SPEAR_TIP_CD));
}

function hitVictim(
  victim: BallBody,
  source: BallBody,
  knockNx: number,
  knockNy: number,
  relSpeed: number,
): CollisionHit | null {
  if (!spearTipHitsBody(source, victim)) {
    return null;
  }
  if (source.spearCdRemain > 0) {
    return null;
  }
  const shieldMul = victim.shieldRemain > 0 ? victim.shieldMul : 1;
  const armorMul = victim.armorRemain > 0 ? victim.armorMul : 1;
  const incoming = collisionDamage(relSpeed) * shieldMul * armorMul * outgoingDamageMul(source);
  if (incoming <= 0) {
    return null;
  }
  const shieldBefore = victim.potionShieldHp + victim.hookShoveShieldHp;
  const damage = applyHpLoss(victim, incoming);
  const absorbed = Math.max(0, shieldBefore - (victim.potionShieldHp + victim.hookShoveShieldHp));
  if (damage <= 0 && absorbed <= 0) {
    return null;
  }
  source.spearCdRemain = SPEAR_TIP_CD;
  const venom = consumeBladeVenom(source, victim);
  const total = damage + venom;
  if (victim.armorRemain > 0) {
    victim.armorBroken = true;
  }
  const kb = knockbackSpeed(relSpeed);
  victim.vx += knockNx * kb;
  victim.vy += knockNy * kb;
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage: total,
    knockback: kb,
    relSpeed,
    threshold: 0,
  };
}

/**
 * 枪尖戳中对方身体才掉血（单向，可互戳）；仅掉血时沿法线轻弹。
 * 身子圆碰圆仍由物理分离/弹开，无枪尖命中则不掉血。
 * 普攻 CD 中戳中不掉血、不进 CD。技能走独立通道，不受此 CD 限制。
 * nx, ny = 由 a 指向 b 的接触法线。
 */
export function applyCollisionCombat(
  a: BallBody,
  b: BallBody,
  nx: number,
  ny: number,
  relSpeed: number,
  _relVx = a.vx - b.vx,
  _relVy = a.vy - b.vy,
): CollisionHit[] {
  if (a.invincibleRemain > 0 || b.invincibleRemain > 0) {
    return [];
  }
  if (a.suppressCombat || b.suppressCombat) {
    return [];
  }
  if (a.team && b.team && a.team === b.team) {
    return [];
  }

  const hits: CollisionHit[] = [];
  const hitA = hitVictim(a, b, -nx, -ny, relSpeed);
  const hitB = hitVictim(b, a, nx, ny, relSpeed);
  if (hitA) {
    hits.push(hitA);
  }
  if (hitB) {
    hits.push(hitB);
  }
  const aRammed = b.activeRamRemain > 0;
  const bRammed = a.activeRamRemain > 0;
  if (hitA) {
    const extra = applyPinRamBonus(a, b);
    if (extra) {
      hits.push(extra);
    }
    const reflect = applyNailReflect(a, b, aRammed);
    if (reflect) {
      hits.push(reflect);
    }
  }
  if (hitB) {
    const extra = applyPinRamBonus(b, a);
    if (extra) {
      hits.push(extra);
    }
    const reflect = applyNailReflect(b, a, bRammed);
    if (reflect) {
      hits.push(reflect);
    }
  }
  hits.push(...applyArcOnCollision(a, b));
  return hits;
}

/** 锁点公式自检：启动时跑一遍，避免枪尖门闩 / 伤害 / 弹开 / CD 算错。 */
export function selfCheckCollisionDamage(): void {
  if (collisionDamage(8) !== COLLISION_DAMAGE_CAP) {
    throw new Error('碰撞伤害：相对速度 8 应 cap 28');
  }
  if (collisionDamage(16) !== COLLISION_DAMAGE_CAP) {
    throw new Error('碰撞伤害：应 cap 28');
  }
  if (collisionDamage(3) !== 18) {
    throw new Error('碰撞伤害：相对速度 3 应为 18，无门槛');
  }
  if (collisionDamage(0) !== 0 || collisionDamage(-1) !== 0) {
    throw new Error('碰撞伤害：相对速度≤0 不当命中');
  }
  const kb = knockbackSpeed(16);
  if (Math.abs(kb - KNOCKBACK_SCALE) > 1e-6) {
    throw new Error('弹开：满额应只按速度顶在 2.0，不再乘朝向');
  }
  if (SPEAR_TIP_CD !== 1.5) {
    throw new Error('枪尖 CD：应为 1.5s，不是 1s 或 2s');
  }
  if (spearCdFill(0) !== 1 || spearCdFill(SPEAR_TIP_CD) !== 0) {
    throw new Error('枪尖 CD：满=可戳，刚进 CD 应为空');
  }
  if (Math.abs(spearCdFill(SPEAR_TIP_CD * 0.5) - 0.5) > 1e-6) {
    throw new Error('枪尖 CD：冷却中应从空涨到满');
  }
  const stabber = {
    x: 0,
    y: 0,
    facingX: 1,
    facingY: 0,
    aimX: 1,
    aimY: 0,
    hasAim: false,
  };
  const frontBody = { x: 2 * BALL_RADIUS, y: 0, radius: BALL_RADIUS };
  const sideBody = { x: 0, y: 2 * BALL_RADIUS, radius: BALL_RADIUS };
  if (!spearTipHitsBody(stabber, frontBody)) {
    throw new Error('枪尖：正对接触应戳中身体');
  }
  if (spearTipHitsBody(stabber, sideBody)) {
    throw new Error('枪尖：侧身圆蹭不应算枪尖命中');
  }
  const aimer = { ...stabber, hasAim: true, aimX: 0, aimY: 1 };
  if (!spearTipHitsBody(aimer, sideBody) || spearTipHitsBody(aimer, frontBody)) {
    throw new Error('枪尖：有瞄准时应跟 aim，不跟 facing');
  }
}
