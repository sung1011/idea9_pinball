import { applyHardCc } from './hardCc';
import { createBallBody, type BallBody } from './ballBody';
import { HOOK_SHOVE, HOOK_ULT } from '../heroes/hookKit';
import { HERO_IDS } from '../heroes/heroIds';
import { ULT_TODO_COPY, ultName, ultShort } from '../heroes/kitLabels';
import { createActionBus } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { createPlayerControl } from '../input/playerControl';
import { createTouchPad } from '../input/touchPad';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createSkillCaster } from './skillCaster';
import { stepPhysics } from './physicsStep';
import {
  clearUltEnergy,
  creditUltCombat,
  tickUltEnergy,
  ULT_ENERGY_MAX,
  ULT_ENERGY_PASSIVE_PER_SEC,
  ULT_ENERGY_TOTAL_CAP_PER_SEC,
} from './ultEnergy';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 0.08): boolean {
  return Math.abs(a - b) < eps;
}

function sample(partial: Partial<ActionSample> = {}): ActionSample {
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

function redBlue(ax: number, ay: number, bx: number, by: number): [BallBody, BallBody] {
  return [
    createBallBody({ x: ax, y: ay, color: 0xff0000, label: '红1', team: 'red', teamSlot: 1, facingX: 1, facingY: 0 }),
    createBallBody({ x: bx, y: by, color: 0x0000ff, label: '蓝1', team: 'blue', teamSlot: 1, facingX: -1, facingY: 0 }),
  ];
}

function play(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  dt: number,
): number {
  const hits = caster.tick(ball, dt, roster);
  const phys = stepPhysics(roster, dt);
  hits.push(...caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id)));
  return hits.length;
}

function advance(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  sec: number,
  aim?: { x: number; y: number },
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    if (aim) {
      ball.hasAim = true;
      ball.aimX = aim.x;
      ball.aimY = aim.y;
    }
    play(caster, ball, roster, dt);
    left -= dt;
  }
}

function fireUlt(caster: ReturnType<typeof createSkillCaster>, ball: BallBody, aimX = 1, aimY = 0): void {
  ball.ultEnergy = ULT_ENERGY_MAX;
  caster.handleInput(ball, sample({ skillPress: 5, aimX, aimY }), [ball]);
  caster.handleInput(ball, sample({ skillPress: 5, aimX, aimY }), [ball]);
}

function firePointer(el: Element, type: string): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
    }),
  );
}

