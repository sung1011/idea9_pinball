import { createBallBody, type BallBody } from './ballBody';
import { FLOOR_SPEED, MAX_HP } from './constants';
import { ARC_SIDESTEP } from '../heroes/arcKit';
import { CHAIN_HEAL } from '../heroes/chainKit';
import { nextHero } from '../heroes/heroIds';
import { HOOK_PULL } from '../heroes/hookKit';
import { NAIL_ARMOR } from '../heroes/nailKit';
import { RING_FIELD, RING_TRAP } from '../heroes/ringKit';
import {
  WELL_HOOK,
  WELL_REEL,
  WELL_STAKE,
  WELL_SWAP,
  dropSpeedOneTier,
  nextSpeedTier,
} from '../heroes/wellKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { stepPhysics } from './physicsStep';
import { getStake, listStakes, placeStake, resetStakes } from './ropeStakes';
import { createSkillCaster } from './skillCaster';
import { resetTrapZones, setTrapZone } from './trapZones';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function sample(partial: Partial<ActionSample>): ActionSample {
  return {
    aimX: 1,
    aimY: 0,
    hasAim: true,
    steerAim: true,
    skillPress: 0,
    confirmRelease: false,
    cancelAim: false,
    ...partial,
  };
}

function redBlue(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  redHero: 'well' | 'hook' | 'arc' = 'well',
): [BallBody, BallBody] {
  const a = createBallBody({
    x: x0,
    y: y0,
    color: 0xe24a4a,
    label: '红井',
    team: 'red',
    facingX: 1,
    facingY: 0,
    hero: redHero,
  });
  const b = createBallBody({
    x: x1,
    y: y1,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
    facingX: -1,
    facingY: 0,
    hero: 'hook',
  });
  return [a, b];
}

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  slot: SkillSlot,
  roster: readonly BallBody[] = [],
  extra: Partial<ActionSample> = {},
): void {
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
}

function lockThenFire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  extra: Partial<ActionSample> = {},
): void {
  caster.handleInput(ball, sample({ skillPress: 1, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: 1, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: 1, ...extra }), roster);
}

function play(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  dt: number,
): void {
  caster.tick(ball, dt, roster);
  const phys = stepPhysics(roster, dt);
  caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id));
}

function advance(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  sec: number,
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    play(caster, ball, roster, dt);
    left -= dt;
  }
}

function dropTrapOn(ball: BallBody): void {
  setTrapZone({
    ownerId: 9000 + ball.id,
    ownerTeam: ball.team === 'red' ? 'blue' : 'red',
    x: ball.x,
    y: ball.y,
    radius: RING_TRAP.radius,
    remain: RING_TRAP.duration,
  });
}

