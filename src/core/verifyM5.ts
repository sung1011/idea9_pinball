import { createBallBody, type BallBody } from './ballBody';
import { applySkillDamage } from './skillHits';
import {
  ACTIVE_RAM_WINDOW,
  FLOOR_SPEED,
  FRICTION,
  HARD_CC_DIMINISH_WINDOW,
  MAX_HP,
  RESPAWN_SEC,
  SPAWN_INVINCIBLE_SEC,
} from './constants';
import { HOOK_BRAKE, HOOK_PULL, HOOK_SHOVE, HOOK_STAB } from '../heroes/hookKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createPlayerControl } from '../input/playerControl';
import { createMatchSession } from './matchSession';
import { applyHardCc, createSkillCaster, scaleHardCc } from './skillCaster';
import { segmentBlocked } from './skillQuery';
import { createSimpleBot } from './simpleBot';
import { stepPhysics } from './physicsStep';

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

function redBlue(x0: number, y0: number, x1: number, y1: number): [BallBody, BallBody] {
  const a = createBallBody({
    x: x0,
    y: y0,
    color: 0xe24a4a,
    label: '红',
    team: 'red',
    facingX: 1,
    facingY: 0,
  });
  const b = createBallBody({
    x: x1,
    y: y1,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
    facingX: -1,
    facingY: 0,
  });
  return [a, b];
}

function fire(caster: ReturnType<typeof createSkillCaster>, ball: BallBody, slot: SkillSlot, aimX = 1, aimY = 0): void {
  caster.handleInput(ball, sample({ skillPress: slot, aimX, aimY }));
  caster.handleInput(ball, sample({ skillPress: slot, aimX, aimY }));
}

function play(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  dt: number,
): number {
  const hits = caster.tick(ball, dt, roster);
  for (const other of roster) {
    if (other.id !== ball.id) {
      other.frictionMul = 0;
    }
  }
  const phys = stepPhysics(roster, dt);
  hits.push(...caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id)));
  return hits.length + phys.hits.length;
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

