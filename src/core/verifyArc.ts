import { applyEchoMark, createBallBody, type BallBody } from './ballBody';
import { applyCollisionCombat, collisionDamage } from './collisionDamage';
import { BALL_RADIUS, FLOOR_SPEED, MAX_HP, SPEAR_TIP_CD } from './constants';
import { ARC_GRAZE, ARC_MARK, ARC_PHASE, ARC_SIDESTEP, behindEnemyPos } from '../heroes/arcKit';
import { CHAIN_FAIL_CD, CHAIN_HEAL, CHAIN_SHIELD } from '../heroes/chainKit';
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

/** 闪弧四技能：侧闪贴背、掠刃荼毒枪尖+6、标记额外伤、虚晃无碰撞与速度门、困圈禁位移。 */
export function verifyArc(): void {
  resetTrapZones();
  assert(ARC_SIDESTEP.cd === 7 && ARC_SIDESTEP.windup === 0.15, '闪弧：侧闪应为 CD7 / 前摇0.15');
  assert(ARC_SIDESTEP.fanDeg === 40 && ARC_SIDESTEP.range === 6, '闪弧：侧闪应为扇 40° / 距 6');
  assert(ARC_SIDESTEP.failCd === 2, '闪弧：侧闪无目标短 CD 应为 2s');
  assert(ARC_GRAZE.cd === 9 && ARC_GRAZE.duration === 8 && ARC_GRAZE.extra === 6, '闪弧：掠刃应为 CD9 / 荼毒 8s / +6');
  assert(ARC_MARK.cd === 11 && ARC_MARK.windup === 0.25 && ARC_MARK.range === 5, '闪弧：标记应为 CD11 / 前摇0.25 / 距5');
  assert(ARC_MARK.duration === 6 && ARC_MARK.extra === 14, '闪弧：标记应为 6s / 额外14');
  assert(ARC_PHASE.cd === 14 && ARC_PHASE.duration === 2.4 && ARC_PHASE.minSpeed === 6, '闪弧：虚晃应为 CD14 / 2.4s / 结束速≥6');
  assert(ARC_PHASE.ramWindow === 0.2, '闪弧：虚晃达标后撞窗应为 0.2s');
  assert(nextHero('hook') === 'ring' && nextHero('ring') === 'chain', '闪弧：英雄循环前段钩刺→磁环→链生');
  assert(nextHero('chain') === 'nail' && nextHero('nail') === 'arc', '闪弧：英雄循环应接到钉壳再接到闪弧');
  assert(nextHero('arc') === 'well', '闪弧：英雄循环闪弧后接到井绳');

  const behind = behindEnemyPos(12, 6, -1, 0, BALL_RADIUS, BALL_RADIUS);
  assert(Math.abs(behind.x - (12 + BALL_RADIUS + BALL_RADIUS + ARC_SIDESTEP.behindPad)) < 1e-6, '闪弧：贴背应在敌朝向反侧短距');
  assert(behind.faceX < 0 && Math.abs(behind.faceY) < 1e-6, '闪弧：贴背后应朝向敌人');

  resetTrapZones();
  const step = createSkillCaster('arc');
  const [stepRed, stepBlue] = redBlue(10, 6, 13, 6);
  stepBlue.facingX = -1;
  stepBlue.facingY = 0;
  fire(step, stepRed, 1, [stepRed, stepBlue], { aimX: 1, aimY: 0 });
  assert(step.getWindup()?.slot === 1, '闪弧：侧闪应走 0.15s 前摇');
  assert(step.isDisplacing(), '闪弧：侧闪前摇期间应为位移技');
  assert(Math.abs(step.getCds()[0] - ARC_SIDESTEP.cd) < 1e-6, '闪弧：侧闪应进 7s CD');
  assert(Math.abs(stepRed.x - 10) < 1e-6, '闪弧：前摇未结束不应瞬移');
  advance(step, stepRed, [stepRed, stepBlue], ARC_SIDESTEP.windup + 0.02);
  const expectBehind = behindEnemyPos(stepBlue.x, stepBlue.y, stepBlue.facingX, stepBlue.facingY, stepRed.radius, stepBlue.radius);
  assert(Math.abs(stepRed.x - expectBehind.x) < 0.2, '闪弧：侧闪应瞬移到敌背后');
  assert(stepRed.facingX < 0, '闪弧：侧闪落地后应朝向敌人');
  assert(!step.isDisplacing(), '闪弧：侧闪结束后应解除位移');

  resetTrapZones();
  const missStep = createSkillCaster('arc');
  const [flashMiss] = redBlue(10, 6, 16, 6);
  const missY = flashMiss.y;
  fire(missStep, flashMiss, 1, [flashMiss], { aimX: 0, aimY: 1 });
  assert(Math.abs(missStep.getCds()[0] - ARC_SIDESTEP.failCd) < 1e-6, '闪弧：侧闪无目标应进 2s 短 CD');
  assert(!missStep.getWindup(), '闪弧：侧闪无目标不应走前摇');
  assert(Math.abs(flashMiss.y - missY) < 1e-6, '闪弧：侧闪无目标不应位移');

  resetTrapZones();
  const graze = createSkillCaster('arc');
  const [grazeRed, grazeBlue] = redBlue(10 - BALL_RADIUS * 1.1, 6, 10 + BALL_RADIUS * 1.1, 6);
  fire(graze, grazeRed, 2, [grazeRed, grazeBlue]);
  assert(Math.abs(graze.getCds()[1] - ARC_GRAZE.cd) < 1e-6, '闪弧：掠刃应即放进 9s CD');
  assert(grazeRed.grazeRemain > ARC_GRAZE.duration - 0.05, '闪弧：掠刃应给自己荼毒 8s');

  grazeRed.vx = 8;
  grazeBlue.vx = -8;
  const before = grazeBlue.hp;
  const hits = applyCollisionCombat(grazeRed, grazeBlue, 1, 0, 16);
  const raw = collisionDamage(16);
  const spear = hits.find((h) => h.victimId === grazeBlue.id);
  assert(!!spear, '闪弧：荼毒下枪尖仍应成功掉血');
  assert(Math.abs((spear?.damage ?? 0) - (raw + ARC_GRAZE.extra)) < 1e-6, '闪弧：成功枪尖应 +6');
  assert(Math.abs(grazeBlue.hp - (before - raw - ARC_GRAZE.extra)) < 0.08, '闪弧：荼毒加伤应加在那一次戳上');
  assert(grazeRed.grazeRemain === 0, '闪弧：触发后应清毒');
  assert(grazeRed.spearCdRemain > SPEAR_TIP_CD - 0.05, '闪弧：荼毒加伤仍走枪尖 1.5s CD');

  resetTrapZones();
  const [cdRed, cdBlue] = redBlue(10 - BALL_RADIUS * 1.1, 6, 10 + BALL_RADIUS * 1.1, 6);
  cdRed.grazeRemain = 8;
  cdRed.spearCdRemain = 0.5;
  cdRed.vx = 8;
  cdBlue.vx = -8;
  const blockedHp = cdBlue.hp;
  applyCollisionCombat(cdRed, cdBlue, 1, 0, 16);
  assert(Math.abs(cdBlue.hp - blockedHp) < 1e-6, '闪弧：枪尖 CD 中不应掉血也不吃荼毒');
  assert(cdRed.grazeRemain > 7.9, '闪弧：枪尖 CD 中不应消耗荼毒');

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
  const [markGRed, markGBlue] = redBlue(10, 6, 10 + BALL_RADIUS * 2.2, 6);
  applyEchoMark(markGBlue, ARC_MARK.duration, markGRed.id);
  markGRed.grazeRemain = 2;
  markGRed.activeRamRemain = 0;
  applyCollisionCombat(markGRed, markGBlue, 1, 0, 7, 0, 7);
  assert(markGBlue.echoMarkRemain > 0, '闪弧：荼毒本身不应触发回印');

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
  assert(Math.abs(grazeOk.getCds()[1] - ARC_GRAZE.cd) < 1e-6, '闪弧：困圈内仍可放掠刃');
  assert(okRed.grazeRemain > 7.9, '闪弧：困圈内掠刃仍应上荼毒');

  resetTrapZones();
  const hookKeep = createSkillCaster('hook');
  const [hookRed, hookBlue] = redBlue(8, 6, 13, 6, 'hook');
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
  const chainBlue = createBallBody({ x: 11, y: 6, color: 0x3d7cf0, team: 'blue', facingX: -1, hero: 'hook' });
  fire(chainKeep, chainRed, 2, [chainRed, chainBlue]);
  assert(Math.abs(chainKeep.getCds()[1] - CHAIN_SHIELD.cd) < 1e-6, '闪弧：链生 kit 不应被拆坏');
  assert(chainRed.leechRemain > CHAIN_SHIELD.duration - 0.1, '闪弧：链生盾脉仍应贴敌吸血');
  assert(CHAIN_HEAL.cd === 10 && CHAIN_FAIL_CD === 2, '闪弧：链生愈链数值不应被改');

  resetTrapZones();
  const nailKeep = createSkillCaster('nail');
  const nailRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'nail', hp: 70 });
  fire(nailKeep, nailRed, 1, [nailRed]);
  assert(Math.abs(nailKeep.getCds()[0] - NAIL_ARMOR.cd) < 1e-6, '闪弧：钉壳 kit 不应被拆坏');
  assert(nailRed.armorRemain > 1.45, '闪弧：钉壳叠甲仍应即放');

  resetTrapZones();
}
