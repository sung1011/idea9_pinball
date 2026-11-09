import type { HeroId } from '../heroes/heroIds';
import type { CollisionHit } from './collisionDamage';
import {
  ACTIVE_RAM_WINDOW,
  BALL_RADIUS,
  FINE_TUNE_WINDOW,
  FLOOR_SPEED,
  MAX_HP,
  POTION_DAMAGE_MUL,
  POTION_SPEED_CAP,
  SPEED_CAP,
} from './constants';
import { applyHpLoss } from './hpLoss';

let nextBallId = 1;

export type TeamId = 'red' | 'blue';

export type BallBody = {
  id: number;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  radius: number;
  color: number;
  hp: number;
  maxHp: number;
  /** 主动撞窗口剩余秒数；>0 时技能门槛/钉壳加成等按主动撞结算 */
  activeRamRemain: number;
  /** 枪尖普攻 CD 剩余秒数；>0 时戳中不掉血、不刷新 CD */
  spearCdRemain: number;
  /** 碰撞后强拧窗口剩余秒数；窗内 120°/s，否则全程弱拧 45°/s */
  fineTuneRemain: number;
  /** 目标方向（Aim）；矛尖用 */
  aimX: number;
  aimY: number;
  hasAim: boolean;
  /** 未设则不算组队（M2 公式球仍可互伤） */
  team?: TeamId;
  /** 本队第几人（生成序，从 1 起；换英雄不换号） */
  teamSlot: number;
  inPlay: boolean;
  invincibleRemain: number;
  spawnX: number;
  spawnY: number;
  /** 硬直剩余秒数；>0 时不能进瞄/放技能，朝向冻结 */
  stunRemain: number;
  /** 最近一次硬控时间戳（技能施放器时钟）；用于 1.5s 衰减 */
  lastHardCcAt: number;
  /** 本帧摩擦倍率；急停×10，位移技飞行中为 0 */
  frictionMul: number;
  /** 技能超速（10/11/12）期间不盖帽，掉回上限后自动关 */
  allowOverCap: boolean;
  /** 冲刺等技能自己结算命中时，跳过本帧碰撞伤害避免双算 */
  suppressCombat: boolean;
  /** 英雄 kit；默认钩刺 */
  hero: HeroId;
  /** 粘壁：撞墙不反弹，沿切向滑 */
  slideWalls: boolean;
  /** 磁场剩余秒数；>0 时身周圈可见 */
  fieldRemain: number;
  /** 治疗链 HOT 剩余秒数；>0 时每秒回血 */
  healRemain: number;
  healDps: number;
  /** HOT 实际回血归属；-1 表示无施法者（不记治疗榜） */
  healSourceId: number;
  /** 愈链对敌 DoT 剩余秒数；>0 时每秒掉血 */
  burnRemain: number;
  burnDps: number;
  burnSourceId: number;
  /** 护盾脉冲剩余秒数；>0 时碰撞伤乘 shieldMul */
  shieldRemain: number;
  shieldMul: number;
  /** 盾脉贴附吸血剩余秒数 */
  leechRemain: number;
  leechTargetId: number;
  /** 打断短瞄准：施放器下帧清空 */
  aimBreak: boolean;
  /** 沉默剩余秒数；>0 时不能进瞄/放技能，仍可滑/可撞 */
  silenceRemain: number;
  /** 叠甲剩余秒数；>0 时碰撞伤乘 armorMul */
  armorRemain: number;
  armorMul: number;
  armorBroken: boolean;
  /** 反击刺反伤窗剩余秒数；>0 且 reflectArmed 时首次被撞反伤 */
  reflectRemain: number;
  reflectDamage: number;
  reflectOnce: boolean;
  reflectArmed: boolean;
  /** 定锚剩余秒数；>0 时跳过保底拉回。未锁定位时仍可被推，位移≥1 断钉 */
  pinRemain: number;
  pinX: number;
  pinY: number;
  pinnedByTeam?: TeamId;
  /** 硬根：速度归零并钉在 pinX/pinY，不能自行离开，仍可碰撞 */
  pinLocked: boolean;
  /** 擦伤刃窗口剩余秒数 */
  grazeRemain: number;
  grazeLocks: Array<{ id: number; remain: number }>;
  /** 标记回响剩余秒数；>0 时下一次主动撞/擦伤额外伤 */
  echoMarkRemain: number;
  echoMarkSourceId: number;
  /** 虚晃无碰撞剩余秒数 */
  phaseRemain: number;
  /** 折光剩余秒数；>0 时受到的伤害 ×0.5，减免差额入反照账本 */
  refractRemain: number;
  /** 反照账本：只记折光实际减免与裂镜自伤 */
  mirrorLedger: number;
  /** 伤害药水：枪尖与技能伤害 ×1.5 */
  potionDamageRemain: number;
  /** 加速药水：移速上限 8→10 */
  potionSpeedRemain: number;
  /** 护盾药水剩余秒；吸收量见 potionShieldHp */
  potionShieldRemain: number;
  potionShieldHp: number;
  /** 必杀能量 0–100；死亡保留、换英雄/重开清空 */
  ultEnergy: number;
  /** 未换成能量的有效伤害+治疗余量 */
  ultCombatCredit: number;
};