/** 钩刺四技能：释放后前摇、未中短 CD、连捅、冲刺、急停，以及简化 bot。 */
export function verifyM5(): void {
  assert(HOOK_PULL.cd === 8 && HOOK_PULL.missCd === 4, 'M5：勾过来 CD 应为 8/未中 4');
  assert(HOOK_STAB.cd === 6 && HOOK_SHOVE.cd === 10 && HOOK_BRAKE.cd === 12, 'M5：捅/推/急停 CD 应为 6/10/12');
  assert(scaleHardCc(0.25, 0, 0.2) === 0.125, 'M5：1.5s 内二次硬控应减半');
  assert(scaleHardCc(0.25, 0, HARD_CC_DIMINISH_WINDOW + 0.01) === 0.25, 'M5：超过 1.5s 硬控不衰减');

  const hold = createSkillCaster();
  const [holdRed, holdBlue] = redBlue(8, 6, 12, 6);
  hold.handleInput(holdRed, sample({ skillPress: 1 }));
  assert(hold.getAimingSlot() === 1, 'M5：按下应进瞄');
  let holdLeft = 5;
  while (holdLeft > 1e-9) {
    const dt = Math.min(1 / 60, holdLeft);
    hold.tick(holdRed, dt, [holdRed, holdBlue]);
    holdLeft -= dt;
  }
  assert(hold.getAimingSlot() === 1, 'M5：瞄准可无限持有');
  assert(holdBlue.hp === MAX_HP && hold.getCds()[0] === 0, 'M5：未释放不应出勾或进 CD');

  const [windRed, windBlue] = redBlue(8, 6, 12, 6);
  const wind = createSkillCaster();
  fire(wind, windRed, 1);
  advance(wind, windRed, [windRed, windBlue], 0.39);
  assert(windBlue.hp === MAX_HP, 'M5：释放后 0.4s 前摇未结束不应出勾');
  advance(wind, windRed, [windRed, windBlue], 0.03);
  assert(Math.abs(windBlue.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, 'M5：勾中应造成 8 伤');
  assert(Math.abs(Math.hypot(windRed.vx, windRed.vy) - HOOK_PULL.flySpeed) < 0.35, 'M5：勾中后应向目标飞 10 速');
  let arrivedRam = false;
  let flyLeft = 0.45;
  while (flyLeft > 1e-9) {
    const dt = Math.min(1 / 60, flyLeft);
    play(wind, windRed, [windRed, windBlue], dt);
    flyLeft -= dt;
    if (windRed.activeRamRemain > 0) {
      arrivedRam = true;
    }
  }
  assert(arrivedRam, 'M5：抵达后应开主动撞窗');

  const miss = createSkillCaster();
  const missBall = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1 });
  fire(miss, missBall, 1, 1, 0);
  advance(miss, missBall, [missBall], 0.45);
  assert(Math.abs(miss.getCds()[0] - HOOK_PULL.missCd) < 0.1, 'M5：未勾中 CD 应变 4s');

  assert(segmentBlocked(2.5, 3.2, 2.5, 8.8), 'M5：穿矮柱勾索应被墙挡');
  const [wallRed, wallBlue] = redBlue(2.5, 3.2, 2.5, 8.8);
  const wall = createSkillCaster();
  fire(wall, wallRed, 1, 0, 1);
  advance(wall, wallRed, [wallRed, wallBlue], 0.45);
  assert(wallBlue.hp === MAX_HP, 'M5：墙挡勾索不应命中');
  assert(Math.abs(wall.getCds()[0] - HOOK_PULL.missCd) < 0.1, 'M5：墙挡应按未中短 CD');

  const allyA = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1 });
  const allyB = createBallBody({ x: 12, y: 6, color: 0xc43d3d, team: 'red', facingX: -1 });
  const ally = createSkillCaster();
  fire(ally, allyA, 1);
  advance(ally, allyA, [allyA, allyB], 0.45);
  assert(allyB.hp === MAX_HP, 'M5：不勾友军');
  assert(Math.abs(ally.getCds()[0] - HOOK_PULL.missCd) < 0.1, 'M5：勾友军应按未中');

  const inv = createSkillCaster();
  const [invRed, invBlue] = redBlue(8, 6, 12, 6);
  invBlue.invincibleRemain = 2;
  fire(inv, invRed, 1);
  advance(inv, invRed, [invRed, invBlue], 0.45);
  assert(invBlue.hp === MAX_HP, 'M5：无敌目标不受勾伤');

  const [stabRed, stabBlue] = redBlue(8, 6, 9.6, 6);
  const stab = createSkillCaster();
  const startX = stabRed.x;
  fire(stab, stabRed, 2);
  advance(stab, stabRed, [stabRed, stabBlue], HOOK_STAB.windup + 0.001);
  assert(Math.abs(stabBlue.hp - (MAX_HP - 9)) < 1e-6, 'M5：第一捅应为 9');
  assert(stabRed.x > startX + HOOK_STAB.selfPush * 0.5, 'M5：捅时应自推');
  advance(stab, stabRed, [stabRed, stabBlue], HOOK_STAB.interval);
  assert(Math.abs(stabBlue.hp - (MAX_HP - 18)) < 1e-6, 'M5：第二捅应为 9');
  advance(stab, stabRed, [stabRed, stabBlue], HOOK_STAB.interval);
  assert(Math.abs(stabBlue.hp - (MAX_HP - 32)) < 1e-6, 'M5：第三捅应为 14');
  assert(stabBlue.stunRemain > 0.2, 'M5：第三下应上 0.25s 硬直');
  assert(Math.abs((stab.getCds()[1] ?? 0) - (HOOK_STAB.cd - HOOK_STAB.windup - 2 * HOOK_STAB.interval)) < 0.08, 'M5：挥空与命中均进捅 CD');

  const whiff = createSkillCaster();
  const whiffBall = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1 });
  fire(whiff, whiffBall, 2);
  advance(whiff, whiffBall, [whiffBall], HOOK_STAB.windup + 2 * HOOK_STAB.interval + 0.02);
  assert(whiff.getCds()[1] > 5, 'M5：挥空仍进捅 CD');
  assert(whiffBall.x > 8 + HOOK_STAB.selfPush * 2, 'M5：挥空仍应三段自推');

  const dimTarget = createBallBody({ x: 10, y: 6, color: 0x3d7cf0, team: 'blue' });
  applyHardCc(dimTarget, HOOK_STAB.thirdStun, 0);
  dimTarget.stunRemain = 0;
  const second = applyHardCc(dimTarget, HOOK_STAB.thirdStun, 0.4);
  assert(Math.abs(second - HOOK_STAB.thirdStun * 0.5) < 1e-9, 'M5：二次硬直时长应减半');

  const dash = createSkillCaster();
  const dashBall = createBallBody({ x: 4, y: 6, color: 0xe24a4a, team: 'red', facingX: 1 });
  fire(dash, dashBall, 3);
  advance(dash, dashBall, [dashBall], HOOK_SHOVE.windup + HOOK_SHOVE.dashTime);
  const dashExpect = 4 + FLOOR_SPEED * HOOK_SHOVE.windup + HOOK_SHOVE.dashDist;
  assert(Math.abs(dashBall.x - dashExpect) < 0.7, 'M5：推过去应冲约 4.5 格');

  const [shoveRed, shoveBlue] = redBlue(8, 6, 10, 6);
  const shove = createSkillCaster();
  fire(shove, shoveRed, 3);
  let shoveHit = false;
  let shoveLeft = HOOK_SHOVE.windup + HOOK_SHOVE.dashTime;
  while (shoveLeft > 1e-9 && !shoveHit) {
    const dt = Math.min(1 / 60, shoveLeft);
    play(shove, shoveRed, [shoveRed, shoveBlue], dt);
    shoveLeft -= dt;
    if (shoveBlue.hp < MAX_HP) {
      shoveHit = true;
      assert(Math.abs(shoveBlue.hp - (MAX_HP - HOOK_SHOVE.damage)) < 1e-6, 'M5：推过去碰敌应伤 12');
      assert(Math.abs(shoveBlue.vx - HOOK_SHOVE.hitPush) < 0.35, 'M5：目标应沿冲刺向初速 12');
      const keep = (HOOK_SHOVE.dashDist / HOOK_SHOVE.dashTime) * HOOK_SHOVE.keepSpeed;
      assert(Math.abs(shoveRed.vx - keep) < 0.8, 'M5：自己应保留 70% 剩余速');
      assert(Math.abs(shoveRed.activeRamRemain - ACTIVE_RAM_WINDOW) < 0.08, 'M5：推中后应开 0.25s 撞窗');
    }
  }
  assert(shoveHit, 'M5：推过去应在冲刺途中碰敌');

  const wallDash = createSkillCaster();
  const wallDashBall = createBallBody({
    x: 18.6,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
  });
  fire(wallDash, wallDashBall, 3);
  advance(wallDash, wallDashBall, [wallDashBall], HOOK_SHOVE.windup + 0.12);
  assert(wallDashBall.x < 19.7, 'M5：冲刺撞墙应提前结束');
  assert(!wallDash.isDisplacing(), 'M5：撞墙后不应继续冲刺');

  const brake = createSkillCaster();
  const brakeBall = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    vx: 8,
    facingX: 1,
  });
  fire(brake, brakeBall, 4);
  assert(brake.getWindup() === null, 'M5：急停应即放');
  assert(Math.abs(brake.getCds()[3] - HOOK_BRAKE.cd) < 1e-6, 'M5：急停 CD 应为 12');
  advance(brake, brakeBall, [brakeBall], 0.3);
  const mid = Math.hypot(brakeBall.vx, brakeBall.vy);
  const expectMid = 8 * Math.exp(-FRICTION * HOOK_BRAKE.frictionMul * 0.3);
  assert(Math.abs(mid - expectMid) < 0.15, 'M5：急停 0.6s 内摩擦应为 ×10');
  let popped = false;
  let popLeft = 0.4;
  while (popLeft > 1e-9 && !popped) {
    const dt = Math.min(1 / 60, popLeft);
    play(brake, brakeBall, [brakeBall], dt);
    popLeft -= dt;
    const speed = Math.hypot(brakeBall.vx, brakeBall.vy);
    if (speed > 8) {
      popped = true;
      assert(Math.abs(speed - HOOK_BRAKE.popSpeed) < 0.35, 'M5：急停结束应按朝向 11 速弹出');
      assert(brakeBall.activeRamRemain > 0.2, 'M5：弹出后应开主动撞窗');
    }
  }
  assert(popped, 'M5：急停结束应弹出');

  const cds = createSkillCaster();
  const cdsBall = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1 });
  fire(cds, cdsBall, 4);
  cds.handleInput(cdsBall, sample({ skillPress: 1 }));
  assert(cds.getAimingSlot() === 1, 'M5：四槽 CD 独立，急停后仍可瞄勾');

  const combo = createSkillCaster();
  const [comboRed, comboBlue] = redBlue(8, 6, 12, 6);
  fire(combo, comboRed, 4);
  fire(combo, comboRed, 1);
  assert(combo.getWindup()?.slot === 1, 'M5：急停后应能接勾前摇');
  advance(combo, comboRed, [comboRed, comboBlue], HOOK_PULL.windup + 0.35);
  fire(combo, comboRed, 2);
  assert(combo.getWindup()?.slot === 2 || combo.isHardBusy(), 'M5：勾后应能接捅');
  advance(combo, comboRed, [comboRed, comboBlue], HOOK_STAB.windup + HOOK_STAB.interval * 2 + 0.05);
  fire(combo, comboRed, 3);
  assert(combo.getWindup()?.slot === 3 || combo.isDisplacing(), 'M5：捅后应能接推过去');

  const ctl = createPlayerControl();
  const [ctlRed] = redBlue(8, 6, 14, 6);
  ctl.tick(ctlRed, sample({ skillPress: 1 }), 0);
  ctl.tick(ctlRed, sample({ confirmRelease: true }), 0);
  assert(ctl.getWindup()?.slot === 1, 'M5：点地确认仍释放当前技能');

  const botBall = createBallBody({
    x: 14,
    y: 6,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
    facingX: -1,
  });
  const prey = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    label: '红',
    team: 'red',
    facingX: 1,
  });
  const bot = createSimpleBot(botBall, { random: () => 0, hookChance: 1 });
  for (let i = 0; i < 90; i += 1) {
    bot.tick(1 / 60, [prey, botBall], 'playing');
    stepPhysics([prey, botBall], 1 / 60);
    bot.afterPhysics(1 / 60, [prey, botBall], false);
  }
  assert(bot.getCds()[0] > 0, 'M5：近距简化 bot 应偶勾');
  assert(bot.getCds()[1] === 0, 'M5：简化 bot 不应打捅×3 连招');

  const approachBotBall = createBallBody({
    x: 16,
    y: 3,
    color: 0x4f9bff,
    label: '蓝2',
    team: 'blue',
    facingX: -1,
    vx: 0,
  });
  const farPrey = createBallBody({
    x: 4,
    y: 3,
    color: 0xe24a4a,
    team: 'red',
  });
  const approachBot = createSimpleBot(approachBotBall, { random: () => 0.99, hookChance: 0.01 });
  for (let i = 0; i < 120; i += 1) {
    approachBot.tick(1 / 60, [farPrey, approachBotBall], 'playing');
    stepPhysics([farPrey, approachBotBall], 1 / 60);
    approachBot.afterPhysics(1 / 60, [farPrey, approachBotBall], false);
  }
  assert(approachBot.getCds()[2] > 0 || approachBot.getCds()[3] > 0, 'M5：远距简化 bot 应急停或靠近');
  assert(approachBot.getCds()[1] === 0, 'M5：靠近路径也不应使用方向捅');

  const [koRed, koBlue] = redBlue(6, 6, 14, 6);
  const ko = createMatchSession([koRed, koBlue], { countdownSec: 0, playSec: 40 });
  koRed.invincibleRemain = 0;
  koBlue.invincibleRemain = 0;
  koBlue.hp = HOOK_PULL.damage;
  const skillHit = applySkillDamage(koBlue, koRed, HOOK_PULL.damage);
  assert(skillHit !== null && koBlue.hp === 0, 'M5：技能应能击破到 0 血');
  ko.tick(0, skillHit ? [skillHit] : []);
  assert(!koBlue.inPlay, 'M5：技能击破后应离场');
  assert(Math.abs((ko.snapshot().respawns[koBlue.id] ?? 0) - RESPAWN_SEC) < 1e-6, 'M5：击破后回场倒计时 5s');
  ko.tick(RESPAWN_SEC, []);
  assert(koBlue.inPlay && koBlue.hp === koBlue.maxHp, 'M5：5s 后应回场有血');
  assert(koBlue.invincibleRemain >= SPAWN_INVINCIBLE_SEC - 1e-6, 'M5：回场应 2s 无敌');
  stepPhysics([koBlue], 1 / 60);
  assert(Math.hypot(koBlue.vx, koBlue.vy) + 1e-6 >= FLOOR_SPEED - 0.1, 'M5：回场后应可动');
}
