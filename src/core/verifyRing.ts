import { createBallBody, type BallBody } from './ballBody';
import {
  ACTIVE_RAM_WINDOW,
  FLOOR_SPEED,
  HARD_CC_DIMINISH_WINDOW,
  MAX_HP,
} from './constants';
import { HOOK_PULL } from '../heroes/hookKit';
import {
  RING_FIELD,
  RING_SLIDE,
  RING_TRAP,
  RING_WAVE,
  ringTrapCenter,
} from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createSkillCaster } from './skillCaster';
import { stepPhysics } from './physicsStep';
import { isInEnemyTrap, listTrapZones, resetTrapZones } from './trapZones';

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
    hero: 'ring',
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
): CollisionCount {
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

type CollisionCount = number;

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
    left -= dt;
  }
}

/** 磁环四技能：磁场 DoT、推波击退、粘壁滑墙弹出、困圈物理关死 + 禁位移。 */
export function verifyRing(): void {
  resetTrapZones();
  assert(RING_FIELD.cd === 11 && RING_FIELD.dps === 6 && RING_FIELD.radius === 2, '磁环：磁场应为 CD11 / 半径2 / 每秒6');
  assert(RING_FIELD.duration === 5, '磁环：磁场持续应为 5s');
  assert(RING_WAVE.cd === 9 && RING_WAVE.fanDeg === 70 && RING_WAVE.knockback === 9, '磁环：推波应为 CD9 / 70° / 击退9');
  assert(RING_SLIDE.cd === 14 && RING_SLIDE.slideTime === 4 && RING_SLIDE.popSpeed === 8, '磁环：粘壁应为 CD14 / 4s / 弹出8');
  assert(RING_TRAP.cd === 12 && RING_TRAP.windup === 0.35 && RING_TRAP.radius === 2.5, '磁环：困圈应为 CD12 / 前摇0.35 / 半径2.5');
  assert(RING_TRAP.duration === 3.8 && RING_TRAP.punishCd === 2, '磁环：困圈持续 3.8、惩罚 CD 2');
  assert(HARD_CC_DIMINISH_WINDOW === 1.5, '磁环：二次硬控窗仍为 1.5s');

  const placed = ringTrapCenter({ x: 10, y: 6 }, 18, 6, true);
  assert(Math.abs(placed.x - 14) < 1e-6 && placed.y === 6, '磁环：困圈落点应夹在距己 4 格内');
  const self = ringTrapCenter({ x: 10, y: 6 });
  assert(self.x === 10 && self.y === 6, '磁环：无点地时困圈心应为自身');

  const [fieldRed, fieldBlue] = redBlue(10, 6, 11.2, 6);
  const fieldAlly = createBallBody({
    x: 10.6,
    y: 6,
    color: 0xc43d3d,
    team: 'red',
    hero: 'hook',
  });
  const field = createSkillCaster('ring');
  fire(field, fieldRed, 1, [fieldRed, fieldBlue, fieldAlly]);
  assert(Math.abs(field.getCds()[0] - RING_FIELD.cd) < 1e-6, '磁环：磁场应即放进 11s CD');
  tickPinned(field, fieldRed, [fieldRed, fieldBlue, fieldAlly], 1);
  assert(Math.abs(fieldBlue.hp - (MAX_HP - RING_FIELD.dps)) < 0.35, '磁环：磁场 1s 应对敌约 6 伤');
  assert(fieldRed.hp === MAX_HP, '磁环：磁场己免');
  assert(fieldAlly.hp === MAX_HP, '磁环：磁场不伤友军');
  tickPinned(field, fieldRed, [fieldRed, fieldBlue, fieldAlly], RING_FIELD.duration);
  const afterField = fieldBlue.hp;
  tickPinned(field, fieldRed, [fieldRed, fieldBlue, fieldAlly], 0.5);
  assert(Math.abs(fieldBlue.hp - afterField) < 1e-6, '磁环：磁场结束后应停伤');

  resetTrapZones();
  const [waveRed, waveBlue] = redBlue(8, 6, 10.5, 6);
  const waveFar = createBallBody({
    x: 10.2,
    y: 7.1,
    color: 0x4f9bff,
    team: 'blue',
    hero: 'hook',
  });
  const wave = createSkillCaster('ring');
  fire(wave, waveRed, 2, [waveRed, waveBlue, waveFar]);
  assert(Math.abs(waveBlue.hp - (MAX_HP - RING_WAVE.damage)) < 1e-6, '磁环：推波应伤 8');
  assert(Math.abs(waveBlue.vx - RING_WAVE.knockback) < 0.35, '磁环：推波击退初速应约 9');
  assert(waveFar.hp < MAX_HP, '磁环：推波锥内多人应都吃到');

  resetTrapZones();
  const slide = createSkillCaster('ring');
  const slideBall = createBallBody({
    x: 1.05,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    vx: -6,
    facingX: -1,
    hero: 'ring',
  });
  fire(slide, slideBall, 3, [slideBall]);
  assert(slide.isDisplacing(), '磁环：粘壁应为位移技');
  advance(slide, slideBall, [slideBall], 0.35);
  assert(slideBall.x < 0.7, '磁环：粘壁应贴墙');
  assert(slideBall.vx <= 0.15, '磁环：粘壁撞墙不应反弹');
  assert(slideBall.slideWalls, '磁环：粘壁期间应沿壁滑');
  let popped = false;
  let popLeft = RING_SLIDE.slideTime;
  while (popLeft > 1e-9 && !popped) {
    const dt = Math.min(1 / 60, popLeft);
    play(slide, slideBall, [slideBall], dt);
    popLeft -= dt;
    const speed = Math.hypot(slideBall.vx, slideBall.vy);
    if (speed > 7.4 && !slideBall.slideWalls) {
      popped = true;
      assert(Math.abs(speed - RING_SLIDE.popSpeed) < 0.45, '磁环：粘壁结束应按朝向 8 速弹出');
      assert(slideBall.activeRamRemain > ACTIVE_RAM_WINDOW - 0.08, '磁环：弹出后应开主动撞窗');
    }
  }
  assert(popped, '磁环：粘壁结束后应弹出');

  resetTrapZones();
  const [trapRed, trapBlue] = redBlue(10, 6, 12, 6);
  const trap = createSkillCaster('ring');
  const hook = createSkillCaster('hook');
  fire(trap, trapRed, 4, [trapRed, trapBlue]);
  assert(trap.getWindup()?.slot === 4, '磁环：困圈应走 0.35s 前摇');
  advance(trap, trapRed, [trapRed, trapBlue], 0.33);
  assert(!isInEnemyTrap(trapBlue), '磁环：前摇未结束不应出困圈');
  advance(trap, trapRed, [trapRed, trapBlue], 0.05);
  assert(isInEnemyTrap(trapBlue), '磁环：释放后敌应在困圈内');
  assert(!isInEnemyTrap(trapRed), '磁环：友军 / 自己不受困');

  fire(hook, trapBlue, 1, [trapRed, trapBlue], { aimX: -1, aimY: 0 });
  assert(Math.abs(hook.getCds()[0] - RING_TRAP.punishCd) < 0.05, '磁环：圈内放勾应失败并进 2s 短 CD');
  assert(trapRed.hp === MAX_HP, '磁环：圈内位移失败不应出勾伤');
  assert(!hook.isDisplacing(), '磁环：圈内勾不应起飞');

  fire(hook, trapBlue, 3, [trapRed, trapBlue], { aimX: -1, aimY: 0 });
  assert(Math.abs(hook.getCds()[2] - RING_TRAP.punishCd) < 0.08, '磁环：圈内盾冲应失败');

  const ringSlide = createSkillCaster('ring');
  const trappedRing = createBallBody({
    x: 10.2,
    y: 6,
    color: 0x4f9bff,
    team: 'blue',
    facingX: 1,
    hero: 'ring',
  });
  fire(ringSlide, trappedRing, 3, [trapRed, trappedRing]);
  assert(Math.abs(ringSlide.getCds()[2] - RING_TRAP.punishCd) < 0.08, '磁环：圈内粘壁应失败');
  assert(!ringSlide.isDisplacing(), '磁环：圈内粘壁不应进入滑墙');

  const outside = createBallBody({
    x: 16,
    y: 6,
    color: 0x3d7cf0,
    team: 'blue',
    facingX: -1,
    hero: 'hook',
  });
  const outsideHook = createSkillCaster('hook');
  fire(outsideHook, outside, 1, [trapRed, outside], { aimX: -1, aimY: 0 });
  assert(outsideHook.getWindup()?.slot === 1, '磁环：圈外仍可放位移技');

  const allyHook = createSkillCaster('hook');
  const ally = createBallBody({
    x: 10.3,
    y: 6.2,
    color: 0xc43d3d,
    team: 'red',
    facingX: 1,
    hero: 'hook',
  });
  fire(allyHook, ally, 4, [trapRed, ally, trapBlue]);
  assert(allyHook.getCds()[3] > 10, '磁环：友军在圈内仍可放蓄势');

  resetTrapZones();
  const [cageRed, cageBlue] = redBlue(10, 6, 10.4, 6);
  const cageCaster = createSkillCaster('ring');
  fire(cageCaster, cageRed, 4, [cageRed, cageBlue]);
  advance(cageCaster, cageRed, [cageRed, cageBlue], RING_TRAP.windup + 0.05);
  const cage = listTrapZones()[0];
  assert(!!cage && isInEnemyTrap(cageBlue), '磁环：关死测应有困圈且敌在圈内');
  cageRed.x = 2;
  cageRed.y = 2;
  cageRed.vx = 0;
  cageRed.vy = 0;
  cageBlue.x = cage.x + 0.2;
  cageBlue.y = cage.y;
  cageBlue.vx = 8;
  cageBlue.vy = 0;
  cageBlue.allowOverCap = false;
  advance(cageCaster, cageRed, [cageRed, cageBlue], 0.5);
  assert(Math.hypot(cageBlue.x - cage.x, cageBlue.y - cage.y) <= RING_TRAP.radius + 0.06, '磁环：圈内敌应被物理关死夹在边缘');
  assert(isInEnemyTrap(cageBlue), '磁环：夹边后敌仍算在困圈内');

  resetTrapZones();
  const [allyCageRed] = redBlue(10, 6, 16, 6);
  const allyCage = createBallBody({
    x: 10.2,
    y: 6,
    color: 0xc43d3d,
    team: 'red',
    facingX: 1,
    hero: 'hook',
  });
  const allyTrap = createSkillCaster('ring');
  fire(allyTrap, allyCageRed, 4, [allyCageRed, allyCage]);
  advance(allyTrap, allyCageRed, [allyCageRed, allyCage], RING_TRAP.windup + 0.05);
  const allyZone = listTrapZones()[0];
  assert(!!allyZone, '磁环：友军关死对照应有困圈');
  allyCageRed.x = 2;
  allyCageRed.y = 2;
  allyCageRed.vx = 0;
  allyCageRed.vy = 0;
  allyCage.x = allyZone.x + 0.2;
  allyCage.y = allyZone.y;
  allyCage.vx = 8;
  allyCage.vy = 0;
  advance(allyTrap, allyCageRed, [allyCageRed, allyCage], 0.55);
  assert(allyCage.x > allyZone.x + RING_TRAP.radius + 0.3, '磁环：友军应能滑出困圈');

  resetTrapZones();
  const [inRed] = redBlue(10, 6, 16, 6);
  const inbound = createBallBody({
    x: 16,
    y: 6,
    color: 0x4f9bff,
    team: 'blue',
    vx: -8,
    facingX: -1,
    hero: 'hook',
  });
  const inTrap = createSkillCaster('ring');
  fire(inTrap, inRed, 4, [inRed, inbound]);
  advance(inTrap, inRed, [inRed, inbound], RING_TRAP.windup + 0.05);
  const inZone = listTrapZones()[0];
  assert(!!inZone, '磁环：外进圈测应有困圈');
  inRed.x = 2;
  inRed.y = 2;
  inRed.vx = 0;
  inRed.vy = 0;
  inbound.x = inZone.x + RING_TRAP.radius + 1.2;
  inbound.y = inZone.y;
  inbound.vx = -8;
  inbound.vy = 0;
  advance(inTrap, inRed, [inRed, inbound], 0.4);
  assert(isInEnemyTrap(inbound), '磁环：圈外敌应能滑进困圈');
  inbound.vx = 8;
  inbound.vy = 0;
  advance(inTrap, inRed, [inRed, inbound], 0.45);
  assert(Math.hypot(inbound.x - inZone.x, inbound.y - inZone.y) <= RING_TRAP.radius + 0.06, '磁环：滑进后敌不能再滑出');

  resetTrapZones();
  const [endRed, endBlue] = redBlue(10, 6, 10.4, 6);
  const endTrap = createSkillCaster('ring');
  fire(endTrap, endRed, 4, [endRed, endBlue]);
  advance(endTrap, endRed, [endRed, endBlue], RING_TRAP.windup + 0.05);
  assert(isInEnemyTrap(endBlue), '磁环：关死测应先出困圈');
  endRed.x = 2;
  endRed.y = 2;
  endRed.vx = 0;
  endRed.vy = 0;
  endBlue.vx = 0;
  endBlue.vy = 0;
  advance(endTrap, endRed, [endRed, endBlue], RING_TRAP.duration + 0.05);
  assert(!isInEnemyTrap(endBlue), '磁环：持续结束后困圈应消失');
  endBlue.x = 10.4;
  endBlue.y = 6;
  endBlue.vx = 8;
  endBlue.vy = 0;
  advance(endTrap, endRed, [endRed, endBlue], 0.5);
  assert(endBlue.x > 12.5, '磁环：圈结束后敌应能滑走');

  resetTrapZones();
  const hold = createSkillCaster('ring');
  const [holdRed, holdBlue] = redBlue(8, 6, 12, 6);
  hold.handleInput(holdRed, sample({ skillPress: 4 }), [holdRed, holdBlue]);
  assert(hold.getAimingSlot() === 4, '磁环：按下应进瞄');
  let holdLeft = 3;
  while (holdLeft > 1e-9) {
    const dt = Math.min(1 / 60, holdLeft);
    hold.tick(holdRed, dt, [holdRed, holdBlue]);
    holdLeft -= dt;
  }
  assert(hold.getAimingSlot() === 4, '磁环：瞄准可无限持有');
  assert(hold.getCds()[3] === 0 && holdBlue.hp === MAX_HP, '磁环：未释放不应出困圈');

  resetTrapZones();
  const hookKeep = createSkillCaster('hook');
  const [hookRed, hookBlue] = redBlue(8, 6, 12, 6);
  hookRed.hero = 'hook';
  fire(hookKeep, hookRed, 1, [hookRed, hookBlue]);
  advance(hookKeep, hookRed, [hookRed, hookBlue], HOOK_PULL.windup + 0.03);
  assert(Math.abs(hookBlue.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, '磁环：钩刺 kit 不应被拆坏');
  assert(Math.hypot(hookRed.vx, hookRed.vy) + 1e-6 >= FLOOR_SPEED - 0.2, '磁环：钩刺勾飞仍可动');

  resetTrapZones();
}