/** 井绳四技能：双钩两段瞄、换位、桩反弹/撞窗、收索沿线定身 2s，以及困圈禁位移。 */
export function verifyWell(): void {
  resetTrapZones();
  resetStakes();
  assert(WELL_HOOK.cd === 10 && WELL_HOOK.windup === 0.4 && WELL_HOOK.lockRange === 6, '井绳：双钩应为 CD10 / 前摇0.4 / 锁敌6');
  assert(WELL_HOOK.landRange === 5 && WELL_HOOK.damage === 8 && WELL_HOOK.landSpeed === 9, '井绳：双钩应为落点5 / 伤8 / 落地速9');
  assert(WELL_SWAP.cd === 16 && WELL_SWAP.windup === 0.45 && WELL_SWAP.range === 5, '井绳：换位应为 CD16 / 前摇0.45 / 距5');
  assert(WELL_SWAP.damage === 5 && WELL_SWAP.speedKeep === 0.5, '井绳：换位应为伤5 / 速度50%');
  assert(WELL_STAKE.cd === 12 && WELL_STAKE.windup === 0.3 && WELL_STAKE.range === 6, '井绳：弹索桩应为 CD12 / 前摇0.3 / 距6');
  assert(WELL_STAKE.duration === 7, '井绳：弹索桩应持续 7s');
  assert(WELL_REEL.cd === 9 && WELL_REEL.width === 1 && WELL_REEL.damage === 6, '井绳：收索应为 CD9 / 宽1 / 伤6');
  assert(WELL_REEL.duration === 2, '井绳：收索硬根应为 2s（超出旧硬控 0.6s 上限）');
  assert(nextHero('hook') === 'ring' && nextHero('ring') === 'chain', '井绳：H 循环前段钩刺→磁环→链生');
  assert(nextHero('chain') === 'nail' && nextHero('nail') === 'arc', '井绳：H 循环应接到钉壳再接到闪弧');
  assert(nextHero('arc') === 'well' && nextHero('well') === 'hook', '井绳：H 循环闪弧→井绳→钩刺');
  assert(nextSpeedTier(9) === 8 && nextSpeedTier(8) === 5, '井绳：9 降到 8、8 降到 5');
  assert(nextSpeedTier(5) === FLOOR_SPEED && nextSpeedTier(2.5) === 0.4, '井绳：5 降到保底、保底降到爬行');
  const tierBall = { vx: 8, vy: 0 };
  dropSpeedOneTier(tierBall);
  assert(Math.abs(tierBall.vx - 5) < 1e-6, '井绳：降速一档 8→5');

  resetTrapZones();
  resetStakes();
  const miss = createSkillCaster('well');
  const [missRed, missBlue] = redBlue(8, 6, 16, 6);
  fire(miss, missRed, 1, [missRed, missBlue], { pointerX: 8, pointerY: 10, hasPointer: true });
  assert(miss.getCds()[0] === 0, '井绳：双钩未锁敌不应进 CD');
  assert(miss.getAimingSlot() === 1, '井绳：双钩未锁敌应留在瞄准');
  assert(miss.getAimHint?.()?.stage !== 2, '井绳：未锁敌不应进入第二段');

  resetTrapZones();
  resetStakes();
  const hook = createSkillCaster('well');
  const [hookRed, hookBlue] = redBlue(8, 6, 12, 6);
  hookRed.vx = 0;
  hookRed.vy = 0;
  hookBlue.vx = 0;
  hookBlue.vy = 0;
  hook.handleInput(hookRed, sample({ skillPress: 1, pointerX: 8, pointerY: 10, hasPointer: true }), [
    hookRed,
    hookBlue,
  ]);
  hook.handleInput(hookRed, sample({ skillPress: 1, pointerX: 8, pointerY: 10, hasPointer: true }), [
    hookRed,
    hookBlue,
  ]);
  assert(hook.getAimingSlot() === 1, '井绳：双钩第一段确认后应仍瞄准');
  assert(hook.getCds()[0] === 0, '井绳：双钩锁定后、落点确认前不应进 CD');
  assert(hook.getAimHint?.()?.stage === 2, '井绳：锁敌后应进入第二段瞄落点');
  hook.handleInput(hookRed, sample({ skillPress: 1, pointerX: 8, pointerY: 10, hasPointer: true }), [
    hookRed,
    hookBlue,
  ]);
  assert(hook.getWindup()?.slot === 1, '井绳：双钩应走 0.4s 前摇');
  assert(Math.abs(hook.getCds()[0] - WELL_HOOK.cd) < 1e-6, '井绳：双钩应进 10s CD');
  assert(hook.isDisplacing(), '井绳：双钩前摇期间应为位移技');
  assert(Math.abs(hookRed.x - 8) < 1e-6 && Math.abs(hookRed.y - 6) < 1e-6, '井绳：前摇未结束不应起飞');
  hook.tick(hookRed, WELL_HOOK.windup + 0.01, [hookRed, hookBlue]);
  assert(Math.abs(hookBlue.hp - (MAX_HP - WELL_HOOK.damage)) < 1e-6, '井绳：双钩应打 A 8 伤');
  assert(Math.abs(hookBlue.x - 10.5858) < 0.08 && Math.abs(hookBlue.y - 7.4142) < 0.08, '井绳：A 应轻拉向 A–B 中点约 2 格');
  advance(hook, hookRed, [hookRed, hookBlue], 0.28);
  assert(Math.abs(hookRed.x - 8) < 0.35 && Math.abs(hookRed.y - 10) < 0.45, '井绳：自己应飞向落点 B');
  assert(Math.abs(Math.hypot(hookRed.vx, hookRed.vy) - WELL_HOOK.landSpeed) < 1.4, '井绳：落地速度应约 9');

  resetTrapZones();
  resetStakes();
  const swap = createSkillCaster('well');
  const [swapRed, swapBlue] = redBlue(8, 6, 12, 6);
  swapRed.vx = 6;
  swapRed.vy = 0;
  swapBlue.vx = -4;
  swapBlue.vy = 2;
  fire(swap, swapRed, 2, [swapRed, swapBlue]);
  assert(swap.getWindup()?.slot === 2, '井绳：换位应走 0.45s 前摇');
  assert(Math.abs(swap.getCds()[1] - WELL_SWAP.cd) < 1e-6, '井绳：换位应进 16s CD');
  assert(swap.isDisplacing(), '井绳：换位前摇期间应为位移技');
  swap.tick(swapRed, WELL_SWAP.windup + 0.01, [swapRed, swapBlue]);
  assert(Math.abs(swapRed.x - 12) < 0.12 && Math.abs(swapBlue.x - 8) < 0.12, '井绳：换位应交换位置');
  assert(Math.abs(swapRed.vx + 2) < 1e-6 && Math.abs(swapRed.vy - 1) < 1e-6, '井绳：自己应拿到对方速度的 50%');
  assert(Math.abs(swapBlue.vx - 3) < 1e-6 && Math.abs(swapBlue.vy) < 1e-6, '井绳：对方应拿到自己速度的 50%');
  assert(Math.abs(swapBlue.hp - (MAX_HP - WELL_SWAP.damage)) < 1e-6, '井绳：换位应打 5 伤');

  resetTrapZones();
  resetStakes();
  const stake = createSkillCaster('well');
  const [stakeRed] = redBlue(8, 6, 16, 6);
  fire(stake, stakeRed, 3, [stakeRed], { pointerX: 12, pointerY: 6, hasPointer: true });
  assert(stake.getWindup()?.slot === 3, '井绳：弹索桩应走 0.3s 前摇');
  assert(Math.abs(stake.getCds()[2] - WELL_STAKE.cd) < 1e-6, '井绳：弹索桩应进 12s CD');
  advance(stake, stakeRed, [stakeRed], WELL_STAKE.windup + 0.02);
  const peg = getStake(stakeRed.id);
  assert(!!peg && Math.abs(peg.x - 12) < 0.05 && Math.abs(peg.y - 6) < 0.05, '井绳：应在落点投出桩');
  assert(peg !== null && peg.remain > 4.6, '井绳：桩应持续约 5s');
  placeStake(stakeRed, 14, 6);
  assert(listStakes().length === 1, '井绳：同时仅 1 桩');
  assert(Math.abs((getStake(stakeRed.id)?.x ?? 0) - 14) < 1e-6, '井绳：新桩应替换旧桩');

  resetTrapZones();
  resetStakes();
  const bounce = createSkillCaster('well');
  const [bounceRed, bounceAlly] = redBlue(8, 6, 16, 6);
  bounceAlly.team = 'red';
  bounceAlly.hero = 'hook';
  fire(bounce, bounceRed, 3, [bounceRed, bounceAlly], { pointerX: 11, pointerY: 6, hasPointer: true });
  advance(bounce, bounceRed, [bounceRed, bounceAlly], WELL_STAKE.windup + 0.02);
  bounceAlly.x = 10.1;
  bounceAlly.y = 6;
  bounceAlly.vx = 6;
  bounceAlly.vy = 0;
  bounceAlly.activeRamRemain = 0;
  const ramBefore = bounceAlly.activeRamRemain;
  advance(bounce, bounceRed, [bounceRed, bounceAlly], 0.2);
  assert(bounceAlly.vx < 0, '井绳：己方撞桩应按壁反弹');
  assert(bounceAlly.activeRamRemain > ramBefore, '井绳：己方撞桩应开 0.25s 主动撞窗');

  resetTrapZones();
  resetStakes();
  const enemyHit = createSkillCaster('well');
  const [hitRed, hitBlue] = redBlue(8, 6, 16, 6);
  fire(enemyHit, hitRed, 3, [hitRed, hitBlue], { pointerX: 11, pointerY: 6, hasPointer: true });
  advance(enemyHit, hitRed, [hitRed, hitBlue], WELL_STAKE.windup + 0.02);
  hitBlue.x = 10.1;
  hitBlue.y = 6;
  hitBlue.vx = 6;
  hitBlue.vy = 0;
  hitBlue.activeRamRemain = 0;
  advance(enemyHit, hitRed, [hitRed, hitBlue], 0.2);
  assert(hitBlue.vx < 0, '井绳：敌方撞桩也应反弹');
  assert(hitBlue.activeRamRemain === 0, '井绳：敌方撞桩不应开主动撞窗');

  resetTrapZones();
  resetStakes();
  const noReel = createSkillCaster('well');
  const [noReelRed] = redBlue(8, 6, 16, 6);
  fire(noReel, noReelRed, 4, [noReelRed]);
  assert(noReel.getCds()[3] === 0, '井绳：无桩时收索不应进 CD');

  resetTrapZones();
  resetStakes();
  const reel = createSkillCaster('well');
  const [reelRed, reelBlue] = redBlue(8, 6, 10, 6);
  placeStake(reelRed, 14, 6);
  reelBlue.vx = 8;
  reelBlue.vy = 0;
  const reelX = reelBlue.x;
  const reelY = reelBlue.y;
  fire(reel, reelRed, 4, [reelRed, reelBlue]);
  assert(Math.abs(reel.getCds()[3] - WELL_REEL.cd) < 1e-6, '井绳：收索应进 9s CD');
  assert(Math.abs(reelBlue.hp - (MAX_HP - WELL_REEL.damage)) < 1e-6, '井绳：收索应打 6 伤');
  assert(Math.abs(reelBlue.x - reelX) < 1e-6 && Math.abs(reelBlue.y - reelY) < 1e-6, '井绳：收索不应再轻拉位移');
  assert(Math.abs(reelBlue.vx) < 1e-6 && Math.abs(reelBlue.vy) < 1e-6, '井绳：收索应将速度归零');
  assert(reelBlue.stunRemain > 1.95 && reelBlue.pinRemain > 1.95, '井绳：收索应上 2s 硬根');
  assert(reelBlue.pinLocked, '井绳：收索应锁定位（不能自行离开）');
  const rooted = createSkillCaster('hook');
  rooted.handleInput(reelBlue, sample({ skillPress: 1, aimX: -1, aimY: 0 }), [reelRed, reelBlue]);
  assert(rooted.getAimingSlot() === 0, '井绳：定身期间不能进瞄/放技能');
  reelBlue.vx = 8;
  play(reel, reelRed, [reelRed, reelBlue], 1 / 60);
  assert(Math.abs(reelBlue.x - reelX) < 1e-6 && Math.abs(reelBlue.y - reelY) < 1e-6, '井绳：定身 2s 内不能离开钉点');
  assert(Math.abs(reelBlue.vx) < 1e-6 && Math.abs(reelBlue.vy) < 1e-6, '井绳：定身应持续把速度打回 0');
  const rammer = createBallBody({
    x: 9.05,
    y: 6,
    color: 0x3d7cf0,
    label: '撞',
    team: 'blue',
    facingX: 1,
    vx: 8,
    hero: 'hook',
  });
  play(reel, reelRed, [reelRed, reelBlue, rammer], 1 / 60);
  assert(Math.abs(reelBlue.x - reelX) < 1e-6 && Math.abs(reelBlue.y - reelY) < 1e-6, '井绳：定身仍可碰撞但自己不离开');
  assert(rammer.vx < 8, '井绳：定身目标仍可被撞到并弹开对方');
  advance(reel, reelRed, [reelRed, reelBlue], 1.85);
  assert(reelBlue.stunRemain > 0 && reelBlue.pinRemain > 0, '井绳：2s 硬根在约 1.9s 时仍应在');
  advance(reel, reelRed, [reelRed, reelBlue], 0.25);
  assert(reelBlue.stunRemain === 0 && reelBlue.pinRemain === 0 && !reelBlue.pinLocked, '井绳：2s 后应解开定身');

  resetTrapZones();
  resetStakes();
  const missLine = createSkillCaster('well');
  const [lineRed, lineBlue] = redBlue(8, 6, 11, 7.2);
  placeStake(lineRed, 14, 6);
  const hpLine = lineBlue.hp;
  fire(missLine, lineRed, 4, [lineRed, lineBlue]);
  assert(lineBlue.hp === hpLine, '井绳：线外敌人不应被收索');

  resetTrapZones();
  resetStakes();
  const trapHook = createSkillCaster('well');
  const [trapH, trapHb] = redBlue(8, 6, 12, 6);
  dropTrapOn(trapH);
  const hx = trapH.x;
  const hy = trapH.y;
  lockThenFire(trapHook, trapH, [trapH, trapHb], { pointerX: 8, pointerY: 10, hasPointer: true });
  assert(Math.abs(trapHook.getCds()[0] - RING_TRAP.punishCd) < 0.05, '井绳：困圈内双钩应失败并进 2s 短 CD');
  trapHook.tick(trapH, 0.5, [trapH, trapHb]);
  assert(Math.abs(trapH.x - hx) < 1e-6 && Math.abs(trapH.y - hy) < 1e-6, '井绳：困圈内双钩不应起飞');
  assert(!trapHook.isDisplacing(), '井绳：困圈内双钩不应进入位移');

  resetTrapZones();
  resetStakes();
  const trapSwap = createSkillCaster('well');
  const [trapS, trapSb] = redBlue(8, 6, 12, 6);
  dropTrapOn(trapS);
  fire(trapSwap, trapS, 2, [trapS, trapSb]);
  assert(Math.abs(trapSwap.getCds()[1] - RING_TRAP.punishCd) < 0.05, '井绳：困圈内换位应失败并进 2s 短 CD');
  assert(Math.abs(trapS.x - 8) < 1e-6 && Math.abs(trapSb.x - 12) < 1e-6, '井绳：困圈内换位不应交换位置');

  resetTrapZones();
  resetStakes();
  const trapStake = createSkillCaster('well');
  const [trapP] = redBlue(8, 6, 16, 6);
  dropTrapOn(trapP);
  fire(trapStake, trapP, 3, [trapP], { pointerX: 12, pointerY: 6, hasPointer: true });
  assert(Math.abs(trapStake.getCds()[2] - WELL_STAKE.cd) < 1e-6, '井绳：困圈内仍可投桩');
  advance(trapStake, trapP, [trapP], WELL_STAKE.windup + 0.03);
  assert(!!getStake(trapP.id), '井绳：困圈内桩仍应落下');

  resetTrapZones();
  resetStakes();
  const hookKeep = createSkillCaster('hook');
  const [hookK, hookKb] = redBlue(8, 6, 12, 6, 'hook');
  fire(hookKeep, hookK, 1, [hookK, hookKb]);
  advance(hookKeep, hookK, [hookK, hookKb], HOOK_PULL.windup + 0.03);
  assert(Math.abs(hookKb.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, '井绳：钩刺 kit 不应被拆坏');
  assert(Math.hypot(hookK.vx, hookK.vy) + 1e-6 >= FLOOR_SPEED - 0.2, '井绳：钩刺勾飞仍可动');

  resetTrapZones();
  resetStakes();
  const ringKeep = createSkillCaster('ring');
  const ringRed = createBallBody({ x: 10, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'ring' });
  fire(ringKeep, ringRed, 1, [ringRed]);
  assert(Math.abs(ringKeep.getCds()[0] - RING_FIELD.cd) < 1e-6, '井绳：磁环 kit 不应被拆坏');
  assert(ringRed.fieldRemain > RING_FIELD.duration - 0.05, '井绳：磁环磁场仍应即放');

  resetTrapZones();
  resetStakes();
  const chainKeep = createSkillCaster('chain');
  const chainRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'chain' });
  fire(chainKeep, chainRed, 2, [chainRed]);
  assert(Math.abs(chainKeep.getCds()[1] - 12) < 1e-6, '井绳：链生 kit 不应被拆坏');
  assert(chainRed.shieldRemain > 1.15, '井绳：链生无友时护盾仍应仅罩自己');
  assert(CHAIN_HEAL.cd === 10, '井绳：链生治疗链数值不应被改');

  resetTrapZones();
  resetStakes();
  const nailKeep = createSkillCaster('nail');
  const nailRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'nail', hp: 70 });
  fire(nailKeep, nailRed, 1, [nailRed]);
  assert(Math.abs(nailKeep.getCds()[0] - NAIL_ARMOR.cd) < 1e-6, '井绳：钉壳 kit 不应被拆坏');
  assert(nailRed.armorRemain > 1.45, '井绳：钉壳叠甲仍应即放');

  resetTrapZones();
  resetStakes();
  const arcKeep = createSkillCaster('arc');
  const [arcRed] = redBlue(10, 6, 16, 6, 'arc');
  fire(arcKeep, arcRed, 1, [arcRed], { aimX: 0, aimY: 1 });
  advance(arcKeep, arcRed, [arcRed], ARC_SIDESTEP.windup + 0.02);
  assert(Math.abs(arcRed.y - 8) < 0.12, '井绳：闪弧侧移闪仍应横移约 2 格');

  resetTrapZones();
  resetStakes();
}