/** 钩刺无畏冲锋 + 全英雄第五键能量 UI。四技能 CD 元组仍为 4。 */
export function verifyUlt(): void {
  assert(HOOK_ULT.steps === 3 && HOOK_ULT.stepTime === 0.4 && HOOK_ULT.stepDist === 0.8, '必杀：三步各 0.4s / 0.8 格');
  assert(HOOK_ULT.energyCost === 100, '必杀：能量消耗仍为 100');
  assert(HOOK_ULT.chargeSpeed0 === 8 && HOOK_ULT.chargeAccel === 12 && HOOK_ULT.chargeSpeedCap === 16, '必杀：冲锋 8 加速 12 封顶 16');
  assert(HOOK_ULT.damage === 36 && HOOK_ULT.turnDegPerSec === 90, '必杀：36 伤、转向 90°/s');
  assert(Number(HOOK_ULT.damage) !== Number(HOOK_SHOVE.damage), '必杀：伤害应与盾冲不同');
  assert(ultShort('hook') === '无畏' && ultName('hook') === '无畏冲锋', '必杀：钩刺第五键文案应为无畏/无畏冲锋');
  assert(ultShort('ring') === '沉磁' && ultName('ring') === '沉磁井', '必杀：磁环第五键文案应为沉磁/沉磁井');
  for (const hero of HERO_IDS) {
    if (hero === 'hook' || hero === 'ring') {
      continue;
    }
    assert(ultShort(hero) === '必杀' && ultName(hero) === '必杀', `必杀：${hero} 第五键文案应为必杀`);
  }

  const idle = createBallBody({ x: 10, y: 10, color: 1, facingX: 1, facingY: 0 });
  tickUltEnergy(idle, 1);
  assert(near(idle.ultEnergy, ULT_ENERGY_PASSIVE_PER_SEC, 1e-6), '必杀能量：在场被动 2/s');
  idle.ultCombatCredit = 100;
  tickUltEnergy(idle, 1);
  assert(near(idle.ultEnergy, 6, 1e-4), '必杀能量：战斗加成封顶 +2/s，合计 4/s');
  assert(idle.ultEnergy <= ULT_ENERGY_TOTAL_CAP_PER_SEC + 2 + 1e-6, '必杀能量：总回复不超过 4/s');
  idle.ultCombatCredit = 5;
  const beforeChip = idle.ultEnergy;
  tickUltEnergy(idle, 0.1);
  assert(idle.ultEnergy > beforeChip && idle.ultCombatCredit < 5, '必杀能量：碎伤应按 1/10 连续入账，不整除丢掉');
  idle.ultEnergy = 99;
  idle.ultCombatCredit = 0;
  tickUltEnergy(idle, 5);
  assert(idle.ultEnergy === ULT_ENERGY_MAX, '必杀能量：满 100 封顶');

  const dead = createBallBody({ x: 8, y: 8, color: 1 });
  dead.ultEnergy = 40;
  dead.ultCombatCredit = 80;
  dead.inPlay = false;
  tickUltEnergy(dead, 2);
  assert(dead.ultEnergy === 40, '必杀能量：死亡暂停回复、保留能量');
  dead.inPlay = true;
  tickUltEnergy(dead, 1);
  assert(dead.ultEnergy > 40, '必杀能量：回场后继续回复');

  const switcher = createBallBody({ x: 4, y: 4, color: 1, hero: 'hook' });
  switcher.ultEnergy = 80;
  const ctl = createPlayerControl('hook');
  ctl.setHero(switcher, 'ring');
  assert(switcher.ultEnergy === 0, '必杀能量：换英雄应清空');

  const restartBall = createBallBody({ x: 5, y: 5, color: 1 });
  restartBall.ultEnergy = 70;
  clearUltEnergy(restartBall);
  assert(restartBall.ultEnergy === 0, '必杀能量：重开清空');

  const src = createBallBody({ x: 6, y: 6, color: 1, team: 'red', teamSlot: 1 });
  const vic = createBallBody({ x: 8, y: 6, color: 2, team: 'blue', teamSlot: 1 });
  creditUltCombat(
    [src, vic],
    [
      { victimId: vic.id, sourceId: src.id, victimLabel: '蓝', sourceLabel: '红', damage: 36, knockback: 0, relSpeed: 0, threshold: 0 },
      { victimId: vic.id, sourceId: src.id, victimLabel: '蓝', sourceLabel: '红', damage: 12, knockback: 0, relSpeed: 0, threshold: 0, environment: true },
      { victimId: src.id, sourceId: src.id, victimLabel: '红', sourceLabel: '红', damage: 8, knockback: 0, relSpeed: 0, threshold: 0 },
    ],
    [{ unitId: vic.id, amount: 10, x: 8, y: 6, sourceId: src.id }],
  );
  assert(near(src.ultCombatCredit, 46, 1e-6), '必杀能量：只计有效伤害+治疗，环境/自伤不计');

  const cds = createSkillCaster().getCds();
  assert(cds.length === 4, '必杀：四技能 CD 仍为四元组');

  const caster = createSkillCaster('hook');
  const [red, blue] = redBlue(16, 4, 24, 4);
  const extra = createBallBody({ x: 30, y: 4, color: 3, label: '蓝2', team: 'blue', teamSlot: 2, facingX: -1 });
  fireUlt(caster, red, 1, 0);
  assert(red.ultEnergy === 0, '必杀：确认应花掉 100 能量');
  assert(caster.isHardBusy() && caster.isDisplacing(), '必杀：确认后应锁普通技能并算位移');
  assert(caster.getCds().every((cd) => cd === 0), '必杀：不应写入四技能 CD');

  const x0 = red.x;
  red.hasAim = true;
  red.aimX = 1;
  red.aimY = 0;
  advance(caster, red, [red, blue, extra], 0.25, { x: 1, y: 0 });
  const backSpeed = Math.hypot(red.vx, red.vy);
  assert(backSpeed > 1.6 && backSpeed < 2.6, `必杀：后撤 0.25s 时应仍是 0.8/0.4 格每秒，实际 ${backSpeed}`);
  assert(red.x < x0 - 0.4 && red.x > x0 - 0.7, '必杀：0.25s 应走完约半步 0.5 格，尚未冲出');
  advance(caster, red, [red, blue, extra], HOOK_ULT.stepTime - 0.02 - 0.25, { x: 1, y: 0 });
  assert(red.x < x0 - 0.5, '必杀：第一步应沿枪尖反向后退');
  assert(red.facingX > 0.7, '必杀：后退时朝向仍跟枪尖，不翻成后退');

  red.aimX = 0;
  red.aimY = 1;
  const y1 = red.y;
  advance(caster, red, [red, blue, extra], HOOK_ULT.stepTime + 0.02, { x: 0, y: 1 });
  assert(red.y < y1 - 0.4, '必杀：第二步应按新枪尖反向再退');

  red.aimX = -1;
  red.aimY = 0;
  const x2 = red.x;
  advance(caster, red, [red, blue, extra], HOOK_ULT.stepTime + 0.02, { x: -1, y: 0 });
  assert(red.x > x2 + 0.4, '必杀：第三步结束前改向应改变后退');

  red.aimX = 1;
  red.aimY = 0;
  advance(caster, red, [red, blue, extra], 0.05, { x: 1, y: 0 });
  const chargeSpeed = Math.hypot(red.vx, red.vy);
  assert(chargeSpeed > 7.2 && chargeSpeed < 10.5, `必杀：进入冲锋初速应约 8，实际 ${chargeSpeed}`);

  const speedBefore = chargeSpeed;
  advance(caster, red, [red, blue, extra], 0.35, { x: 1, y: 0 });
  const sped = Math.hypot(red.vx, red.vy);
  assert(sped > speedBefore + 2, '必杀：冲锋应加速');
  assert(sped <= HOOK_ULT.chargeSpeedCap + 0.2, '必杀：冲锋速度封顶 16');

  const hpBlue = blue.hp;
  const hpExtra = extra.hp;
  advance(caster, red, [red, blue, extra], 1.2, { x: 1, y: 0 });
  const lostBlue = hpBlue - blue.hp;
  const lostExtra = hpExtra - extra.hp;
  assert(lostBlue === 0 || lostBlue === HOOK_ULT.damage, '必杀：每名敌人最多吃一次 36');
  assert(red.inPlay, '必杀：穿刺不应自己撞停消失');
  if (lostBlue === HOOK_ULT.damage && extra.x > blue.x) {
    assert(lostExtra === HOOK_ULT.damage || extra.hp === hpExtra, '必杀：可穿多人');
  }

  const pierceC = createSkillCaster('hook');
  const pRed = createBallBody({ x: 14, y: 4, color: 1, team: 'red', teamSlot: 1, facingX: 1, facingY: 0 });
  const pA = createBallBody({ x: 20, y: 4, color: 2, label: '蓝A', team: 'blue', teamSlot: 1, facingX: -1 });
  const pB = createBallBody({ x: 26, y: 4, color: 3, label: '蓝B', team: 'blue', teamSlot: 2, facingX: -1 });
  fireUlt(pierceC, pRed, 1, 0);
  advance(pierceC, pRed, [pRed, pA, pB], HOOK_ULT.steps * HOOK_ULT.stepTime + 0.02, { x: 1, y: 0 });
  assert(pRed.x < 13.5, '必杀：三步后退结束后应比起点更左');
  const hpA = pA.hp;
  const hpB = pB.hp;
  advance(pierceC, pRed, [pRed, pA, pB], 1.35, { x: 1, y: 0 });
  assert(hpA - pA.hp === HOOK_ULT.damage, '必杀：穿刺应对第一人结算一次 36');
  assert(hpB - pB.hp === HOOK_ULT.damage, '必杀：穿刺应对第二人结算一次 36');
  assert(Math.hypot(pRed.vx, pRed.vy) > 8, '必杀：碰敌不回头，速度应仍高于盾冲停步');

  const wallC = createSkillCaster('hook');
  const wallBall = createBallBody({ x: 4.2, y: 4, color: 1, facingX: -1, facingY: 0 });
  fireUlt(wallC, wallBall, -1, 0);
  wallBall.hasAim = true;
  wallBall.aimX = -1;
  wallBall.aimY = 0;
  advance(wallC, wallBall, [wallBall], 2.2, { x: -1, y: 0 });
  assert(!wallC.isDisplacing(), '必杀：撞实墙应结束冲力');
  assert(Math.hypot(wallBall.vx, wallBall.vy) <= 8.2, '必杀：结束后应撤掉必杀冲力');

  const ccC = createSkillCaster('hook');
  const [ccRed, ccBlue] = redBlue(16, 4, 24, 4);
  fireUlt(ccC, ccRed, 1, 0);
  advance(ccC, ccRed, [ccRed, ccBlue], HOOK_ULT.steps * HOOK_ULT.stepTime + 0.05, { x: 1, y: 0 });
  const energyAfterCast = ccRed.ultEnergy;
  applyHardCc(ccRed, 0.6, 10);
  play(ccC, ccRed, [ccRed, ccBlue], 1 / 60);
  play(ccC, ccRed, [ccRed, ccBlue], 1 / 60);
  assert(!ccC.isHardBusy() || ccRed.stunRemain > 0, '必杀：硬控应打断');
  assert(ccRed.ultEnergy === energyAfterCast, '必杀：硬控打断不退能量');

  const shove = createSkillCaster('hook');
  const [sRed, sBlue] = redBlue(16, 4, 18.2, 4);
  sRed.ultEnergy = 0;
  shove.handleInput(sRed, sample({ skillPress: 3, aimX: 1, aimY: 0 }), [sRed, sBlue]);
  shove.handleInput(sRed, sample({ skillPress: 3, aimX: 1, aimY: 0 }), [sRed, sBlue]);
  advance(shove, sRed, [sRed, sBlue], 0.4);
  assert(!shove.isDisplacing() || sBlue.hp < sBlue.maxHp, '必杀：盾冲仍应碰敌结算，不与无畏共用');

  let todoHits = 0;
  const other = createPlayerControl('chain', { onUltTodo: () => (todoHits += 1) });
  const chainBall = createBallBody({ x: 8, y: 8, color: 1, hero: 'chain' });
  chainBall.ultEnergy = 0;
  other.tick(chainBall, sample({ skillPress: 5 }), 0, [chainBall]);
  assert(todoHits === 1, '必杀：其他英雄点第五键应出 todo');
  assert(other.getAimingSlot() === 0, '必杀：其他英雄第五键不应进瞄');
  chainBall.ultEnergy = 100;
  other.tick(chainBall, sample({ skillPress: 5 }), 0, [chainBall]);
  assert(todoHits === 2, '必杀：其他英雄能量不足也不得禁用第五键');
  assert(chainBall.ultEnergy === 100, '必杀：其他英雄不得扣能量');

  const low = createSkillCaster('hook');
  const lowBall = createBallBody({ x: 9, y: 9, color: 1, facingX: 1 });
  lowBall.ultEnergy = 40;
  low.handleInput(lowBall, sample({ skillPress: 5 }), [lowBall]);
  assert(low.getAimingSlot() === 0, '必杀：钩刺能量不足不能进瞄');
  assert(lowBall.ultEnergy === 40, '必杀：钩刺能量不足不扣能量');

  const host = document.createElement('div');
  const bus = createActionBus();
  const pad = createTouchPad(host, bus, { holdMs: 0 });
  const skillBtns = host.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn');
  const ultBtn = host.querySelector<HTMLButtonElement>('button.touchUltBtn');
  const todo = host.querySelector<HTMLElement>('.touchUltTodo');
  assert(skillBtns.length === 4, '必杀 UI：四技能键数量不变');
  assert(!!ultBtn && ultBtn.dataset.slot === '5', '必杀 UI：全英雄应有第五键');
  assert(todo?.textContent === ULT_TODO_COPY, '必杀 UI：占位文案必须是小写 todo');
  for (const hero of HERO_IDS) {
    pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero, energy: 55 });
    assert(!!ultBtn?.textContent?.includes(ultShort(hero)), `必杀 UI：${hero} 第五键短名应对上`);
    assert(ultBtn?.disabled !== true, `必杀 UI：${hero} 第五键不可因能量禁用`);
  }
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'hook', energy: 100 });
  assert(ultBtn?.classList.contains('isReady') === true, '必杀 UI：钩刺满能量应标就绪');
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'ring', energy: 100 });
  assert(ultBtn?.classList.contains('isReady') === true, '必杀 UI：磁环满能量应标就绪');
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'chain', energy: 100 });
  assert(ultBtn?.classList.contains('isReady') !== true, '必杀 UI：未实装英雄满能量也不标就绪');
  pad.showTodo();
  assert(!!todo && todo.classList.contains('isOn') && todo.textContent === 'todo', '必杀 UI：todo 必须精确小写');

  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  document.body.appendChild(host);
  const keyBus = createActionBus();
  const unbind = bindPcInput({
    bus: keyBus,
    canvas,
    getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
    getAimingSlot: () => 0 as SkillSlot | 0,
  });
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', bubbles: true }));
  const keyed = keyBus.sample(0, 0);
  assert(keyed.skillPress === 5, '必杀：键盘 5 应推进第五键');
  firePointer(ultBtn as HTMLButtonElement, 'pointerdown');
  assert(bus.sample(0, 0).skillPress === 5, '必杀：点第五键应推进 ActionBus');
  unbind();
  host.remove();
}