export function createBallBody(init: {
  x: number;
  y: number;
  color: number;
  label?: string;
  vx?: number;
  vy?: number;
  facingX?: number;
  facingY?: number;
  hp?: number;
  team?: TeamId;
  teamSlot?: number;
  spawnX?: number;
  spawnY?: number;
  hero?: HeroId;
}): BallBody {
  const id = nextBallId;
  nextBallId += 1;
  return {
    id,
    label: init.label ?? `球${id}`,
    x: init.x,
    y: init.y,
    vx: init.vx ?? 0,
    vy: init.vy ?? 0,
    facingX: init.facingX ?? 1,
    facingY: init.facingY ?? 0,
    radius: BALL_RADIUS,
    color: init.color,
    hp: init.hp ?? MAX_HP,
    maxHp: MAX_HP,
    activeRamRemain: 0,
    spearCdRemain: 0,
    fineTuneRemain: 0,
    aimX: init.facingX ?? 1,
    aimY: init.facingY ?? 0,
    hasAim: false,
    team: init.team,
    teamSlot: Math.max(1, Math.floor(init.teamSlot ?? 1)),
    inPlay: true,
    invincibleRemain: 0,
    spawnX: init.spawnX ?? init.x,
    spawnY: init.spawnY ?? init.y,
    stunRemain: 0,
    lastHardCcAt: -1e9,
    frictionMul: 1,
    allowOverCap: false,
    suppressCombat: false,
    hero: init.hero ?? 'hook',
    slideWalls: false,
    fieldRemain: 0,
    healRemain: 0,
    healDps: 0,
    healSourceId: -1,
    burnRemain: 0,
    burnDps: 0,
    burnSourceId: -1,
    shieldRemain: 0,
    shieldMul: 1,
    leechRemain: 0,
    leechTargetId: -1,
    aimBreak: false,
    silenceRemain: 0,
    armorRemain: 0,
    armorMul: 1,
    armorBroken: false,
    reflectRemain: 0,
    reflectDamage: 0,
    reflectOnce: false,
    reflectArmed: false,
    pinRemain: 0,
    pinX: 0,
    pinY: 0,
    pinnedByTeam: undefined,
    pinLocked: false,
    grazeRemain: 0,
    grazeLocks: [],
    echoMarkRemain: 0,
    echoMarkSourceId: -1,
    phaseRemain: 0,
    refractRemain: 0,
    mirrorLedger: 0,
    potionDamageRemain: 0,
    potionSpeedRemain: 0,
    potionShieldRemain: 0,
    potionShieldHp: 0,
    ultEnergy: 0,
    ultCombatCredit: 0,
  };
}

export function outgoingDamageMul(source: BallBody): number {
  return source.potionDamageRemain > 0 ? POTION_DAMAGE_MUL : 1;
}

export function speedCapOf(ball: BallBody): number {
  return ball.potionSpeedRemain > 0 ? POTION_SPEED_CAP : SPEED_CAP;
}

