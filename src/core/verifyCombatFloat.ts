import { applyHealHot, applyShield, createBallBody, tickHeal } from './ballBody';
import {
  COMBAT_FLOAT_COLOR,
  combatFloatColor,
  combatFloatStackOffset,
  floatsFromHits,
  floatsFromShield,
  formatCombatFloat,
  resetCombatFloatAcc,
  takeHealFloats,
} from './combatFloat';
import { applyCollisionCombat } from './collisionDamage';
import { BALL_RADIUS, MAX_HP } from './constants';
import { stepPhysics } from './physicsStep';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

/** 飘字：仅数字、三色通道、挂在现有掉血/回血结算上。 */
export function verifyCombatFloat(): void {
  resetCombatFloatAcc();

  assert(formatCombatFloat('damage', 12.4) === '-12', '飘字：伤害应显示 -12');
  assert(formatCombatFloat('heal', 8) === '+8', '飘字：治疗应显示 +8');
  assert(formatCombatFloat('shield', 5.2) === '+5', '飘字：护盾应显示 +5');
  assert(combatFloatColor('damage') === COMBAT_FLOAT_COLOR.damage, '飘字：伤害应为红橙');
  assert(combatFloatColor('heal') === COMBAT_FLOAT_COLOR.heal, '飘字：治疗应为绿');
  assert(combatFloatColor('shield') === COMBAT_FLOAT_COLOR.shield, '飘字：护盾应为青');
  assert(COMBAT_FLOAT_COLOR.damage === 0xff6a2a, '飘字：伤害色锁定红橙');
  assert(COMBAT_FLOAT_COLOR.heal === 0x3dcc6f, '飘字：治疗色锁定绿');
  assert(COMBAT_FLOAT_COLOR.shield === 0x3ec8d8, '飘字：护盾色锁定青');

  const a = combatFloatStackOffset(0);
  const b = combatFloatStackOffset(1);
  const c = combatFloatStackOffset(2);
  assert(a.dx === 0 && a.dy === 0, '飘字：首个应在结算点');
  assert(Math.abs(b.dx) > 0.2 && Math.abs(c.dx) > 0.2 && b.dx * c.dx < 0, '飘字：同帧应左右错开');

  const hitA = createBallBody({
    x: 10 - BALL_RADIUS * 1.1,
    y: 6,
    color: 0xe24a4a,
    label: '红',
    vx: 8,
    vy: 0,
    facingX: 1,
    team: 'red',
  });
  const hitB = createBallBody({
    x: 10 + BALL_RADIUS * 1.1,
    y: 6,
    color: 0x3d7cf0,
    label: '蓝',
    vx: -8,
    vy: 0,
    facingX: -1,
    team: 'blue',
  });
  const hits = applyCollisionCombat(hitA, hitB, 1, 0, 16);
  assert(hits.length >= 2, '飘字：对撞应结算双方伤害');
  const dmgFloats = floatsFromHits(hits, [hitA, hitB]);
  assert(dmgFloats.length === hits.filter((h) => h.damage > 0).length, '飘字：每段掉血一条');
  assert(
    dmgFloats.every((ev) => ev.kind === 'damage' && ev.amount > 0),
    '飘字：碰撞结算应为伤害数字',
  );
  const victimA = dmgFloats.find((ev) => ev.unitId === hitA.id);
  assert(!!victimA && Math.abs(victimA.x - hitA.x) < 1e-6, '飘字：应从受击单位冒出');
  assert(hitA.hp < MAX_HP && hitB.hp < MAX_HP, '飘字：不应改掉血公式');

  const scrapeA = createBallBody({
    x: 8.8,
    y: 5.3,
    color: 0xe24a4a,
    vx: 2,
    facingX: 1,
    team: 'red',
  });
  const scrapeB = createBallBody({
    x: 10.2,
    y: 6.6,
    color: 0x3d7cf0,
    vx: 2,
    facingX: 1,
    team: 'blue',
  });
  const scrapeHits = applyCollisionCombat(scrapeA, scrapeB, 1, 0, 2);
  assert(scrapeHits.length === 0, '飘字：无枪尖命中无伤害事件');
  assert(floatsFromHits(scrapeHits, [scrapeA, scrapeB]).length === 0, '飘字：无枪尖命中不应出字');

  const healBall = createBallBody({ x: 8, y: 6, color: 0xe24a4a, hp: 70 });
  applyHealHot(healBall, 6, 4);
  const pulses = [];
  for (let i = 0; i < 12; i += 1) {
    const gained = tickHeal(healBall, 1 / 60);
    pulses.push({ unitId: healBall.id, amount: gained, x: healBall.x, y: healBall.y });
  }
  const healFloats = takeHealFloats(pulses);
  assert(healFloats.length >= 1, '飘字：HOT 应冒出绿色数字');
  assert(
    healFloats.every((ev) => ev.kind === 'heal' && ev.amount >= 1),
    '飘字：治疗应为正整数',
  );
  assert(Math.abs(healBall.hp - (70 + 6 * (12 / 60))) < 0.08, '飘字：不应改回血数值');

  resetCombatFloatAcc();
  const burst = takeHealFloats([{ unitId: 99, amount: 8, x: 3, y: 4 }]);
  assert(burst.length === 1 && burst[0].amount === 8 && formatCombatFloat('heal', burst[0].amount) === '+8', '飘字：整段回血应一次 +8');

  const shieldBall = createBallBody({ x: 5, y: 5, color: 0x86efac });
  applyShield(shieldBall, 0.45, 3.2);
  assert(floatsFromShield([]).length === 0, '飘字：无护盾数值事件应跳过');
  const reserved = floatsFromShield([{ unitId: shieldBall.id, amount: 6, x: shieldBall.x, y: shieldBall.y }]);
  assert(reserved.length === 1 && reserved[0].kind === 'shield', '飘字：护盾通道有事件才显示');
  assert(formatCombatFloat('shield', reserved[0].amount) === '+6', '飘字：护盾只显示数字');

  resetCombatFloatAcc();
  const hot = createBallBody({ x: 7, y: 7, color: 0xe24a4a, hp: 80 });
  applyHealHot(hot, 6, 2);
  let physHeals = 0;
  for (let i = 0; i < 20; i += 1) {
    const step = stepPhysics([hot], 1 / 60);
    physHeals += step.heals.reduce((sum, item) => sum + item.amount, 0);
  }
  assert(physHeals > 1.5, '飘字：物理步进应带出治疗结算量');
  assert(Math.abs(hot.hp - (80 + physHeals)) < 1e-6, '飘字：步进回血与结算量应一致');
  resetCombatFloatAcc();
}
