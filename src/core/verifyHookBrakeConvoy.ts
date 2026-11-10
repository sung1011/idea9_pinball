import { createBallBody, openActiveRam, type BallBody } from './ballBody';
import { applyHardCc } from './hardCc';
import { HOOK_BRAKE } from '../heroes/hookKit';
import { NAIL_RAM } from '../heroes/nailKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createSkillCaster } from './skillCaster';
import { createMatchSession } from './matchSession';
import { stepPhysics } from './physicsStep';
import {
  ACTIVE_RAM_WINDOW,
  FRICTION,
  LEFT_PILLAR,
  MAP_WIDTH,
  POTION_SHIELD,
} from './constants';
import {
  beginHookBrakeConvoy,
  breakHookBrakeConvoyFor,
  isBrakeConvoyLeader,
  isBrakeConvoyPassenger,
} from './hookBrakeConvoy';
import { HOOK_BRAKE_TECH, HOOK_TECH_DEFS } from './hookTech';
import { applyPotionToBall } from './potionField';
import { applyHpLoss } from './hpLoss';
import { grantHookShoveShield } from './hookShield';
import { createTechStore, emptyTechSave, memoryTechStorage, TECH_SAVE_KEY } from './techSave';
import { skillTipCopy } from '../heroes/kitLabels';
import { applyStageVars, computeLandscapeStage } from '../ui/stageLayout';
import { createTechPanel } from '../ui/techPanel';
import { placeMagnetWell, resetMagnetWells } from './magnetWells';
import { setArenaPillarsEnabled } from './wallBounce';

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

function unit(x: number, y: number, team: 'red' | 'blue', label: string, hero: BallBody['hero'] = 'hook'): BallBody {
  const ball = createBallBody({
    x,
    y,
    color: team === 'red' ? 0xe24a4a : 0x3d7cf0,
    label,
    team,
    facingX: 1,
    facingY: 0,
    vx: 0,
    vy: 0,
    hero,
  });
  ball.suppressCombat = true;
  return ball;
}

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  slot: SkillSlot,
  roster: readonly BallBody[],
  aimX = 1,
  aimY = 0,
): void {
  caster.handleInput(ball, sample({ skillPress: slot, aimX, aimY }), roster);
  caster.handleInput(ball, sample({ skillPress: slot, aimX, aimY }), roster);
}

function playAll(
  casters: Map<number, ReturnType<typeof createSkillCaster>>,
  roster: readonly BallBody[],
  dt: number,
): void {
  for (const ball of roster) {
    const caster = casters.get(ball.id);
    if (caster) {
      caster.tick(ball, dt, roster);
    }
  }
  const phys = stepPhysics(roster, dt);
  for (const ball of roster) {
    const caster = casters.get(ball.id);
    if (caster) {
      caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id));
    }
  }
}

function advanceAll(
  casters: Map<number, ReturnType<typeof createSkillCaster>>,
  roster: readonly BallBody[],
  sec: number,
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    playAll(casters, roster, dt);
    left -= dt;
  }
}

function popIntoConvoy(leader: BallBody, roster: readonly BallBody[]): void {
  leader.vx = HOOK_BRAKE.popSpeed;
  leader.vy = 0;
  leader.facingX = 1;
  leader.facingY = 0;
  leader.allowOverCap = true;
  openActiveRam(leader);
  beginHookBrakeConvoy(leader, roster);
}