export function floorSpeedOf(ball: BallBody): number {
  if (ball.potionSpeedRemain <= 0) {
    return FLOOR_SPEED;
  }
  return FLOOR_SPEED * (POTION_SPEED_CAP / SPEED_CAP);
}

export function clearPotionBuffs(ball: BallBody): void {
  ball.potionDamageRemain = 0;
  ball.potionSpeedRemain = 0;
  ball.potionShieldRemain = 0;
  ball.potionShieldHp = 0;
}

export function tickPotionBuffs(ball: BallBody, dt: number): void {
  const step = Math.max(0, dt);
  if (ball.potionDamageRemain > 0) {
    ball.potionDamageRemain = Math.max(0, ball.potionDamageRemain - step);
  }
  if (ball.potionSpeedRemain > 0) {
    ball.potionSpeedRemain = Math.max(0, ball.potionSpeedRemain - step);
  }
  if (ball.potionShieldRemain > 0) {
    ball.potionShieldRemain = Math.max(0, ball.potionShieldRemain - step);
    if (ball.potionShieldRemain <= 0) {
      ball.potionShieldHp = 0;
    }
  }
}

export function openActiveRam(ball: BallBody): void {
  ball.activeRamRemain = ACTIVE_RAM_WINDOW;
}

export function tickActiveRam(ball: BallBody, dt: number): void {
  if (ball.activeRamRemain <= 0) {
    ball.activeRamRemain = 0;
    return;
  }
  ball.activeRamRemain = Math.max(0, ball.activeRamRemain - dt);
}

export function tickSpearCd(ball: BallBody, dt: number): void {
  if (ball.spearCdRemain <= 0) {
    ball.spearCdRemain = 0;
    return;
  }
  ball.spearCdRemain = Math.max(0, ball.spearCdRemain - Math.max(0, dt));
}

export function openFineTune(ball: BallBody): void {
  ball.fineTuneRemain = FINE_TUNE_WINDOW;
}

export function tickFineTune(ball: BallBody, dt: number): void {
  if (ball.fineTuneRemain <= 0) {
    ball.fineTuneRemain = 0;
    return;
  }
  ball.fineTuneRemain = Math.max(0, ball.fineTuneRemain - dt);
}

export function tickInvincible(ball: BallBody, dt: number): void {
  if (ball.invincibleRemain <= 0) {
    ball.invincibleRemain = 0;
    return;
  }
  ball.invincibleRemain = Math.max(0, ball.invincibleRemain - dt);
}

export function grantInvincible(ball: BallBody, sec: number): void {
  ball.invincibleRemain = Math.max(ball.invincibleRemain, sec);
}

export function tickStun(ball: BallBody, dt: number): void {
  if (ball.stunRemain <= 0) {
    ball.stunRemain = 0;
    return;
  }
  ball.stunRemain = Math.max(0, ball.stunRemain - dt);
}

export function applyHealHot(ball: BallBody, dps: number, duration: number, sourceId = -1): void {
  ball.healDps = dps;
  ball.healRemain = Math.max(ball.healRemain, duration);
  if (sourceId >= 0) {
    ball.healSourceId = sourceId;
  }
}

export function applyBurn(ball: BallBody, dps: number, duration: number, sourceId: number): void {
  ball.burnDps = dps;
  ball.burnRemain = Math.max(ball.burnRemain, duration);
  ball.burnSourceId = sourceId;
}

export function clearBurn(ball: BallBody): void {
  ball.burnRemain = 0;
  ball.burnDps = 0;
  ball.burnSourceId = -1;
}

export function applyShield(ball: BallBody, mul: number, duration: number): void {
  ball.shieldMul = mul;
  ball.shieldRemain = Math.max(ball.shieldRemain, duration);
}

