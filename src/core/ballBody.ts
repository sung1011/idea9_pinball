import type { HeroId } from '../heroes/heroIds';
import { ACTIVE_RAM_WINDOW, BALL_RADIUS, FINE_TUNE_WINDOW, MAX_HP } from './constants';

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
  /** 主动撞窗口剩余秒数；>0 时碰撞按主动撞阈值结算 */
  activeRamRemain: number;
  /** 碰撞后强拧窗口剩余秒数；窗内 120°/s，否则全程弱拧 45°/s */
  fineTuneRemain: number;
  /** 目标方向（Aim）；矛尖用 */
  aimX: number;
  aimY: number;
  hasAim: boolean;
  /** 未设则不算组队（M2 公式球仍可互伤） */
  team?: TeamId;
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
    fineTuneRemain: 0,
    aimX: init.facingX ?? 1,
    aimY: init.facingY ?? 0,
    hasAim: false,
    team: init.team,
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
  };
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
