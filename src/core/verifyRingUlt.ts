import { Container, Text } from 'pixi.js';
import { applyHardCc } from './hardCc';
import { createBallBody, type BallBody } from './ballBody';
import {
  EIGHT_KILL_RIFT_ENABLED,
  FLOOR_SPEED,
  FRICTION,
  LEFT_PILLAR,
  PILLAR_WIDTH,
  POTION_FIRST_SEC,
  POTION_INTERVAL_SEC,
  SPEED_CAP,
} from './constants';
import { HOOK_SHOVE, HOOK_ULT } from '../heroes/hookKit';
import { RING_FIELD, RING_TRAP, RING_ULT, ringUltCenter } from '../heroes/ringKit';
import { ultName, ultShort, ultTip } from '../heroes/kitLabels';
import type { ActionSample } from '../input/actionTypes';
import { createPlayerControl } from '../input/playerControl';
import { createSkillCaster } from './skillCaster';
import { creditUltCombat, ULT_ENERGY_MAX } from './ultEnergy';
import { createCombatStats } from './combatStats';
import type { CollisionHit } from './collisionDamage';
import { applyPotionToBall } from './potionField';
import { stepPhysics } from './physicsStep';
import {
  countWellN,
  listMagnetWells,
  magnetPullAccel,
  pickMagnetWellFor,
  placeMagnetWell,
  resetMagnetWells,
  wellBlastDamage,
} from './magnetWells';
import { createAimPreview } from '../render/aimPreview';
import { createFieldOverlay } from '../render/fieldOverlay';
import { arenaPillarsEnabled, setArenaPillarsEnabled } from './wallBounce';

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

function pin(ball: BallBody): void {
  ball.pinLocked = true;
  ball.pinRemain = 30;
  ball.pinX = ball.x;
  ball.pinY = ball.y;
  ball.vx = 0;
  ball.vy = 0;
}

function makeRing(x: number, y: number): BallBody {
  return createBallBody({
    x,
    y,
    color: 0xe24a4a,
    label: '红1',
    team: 'red',
    teamSlot: 1,
    facingX: 1,
    facingY: 0,
    hero: 'ring',
  });
}

function makeBlue(x: number, y: number, slot = 1): BallBody {
  return createBallBody({
    x,
    y,
    color: 0x3d7cf0,
    label: `蓝${slot}`,
    team: 'blue',
    teamSlot: slot,
    facingX: -1,
    facingY: 0,
    hero: 'hook',
  });
}