/** 按原公式回血，返回本段实际增加的 HP（满血为 0）。 */
export function tickHeal(ball: BallBody, dt: number): number {
  if (ball.healRemain <= 0) {
    ball.healRemain = 0;
    ball.healDps = 0;
    return 0;
  }
  const step = Math.min(Math.max(0, dt), ball.healRemain);
  let gained = 0;
  if (ball.inPlay && ball.healDps > 0) {
    const before = ball.hp;
    ball.hp = Math.min(ball.maxHp, ball.hp + ball.healDps * step);
    gained = ball.hp - before;
  }
  ball.healRemain = Math.max(0, ball.healRemain - step);
  if (ball.healRemain <= 0) {
    ball.healDps = 0;
    ball.healSourceId = -1;
  }
  return gained;
}

export function tickBurn(ball: BallBody, dt: number, source: BallBody | undefined): CollisionHit | null {
  if (ball.burnRemain <= 0) {
    clearBurn(ball);
    return null;
  }
  const step = Math.min(Math.max(0, dt), ball.burnRemain);
  let hit: CollisionHit | null = null;
  if (ball.inPlay && ball.burnDps > 0 && source && source.inPlay) {
    const applied = applyHpLoss(ball, ball.burnDps * step * outgoingDamageMul(source));
    if (applied > 0) {
      hit = {
        victimId: ball.id,
        sourceId: source.id,
        victimLabel: ball.label,
        sourceLabel: source.label,
        damage: applied,
        knockback: 0,
        relSpeed: 0,
        threshold: 0,
      };
    }
  }
  ball.burnRemain = Math.max(0, ball.burnRemain - step);
  if (ball.burnRemain <= 0) {
    clearBurn(ball);
  }
  return hit;
}

export function tickShield(ball: BallBody, dt: number): void {
  if (ball.shieldRemain <= 0) {
    ball.shieldRemain = 0;
    ball.shieldMul = 1;
    return;
  }
  ball.shieldRemain = Math.max(0, ball.shieldRemain - Math.max(0, dt));
  if (ball.shieldRemain <= 0) {
    ball.shieldMul = 1;
  }
}

export function consumeAimBreak(ball: BallBody): boolean {
  if (!ball.aimBreak) {
    return false;
  }
  ball.aimBreak = false;
  return true;
}

export function applySilence(ball: BallBody, duration: number): void {
  ball.silenceRemain = Math.max(ball.silenceRemain, duration);
  ball.aimBreak = true;
}

export function tickSilence(ball: BallBody, dt: number): void {
  if (ball.silenceRemain <= 0) {
    ball.silenceRemain = 0;
    return;
  }
  ball.silenceRemain = Math.max(0, ball.silenceRemain - Math.max(0, dt));
}

/** 硬直或沉默时不能进瞄 / 放技能。 */
export function skillsBlocked(ball: BallBody): boolean {
  return ball.stunRemain > 0 || ball.silenceRemain > 0;
}

export function applyArmor(ball: BallBody, mul: number, duration: number): void {
  ball.armorMul = mul;
  ball.armorRemain = Math.max(ball.armorRemain, duration);
  ball.armorBroken = false;
}

export function clearArmor(ball: BallBody): void {
  ball.armorRemain = 0;
  ball.armorMul = 1;
  ball.armorBroken = false;
}

export function tickArmor(ball: BallBody, dt: number, onIntactEnd?: (ball: BallBody) => void): void {
  if (ball.armorRemain <= 0) {
    ball.armorRemain = 0;
    ball.armorMul = 1;
    return;
  }
  const step = Math.min(Math.max(0, dt), ball.armorRemain);
  ball.armorRemain = Math.max(0, ball.armorRemain - step);
  if (ball.armorRemain > 0) {
    return;
  }
  const broken = ball.armorBroken;
  ball.armorMul = 1;
  ball.armorBroken = false;
  if (!broken && ball.inPlay) {
    onIntactEnd?.(ball);
  }
}

export function applyReflectWindow(
  ball: BallBody,
  damage: number,
  duration: number,
  once: boolean,
): void {
  ball.reflectDamage = damage;
  ball.reflectRemain = Math.max(ball.reflectRemain, duration);
  ball.reflectOnce = once;
  ball.reflectArmed = true;
}

export function clearReflect(ball: BallBody): void {
  ball.reflectRemain = 0;
  ball.reflectDamage = 0;
  ball.reflectOnce = false;
  ball.reflectArmed = false;
}

