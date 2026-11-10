import { createBallBody, type BallBody } from './ballBody';
import {
  BALL_RADIUS,
  EIGHT_KILL_RIFT_ENABLED,
  POTION_FIRST_SEC,
  POTION_INTERVAL_SEC,
  POTION_SHIELD,
  SPEAR_TIP_DIST,
} from './constants';
import { HOOK_SHOVE, HOOK_ULT } from '../heroes/hookKit';
import { CHAIN_HEAL, CHAIN_SCRAMBLE, CHAIN_SHIELD, CHAIN_TOW, CHAIN_ULT, chainAimShape, chainWindup } from '../heroes/chainKit';
import { RING_FIELD, RING_TRAP, RING_ULT } from '../heroes/ringKit';
import { NAIL_THORN } from '../heroes/nailKit';
import { ultName, ultShort, ultTip } from '../heroes/kitLabels';
import type { ActionSample } from '../input/actionTypes';
import { createPlayerControl } from '../input/playerControl';
import { createSkillCaster } from './skillCaster';
import { creditUltCombat, ULT_ENERGY_MAX } from './ultEnergy';
import { createCombatStats } from './combatStats';
import { applyPotionToBall } from './potionField';
import { stepPhysics } from './physicsStep';
import {
  applyChainEqualize,
  chainEqualizeAvg,
  chainHpRatio,
  isChainUltParticipant,
  listEqualizeFlashes,
  resetChainEqualize,
  takeChainEqualizeHeals,
} from './chainEqualize';
import { createAimPreview } from '../render/aimPreview';
import { createFieldOverlay } from '../render/fieldOverlay';
import { resetMagnetWells } from './magnetWells';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 1e-6): boolean {
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

function makeChain(x: number, y: number, slot = 1): BallBody {
  return createBallBody({
    x,
    y,
    color: 0xe24a4a,
    label: `红${slot}`,
    team: 'red',
    teamSlot: slot,
    facingX: 1,
    facingY: 0,
    hero: 'chain',
  });
}

function makeAlly(x: number, y: number): BallBody {
  return createBallBody({
    x,
    y,
    color: 0xc43d3d,
    label: '红2',
    team: 'red',
    teamSlot: 2,
    facingX: 1,
    facingY: 0,
    hero: 'hook',
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

function pin(ball: BallBody): void {
  ball.pinLocked = true;
  ball.pinRemain = 30;
  ball.pinX = ball.x;
  ball.pinY = ball.y;
  ball.vx = 0;
  ball.vy = 0;
}

function play(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  dt: number,
): ReturnType<typeof stepPhysics> {
  const hits = caster.tick(ball, dt, roster);
  const phys = stepPhysics(roster, dt);
  hits.push(...caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id)));
  phys.hits.push(...hits);
  return phys;
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

/** 链生第五键均血：百分比算术平均、额外 10%、护盾/反伤/能量口径。 */
export function verifyChainUlt(): void {
  resetChainEqualize();
  assert(CHAIN_ULT.energyCost === 100, '均血：能量消耗应为 100');
  assert(CHAIN_ULT.radius === 4 && CHAIN_ULT.allyHealRatio === 0.1, '均血：半径 4 / 我方额外 10%');
  assert(chainWindup(5) === 0, '均血：确认后无前摇');
  assert(chainAimShape(5)?.kind === 'circle' && chainAimShape(5)?.radius === 4, '均血：瞄准应为自身半径 4 圆');
  assert(ultShort('chain') === '均血' && ultName('chain') === '均血', '均血：对外用描述名，不定华丽名');
  assert(ultTip('chain').includes('4') && ultTip('chain').includes('10'), '均血：长按提示应含半径 4 与 10%');
  assert(HOOK_ULT.damage === 36 && HOOK_SHOVE.damage === 12, '均血：钩刺必杀/盾冲数值回归');
  assert(RING_ULT.placeRange === 6 && RING_ULT.radius === 4 && RING_ULT.duration === 3, '均血：沉磁井投放/半径/持续回归');
  assert(RING_ULT.damageBase === 20 && RING_ULT.damagePerN === 10, '均血：沉磁井 20+10N 回归');
  assert(RING_ULT.pullAccel === 7 && RING_ULT.pullSoftRadius === 0.9, '均血：沉磁井吸力 7 / 0.9 回归');
  assert(RING_TRAP.radius === 2.5 && RING_FIELD.dps === 6, '均血：磁环四技能数值回归');
  assert(CHAIN_HEAL.dps === 6 && CHAIN_SHIELD.duration === 3 && CHAIN_TOW.knockback === 10, '均血：链生四技能数值回归');
  assert(CHAIN_SCRAMBLE.range === 5 && CHAIN_SCRAMBLE.duration === 3, '均血：扰锋数值回归');
  assert(EIGHT_KILL_RIFT_ENABLED === false, '均血：八杀环境圈仍关闭');
  assert(POTION_FIRST_SEC === 10 && POTION_INTERVAL_SEC === 45, '均血：药剂 10s 首刷 / 45s 间隔不得回退');
  assert(BALL_RADIUS === 1 && SPEAR_TIP_DIST === 2.24, '均血：碰撞半径/枪尖距不得改');

  const cancelC = createSkillCaster('chain');
  const cancelBall = makeChain(10, 10);
  cancelBall.ultEnergy = 100;
  cancelC.handleInput(cancelBall, sample({ skillPress: 5 }), [cancelBall]);
  assert(cancelC.getAimingSlot() === 5, '均血：满能量应按下进瞄');
  cancelC.handleInput(cancelBall, sample({ cancelAim: true }), [cancelBall]);
  assert(cancelC.getAimingSlot() === 0, '均血：取消应退出瞄准');
  assert(cancelBall.ultEnergy === 100, '均血：瞄准取消不耗能量');
  assert(listEqualizeFlashes().length === 0, '均血：取消不应结算');

  const lowC = createSkillCaster('chain');
  const lowBall = makeChain(8, 8);
  lowBall.ultEnergy = 40;
  lowC.handleInput(lowBall, sample({ skillPress: 5 }), [lowBall]);
  assert(lowC.getAimingSlot() === 0 && lowBall.ultEnergy === 40, '均血：能量不足不能进瞄、不扣能');

  resetChainEqualize();
  const caster = createSkillCaster('chain');
  const red = makeChain(10, 10);
  const blue = makeBlue(13, 10);
  red.hp = red.maxHp * 0.2;
  const x0 = red.x;
  const y0 = red.y;
  const vx0 = red.vx;
  fireUlt(caster, red, [red, blue]);
  assert(red.ultEnergy === 0, '均血：成功放出应扣 100 能量');
  assert(!caster.isHardBusy() && !caster.isDisplacing(), '均血：结算后不锁普通技能/位移');
  assert(caster.getCds().every((cd) => cd === 0), '均血：不应写入四技能 CD');
  assert(red.x === x0 && red.y === y0 && red.vx === vx0, '均血：不移动任何人');
  assert(near(chainEqualizeAvg([0.2, 1]), 0.6), '均血：20% 与 100% 算术平均应为 60%');
  assert(near(red.hp, red.maxHp * 0.7), '均血：我方 20% 与敌 100% 应先 60% 再 70%');
  assert(near(blue.hp, blue.maxHp * 0.6), '均血：敌人只均到 60%，无额外 10%');
  assert(red.invincibleRemain === 0 && blue.stunRemain === 0, '均血：不自带无敌/硬控');
  const flashes = listEqualizeFlashes();
  assert(flashes.length === 1 && flashes[0].radius === 4, '均血：应有一次半径 4 的短暂圈');
  assert(near(flashes[0].x, 10) && near(flashes[0].y, 10), '均血：结算圈锚在释放时自身圆心');

  const hpRed = red.hp;
  const hpBlue = blue.hp;
  pin(red);
  pin(blue);
  advance(caster, red, [red, blue], 1);
  assert(near(red.hp, hpRed) && near(blue.hp, hpBlue), '均血：只结算一次，不持续调血');
  assert(listEqualizeFlashes().length === 0, '均血：短暂圈应自行消失，不常驻');

  caster.handleInput(red, sample({ skillPress: 4 }), [red, blue]);
  caster.handleInput(red, sample({ skillPress: 4 }), [red, blue]);
  assert(Math.abs(caster.getCds()[3] - CHAIN_SCRAMBLE.cd) < 1e-6, '均血：结算后仍可放扰锋');

  resetChainEqualize();
  const maxC = createSkillCaster('chain');
  const maxRed = makeChain(10, 10);
  const maxBlue = makeBlue(13, 10);
  maxRed.maxHp = 100;
  maxRed.hp = 20;
  maxBlue.maxHp = 300;
  maxBlue.hp = 300;
  fireUlt(maxC, maxRed, [maxRed, maxBlue]);
  assert(near(maxRed.hp, 70), '均血：不同最大生命按百分比平均，不加权；我方再 +10% 自身最大生命');
  assert(near(maxBlue.hp, 180), '均血：敌方按自身最大生命×平均百分比，不把绝对值加总分配');

  resetChainEqualize();
  const edgeC = createSkillCaster('chain');
  const edgeRed = makeChain(10, 10);
  const inBlue = makeBlue(14, 10);
  const outBlue = makeBlue(14.02, 10, 2);
  assert(isChainUltParticipant(edgeRed, inBlue), '均血：圆心距<=4 含边界');
  assert(!isChainUltParticipant(edgeRed, outBlue), '均血：圆心距>4 不算');
  inBlue.hp = inBlue.maxHp * 0.2;
  outBlue.hp = 12;
  fireUlt(edgeC, edgeRed, [edgeRed, inBlue, outBlue]);
  assert(near(inBlue.hp, inBlue.maxHp * 0.6), '均血：压线敌人应参与平均');
  assert(outBlue.hp === 12, '均血：圈外生命不变');

  resetChainEqualize();
  const deadC = createSkillCaster('chain');
  const dRed = makeChain(10, 10);
  const dBlue = makeBlue(13, 10);
  const dead = makeBlue(11, 10, 2);
  dead.inPlay = false;
  dead.hp = 0;
  dRed.hp = dRed.maxHp * 0.2;
  fireUlt(deadC, dRed, [dRed, dBlue, dead]);
  assert(dead.inPlay === false && dead.hp === 0, '均血：不复活已死单位');
  assert(near(dRed.hp, dRed.maxHp * 0.7) && near(dBlue.hp, dBlue.maxHp * 0.6), '均血：死者排除后其余仍按 20%/100% 规则');

  resetChainEqualize();
  const invC = createSkillCaster('chain');
  const iRed = makeChain(10, 10);
  const iAlly = makeAlly(12.5, 10);
  const iBlue = makeBlue(10, 12.5);
  const iInv = makeBlue(10, 7.5, 2);
  iInv.invincibleRemain = 5;
  iAlly.hp = iAlly.maxHp * 0.2;
  const invHp = iInv.hp;
  fireUlt(invC, iRed, [iRed, iAlly, iBlue, iInv]);
  assert(iInv.hp === invHp && iInv.invincibleRemain === 5, '均血：无敌单位不参与平均、不调血、不获额外回复');
  const avgNoInv = chainEqualizeAvg([1, 0.2, 1]);
  assert(near(iBlue.hp, iBlue.maxHp * avgNoInv), '均血：平均不含无敌单位');
  assert(near(iAlly.hp, iAlly.maxHp * (avgNoInv + 0.1)), '均血：排除无敌后我方仍加 10%');

  resetChainEqualize();
  const selfInvC = createSkillCaster('chain');
  const siRed = makeChain(10, 10);
  const siAlly = makeAlly(12.5, 10);
  const siBlue = makeBlue(10, 12.5);
  siRed.invincibleRemain = 2;
  siRed.hp = siRed.maxHp * 0.4;
  siAlly.hp = siAlly.maxHp * 0.2;
  fireUlt(selfInvC, siRed, [siRed, siAlly, siBlue]);
  assert(siRed.ultEnergy === 0, '均血：无敌施法者仍扣能放出');
  assert(near(siRed.hp, siRed.maxHp * 0.4), '均血：无敌施法者本人排除，不调血不加 10%');
  assert(near(chainEqualizeAvg([0.2, 1]), 0.6), '均血：其余参与者仍按自身规则');
  assert(near(siAlly.hp, siAlly.maxHp * 0.7) && near(siBlue.hp, siBlue.maxHp * 0.6), '均血：无敌施法者排除后其他参与者规则一致');

  resetChainEqualize();
  const shC = createSkillCaster('chain');
  const shRed = makeChain(10, 10);
  const shBlue = makeBlue(13, 10);
  shRed.hp = shRed.maxHp * 0.2;
  applyPotionToBall(shBlue, 'shield');
  const shieldHp = shBlue.potionShieldHp;
  fireUlt(shC, shRed, [shRed, shBlue]);
  assert(near(shBlue.potionShieldHp, shieldHp) && shieldHp === POTION_SHIELD, '均血：普通护盾值完全不变');
  assert(near(shBlue.hp, shBlue.maxHp * 0.6), '均血：护盾单位仍直接调生命，不走护盾吸收');

  resetChainEqualize();
  const thC = createSkillCaster('chain');
  const thRed = makeChain(10, 10);
  const thBlue = makeBlue(13, 10);
  thBlue.hero = 'nail';
  thBlue.reflectRemain = NAIL_THORN.activeWindow;
  thBlue.reflectArmed = true;
  thBlue.reflectDamage = NAIL_THORN.activeDamage;
  thBlue.reflectOnce = true;
  thRed.hp = thRed.maxHp * 0.2;
  fireUlt(thC, thRed, [thRed, thBlue]);
  const afterEq = thRed.hp;
  assert(near(afterEq, thRed.maxHp * 0.7), '均血：降血后施法者生命只按均血+10%');
  const thStep = play(thC, thRed, [thRed, thBlue], 1 / 60);
  assert(near(thRed.hp, afterEq), '均血：均血降血不触发受击反伤');
  assert(thBlue.reflectArmed && thBlue.reflectRemain > 0, '均血：不消耗钉壳受击反伤窗');
  assert(
    thStep.hits.every((hit) => hit.sourceId !== thBlue.id),
    '均血：不得打出普通受击反伤 hit',
  );

  resetChainEqualize();
  const capC = createSkillCaster('chain');
  const capRed = makeChain(10, 10);
  const capAlly = makeAlly(12.5, 10);
  capAlly.hp = capAlly.maxHp * 0.95;
  fireUlt(capC, capRed, [capRed, capAlly]);
  const afterAvg = chainEqualizeAvg([1, 0.95]);
  assert(near(capAlly.hp, capAlly.maxHp), '均血：我方额外 10% 不得超满血');
  assert(afterAvg + 0.1 > 1, '均血：满血截断用例应确实会顶满');

  resetChainEqualize();
  const soloC = createSkillCaster('chain');
  const solo = makeChain(10, 10);
  solo.hp = solo.maxHp * 0.4;
  fireUlt(soloC, solo, [solo]);
  assert(near(solo.hp, solo.maxHp * 0.5), '均血：仅本人时只加 10%');
  const soloHeals = takeChainEqualizeHeals();
  assert(soloHeals.length === 1 && near(soloHeals[0].amount, solo.maxHp * 0.1), '均血：仅本人额外回复应按最大生命 10% 入账');
  assert(soloHeals[0].noUltCredit === true && soloHeals[0].sourceId === solo.id, '均血：额外回复带施法者但不自回充');

  resetChainEqualize();
  const fullC = createSkillCaster('chain');
  const full = makeChain(10, 10);
  fireUlt(fullC, full, [full]);
  assert(full.hp === full.maxHp, '均血：满血本人额外回复截断为 0');
  assert(takeChainEqualizeHeals().length === 0, '均血：无实际回血不入治疗账');

  resetChainEqualize();
  const twiceC = createSkillCaster('chain');
  const twice = makeChain(10, 10);
  fireUlt(twiceC, twice, [twice]);
  assert(twice.ultEnergy === 0, '均血：一次释放扣光 100');
  twiceC.handleInput(twice, sample({ skillPress: 5 }), [twice]);
  assert(twiceC.getAimingSlot() === 0, '均血：能量不足不能再进瞄');
  twiceC.handleInput(twice, sample({ skillPress: 5 }), [twice]);
  assert(twice.ultEnergy === 0, '均血：不得第二次扣能');

  resetChainEqualize();
  const statC = createSkillCaster('chain');
  const stRed = makeChain(10, 10);
  const stAlly = makeAlly(12.5, 10);
  const stBlue = makeBlue(10, 12.5);
  stRed.hp = stRed.maxHp * 0.2;
  stAlly.hp = stAlly.maxHp * 0.2;
  fireUlt(statC, stRed, [stRed, stAlly, stBlue]);
  const statHeals = takeChainEqualizeHeals();
  const stats = createCombatStats();
  stats.applyHits([]);
  stats.applyHeals(statHeals);
  creditUltCombat([stRed, stAlly, stBlue], [], statHeals);
  assert(stats.totalsOf(stRed.id).damage === 0, '均血：降血不记伤害统计、不冒充普通伤害');
  const wantHeal = stRed.maxHp * 0.1 + stAlly.maxHp * 0.1;
  assert(near(stats.totalsOf(stRed.id).heal, wantHeal), '均血：仅额外 10% 实际回血记治疗，均血调升不记');
  assert(stRed.ultCombatCredit === 0, '均血：均血升降与额外回血都不可自回充');
  assert(statHeals.every((heal) => heal.noUltCredit), '均血：治疗脉冲应标 noUltCredit');

  resetChainEqualize();
  const aC = createSkillCaster('chain');
  const bC = createSkillCaster('chain');
  const aRed = makeChain(10, 10, 1);
  const bRed = makeChain(12.5, 10, 2);
  const seqBlue = makeBlue(10, 12.5);
  aRed.hp = aRed.maxHp * 0.2;
  fireUlt(aC, aRed, [aRed, bRed, seqBlue]);
  const afterFirstB = bRed.hp;
  const afterFirstA = aRed.hp;
  const firstAvg = chainEqualizeAvg([0.2, 1, 1]);
  assert(near(afterFirstB, bRed.maxHp * (firstAvg + 0.1)), '均血：第一名链生按当时生命快照');
  fireUlt(bC, bRed, [aRed, bRed, seqBlue]);
  const secondAvg = chainEqualizeAvg([
    chainHpRatio({ hp: afterFirstA, maxHp: aRed.maxHp }),
    chainHpRatio({ hp: afterFirstB, maxHp: bRed.maxHp }),
    chainHpRatio({ hp: seqBlue.maxHp * firstAvg, maxHp: seqBlue.maxHp }),
  ]);
  assert(near(bRed.hp, Math.min(bRed.maxHp, bRed.maxHp * (secondAvg + 0.1))), '均血：第二名链生应按第一名之后的生命再快照，不共用过期数据');
  assert(bRed.hp > afterFirstB + 1e-6, '均血：第二发不得复用第一发过期快照');

  resetChainEqualize();
  const moveC = createSkillCaster('chain');
  const moveRed = makeChain(10, 10);
  fireUlt(moveC, moveRed, [moveRed]);
  const flashX = listEqualizeFlashes()[0]?.x;
  moveRed.x = 16;
  assert(near(listEqualizeFlashes()[0]?.x ?? -1, flashX ?? -2), '均血：结算圈不跟随单位，不是常驻光圈');

  const overlay = createFieldOverlay();
  overlay.sync([moveRed]);
  const preview = createAimPreview();
  moveRed.hero = 'chain';
  preview.sync(moveRed, 5, sample({ aimX: 1, aimY: 0 }));
  assert(preview.root.visible, '均血：瞄准预览应画出自身半径圆');

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
  assert(hRed.ultEnergy === 0 && hookC.isDisplacing(), '均血：钩刺无畏冲锋回归');

  resetMagnetWells();
  const ringC = createSkillCaster('ring');
  const ringRed = createBallBody({
    x: 10,
    y: 10,
    color: 0xe24a4a,
    label: '红1',
    team: 'red',
    teamSlot: 1,
    facingX: 1,
    facingY: 0,
    hero: 'ring',
  });
  ringRed.ultEnergy = 100;
  ringC.handleInput(ringRed, sample({ skillPress: 5, pointerX: 16, pointerY: 10, hasPointer: true }), [ringRed]);
  ringC.handleInput(ringRed, sample({ skillPress: 5, pointerX: 16, pointerY: 10, hasPointer: true }), [ringRed]);
  assert(ringRed.ultEnergy === 0, '均血：磁环沉磁井回归仍扣能');
  resetMagnetWells();

  const chainCtl = createPlayerControl('chain');
  const ctlBall = makeChain(8, 8);
  ctlBall.ultEnergy = 100;
  chainCtl.tick(ctlBall, sample({ skillPress: 5 }), 0, [ctlBall]);
  assert(chainCtl.getAimingSlot() === 5, '均血：玩家控制应按下进瞄');
  chainCtl.tick(ctlBall, sample({ skillPress: 5 }), 0, [ctlBall]);
  assert(ctlBall.ultEnergy === 0, '均血：玩家控制确认扣能');

  applyChainEqualize(makeChain(4, 4), []);
  assert(listEqualizeFlashes().length >= 1, '均血：重开前应能留下结算圈');
  resetChainEqualize();
  assert(listEqualizeFlashes().length === 0, '均血：重开应清结算圈与待入账治疗');
  assert(takeChainEqualizeHeals().length === 0, '均血：重开不残留治疗脉冲');
}