function fireUlt(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  extra: Partial<ActionSample> = {},
): void {
  ball.ultEnergy = ULT_ENERGY_MAX;
  caster.handleInput(ball, sample({ skillPress: 5, aimX: 1, aimY: 0, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: 5, aimX: 1, aimY: 0, ...extra }), roster);
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

function collectTexts(node: Container): Text[] {
  const out: Text[] = [];
  for (const child of node.children) {
    if (child instanceof Text) {
      out.push(child);
    } else if (child instanceof Container) {
      out.push(...collectTexts(child));
    }
  }
  return out;
}

/** 磁环第五键沉磁井：能量、投放、吸力、N、多圈、护盾、回归。 */
export function verifyRingUlt(): void {
  resetMagnetWells();
  assert(RING_ULT.energyCost === 100, '沉磁井：能量消耗应为 100');
  assert(RING_ULT.placeRange === 6 && RING_ULT.radius === 4 && RING_ULT.duration === 3, '沉磁井：投放 6 / 半径 4 / 持续 3');
  assert(RING_ULT.damageBase === 20 && RING_ULT.damagePerN === 10, '沉磁井：爆炸 20+10N');
  assert(RING_ULT.pullAccel === 7 && RING_ULT.pullSoftRadius === 0.9, '沉磁井：吸力首测 accel=7 soft=0.9');
  assert(FRICTION === Math.log(SPEED_CAP / 0.4) / 2, '沉磁井：不得改全局摩擦');
  assert(SPEED_CAP === 8 && FLOOR_SPEED === 2.5, '沉磁井：不得改全局速度上限/保底');
  assert(EIGHT_KILL_RIFT_ENABLED === false, '沉磁井：八杀环境圈仍关闭');
  assert(POTION_FIRST_SEC === 10 && POTION_INTERVAL_SEC === 45, '沉磁井：药剂 10s 首刷 / 45s 间隔不得回退');
  assert(ultShort('ring') === '沉磁' && ultName('ring') === '沉磁井', '沉磁井：对外暂名');
  assert(ultTip('ring').includes('3') && ultTip('ring').includes('4'), '沉磁井：长按提示应含 3 秒与半径 4');
  assert(HOOK_ULT.damage === 36 && HOOK_SHOVE.damage === 12, '沉磁井：钩刺必杀/盾冲数值回归');
  assert(RING_TRAP.radius === 2.5 && RING_FIELD.dps === 6, '沉磁井：磁环四技能数值回归');

  const placed = ringUltCenter({ x: 10, y: 6 }, 20, 6, true);
  assert(near(placed.x, 16, 1e-6) && placed.y === 6, '沉磁井：落点应夹在距己 6 格内');
  const self = ringUltCenter({ x: 10, y: 6 });
  assert(self.x === 10 && self.y === 6, '沉磁井：无点地时圆心应为自身');

  const cancelC = createSkillCaster('ring');
  const cancelBall = makeRing(10, 10);
  cancelBall.ultEnergy = 100;
  cancelC.handleInput(cancelBall, sample({ skillPress: 5 }), [cancelBall]);
  assert(cancelC.getAimingSlot() === 5, '沉磁井：满能量应按下进瞄');
  cancelC.handleInput(cancelBall, sample({ cancelAim: true }), [cancelBall]);
  assert(cancelC.getAimingSlot() === 0, '沉磁井：取消应退出瞄准');
  assert(cancelBall.ultEnergy === 100, '沉磁井：瞄准取消不耗能量');
  assert(listMagnetWells().length === 0, '沉磁井：取消不应落地');

  const lowC = createSkillCaster('ring');
  const lowBall = makeRing(8, 8);
  lowBall.ultEnergy = 40;
  lowC.handleInput(lowBall, sample({ skillPress: 5 }), [lowBall]);
  assert(lowC.getAimingSlot() === 0 && lowBall.ultEnergy === 40, '沉磁井：能量不足不能进瞄、不扣能');

  const caster = createSkillCaster('ring');
  const red = makeRing(12, 10);
  const ally = createBallBody({
    x: 13,
    y: 10,
    color: 0xc43d3d,
    label: '红2',
    team: 'red',
    teamSlot: 2,
    hero: 'hook',
  });
  const blue = makeBlue(14, 10);
  fireUlt(caster, red, [red, ally, blue], { pointerX: 18, pointerY: 10, hasPointer: true });
  assert(red.ultEnergy === 0, '沉磁井：成功放出应扣 100 能量');
  assert(!caster.isHardBusy() && !caster.isDisplacing(), '沉磁井：落地后不锁普通技能/位移');
  assert(caster.getCds().every((cd) => cd === 0), '沉磁井：不应写入四技能 CD');
  const wells = listMagnetWells();
  assert(wells.length === 1, '沉磁井：确认后应立即有一圈');
  assert(near(wells[0].x, 18, 1e-6) && wells[0].y === 10, '沉磁井：落点固定在夹限后的点');
  assert(wells[0].radius === 4 && near(wells[0].remain, 3, 1e-6), '沉磁井：半径 4、立即开始 3 秒并无额外预警');

  red.x = 8;
  red.y = 8;
  play(caster, red, [red, ally, blue], 1 / 60);
  assert(near(listMagnetWells()[0]?.x ?? 0, 18, 1e-6), '沉磁井：确认后圆心不跟随施法者');

  caster.handleInput(red, sample({ skillPress: 1 }), [red, ally, blue]);
  caster.handleInput(red, sample({ skillPress: 1 }), [red, ally, blue]);
  assert(Math.abs(caster.getCds()[0] - RING_FIELD.cd) < 1e-6, '沉磁井：落地后仍可放辉环');

  resetMagnetWells();
  const edgeC = createSkillCaster('ring');
  const edgeRed = makeRing(10, 10);
  const inBlue = makeBlue(14, 10);
  const outBlue = makeBlue(14.02, 10, 2);
  pin(edgeRed);
  pin(inBlue);
  pin(outBlue);
  fireUlt(edgeC, edgeRed, [edgeRed, inBlue, outBlue], { pointerX: 10, pointerY: 10, hasPointer: true });
  const well0 = listMagnetWells()[0];
  assert(well0 && countWellN(well0, [edgeRed, inBlue, outBlue]) === 2, '沉磁井：圆心距<=4 含边界算圈内，4 外不算');

  resetMagnetWells();
  const timed = createSkillCaster('ring');
  const tRed = makeRing(10, 10);
  const tBlue = makeBlue(11.2, 10);
  pin(tRed);
  pin(tBlue);
  fireUlt(timed, tRed, [tRed, tBlue], { pointerX: 10, pointerY: 10, hasPointer: true });
  const hpBefore = tBlue.hp;
  advance(timed, tRed, [tRed, tBlue], RING_ULT.duration - 1 / 60);
  assert(listMagnetWells().length === 1, '沉磁井：3s 前不应爆炸');
  assert(tBlue.hp === hpBefore, '沉磁井：吸阶段不应提前爆炸伤');
  advance(timed, tRed, [tRed, tBlue], 1 / 60);
  assert(listMagnetWells().length === 0, '沉磁井：满 3s 应爆炸并收圈');
  const nTimed = 2;
  assert(hpBefore - tBlue.hp === wellBlastDamage(nTimed), '沉磁井：恰 3s 一次爆炸，伤害 20+10N');
  const stunBefore = tBlue.stunRemain;
  const vxBefore = tBlue.vx;
  assert(stunBefore === 0, '沉磁井：爆炸不眩晕');
  advance(timed, tRed, [tRed, tBlue], 1);
  assert(listMagnetWells().length === 0, '沉磁井：只爆炸一次');
  assert(tBlue.stunRemain === 0, '沉磁井：爆炸后仍不眩晕');
  assert(Math.abs(tBlue.vx - vxBefore) < 3 || tBlue.pinLocked, '沉磁井：爆炸不击退');

  resetMagnetWells();
  const nC = createSkillCaster('ring');
  const nRed = makeRing(10, 10);
  const nAlly = createBallBody({
    x: 11,
    y: 10,
    color: 0xc43d3d,
    label: '红2',
    team: 'red',
    teamSlot: 2,
    hero: 'hook',
  });
  const nB1 = makeBlue(12, 10, 1);
  const nB2 = makeBlue(10, 12, 2);
  for (const ball of [nRed, nAlly, nB1, nB2]) {
    pin(ball);
  }
  fireUlt(nC, nRed, [nRed, nAlly, nB1, nB2], { pointerX: 10, pointerY: 10, hasPointer: true });
  const nWell = listMagnetWells()[0];
  assert(nWell && countWellN(nWell, [nRed, nAlly, nB1, nB2]) === 4, '沉磁井：N 含敌我与本人');
  const hpAlly = nAlly.hp;
  const hpRed = nRed.hp;
  const hpB1 = nB1.hp;
  advance(nC, nRed, [nRed, nAlly, nB1, nB2], RING_ULT.duration);
  const expect = wellBlastDamage(4);
  assert(hpB1 - nB1.hp === expect && nB2.maxHp - nB2.hp === expect, '沉磁井：每名敌人吃完整 20+10N，不分摊');
  assert(nAlly.hp === hpAlly && nRed.hp === hpRed, '沉磁井：友军与本人不受爆炸伤');

  resetMagnetWells();
  const deadC = createSkillCaster('ring');
  const dRed = makeRing(10, 10);
  const dBlue = makeBlue(12, 10);
  pin(dRed);
  pin(dBlue);
  fireUlt(deadC, dRed, [dRed, dBlue], { pointerX: 10, pointerY: 10, hasPointer: true });
  applyHardCc(dRed, 0.6, 0);
  assert(listMagnetWells().length === 1, '沉磁井：施法者被控不取消');
  dRed.inPlay = false;
  dRed.hp = 0;
  dRed.stunRemain = 0;
  const dWell = listMagnetWells()[0];
  assert(dWell && countWellN(dWell, [dRed, dBlue]) === 1, '沉磁井：阵亡本人不计 N');
  advance(deadC, dRed, [dRed, dBlue], RING_ULT.duration);
  assert(listMagnetWells().length === 0, '沉磁井：施法者阵亡后圈仍独立爆炸');
  assert(dBlue.maxHp - dBlue.hp === wellBlastDamage(1), '沉磁井：死者离场后 N=1，伤 30');
  assert(dBlue.stunRemain === 0, '沉磁井：爆炸不眩晕');

  resetMagnetWells();
  const invC = createSkillCaster('ring');
  const iRed = makeRing(10, 10);
  const iBlue = makeBlue(12, 10);
  const iInv = makeBlue(10, 12, 2);
  iInv.invincibleRemain = 5;
  pin(iRed);
  pin(iBlue);
  pin(iInv);
  fireUlt(invC, iRed, [iRed, iBlue, iInv], { pointerX: 10, pointerY: 10, hasPointer: true });
  const iWell = listMagnetWells()[0];
  assert(iWell && countWellN(iWell, [iRed, iBlue, iInv]) === 2, '沉磁井：无敌不计人数');
  assert(pickMagnetWellFor(iInv) === null, '沉磁井：无敌不受吸');
  const invHp = iInv.hp;
  advance(invC, iRed, [iRed, iBlue, iInv], RING_ULT.duration);
  assert(iInv.hp === invHp, '沉磁井：无敌不受爆炸伤');
  assert(iBlue.maxHp - iBlue.hp === wellBlastDamage(2), '沉磁井：爆炸按不含无敌的 N');

  resetMagnetWells();
  const shC = createSkillCaster('ring');
  const shRed = makeRing(10, 10);
  const shBlue = makeBlue(12, 10);
  pin(shRed);
  pin(shBlue);
  applyPotionToBall(shBlue, 'shield');
  fireUlt(shC, shRed, [shRed, shBlue], { pointerX: 10, pointerY: 10, hasPointer: true });
  const shN = countWellN(listMagnetWells()[0], [shRed, shBlue]);
  assert(shN === 2, '沉磁井：护盾单位正常计数');
  const shieldHp = shBlue.potionShieldHp;
  const hpSh = shBlue.hp;
  advance(shC, shRed, [shRed, shBlue], RING_ULT.duration);
  const want = wellBlastDamage(2);
  assert(shBlue.hp === hpSh, '沉磁井：护盾应吸收爆炸伤、本体不掉血');
  assert(near(shBlue.potionShieldHp, shieldHp - want, 1e-6), '沉磁井：护盾按已有规则吸收完整伤');

  resetMagnetWells();
  const a = placeMagnetWell({ ownerId: 1, ownerTeam: 'red', x: 10, y: 10 });
  const b = placeMagnetWell({ ownerId: 2, ownerTeam: 'blue', x: 16, y: 10 });
  const mid = makeBlue(13, 10);
  const pickMid = pickMagnetWellFor(mid);
  assert(pickMid?.id === a.id, '沉磁井：等距取先生成圈');
  mid.x = 13.2;
  assert(pickMagnetWellFor(mid)?.id === b.id, '沉磁井：更近的圈应接管，不叠加');
  mid.x = 13;
  assert(pickMagnetWellFor(mid)?.id === a.id, '沉磁井：回到等距仍锁先生成圈，避免来回切换');

  resetMagnetWells();
  const snapRed = makeRing(10, 10);
  const e1 = makeBlue(11, 10, 1);
  const e2 = makeBlue(10, 11.5, 2);
  e1.hp = 10;
  pin(snapRed);
  pin(e1);
  pin(e2);
  placeMagnetWell({ ownerId: snapRed.id, ownerTeam: snapRed.team, x: 10, y: 10, remain: 1 / 120 });
  placeMagnetWell({ ownerId: snapRed.id, ownerTeam: snapRed.team, x: 10.2, y: 10, remain: 1 / 120 });
  const nSnap = countWellN(listMagnetWells()[0], [snapRed, e1, e2]);
  assert(nSnap === 3, '沉磁井：同帧快照前 N=3');
  const hpE2 = e2.hp;
  stepPhysics([snapRed, e1, e2], 1 / 60);
  const lost = hpE2 - e2.hp;
  assert(lost === wellBlastDamage(3) * 2, `沉磁井：同帧两圈应按伤前 N 各结算完整伤，实际 ${lost}`);
  assert(e1.hp === 0, '沉磁井：低血敌人可被第一圈打到 0，但不改后圈 N');

  const pullPillars = arenaPillarsEnabled();
  setArenaPillarsEnabled(false);
  try {
  resetMagnetWells();
  const pullC = createSkillCaster('ring');
  const pRed = makeRing(22, 10);
  fireUlt(pullC, pRed, [pRed], { pointerX: 22, pointerY: 10, hasPointer: true });
  const center = listMagnetWells()[0];
  assert(!!center, '沉磁井：吸力校准需要落地圈');
  const slider = makeBlue(center.x, center.y - 3);
  slider.vx = 2.5;
  slider.vy = 0;
  slider.facingX = 1;
  slider.frictionMul = 1;
  const slideStart = Math.hypot(slider.x - center.x, slider.y - center.y);
  let slideLeft = 1;
  while (slideLeft > 1e-9) {
    const dt = Math.min(1 / 60, slideLeft);
    stepPhysics([slider], dt);
    slideLeft -= dt;
  }
  const slideEnd = Math.hypot(slider.x - center.x, slider.y - center.y);
  const inward = slideStart - slideEnd;
  assert(inward >= 1.0, `沉磁井：普通滑行 2.5 切向 1s 应明显内偏，实际内移 ${inward.toFixed(3)} 格（accel=${RING_ULT.pullAccel}）`);

  resetMagnetWells();
  placeMagnetWell({ ownerId: 9, ownerTeam: 'red', x: 22, y: 10 });
  const fastWell = listMagnetWells()[0];
  const fast = makeBlue(fastWell.x, fastWell.y - 3.8);
  fast.vx = 8;
  fast.vy = 0;
  fast.facingX = 1;
  let fastLeft = 0.4;
  let escaped = false;
  while (fastLeft > 1e-9) {
    const dt = Math.min(1 / 60, fastLeft);
    stepPhysics([fast], dt);
    fastLeft -= dt;
    if (Math.hypot(fast.x - fastWell.x, fast.y - fastWell.y) > RING_ULT.radius) {
      escaped = true;
      break;
    }
  }
  assert(escaped, `沉磁井：高速切向 8 应仍有机会脱离，终点距 ${Math.hypot(fast.x - fastWell.x, fast.y - fastWell.y).toFixed(3)}`);

  resetMagnetWells();
  placeMagnetWell({ ownerId: 9, ownerTeam: 'red', x: 22, y: 10 });
  const dashWell = listMagnetWells()[0];
  const dasher = makeBlue(dashWell.x - 2.2, dashWell.y);
  dasher.vx = -(HOOK_SHOVE.dashDist / HOOK_SHOVE.dashTime);
  dasher.vy = 0;
  dasher.allowOverCap = true;
  dasher.frictionMul = 0;
  let dashLeft = HOOK_SHOVE.dashTime;
  let dashEscaped = false;
  while (dashLeft > 1e-9) {
    const dt = Math.min(1 / 60, dashLeft);
    stepPhysics([dasher], dt);
    dashLeft -= dt;
    dasher.allowOverCap = true;
    dasher.frictionMul = 0;
    if (Math.hypot(dasher.x - dashWell.x, dasher.y - dashWell.y) > RING_ULT.radius) {
      dashEscaped = true;
      break;
    }
  }
  const dashDist = Math.hypot(dasher.x - dashWell.x, dasher.y - dashWell.y);
  assert(dashEscaped, `沉磁井：位移技高速应仍有机会冲出，终点距 ${dashDist.toFixed(3)}`);

  resetMagnetWells();
  placeMagnetWell({ ownerId: 9, ownerTeam: 'red', x: 22, y: 10 });
  const jitter = makeBlue(22.12, 10);
  jitter.vx = 0.2;
  jitter.vy = 0.15;
  const aNear = magnetPullAccel(0.12);
  const aFar = magnetPullAccel(3);
  assert(aNear < aFar * 0.25, `沉磁井：中心吸力应平滑减弱 ${aNear.toFixed(3)} vs ${aFar.toFixed(3)}`);
  let maxSpeed = 0;
  let jitLeft = 0.6;
  while (jitLeft > 1e-9) {
    const dt = Math.min(1 / 60, jitLeft);
    stepPhysics([jitter], dt);
    maxSpeed = Math.max(maxSpeed, Math.hypot(jitter.vx, jitter.vy));
    jitLeft -= dt;
  }
  const jitDist = Math.hypot(jitter.x - 22, jitter.y - 10);
  assert(maxSpeed < SPEED_CAP + 0.2, `沉磁井：中心附近不应把速度拉爆，最大 ${maxSpeed.toFixed(3)}`);
  assert(jitDist < 2.2, `沉磁井：中心附近应稳住，不来回甩出，终点距 ${jitDist.toFixed(3)}`);
  } finally {
    setArenaPillarsEnabled(pullPillars);
  }

  const prevPillars = arenaPillarsEnabled();
  setArenaPillarsEnabled(true);
  resetMagnetWells();
  const pillarX = LEFT_PILLAR.x;
  const pillarY = LEFT_PILLAR.y;
  placeMagnetWell({ ownerId: 9, ownerTeam: 'red', x: pillarX - 4, y: pillarY });
  const blocked = makeBlue(pillarX + PILLAR_WIDTH / 2 + 1.2, pillarY);
  blocked.vx = 0;
  blocked.vy = 0;
  const startX = blocked.x;
  let wallLeft = 1.2;
  while (wallLeft > 1e-9) {
    const dt = Math.min(1 / 60, wallLeft);
    stepPhysics([blocked], dt);
    wallLeft -= dt;
  }
  assert(blocked.x > pillarX, `沉磁井：吸力不得拉穿实体矮柱，起点 ${startX.toFixed(2)} 终点 ${blocked.x.toFixed(2)}`);
  setArenaPillarsEnabled(prevPillars);

  resetMagnetWells();
  const credC = createSkillCaster('ring');
  const cRed = makeRing(10, 10);
  const cBlue = makeBlue(12, 10);
  pin(cRed);
  pin(cBlue);
  fireUlt(credC, cRed, [cRed, cBlue], { pointerX: 10, pointerY: 10, hasPointer: true });
  const stats = createCombatStats();
  advance(credC, cRed, [cRed, cBlue], RING_ULT.duration);
  const blastHits: CollisionHit[] = [
    {
      victimId: cBlue.id,
      sourceId: cRed.id,
      victimLabel: cBlue.label,
      sourceLabel: cRed.label,
      damage: wellBlastDamage(2),
      knockback: 0,
      relSpeed: 0,
      threshold: 0,
      noUltCredit: true,
      environment: false,
    },
  ];
  const energyBefore = cRed.ultEnergy;
  creditUltCombat([cRed, cBlue], blastHits, []);
  assert(cRed.ultEnergy === energyBefore && cRed.ultCombatCredit === 0, '沉磁井：必杀伤害不自回充');
  stats.applyHits(blastHits);
  assert(stats.totalsOf(cRed.id).damage === wellBlastDamage(2), '沉磁井：伤害归因仍记入统计');
  assert(!blastHits[0].environment, '沉磁井：必杀圈不得标成环境圈');

  const hookC = createSkillCaster('hook');
  const hRed = createBallBody({
    x: 16,
    y: 4,
    color: 1,
    team: 'red',
    teamSlot: 1,
    facingX: 1,
    facingY: 0,
    hero: 'hook',
  });
  hRed.ultEnergy = 100;
  hookC.handleInput(hRed, sample({ skillPress: 5, aimX: 1, aimY: 0 }), [hRed]);
  hookC.handleInput(hRed, sample({ skillPress: 5, aimX: 1, aimY: 0 }), [hRed]);
  assert(hRed.ultEnergy === 0 && hookC.isDisplacing(), '沉磁井：钩刺无畏冲锋回归');

  const ringCtl = createPlayerControl('ring');
  const ctlBall = makeRing(8, 8);
  ctlBall.ultEnergy = 100;
  ringCtl.tick(ctlBall, sample({ skillPress: 5, pointerX: 10, pointerY: 8, hasPointer: true }), 0, [ctlBall]);
  assert(ringCtl.getAimingSlot() === 5, '沉磁井：玩家控制应按下进瞄');
  ringCtl.tick(ctlBall, sample({ skillPress: 5, pointerX: 10, pointerY: 8, hasPointer: true }), 0, [ctlBall]);
  assert(ctlBall.ultEnergy === 0, '沉磁井：玩家控制确认扣能');

  resetMagnetWells();
  placeMagnetWell({ ownerId: 1, ownerTeam: 'red', x: 12, y: 10 });
  const overlay = createFieldOverlay();
  const dummy = makeRing(20, 16);
  overlay.sync([dummy]);
  const texts = collectTexts(overlay.root);
  assert(texts.some((label) => label.text === '3.0'), '沉磁井：场地应画清晰 3.0 倒计时');
  assert(
    texts.every((label) => near(label.x, 12, 0.01) && near(label.y, 10, 0.01)),
    '沉磁井：倒计时应锚在落点，不给单位加常驻圈',
  );
  const preview = createAimPreview();
  dummy.hero = 'ring';
  dummy.ultEnergy = 100;
  preview.sync(dummy, 5, sample({ pointerX: 16, pointerY: 16, hasPointer: true, aimX: 1, aimY: 0 }));
  assert(preview.root.visible, '沉磁井：瞄准预览应画出选点圆');

  resetMagnetWells();
  placeMagnetWell({ ownerId: 1, ownerTeam: 'red', x: 8, y: 8 });
  assert(listMagnetWells().length === 1, '沉磁井：重开前应有圈');
  resetMagnetWells();
  assert(listMagnetWells().length === 0, '沉磁井：重开应清圈');

  resetMagnetWells();
}