export function tickReflect(ball: BallBody, dt: number): void {
  if (ball.reflectRemain <= 0) {
    clearReflect(ball);
    return;
  }
  ball.reflectRemain = Math.max(0, ball.reflectRemain - Math.max(0, dt));
  if (ball.reflectRemain <= 0) {
    clearReflect(ball);
  }
}

export function applyPin(
  ball: BallBody,
  duration: number,
  team: TeamId | undefined,
  locked = false,
): void {
  ball.pinRemain = Math.max(ball.pinRemain, duration);
  ball.pinX = ball.x;
  ball.pinY = ball.y;
  ball.pinnedByTeam = team;
  if (locked) {
    ball.pinLocked = true;
  }
}

export function clearPin(ball: BallBody): void {
  ball.pinRemain = 0;
  ball.pinnedByTeam = undefined;
  ball.pinLocked = false;
}

export function tickPin(ball: BallBody, dt: number, breakDist: number): void {
  if (ball.pinRemain <= 0) {
    clearPin(ball);
    return;
  }
  if (ball.pinLocked) {
    ball.x = ball.pinX;
    ball.y = ball.pinY;
    ball.vx = 0;
    ball.vy = 0;
  } else {
    const moved = Math.hypot(ball.x - ball.pinX, ball.y - ball.pinY);
    if (moved + 1e-9 >= breakDist) {
      ball.stunRemain = 0;
      clearPin(ball);
      return;
    }
  }
  ball.pinRemain = Math.max(0, ball.pinRemain - Math.max(0, dt));
  if (ball.pinRemain <= 0) {
    clearPin(ball);
  }
}

export function applyEchoMark(ball: BallBody, duration: number, sourceId: number): void {
  ball.echoMarkRemain = Math.max(ball.echoMarkRemain, duration);
  ball.echoMarkSourceId = sourceId;
}

export function clearEchoMark(ball: BallBody): void {
  ball.echoMarkRemain = 0;
  ball.echoMarkSourceId = -1;
}

export function tickEchoMark(ball: BallBody, dt: number): void {
  if (ball.echoMarkRemain <= 0) {
    clearEchoMark(ball);
    return;
  }
  ball.echoMarkRemain = Math.max(0, ball.echoMarkRemain - Math.max(0, dt));
  if (ball.echoMarkRemain <= 0) {
    clearEchoMark(ball);
  }
}

export function tickGraze(ball: BallBody, dt: number): void {
  const step = Math.max(0, dt);
  if (ball.grazeRemain > 0) {
    ball.grazeRemain = Math.max(0, ball.grazeRemain - step);
  }
  if (ball.grazeLocks.length === 0) {
    return;
  }
  ball.grazeLocks = ball.grazeLocks.filter((lock) => {
    lock.remain -= step;
    return lock.remain > 1e-9;
  });
}

export function clearGraze(ball: BallBody): void {
  ball.grazeRemain = 0;
  ball.grazeLocks.length = 0;
}

export function applyRefract(ball: BallBody, duration: number): void {
  ball.refractRemain = Math.max(ball.refractRemain, duration);
}

export function tickRefract(ball: BallBody, dt: number): void {
  if (ball.refractRemain <= 0) {
    ball.refractRemain = 0;
    return;
  }
  ball.refractRemain = Math.max(0, ball.refractRemain - Math.max(0, dt));
}

export function clearKitAuras(ball: BallBody): void {
  ball.slideWalls = false;
  ball.fieldRemain = 0;
  ball.healRemain = 0;
  ball.healDps = 0;
  ball.healSourceId = -1;
  clearBurn(ball);
  ball.shieldRemain = 0;
  ball.shieldMul = 1;
  ball.leechRemain = 0;
  ball.leechTargetId = -1;
  ball.aimBreak = false;
  ball.silenceRemain = 0;
  clearArmor(ball);
  clearReflect(ball);
  clearPin(ball);
  clearEchoMark(ball);
  clearGraze(ball);
  ball.phaseRemain = 0;
  ball.refractRemain = 0;
  ball.mirrorLedger = 0;
}
