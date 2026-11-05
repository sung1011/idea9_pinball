import { createBallBody, tickBurn, tickHeal, tickShield, tickSilence, type BallBody } from './ballBody';
import { FLOOR_SPEED, MAX_HP } from './constants';
import { CHAIN_FAIL_CD, CHAIN_HEAL, CHAIN_SCRAMBLE, CHAIN_SHIELD, CHAIN_TOW } from '../heroes/chainKit';
import { HOOK_PULL } from '../heroes/hookKit';
import { RING_FIELD } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { stepPhysics } from './physicsStep';
import { createSkillCaster } from './skillCaster';
import { resetTrapZones } from './trapZones';

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

function redAllyBlue(
  x0: number,
  y0: number,
  xAlly: number,
  yAlly: number,
  x1: number,
  y1: number,
): [BallBody, BallBody, BallBody] {
  const a = createBallBody({
    x: x0,
    y: y0,
    color: 0xe24a4a,
    label: '红链',
    team: 'red',
    facingX: 1,
    facingY: 0,
    hero: 'chain',
  });
  const ally = createBallBody({
    x: xAlly,
    y: yAlly,
    color: 0xc43d3d,
    label: '红友',
    team: 'red',
    facingX: 1,
    facingY: 0,
    hero: 'hook',
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
  return [a, ally, b];
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
  stepPhysics(roster, dt);
  caster.afterPhysics(ball, dt, roster, false);
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

function tickPinned(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  sec: number,
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    for (const item of roster) {
      item.vx = 0;
      item.vy = 0;
    }
    caster.tick(ball, dt, roster);
    for (const item of roster) {
      tickHeal(item, dt);
      const src = roster.find((other) => other.id === item.burnSourceId);
      tickBurn(item, dt, src);
      tickShield(item, dt);
      tickSilence(item, dt);
    }
    left -= dt;
  }
}

/** 链生四技能：愈链友HOT/敌DoT、盾脉贴敌吸血、援勾拉友或击退敌、扰锋范围沉默。 */
export function verifyChain(): void {
  resetTrapZones();
  assert(CHAIN_HEAL.cd === 10 && CHAIN_HEAL.dps === 6 && CHAIN_HEAL.duration === 4, '链生：愈链应为 CD10 / 每秒6 / 4s');
  assert(CHAIN_HEAL.windup === 0.3 && CHAIN_HEAL.fanDeg === 40 && CHAIN_HEAL.range === 6, '链生：愈链应为前摇0.3 / ±40° / 距6');
  assert(CHAIN_SHIELD.cd === 12 && CHAIN_SHIELD.dps === 8 && CHAIN_SHIELD.duration === 3, '链生：盾脉应为 CD12 / 每秒8 / 3s');
  assert(CHAIN_TOW.cd === 8 && CHAIN_TOW.lowHpRatio === 0.4 && CHAIN_TOW.pullDist === 2, '链生：援勾应为 CD8 / 残血40% / 轻拉2');
  assert(CHAIN_TOW.knockback === 10, '链生：援勾对敌击退初速应为 10');
  assert(CHAIN_FAIL_CD === 2, '链生：无目标短 CD 应为 2s');
  assert(
    CHAIN_SCRAMBLE.cd === 15 &&
      CHAIN_SCRAMBLE.windup === 0.2 &&
      CHAIN_SCRAMBLE.range === 5 &&
      CHAIN_SCRAMBLE.duration === 3,
    '链生：扰锋应为 CD15 / 前摇0.2 / 半径5 / 沉默3s',
  );

  const [healRed, healAlly, healBlue] = redAllyBlue(8, 6, 10.5, 6, 14, 6);
  healRed.hp = 70;
  healAlly.hp = 70;
  healBlue.hp = 70;
  const heal = createSkillCaster('chain');
  fire(heal, healRed, 1, [healRed, healAlly, healBlue]);
  assert(heal.getWindup()?.slot === 1, '链生：治疗链应走 0.3s 前摇');
  assert(Math.abs(heal.getCds()[0] - CHAIN_HEAL.cd) < 1e-6, '链生：愈链应进 10s CD');
  tickPinned(heal, healRed, [healRed, healAlly, healBlue], 0.28);
  assert(Math.abs(healRed.hp - 70) < 1e-6 && Math.abs(healAlly.hp - 70) < 1e-6, '链生：前摇未结束不应 HOT');
  tickPinned(heal, healRed, [healRed, healAlly, healBlue], 0.05);
  assert(healAlly.healRemain > CHAIN_HEAL.duration - 0.1, '链生：扇内最近友应上 HOT');
  assert(healRed.healRemain === 0, '链生：愈链对友不应再给自己 HOT');
  assert(healBlue.healRemain === 0 && healBlue.burnRemain === 0, '链生：更远的敌不应被选中');
  tickPinned(heal, healRed, [healRed, healAlly, healBlue], 1);
  assert(Math.abs(healRed.hp - 70) < 0.35, '链生：愈链 1s 己不应回血');
  assert(Math.abs(healAlly.hp - 76) < 0.35, '链生：愈链 1s 友应回约 6');
  tickPinned(heal, healRed, [healRed, healAlly, healBlue], CHAIN_HEAL.duration);
  const afterHeal = healAlly.hp;
  tickPinned(heal, healRed, [healRed, healAlly, healBlue], 0.4);
  assert(Math.abs(healAlly.hp - afterHeal) < 1e-6, '链生：HOT 结束后应停回血');

  resetTrapZones();
  const [burnRed, burnAlly, burnBlue] = redAllyBlue(8, 6, 5, 6, 11, 6);
  burnRed.hp = 70;
  burnAlly.hp = 70;
  const burn = createSkillCaster('chain');
  fire(burn, burnRed, 1, [burnRed, burnAlly, burnBlue], { aimX: 1, aimY: 0 });
  tickPinned(burn, burnRed, [burnRed, burnAlly, burnBlue], CHAIN_HEAL.windup + 0.05);
  assert(burnBlue.burnRemain > CHAIN_HEAL.duration - 0.1, '链生：扇内最近敌应上 DoT');
  assert(burnAlly.healRemain === 0, '链生：扇外友不应 HOT');
  assert(burnRed.healRemain === 0, '链生：对敌愈链不应给自己 HOT');
  const burnHp = burnBlue.hp;
  tickPinned(burn, burnRed, [burnRed, burnAlly, burnBlue], 1);
  assert(Math.abs(burnBlue.hp - (burnHp - 6)) < 0.35, '链生：愈链 1s 敌应掉约 6');

  resetTrapZones();
  const missHeal = createSkillCaster('chain');
  const [missRed] = redAllyBlue(8, 6, 8, 16, 16, 16);
  fire(missHeal, missRed, 1, [missRed], { aimX: 1, aimY: 0 });
  assert(Math.abs(missHeal.getCds()[0] - CHAIN_FAIL_CD) < 1e-6, '链生：愈链无目标应进 2s 短 CD');
  assert(!missHeal.getWindup(), '链生：愈链无目标不应走前摇');

  resetTrapZones();
  const [shieldRed, shieldAlly, shieldFar] = redAllyBlue(8, 6, 6, 6, 11, 6);
  shieldRed.hp = 70;
  const shield = createSkillCaster('chain');
  fire(shield, shieldRed, 2, [shieldRed, shieldAlly, shieldFar]);
  assert(Math.abs(shield.getCds()[1] - CHAIN_SHIELD.cd) < 1e-6, '链生：盾脉应即放进 12s CD');
  assert(shieldRed.leechRemain > CHAIN_SHIELD.duration - 0.05, '链生：盾脉应对距内敌人贴附');
  assert(shieldFar.leechRemain > CHAIN_SHIELD.duration - 0.05, '链生：被贴附的敌人应同步计时');
  assert(shieldAlly.leechRemain === 0, '链生：盾脉不应贴友');
  const leechSelf = shieldRed.hp;
  const leechEnemy = shieldFar.hp;
  advance(shield, shieldRed, [shieldRed, shieldAlly, shieldFar], 1);
  assert(Math.abs(shieldRed.hp - (leechSelf + 8)) < 0.45, '链生：盾脉 1s 己应回约 8');
  assert(Math.abs(shieldFar.hp - (leechEnemy - 8)) < 0.45, '链生：盾脉 1s 敌应掉约 8');
  assert(
    Math.hypot(shieldRed.x - shieldFar.x, shieldRed.y - shieldFar.y) < 1.25,
    '链生：盾脉期间应贴在敌身侧',
  );
  advance(shield, shieldRed, [shieldRed, shieldAlly, shieldFar], CHAIN_SHIELD.duration);
  assert(shieldRed.leechRemain === 0 && shieldFar.leechRemain === 0, '链生：盾脉 3s 后应解开');

  resetTrapZones();
  const lone = createSkillCaster('chain');
  const loneBall = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'chain',
  });
  fire(lone, loneBall, 2, [loneBall]);
  assert(Math.abs(lone.getCds()[1] - CHAIN_FAIL_CD) < 1e-6, '链生：盾脉无敌人应进 2s 短 CD');
  assert(loneBall.leechRemain === 0, '链生：无敌人时盾脉不应贴附');

  resetTrapZones();
  const [towRed, towAlly] = redAllyBlue(8, 6, 12, 6, 16, 6);
  const tow = createSkillCaster('chain');
  fire(tow, towRed, 3, [towRed, towAlly]);
  assert(tow.isDisplacing(), '链生：勾友满血应拉自己向友');
  assert(towRed.activeRamRemain === 0, '链生：勾友不应开对敌主动撞窗');
  advance(tow, towRed, [towRed, towAlly], 0.35);
  assert(towRed.x > 9.5, '链生：勾友应把自己拉向友军');
  assert(towRed.activeRamRemain === 0, '链生：勾友飞行中仍不应开主动撞');

  resetTrapZones();
  const [pullRed, pullAlly] = redAllyBlue(8, 6, 12, 6, 16, 6);
  pullAlly.hp = 35;
  const startAllyX = pullAlly.x;
  const pull = createSkillCaster('chain');
  fire(pull, pullRed, 3, [pullRed, pullAlly]);
  assert(!pull.isDisplacing(), '链生：残血勾友应轻拉友而非自己飞');
  assert(Math.abs(startAllyX - pullAlly.x - CHAIN_TOW.pullDist) < 0.08, '链生：残血友应被轻拉向己约 2 格');
  assert(pullRed.activeRamRemain === 0, '链生：残血勾友不算主动撞');

  resetTrapZones();
  const [shoveRed, , shoveBlue] = redAllyBlue(8, 6, 4, 6, 12, 6);
  const shove = createSkillCaster('chain');
  fire(shove, shoveRed, 3, [shoveRed, shoveBlue]);
  assert(!shove.isDisplacing(), '链生：援勾对敌应即刻击退而非自己飞');
  assert(Math.abs(shoveBlue.vx - CHAIN_TOW.knockback) < 0.35, '链生：援勾对敌击退初速应约 10');
  assert(shoveRed.activeRamRemain === 0, '链生：援勾弹敌不算主动撞');

  resetTrapZones();
  const missTow = createSkillCaster('chain');
  const missTowBall = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'chain',
  });
  fire(missTow, missTowBall, 3, [missTowBall]);
  assert(Math.abs(missTow.getCds()[2] - CHAIN_FAIL_CD) < 1e-6, '链生：援勾无目标应进 2s 短 CD');

  resetTrapZones();
  const [scrRed, scrAlly, scrBlue] = redAllyBlue(8, 6, 6, 6, 10.5, 6);
  const scrFar = createBallBody({
    x: 16,
    y: 6,
    color: 0x3d7cf0,
    label: '蓝远',
    team: 'blue',
    facingX: -1,
    hero: 'hook',
  });
  const scrNear = createBallBody({
    x: 8,
    y: 9,
    color: 0x3d7cf0,
    label: '蓝近',
    team: 'blue',
    facingX: -1,
    hero: 'hook',
  });
  scrBlue.facingX = 1;
  scrBlue.facingY = 0;
  scrBlue.vx = 2.5;
  scrBlue.vy = 0;
  const scrRoster = [scrRed, scrAlly, scrBlue, scrFar, scrNear];
  const scramble = createSkillCaster('chain');
  const victimAim = createSkillCaster('hook');
  victimAim.handleInput(scrBlue, sample({ skillPress: 1, aimX: -1, aimY: 0 }), scrRoster);
  assert(victimAim.getAimingSlot() === 1, '链生：扰锋前目标应在短瞄准');
  fire(scramble, scrRed, 4, scrRoster);
  assert(scramble.getWindup()?.slot === 4, '链生：扰锋应走 0.2s 前摇');
  assert(Math.abs(scramble.getCds()[3] - CHAIN_SCRAMBLE.cd) < 1e-6, '链生：扰锋应进 15s CD');
  tickPinned(scramble, scrRed, scrRoster, 0.18);
  assert(scrBlue.silenceRemain === 0 && scrBlue.hp === MAX_HP, '链生：扰锋前摇未结束不应沉默');
  tickPinned(scramble, scrRed, scrRoster, 0.05);
  assert(scrBlue.hp === MAX_HP, '链生：扰锋不应造成伤害');
  assert(scrBlue.facingX > 0.9 && Math.abs(scrBlue.facingY) < 0.12, '链生：扰锋不应拧朝向');
  assert(scrBlue.stunRemain === 0, '链生：沉默不是硬直');
  assert(scrBlue.silenceRemain > 2.9 && scrBlue.silenceRemain <= 3, '链生：半径内敌人应沉默 3s');
  assert(scrNear.silenceRemain > 2.9, '链生：半径内另一敌人也应沉默');
  assert(scrAlly.silenceRemain === 0, '链生：友军不受扰锋影响');
  assert(scrFar.silenceRemain === 0, '链生：半径外敌人不应沉默');
  victimAim.tick(scrBlue, 1 / 60, scrRoster);
  assert(victimAim.getAimingSlot() === 0, '链生：扰锋应打断短瞄准');
  assert(!scrBlue.aimBreak, '链生：瞄准打断标记应被施放器吃掉');
  victimAim.handleInput(scrBlue, sample({ skillPress: 1, aimX: -1, aimY: 0 }), scrRoster);
  assert(victimAim.getAimingSlot() === 0, '链生：沉默中不能进瞄');
  const slideX = scrBlue.x;
  scrBlue.vx = 2.5;
  scrBlue.vy = 0;
  stepPhysics([scrBlue], 1 / 20);
  assert(scrBlue.x > slideX + 0.08, '链生：沉默后仍可滑');
  tickPinned(scramble, scrRed, scrRoster, 2.8);
  assert(scrBlue.silenceRemain > 0, '链生：沉默约 2.9s 后仍应在');
  victimAim.handleInput(scrBlue, sample({ skillPress: 1, aimX: -1, aimY: 0 }), scrRoster);
  assert(victimAim.getAimingSlot() === 0, '链生：沉默未结束仍不能进瞄');
  tickPinned(scramble, scrRed, scrRoster, 0.25);
  assert(scrBlue.silenceRemain === 0, '链生：沉默 3s 后应结束');
  victimAim.handleInput(scrBlue, sample({ skillPress: 1, aimX: -1, aimY: 0 }), scrRoster);
  assert(victimAim.getAimingSlot() === 1, '链生：沉默结束后应能再进瞄');

  resetTrapZones();
  const hookKeep = createSkillCaster('hook');
  const hookRed = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'hook',
  });
  const hookBlue = createBallBody({
    x: 12,
    y: 6,
    color: 0x3d7cf0,
    team: 'blue',
    facingX: -1,
    hero: 'hook',
  });
  fire(hookKeep, hookRed, 1, [hookRed, hookBlue]);
  advance(hookKeep, hookRed, [hookRed, hookBlue], HOOK_PULL.windup + 0.03);
  assert(Math.abs(hookBlue.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, '链生：钩刺 kit 不应被拆坏');
  assert(Math.hypot(hookRed.vx, hookRed.vy) + 1e-6 >= FLOOR_SPEED - 0.2, '链生：钩刺勾飞仍可动');

  resetTrapZones();
  const ringKeep = createSkillCaster('ring');
  const ringRed = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'ring',
  });
  fire(ringKeep, ringRed, 1, [ringRed]);
  assert(Math.abs(ringKeep.getCds()[0] - RING_FIELD.cd) < 1e-6, '链生：磁环 kit 不应被拆坏');
  assert(ringRed.fieldRemain > RING_FIELD.duration - 0.05, '链生：磁环磁场仍应即放');

  resetTrapZones();
}
