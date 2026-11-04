import { applyEchoMark, createBallBody, type BallBody } from './ballBody';
import {
  applyCollisionCombat,
  collisionDamage,
  collisionThreshold,
  incomingFacing,
} from './collisionDamage';
import { grazeContactAngleDeg, isGrazeAngle, tryGrazeBlade } from './arcCombat';
import { FLOOR_SPEED, MAX_HP } from './constants';
import { ARC_GRAZE, ARC_MARK, ARC_PHASE, ARC_SIDESTEP, sideStepOffset } from '../heroes/arcKit';
import { CHAIN_HEAL } from '../heroes/chainKit';
import { nextHero } from '../heroes/heroIds';
import { HOOK_PULL } from '../heroes/hookKit';
import { NAIL_ARMOR } from '../heroes/nailKit';
import { RING_FIELD, RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { stepPhysics } from './physicsStep';
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
  redHero: 'arc' | 'hook' = 'arc',
): [BallBody, BallBody] {
  const a = createBallBody({
    x: x0,
    y: y0,
    color: 0xe24a4a,
    label: '红弧',
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

/** 闪弧四技能：侧移闪、擦伤窗/夹角/限频、标记额外伤、虚晃无碰撞与速度门、困圈禁位移。 */
export function verifyArc(): void {
  resetTrapZones();
  assert(ARC_SIDESTEP.cd === 7 && ARC_SIDESTEP.windup === 0.15 && ARC_SIDESTEP.dist === 2, '闪弧：侧移闪应为 CD7 / 前摇0.15 / 横移2');
  assert(ARC_GRAZE.cd === 9 && ARC_GRAZE.duration === 4 && ARC_GRAZE.damage === 11, '闪弧：擦伤刃应为 CD9 / 窗4s / 伤11');
  assert(ARC_GRAZE.minDeg === 60 && ARC_GRAZE.maxDeg === 120 && ARC_GRAZE.targetCd === 1, '闪弧：擦伤夹角 60–120、同目标 1s');
  assert(ARC_MARK.cd === 11 && ARC_MARK.windup === 0.25 && ARC_MARK.range === 5, '闪弧：标记应为 CD11 / 前摇0.25 / 距5');
  assert(ARC_MARK.duration === 6 && ARC_MARK.extra === 14, '闪弧：标记应为 6s / 额外14');
  assert(ARC_PHASE.cd === 14 && ARC_PHASE.duration === 2.4 && ARC_PHASE.minSpeed === 6, '闪弧：虚晃应为 CD14 / 2.4s / 结束速≥6');
  assert(ARC_PHASE.ramWindow === 0.2, '闪弧：虚晃达标后撞窗应为 0.2s');
  assert(nextHero('hook') === 'ring' && nextHero('ring') === 'chain', '闪弧：H 循环前段钩刺→磁环→链生');
  assert(nextHero('chain') === 'nail' && nextHero('nail') === 'arc', '闪弧：H 循环应接到钉壳再接到闪弧');
  assert(nextHero('arc') === 'well', '闪弧：H 循环闪弧后接到井绳');
  assert(Math.abs(grazeContactAngleDeg(8, 0, 1, 0)) < 1e-6, '闪弧：对撞夹角应为 0');
  assert(Math.abs(grazeContactAngleDeg(0, 8, 1, 0) - 90) < 1e-6, '闪弧：垂直相对速夹角应为 90');
  assert(isGrazeAngle(60) && isGrazeAngle(90) && isGrazeAngle(120), '闪弧：60/90/120 应算擦肩');
  assert(!isGrazeAngle(0) && !isGrazeAngle(45) && !isGrazeAngle(135), '闪弧：对撞/过斜不应算擦肩');

  const left = sideStepOffset(1, 0, 0, 1);
  const right = sideStepOffset(1, 0, 0, -1);
  assert(left.side === 'left' && Math.abs(left.y - ARC_SIDESTEP.dist) < 1e-6, '闪弧：朝右瞄上应左移 +y');
  assert(right.side === 'right' && Math.abs(right.y + ARC_SIDESTEP.dist) < 1e-6, '闪弧：朝右瞄下应右移 -y');

  resetTrapZones();
  const step = createSkillCaster('arc');
  const [stepRed] = redBlue(10, 6, 16, 6);
  fire(step, stepRed, 1, [stepRed], { aimX: 0, aimY: 1 });
  assert(step.getWindup()?.slot === 1, '闪弧：侧移闪应走 0.15s 前摇');
  assert(step.isDisplacing(), '闪弧：侧移闪前摇期间应为位移技');
  assert(Math.abs(step.getCds()[0] - ARC_SIDESTEP.cd) < 1e-6, '闪弧：侧移闪应进 7s CD');
  assert(Math.abs(stepRed.y - 6) < 1e-6, '闪弧：前摇未结束不应横移');
  advance(step, stepRed, [stepRed], ARC_SIDESTEP.windup + 0.02);
  assert(Math.abs(stepRed.y - 8) < 0.12, '闪弧：瞄上应向左横移约 2 格');
  assert(!step.isDisplacing(), '闪弧：侧移结束后应解除位移');

  resetTrapZones();
  const stepR = createSkillCaster('arc');
  const [stepRight] = redBlue(10, 6, 16, 6);
  fire(stepR, stepRight, 1, [stepRight], { aimX: 0, aimY: -1 });
  advance(stepR, stepRight, [stepRight], ARC_SIDESTEP.windup + 0.02);
  assert(Math.abs(stepRight.y - 4) < 0.12, '闪弧：瞄下应向右横移约 2 格');

  resetTrapZones();
  const graze = createSkillCaster('arc');
  const [grazeRed, grazeBlue] = redBlue(10, 6, 16, 6);
  fire(graze, grazeRed, 2, [grazeRed, grazeBlue]);
  assert(Math.abs(graze.getCds()[1] - ARC_GRAZE.cd) < 1e-6, '闪弧：擦伤刃应即放进 9s CD');
  assert(grazeRed.grazeRemain > ARC_GRAZE.duration - 0.05, '闪弧：擦伤刃应开持续窗');

  const headOn = tryGrazeBlade(grazeRed, grazeBlue, 8, 1, 0, 8, 0);
  assert(!headOn, '闪弧：对撞夹角 0 不应擦伤');
  const glance = tryGrazeBlade(grazeRed, grazeBlue, 7, 1, 0, 0, 7);
  assert(Math.abs((glance?.damage ?? 0) - ARC_GRAZE.damage) < 1e-6, '闪弧：夹角 90 且相对速达标应擦伤 11');
  const again = tryGrazeBlade(grazeRed, grazeBlue, 7, 1, 0, 0, 7);
  assert(!again, '闪弧：同目标 1s 内不应再擦伤');
  grazeRed.grazeLocks[0].remain = 0;
  const afterCd = tryGrazeBlade(grazeRed, grazeBlue, 7, 1, 0, 0, 7);
  assert(Math.abs((afterCd?.damage ?? 0) - ARC_GRAZE.damage) < 1e-6, '闪弧：间隔 1s 后应可再擦伤');

  resetTrapZones();
  const slow = createBallBody({ x: 10, y: 6, color: 0xe24a4a, team: 'red', hero: 'arc' });
  slow.grazeRemain = 2;
  const slowT = createBallBody({ x: 11, y: 6, color: 0x3d7cf0, team: 'blue' });
  const tooSlow = tryGrazeBlade(slow, slowT, 3, 1, 0, 0, 3);
  assert(!tooSlow, '闪弧：相对速度未达标不应擦伤');

  resetTrapZones();
  const [physRed, physBlue] = redBlue(10, 6, 10.15, 7);
  physRed.vx = 7;
  physRed.vy = 0;
  physRed.grazeRemain = 2;
  physBlue.vx = 0;
  physBlue.vy = 0;
  const before = physBlue.hp;
  applyCollisionCombat(physRed, physBlue, 0.148, 0.989, 7, 7, 0);
  assert(physBlue.hp < before - 10, '闪弧：碰撞路径上擦肩应扣擦伤');
  const facing = incomingFacing(physBlue.facingX, physBlue.facingY, -0.148, -0.989);
  const raw = collisionDamage(7, collisionThreshold(false), facing.coeff);
  assert(Math.abs(physBlue.hp - (before - raw - ARC_GRAZE.damage)) < 0.08, '闪弧：擦伤应叠在碰撞伤之上');

  resetTrapZones();
  const mark = createSkillCaster('arc');
  const [markRed, markBlue] = redBlue(8, 6, 11, 6);
  fire(mark, markRed, 3, [markRed, markBlue]);
  assert(mark.getWindup()?.slot === 3, '闪弧：标记回响应走 0.25s 前摇');
  assert(Math.abs(mark.getCds()[2] - ARC_MARK.cd) < 1e-6, '闪弧：标记回响应进 11s CD');
  advance(mark, markRed, [markRed, markBlue], 0.23);
  assert(markBlue.echoMarkRemain === 0, '闪弧：标记前摇未结束不应上印');
  advance(mark, markRed, [markRed, markBlue], 0.05);
  assert(markBlue.echoMarkRemain > ARC_MARK.duration - 0.1, '闪弧：距≤5 应上标记');

  const hpAfterMark = markBlue.hp;
  markRed.activeRamRemain = 0.25;
  markRed.vx = 5;
  markBlue.vx = -5;
  const ramHits = applyCollisionCombat(markRed, markBlue, 1, 0, 10, 10, 0);
  const bonus = ramHits.find((h) => Math.abs(h.damage - ARC_MARK.extra) < 1e-6);
  assert(!!bonus, '闪弧：标记后主动撞应额外 14');
  assert(markBlue.echoMarkRemain === 0, '闪弧：额外伤后应清标记');
  assert(markBlue.hp < hpAfterMark - 13, '闪弧：额外 14 应扣在目标上');

  resetTrapZones();
  const [markGRed, markGBlue] = redBlue(10, 6, 11.2, 6);
  applyEchoMark(markGBlue, ARC_MARK.duration, markGRed.id);
  markGRed.grazeRemain = 2;
  const grazeMark = applyCollisionCombat(markGRed, markGBlue, 1, 0, 7, 0, 7);
  const gHit = grazeMark.find((h) => Math.abs(h.damage - ARC_GRAZE.damage) < 1e-6);
  const mHit = grazeMark.find((h) => Math.abs(h.damage - ARC_MARK.extra) < 1e-6);
  assert(!!gHit && !!mHit, '闪弧：擦伤应能触发标记额外 14');
  assert(markGBlue.echoMarkRemain === 0, '闪弧：擦伤吃印后应清标记');

  resetTrapZones();
  const miss = createSkillCaster('arc');
  const [missRed, missBlue] = redBlue(8, 6, 16, 6);
  fire(miss, missRed, 3, [missRed, missBlue]);
  advance(miss, missRed, [missRed, missBlue], ARC_MARK.windup + 0.03);
  assert(missBlue.echoMarkRemain === 0, '闪弧：距>5 不应上标记');

  resetTrapZones();
  const phase = createSkillCaster('arc');
  const [phaseRed, phaseBlue] = redBlue(10, 6, 10.35, 6);
  phaseRed.vx = 7;
  phaseBlue.vx = -7;
  fire(phase, phaseRed, 4, [phaseRed, phaseBlue]);
  assert(Math.abs(phase.getCds()[3] - ARC_PHASE.cd) < 1e-6, '闪弧：虚晃应即放进 14s CD');
  assert(phase.isDisplacing(), '闪弧：虚晃应为位移技');
  assert(phaseRed.phaseRemain > ARC_PHASE.duration - 0.05, '闪弧：虚晃应开无碰撞窗');
  const hpPhase = phaseBlue.hp;
  advance(phase, phaseRed, [phaseRed, phaseBlue], 0.2);
  assert(phaseBlue.hp === hpPhase, '闪弧：虚晃期间球-球不应碰撞掉血');
  assert(phaseRed.phaseRemain > ARC_PHASE.duration - 0.25, '闪弧：0.2s 时虚晃应仍在');
  advance(phase, phaseRed, [phaseRed, phaseBlue], ARC_PHASE.duration - 0.2 + 0.03);
  assert(phaseRed.phaseRemain === 0, '闪弧：虚晃结束后应结束');
  assert(phaseRed.activeRamRemain > 0.1 && phaseRed.activeRamRemain <= ARC_PHASE.ramWindow + 1e-6, '闪弧：结束速度≥6 应开 0.2s 撞窗');

  resetTrapZones();
  const slowPhase = createSkillCaster('arc');
  const [slowRed] = redBlue(10, 6, 16, 6);
  slowRed.vx = 4;
  slowRed.vy = 0;
  fire(slowPhase, slowRed, 4, [slowRed]);
  advance(slowPhase, slowRed, [slowRed], ARC_PHASE.duration + 0.03);
  assert(slowRed.activeRamRemain === 0, '闪弧：结束速度<6 不应开撞窗');

  resetTrapZones();
  const trapStep = createSkillCaster('arc');
  const [trapRed] = redBlue(10, 6, 16, 6);
  dropTrapOn(trapRed);
  const y0 = trapRed.y;
  fire(trapStep, trapRed, 1, [trapRed], { aimX: 0, aimY: 1 });
  assert(Math.abs(trapStep.getCds()[0] - RING_TRAP.punishCd) < 0.05, '闪弧：困圈内侧移闪应失败并进 2s 短 CD');
  advance(trapStep, trapRed, [trapRed], 0.2);
  assert(Math.abs(trapRed.y - y0) < 1e-6, '闪弧：困圈内侧移闪不应横移');
  assert(!trapStep.isDisplacing(), '闪弧：困圈内侧移闪不应进入位移');

  resetTrapZones();
  const trapPhase = createSkillCaster('arc');
  const [trapP] = redBlue(10, 6, 16, 6);
  dropTrapOn(trapP);
  fire(trapPhase, trapP, 4, [trapP]);
  assert(Math.abs(trapPhase.getCds()[3] - RING_TRAP.punishCd) < 0.05, '闪弧：困圈内虚晃应失败并进 2s 短 CD');
  assert(trapP.phaseRemain === 0, '闪弧：困圈内虚晃不应进入无碰撞');
  assert(!trapPhase.isDisplacing(), '闪弧：困圈内虚晃不应进入位移');

  resetTrapZones();
  const grazeOk = createSkillCaster('arc');
  const [okRed] = redBlue(10, 6, 16, 6);
  dropTrapOn(okRed);
  fire(grazeOk, okRed, 2, [okRed]);
  assert(Math.abs(grazeOk.getCds()[1] - ARC_GRAZE.cd) < 1e-6, '闪弧：困圈内仍可放擦伤刃');
  assert(okRed.grazeRemain > 1.9, '闪弧：困圈内擦伤刃仍应开窗');

  resetTrapZones();
  const hookKeep = createSkillCaster('hook');
  const [hookRed, hookBlue] = redBlue(8, 6, 12, 6, 'hook');
  fire(hookKeep, hookRed, 1, [hookRed, hookBlue]);
  advance(hookKeep, hookRed, [hookRed, hookBlue], HOOK_PULL.windup + 0.03);
  assert(Math.abs(hookBlue.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, '闪弧：钩刺 kit 不应被拆坏');
  assert(Math.hypot(hookRed.vx, hookRed.vy) + 1e-6 >= FLOOR_SPEED - 0.2, '闪弧：钩刺勾飞仍可动');

  resetTrapZones();
  const ringKeep = createSkillCaster('ring');
  const ringRed = createBallBody({ x: 10, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'ring' });
  fire(ringKeep, ringRed, 1, [ringRed]);
  assert(Math.abs(ringKeep.getCds()[0] - RING_FIELD.cd) < 1e-6, '闪弧：磁环 kit 不应被拆坏');
  assert(ringRed.fieldRemain > RING_FIELD.duration - 0.05, '闪弧：磁环磁场仍应即放');

  resetTrapZones();
  const chainKeep = createSkillCaster('chain');
  const chainRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'chain' });
  fire(chainKeep, chainRed, 2, [chainRed]);
  assert(Math.abs(chainKeep.getCds()[1] - 12) < 1e-6, '闪弧：链生 kit 不应被拆坏');
  assert(chainRed.shieldRemain > 1.15, '闪弧：链生无友时护盾仍应仅罩自己');
  assert(CHAIN_HEAL.cd === 10, '闪弧：链生治疗链数值不应被改');

  resetTrapZones();
  const nailKeep = createSkillCaster('nail');
  const nailRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'nail', hp: 70 });
  fire(nailKeep, nailRed, 1, [nailRed]);
  assert(Math.abs(nailKeep.getCds()[0] - NAIL_ARMOR.cd) < 1e-6, '闪弧：钉壳 kit 不应被拆坏');
  assert(nailRed.armorRemain > 1.45, '闪弧：钉壳叠甲仍应即放');

  resetTrapZones();
}