/** 蓄势科技携带：沿用弹出 0.25s 主动撞窗，替换旧首次 +8。 */
export function verifyHookBrakeConvoy(): void {
  assert(ACTIVE_RAM_WINDOW === 0.25, '蓄势携带：冲锋窗应是现有 0.25s 主动撞窗');
  assert(HOOK_BRAKE.popSpeed === 16.5 && HOOK_BRAKE.brakeTime === 2.6, '蓄势携带：基础弹出未改');
  assert(HOOK_BRAKE_TECH.cost === 50, '蓄势携带：科技仍 50 点');
  assert(!('extraDamage' in HOOK_BRAKE_TECH), '蓄势携带：旧 +8 应取消');
  assert(!('chargeRatio' in HOOK_BRAKE_TECH), '蓄势携带：旧 80% 蓄力门槛应取消');
  const brakeDef = HOOK_TECH_DEFS.find((item) => item.id === 'hookBrake');
  assert(!!brakeDef && brakeDef.effect.includes('接触携带'), '蓄势携带：科技描述应为沿途接触携带');
  assert(!!brakeDef && !brakeDef.effect.includes('8 点') && !brakeDef.effect.includes('80%'), '蓄势携带：描述不应再写旧加伤/蓄力门槛');
  assert(skillTipCopy('hook', 4).effect.includes('携带'), '蓄势携带：技能说明应提到科技携带');

  const oldSave = createTechStore(
    memoryTechStorage({
      [TECH_SAVE_KEY]: JSON.stringify({
        ...emptyTechSave(),
        points: 40,
        unlockedHeroes: ['hook'],
        litTechs: ['hookPull', 'hookBrake'],
      }),
    }),
  );
  assert(oldSave.isTechLit('hookBrake') && oldSave.getState().points === 40, '蓄势携带：旧点亮应无损迁成新效果');
  assert(oldSave.getState().litTechs.includes('hookPull'), '蓄势携带：迁移不清空其他槽位');
  const again = oldSave.buyTech('hookBrake');
  assert(!again.ok && again.code === 'owned' && oldSave.getState().points === 40, '蓄势携带：已点亮不重收费');

  setArenaPillarsEnabled(true);
  resetMagnetWells();

  const techs = { pull: false, stab: false, shove: false, brake: true };
  const leader = unit(8, 6, 'red', '红1');
  const ally = unit(10.05, 6, 'red', '红2');
  const enemy = unit(20, 6, 'blue', '蓝1');
  const roster = [leader, ally, enemy];
  const casters = new Map<number, ReturnType<typeof createSkillCaster>>();
  casters.set(leader.id, createSkillCaster('hook', { techs: () => techs }));
  popIntoConvoy(leader, roster);
  assert(isBrakeConvoyLeader(leader), '蓄势携带：弹出应打开 0.25s 携带窗');
  assert(Math.abs(leader.hookBrakeConvoyRemain - ACTIVE_RAM_WINDOW) < 1e-9, '蓄势携带：窗长应等于主动撞窗');
  assert(Math.abs(leader.activeRamRemain - ACTIVE_RAM_WINDOW) < 1e-9, '蓄势携带：冲锋者原主动撞窗仍开，携带不另开长窗');
  let attached = false;
  let frames = 0;
  const startX = ally.x;
  while (frames < 20 && !isBrakeConvoyPassenger(ally)) {
    const prev = { x: ally.x, y: ally.y };
    playAll(casters, roster, 1 / 60);
    frames += 1;
    const step = Math.hypot(ally.x - prev.x, ally.y - prev.y);
    assert(step < 2 * 0.9, '蓄势携带：接入过渡不应瞬移超过近一球径');
  }
  attached = isBrakeConvoyPassenger(ally);
  assert(attached, '蓄势携带：接触存活友军应自动接入');
  assert(ally.hookBrakeConvoyLeaderId === leader.id, '蓄势携带：归属应是冲锋者');
  assert(ally.activeRamRemain === 0, '蓄势携带：被携带者不应被设 activeRam');
  assert(ally.x > startX - 0.05, '蓄势携带：接入后应同行而非原地');
  const enemyHp = enemy.hp;
  advanceAll(casters, roster, 0.05);
  assert(enemy.hp === enemyHp, '蓄势携带：不给携带额外伤害');
  const remainAtAttach = leader.hookBrakeConvoyRemain;
  assert(remainAtAttach > 0 && remainAtAttach <= ACTIVE_RAM_WINDOW, '蓄势携带：后加入者只跟剩余时间');
  advanceAll(casters, roster, ACTIVE_RAM_WINDOW + 0.05);
  assert(!isBrakeConvoyLeader(leader) && !isBrakeConvoyPassenger(ally), '蓄势携带：窗结束应释放，不把滑行当冲锋');
  const vxEnd = ally.vx;
  const speedEnd = Math.hypot(ally.vx, ally.vy);
  playAll(casters, roster, 1 / 60);
  const speedAfter = Math.hypot(ally.vx, ally.vy);
  const expectFric = speedEnd * Math.exp(-FRICTION / 60);
  assert(Math.abs(speedAfter - expectFric) < 0.08, '蓄势携带：释放后应按实际速度摩擦，不额外加速不强停');
  assert(Math.sign(ally.vx) === Math.sign(vxEnd) || Math.abs(ally.vx) < 0.05, '蓄势携带：释放不倒转速度');

  const noTech = unit(8, 4, 'red', '无科技');
  const noAlly = unit(10.05, 4, 'red', '无科技友');
  const emptyC = createSkillCaster('hook', { techs: () => ({ pull: false, stab: false, shove: false, brake: false }) });
  fire(emptyC, noTech, 4, [noTech, noAlly]);
  let left = HOOK_BRAKE.brakeTime + 0.05;
  let noTechPop = 0;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    emptyC.tick(noTech, dt, [noTech, noAlly]);
    const phys = stepPhysics([noTech, noAlly], dt);
    emptyC.afterPhysics(noTech, dt, [noTech, noAlly], phys.wallHitIds.includes(noTech.id));
    noTechPop = Math.max(noTechPop, Math.hypot(noTech.vx, noTech.vy));
    left -= dt;
  }
  assert(!isBrakeConvoyLeader(noTech) && !isBrakeConvoyPassenger(noAlly), '蓄势携带：未点亮基础蓄势不携带');
  assert(noTechPop > 8, '蓄势携带：未点亮仍应正常弹出');

  const skillPop = unit(8, 14, 'red', '技能弹出');
  const skillAlly = unit(16, 14, 'red', '技能友');
  const popC = createSkillCaster('hook', { techs: () => techs });
  fire(popC, skillPop, 4, [skillPop, skillAlly]);
  let wait = HOOK_BRAKE.brakeTime + 0.2;
  let sawWindow = false;
  let sawCarry = false;
  while (wait > 1e-9) {
    const dt = Math.min(1 / 60, wait);
    popC.tick(skillPop, dt, [skillPop, skillAlly]);
    const phys = stepPhysics([skillPop, skillAlly], dt);
    popC.afterPhysics(skillPop, dt, [skillPop, skillAlly], phys.wallHitIds.includes(skillPop.id));
    wait -= dt;
    if (skillPop.hookBrakeConvoyRemain > 0 && !sawWindow) {
      sawWindow = true;
      assert(skillPop.activeRamRemain > 0.2, '蓄势携带：技能弹出仍开 0.25s 主动撞窗');
      assert(skillPop.hookBrakeConvoyRemain <= ACTIVE_RAM_WINDOW + 1e-9, '蓄势携带：携带不长于撞窗');
      skillAlly.x = skillPop.x + 1.92;
      skillAlly.y = skillPop.y;
      skillAlly.vx = 0;
      skillAlly.vy = 0;
    }
    if (isBrakeConvoyPassenger(skillAlly)) {
      sawCarry = true;
    }
  }
  assert(sawWindow, '蓄势携带：点亮后技能弹出应打开携带窗');
  assert(sawCarry, '蓄势携带：技能弹出后实际接触应接入');

  const a1 = unit(8, 6, 'red', '多1');
  const a2 = unit(10.05, 6, 'red', '多2');
  const a3 = unit(8.15, 7.9, 'red', '多3');
  const multi = [a1, a2, a3];
  popIntoConvoy(a1, multi);
  advanceAll(new Map(), multi, 0.16);
  assert(isBrakeConvoyPassenger(a2) && isBrakeConvoyPassenger(a3), '蓄势携带：沿途所有接触友军都可接入，不限首人');
  const d12 = Math.hypot(a2.x - a1.x, a2.y - a1.y);
  const d13 = Math.hypot(a3.x - a1.x, a3.y - a1.y);
  const d23 = Math.hypot(a3.x - a2.x, a3.y - a2.y);
  assert(d12 >= 1.85 && d13 >= 1.85 && d23 >= 1.85, '蓄势携带：各自碰撞体不应叠成球');
  const keepDist = a3.hookBrakeConvoyFollowDist;
  a2.hp = 0;
  a2.inPlay = false;
  playAll(new Map(), multi, 1 / 60);
  assert(!isBrakeConvoyPassenger(a2), '蓄势携带：死者单独脱离');
  assert(isBrakeConvoyPassenger(a3), '蓄势携带：其余继续');
  assert(Math.abs(a3.hookBrakeConvoyFollowDist - keepDist) < 1e-9, '蓄势携带：空位不重排后续队员跟随距离');

  const onceL = unit(8, 6, 'red', '一次L');
  const onceA = unit(10.05, 6, 'red', '一次A');
  popIntoConvoy(onceL, [onceL, onceA]);
  advanceAll(new Map(), [onceL, onceA], 0.12);
  assert(isBrakeConvoyPassenger(onceA), '蓄势携带：应先接入');
  applyHardCc(onceA, 0.4, 0);
  playAll(new Map(), [onceL, onceA], 1 / 60);
  assert(!isBrakeConvoyPassenger(onceA) && onceA.stunRemain > 0, '蓄势携带：被携带者硬控单独脱离且不清钉控');
  onceA.stunRemain = 0;
  onceA.x = onceL.x + 1.9;
  onceA.y = onceL.y;
  playAll(new Map(), [onceL, onceA], 1 / 60);
  assert(!isBrakeConvoyPassenger(onceA), '蓄势携带：同次冲锋释放后不反复拉回');

  const pinL = unit(8, 6, 'red', '钉L');
  const pinA = unit(10.05, 6, 'red', '钉A');
  pinA.pinRemain = 1;
  pinA.pinX = pinA.x;
  pinA.pinY = pinA.y;
  popIntoConvoy(pinL, [pinL, pinA]);
  advanceAll(new Map(), [pinL, pinA], 0.12);
  assert(!isBrakeConvoyPassenger(pinA) && pinA.pinRemain > 0, '蓄势携带：已硬控友军不能新接入，不把钉控清掉');

  const invL = unit(8, 6, 'red', '无L');
  const invA = unit(10.05, 6, 'red', '无A');
  invA.invincibleRemain = 2;
  popIntoConvoy(invL, [invL, invA]);
  advanceAll(new Map(), [invL, invA], 0.12);
  assert(!isBrakeConvoyPassenger(invA), '蓄势携带：无敌友军不接入');
  invA.invincibleRemain = 0;
  const shieldA = unit(10.05, 8, 'red', '盾A');
  applyPotionToBall(shieldA, 'shield');
  grantHookShoveShield(shieldA);
  const shL = unit(8, 8, 'red', '盾L');
  popIntoConvoy(shL, [shL, shieldA]);
  advanceAll(new Map(), [shL, shieldA], 0.12);
  assert(isBrakeConvoyPassenger(shieldA), '蓄势携带：普通护盾正常接入');
  assert(shieldA.potionShieldHp === POTION_SHIELD, '蓄势携带：接入不消耗护盾');

  const midL = unit(8, 6, 'red', '中L');
  const midA = unit(10.05, 6, 'red', '中A');
  popIntoConvoy(midL, [midL, midA]);
  advanceAll(new Map(), [midL, midA], 0.1);
  assert(isBrakeConvoyPassenger(midA), '蓄势携带：中途无敌前应已接入');
  midA.invincibleRemain = 1;
  playAll(new Map(), [midL, midA], 1 / 60);
  assert(!isBrakeConvoyPassenger(midA), '蓄势携带：携带中变无敌应安全释放');

  const ccL = unit(8, 6, 'red', '控L');
  const ccA = unit(10.05, 6, 'red', '控A');
  popIntoConvoy(ccL, [ccL, ccA]);
  advanceAll(new Map(), [ccL, ccA], 0.1);
  applyHardCc(ccL, 0.5, 1);
  playAll(new Map(), [ccL, ccA], 1 / 60);
  assert(!isBrakeConvoyPassenger(ccA) && !isBrakeConvoyLeader(ccL), '蓄势携带：冲锋者硬控应立即释放全部');

  const dL = unit(8, 6, 'red', '死L');
  const dA = unit(10.05, 6, 'red', '死A');
  popIntoConvoy(dL, [dL, dA]);
  advanceAll(new Map(), [dL, dA], 0.1);
  assert(isBrakeConvoyPassenger(dA), '蓄势携带：死亡测试应先接入');
  const keepVx = dA.vx;
  const keepVy = dA.vy;
  dL.hp = 0;
  breakHookBrakeConvoyFor(dL, [dL, dA]);
  assert(!isBrakeConvoyPassenger(dA) && !isBrakeConvoyLeader(dL), '蓄势携带：冲锋者死亡立即释放，不连带钉住');
  assert(dA.vx === keepVx && dA.vy === keepVy, '蓄势携带：死亡释放保留脱离瞬间实际速度，不强停不额外加速');

  const fL = unit(8, 6, 'red', '强L');
  const fA = unit(10.05, 6, 'red', '强A');
  popIntoConvoy(fL, [fL, fA]);
  advanceAll(new Map(), [fL, fA], 0.1);
  fL.frictionMul = 0;
  playAll(new Map(), [fL, fA], 1 / 60);
  assert(!isBrakeConvoyPassenger(fA), '蓄势携带：冲锋者强制位移应安全结束携带');

  const pL = unit(8, 6, 'red', '客强L');
  const pA = unit(10.05, 6, 'red', '客强A');
  const pB = unit(8.15, 7.9, 'red', '客强B');
  popIntoConvoy(pL, [pL, pA, pB]);
  advanceAll(new Map(), [pL, pA, pB], 0.16);
  assert(isBrakeConvoyPassenger(pA) && isBrakeConvoyPassenger(pB), '蓄势携带：双人应都接入');
  pA.frictionMul = 0;
  playAll(new Map(), [pL, pA, pB], 1 / 60);
  assert(!isBrakeConvoyPassenger(pA) && isBrakeConvoyPassenger(pB), '蓄势携带：被携带者强制位移只自己脱离');

  const c1 = unit(8, 6, 'red', '竞1');
  const c2 = unit(8, 8.15, 'red', '竞2');
  const prize = unit(9.7, 7.08, 'red', '竞奖');
  popIntoConvoy(c1, [c1, c2, prize]);
  popIntoConvoy(c2, [c1, c2, prize]);
  advanceAll(new Map(), [c1, c2, prize], 0.12);
  const owner = prize.hookBrakeConvoyLeaderId;
  assert(owner === c1.id || owner === c2.id, '蓄势携带：不能同时被多个冲锋携带');
  const owners = (c1.hookBrakeConvoyIds.includes(prize.id) ? 1 : 0) + (c2.hookBrakeConvoyIds.includes(prize.id) ? 1 : 0);
  assert(owners === 1, '蓄势携带：已有归属优先保持，不能同时进两队');
  assert(c1.hookBrakeConvoyLeaderId === 0 && c2.hookBrakeConvoyLeaderId === 0, '蓄势携带：冲锋者不能带自己，也不能循环携带');

  const vacL = unit(LEFT_PILLAR.x - 6, LEFT_PILLAR.y, 'red', '隔L');
  const vacA = unit(LEFT_PILLAR.x + 6, LEFT_PILLAR.y, 'red', '隔A');
  popIntoConvoy(vacL, [vacL, vacA]);
  advanceAll(new Map(), [vacL, vacA], 0.2);
  assert(!isBrakeConvoyPassenger(vacA), '蓄势携带：不隔空吸人');

  const wallL = unit(MAP_WIDTH - 5, 6, 'red', '墙L');
  const wallA = unit(MAP_WIDTH - 2.95, 6, 'red', '墙A');
  const vxBeforeWall = HOOK_BRAKE.popSpeed;
  popIntoConvoy(wallL, [wallL, wallA]);
  advanceAll(new Map(), [wallL, wallA], 0.28);
  assert(!isBrakeConvoyPassenger(wallA), '蓄势携带：冲锋者撞实墙应释放友军');
  assert(wallA.vx < vxBeforeWall * 0.2 || wallA.x <= MAP_WIDTH - 1 + 1e-6, '蓄势携带：撞墙后遵守法线反弹，不恢复穿墙前朝墙速度');

  const farL = unit(8, 6, 'red', '远L');
  const farA = unit(10.05, 6, 'red', '远A');
  popIntoConvoy(farL, [farL, farA]);
  advanceAll(new Map(), [farL, farA], 0.1);
  assert(isBrakeConvoyPassenger(farA), '蓄势携带：远距测试应先接入');
  farA.x = LEFT_PILLAR.x + 4;
  farA.y = LEFT_PILLAR.y;
  farL.x = LEFT_PILLAR.x - 4;
  farL.y = LEFT_PILLAR.y;
  playAll(new Map(), [farL, farA], 1 / 60);
  assert(!isBrakeConvoyPassenger(farA), '蓄势携带：不把友军从障碍另一侧拖过来');

  const magL = unit(8, 6, 'red', '井L');
  const magA = unit(10.05, 6, 'red', '井A');
  popIntoConvoy(magL, [magL, magA]);
  advanceAll(new Map(), [magL, magA], 0.1);
  placeMagnetWell({ ownerId: magL.id, ownerTeam: 'blue', x: magL.x, y: magL.y, remain: 3 });
  playAll(new Map(), [magL, magA], 1 / 60);
  assert(!isBrakeConvoyPassenger(magA), '蓄势携带：磁井强制吸力应结束携带');
  resetMagnetWells();

  const nailL = unit(8, 6, 'red', '钉冲L');
  const nailA = unit(10.05, 6, 'red', '钉冲A');
  nailA.hero = 'nail';
  const nailC = createSkillCaster('nail');
  const nailMap = new Map<number, ReturnType<typeof createSkillCaster>>([[nailA.id, nailC]]);
  popIntoConvoy(nailL, [nailL, nailA]);
  advanceAll(nailMap, [nailL, nailA], 0.1);
  fire(nailC, nailA, 3, [nailL, nailA]);
  playAll(nailMap, [nailL, nailA], 1 / 60);
  assert((nailC.getCds()[2] ?? 1) === 0, `蓄势携带：钉壳顶冲拒绝不进 CD（${NAIL_RAM.cd}）`);
  fire(nailC, nailA, 1, [nailL, nailA]);
  advanceAll(nailMap, [nailL, nailA], 0.05);
  assert((nailC.getCds()[0] ?? 0) > 0, '蓄势携带：钉壳非位移甲垒仍可放');

  const hookPass = unit(10.05, 6, 'red', '钩客');
  const hookLead = unit(8, 6, 'red', '钩主');
  hookPass.ultEnergy = 100;
  const hookC = createSkillCaster('hook');
  const hookMap = new Map([[hookPass.id, hookC]]);
  popIntoConvoy(hookLead, [hookLead, hookPass]);
  advanceAll(hookMap, [hookLead, hookPass], 0.1);
  fire(hookC, hookPass, 5, [hookLead, hookPass]);
  playAll(hookMap, [hookLead, hookPass], 1 / 60);
  assert(hookPass.ultEnergy === 100, '蓄势携带：无畏冲锋属位移，拒绝不扣能量');
  fire(hookC, hookPass, 2, [hookLead, hookPass]);
  playAll(hookMap, [hookLead, hookPass], 1 / 60);
  assert((hookC.getCds()[1] ?? 0) > 5, '蓄势携带：钩刺连刺非位移可放并进 CD');
  assert(isBrakeConvoyPassenger(hookPass), '蓄势携带：不能借位移技主动脱离');

  const matchRed = unit(8, 6, 'red', '局红1');
  const matchAlly = unit(10.05, 6, 'red', '局红2');
  const matchB1 = unit(30, 6, 'blue', '局蓝1');
  const matchB2 = unit(30, 10, 'blue', '局蓝2');
  const matchBalls = [matchRed, matchAlly, matchB1, matchB2];
  const match = createMatchSession(matchBalls, { countdownSec: 0, playSec: 30, practice: false });
  matchRed.x = 8;
  matchRed.y = 6;
  matchAlly.x = 10.05;
  matchAlly.y = 6;
  matchRed.vx = 0;
  matchAlly.vx = 0;
  matchRed.invincibleRemain = 0;
  matchAlly.invincibleRemain = 0;
  popIntoConvoy(matchRed, matchBalls);
  advanceAll(new Map(), matchBalls, 0.12);
  assert(isBrakeConvoyPassenger(matchAlly), '蓄势携带：2v2 构造可带队友（本机 bot，非联网）');
  match.reset();
  assert(!isBrakeConvoyPassenger(matchAlly) && !isBrakeConvoyLeader(matchRed), '蓄势携带：重开清携带关系');

  const resRed = unit(8, 6, 'red', '结红');
  const resAlly = unit(10.05, 6, 'red', '结友');
  const resB1 = unit(30, 6, 'blue', '结蓝1');
  const resB2 = unit(30, 8, 'blue', '结蓝2');
  resB1.hp = 1;
  resB2.hp = 1;
  const resMatch = createMatchSession([resRed, resAlly, resB1, resB2], { countdownSec: 0, playSec: 8 });
  popIntoConvoy(resRed, [resRed, resAlly, resB1, resB2]);
  advanceAll(new Map(), [resRed, resAlly, resB1, resB2], 0.1);
  applyHpLoss(resB1, 400);
  applyHpLoss(resB2, 400);
  resMatch.tick(0.05, []);
  if (resMatch.snapshot().phase === 'result') {
    assert(!isBrakeConvoyPassenger(resAlly) && !isBrakeConvoyLeader(resRed), '蓄势携带：结算清携带关系');
  }
  resMatch.reset();
  assert(!isBrakeConvoyPassenger(resAlly) && resAlly.hookBrakeConvoyLeaderId === 0, '蓄势携带：重开/结算路径不遗留输入锁');

  const lost = applyHpLoss(unit(8, 6, 'blue', '伤'), 8);
  assert(lost === 8, '蓄势携带：对照普通 8 伤仍走原掉血，不是科技追加');

  const hudChrome =
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  const assertCopy = (w: number, h: number, label: string): void => {
    const host = document.createElement('div');
    host.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;${hudChrome}`;
    document.body.appendChild(host);
    applyStageVars(host, computeLandscapeStage(w, h, { top: 0, right: 0, bottom: 0, left: 0 }));
    const store = createTechStore(memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 50 }) }));
    const panel = createTechPanel(host, { store, getPhase: () => 'countdown' });
    panel.open();
    const brakeBtn = [...host.querySelectorAll<HTMLButtonElement>('button.techItem')].find((btn) =>
      (btn.textContent ?? '').includes('蓄势'),
    );
    brakeBtn?.click();
    const detail = host.querySelector('.techDetail')?.textContent ?? '';
    assert(detail.includes('接触') && detail.includes('携带'), `${label}：科技详情应为携带友军`);
    assert(!detail.includes('追加') && !detail.includes('80%'), `${label}：旧加伤/蓄力门槛文案应消失`);
    assert(!host.querySelector('.techGlowRing'), `${label}：不新增常驻光圈`);
    panel.close();
    host.remove();
  };
  assertCopy(1920, 1080, '蓄势携带 UI 1920×1080');
  assertCopy(2340, 1080, '蓄势携带 UI 2340×1080');
}
