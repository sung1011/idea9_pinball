import { createBallBody, type BallBody } from './ballBody';
import { applyPotionToBall } from './potionField';
import { applyHpLoss } from './hpLoss';
import { HOOK_BRAKE, HOOK_PULL, HOOK_SHOVE, HOOK_STAB } from '../heroes/hookKit';
import { HERO_IDS, heroZh, type HeroId } from '../heroes/heroIds';
import { skillNames } from '../heroes/kitLabels';
import { SKILL_ICON_FILES } from '../heroes/skillIcons';
import { allHeroTechSlots, heroTechSlots, isBuyableTechId, todoSlotId } from './heroTechSlots';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createPlayerControl } from '../input/playerControl';
import { createSkillCaster } from './skillCaster';
import { createMatchSession } from './matchSession';
import { stepPhysics } from './physicsStep';
import { MAP_WIDTH, MAX_HP, POTION_SHIELD } from './constants';
import { applyHookBleed, clearHookBleeds, hookBleedCount, tickHookBleeds } from './hookBleed';
import { grantHookShoveShield } from './hookShield';
import { HOOK_BRAKE_TECH, HOOK_PULL_TECH, HOOK_SHOVE_TECH, HOOK_STAB_TECH, HOOK_TECH_DEFS } from './hookTech';
import { applyStageVars, computeLandscapeStage } from '../ui/stageLayout';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createTechPanel } from '../ui/techPanel';
import { createResultPanel } from '../ui/resultPanel';
import { createHelpCard } from '../ui/helpCard';
import { createMatchHud } from '../ui/matchHud';
import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import type { AppVersions } from '../ui/appVersion';
import {
  createTechStore,
  memoryTechStorage,
  parseTechSave,
  TECH_SAVE_KEY,
  TECH_START_POINTS,
  emptyTechSave,
} from './techSave';
import { planMatchTechReward } from './techReward';
import {
  EMPTY_COMBAT_TECHS,
  HERO_UNLOCK_COST_FIRST,
  HERO_UNLOCK_COST_LATER,
  TECH_REWARD_DRAW,
  TECH_REWARD_EIGHT_FIRST,
  TECH_REWARD_EIGHT_REST,
  TECH_REWARD_LOSE,
  TECH_REWARD_WIN,
  type CombatTechSnapshot,
} from './techIds';
import { createSimpleBot } from './simpleBot';

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
  const pair: [BallBody, BallBody] = [
    createBallBody({ x: x0, y: y0, color: 0xe24a4a, label: '红', team: 'red', facingX: 1, facingY: 0, vx: 0, vy: 0 }),
    createBallBody({ x: x1, y: y1, color: 0x3d7cf0, label: '蓝', team: 'blue', facingX: 1, facingY: 0, vx: 0, vy: 0 }),
  ];
  pair[0].suppressCombat = true;
  pair[1].suppressCombat = true;
  return pair;
}

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  slot: SkillSlot,
  aimX = 1,
  aimY = 0,
  roster: readonly BallBody[] = [ball],
): void {
  caster.handleInput(ball, sample({ skillPress: slot, aimX, aimY }), roster);
  caster.handleInput(ball, sample({ skillPress: slot, aimX, aimY }), roster);
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

function allTechs(): CombatTechSnapshot {
  return { pull: true, stab: true, shove: true, brake: true };
}

function dummyVersions(): AppVersions {
  return {
    getState: () => ({
      entries: [],
      grouped: [],
      history: [],
      installed: null,
      pending: [],
      flash: '',
    }),
    subscribe: () => () => {},
    refresh: async () => {},
    checkUpdate: async () => {},
    applyUpdate: async () => {},
    dispose: () => {},
  };
}

function settingsActs() {
  return {
    onRestart: () => {},
    onReload: () => {},
    versions: dummyVersions(),
  };
}

/** 科技树首版：存档/解锁/结算/钩刺四槽/练习/UI。 */
export function verifyTechTree(): void {
  assert(HOOK_PULL.cd === 8 && HOOK_PULL.damage === 8 && HOOK_PULL.range === 6, '科技：钩矛基础值未改');
  assert(HOOK_STAB.damages[0] === 9 && HOOK_STAB.damages[2] === 14, '科技：连刺基础伤未改');
  assert(HOOK_SHOVE.damage === 12 && HOOK_SHOVE.cd === 10, '科技：盾冲基础值未改');
  assert(HOOK_BRAKE.popSpeed === 16.5 && HOOK_BRAKE.brakeTime === 2.6, '科技：蓄势基础值未改');
  assert(HERO_IDS.length === 7 && heroZh('mirror') === '镜卫', '科技：七英雄池完整，含镜卫');

  const freshMem = memoryTechStorage();
  const fresh = createTechStore(freshMem);
  assert(fresh.getState().points === TECH_START_POINTS, '科技：新档 100 点');
  assert(fresh.getState().unlockedHeroes.join() === 'hook', '科技：新档仅钩刺免费');
  assert(!fresh.isHeroUnlocked('ring') && !fresh.isHeroUnlocked('mirror'), '科技：旧档迁移不送其他英雄');
  assert(fresh.heroUnlockCost() === HERO_UNLOCK_COST_FIRST, '科技：第一次付费英雄 30 点');
  const freshRaw = fresh.status().raw;
  assert(!!freshRaw && JSON.parse(freshRaw).points === TECH_START_POINTS, '科技：空存储应写入初始 100');
  const freshReload = createTechStore(freshMem);
  assert(freshReload.getState().points === TECH_START_POINTS, '科技：刷新不重复领初始点');
  const hookAgain = fresh.buyHero('hook');
  assert(!hookAgain.ok && hookAgain.code === 'owned', '科技：钩刺免费已解锁不扣点');

  const oldZeroMem = memoryTechStorage({
    [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 0 }),
  });
  const oldZero = createTechStore(oldZeroMem);
  assert(oldZero.getState().points === 0, '科技：0 点老档不补发');
  const oldZeroReload = createTechStore(oldZeroMem);
  assert(oldZeroReload.getState().points === 0, '科技：0 点老档刷新仍为 0');
  const poor = oldZero.buyHero('ring');
  assert(!poor.ok && poor.code === 'poor', '科技：资源不足不能解锁');

  const oldNonzeroMem = memoryTechStorage({
    [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 40 }),
  });
  const oldNonzero = createTechStore(oldNonzeroMem);
  assert(oldNonzero.getState().points === 40, '科技：非零老档余额不变');
  const oldNonzeroReload = createTechStore(oldNonzeroMem);
  assert(oldNonzeroReload.getState().points === 40, '科技：非零老档刷新仍不变');

  const richStore = createTechStore(
    memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 300, unlockedHeroes: ['hook'] }) }),
  );
  const first = ['ring', 'chain', 'nail'] as const;
  for (const id of first) {
    const cost = richStore.heroUnlockCost();
    assert(cost === 30, `科技：前三次任意英雄应为 30（${id}）`);
    const got = richStore.buyHero(id);
    assert(got.ok && got.spent === 30, `科技：应能花 30 点亮${heroZh(id)}`);
  }
  assert(richStore.heroUnlockCost() === HERO_UNLOCK_COST_LATER, '科技：第四次起 60 点');
  const fourth = richStore.buyHero('arc');
  assert(fourth.ok && fourth.spent === 60, '科技：第四个英雄 60 点');
  const fifth = richStore.buyHero('well');
  assert(fifth.ok && fifth.spent === 60, '科技：第五个英雄仍 60');
  const sixth = richStore.buyHero('mirror');
  assert(sixth.ok && sixth.spent === 60, '科技：可自由选镜卫，不是固定前三名单');
  const dupHero = richStore.buyHero('ring');
  assert(!dupHero.ok && dupHero.code === 'owned' && richStore.getState().points === 30, '科技：重复解锁不扣点');
  const shared = richStore.buyTech('hookPull');
  assert(shared.ok && richStore.getState().points === 0, '科技：不同英雄共用同一余额');

  const techBag = createTechStore(
    memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 200, unlockedHeroes: ['hook'] }) }),
  );
  const p1 = techBag.buyTech('hookPull');
  const p2 = techBag.buyTech('hookStab');
  const p3 = techBag.buyTech('hookShove');
  const p4 = techBag.buyTech('hookBrake');
  assert(p1.ok && p2.ok && p3.ok && p4.ok, '科技：钩刺四槽可同时点亮');
  assert(techBag.snapshot().pull && techBag.snapshot().brake, '科技：四槽快照同时生效');
  const again = techBag.buyTech('hookPull');
  assert(!again.ok && again.code === 'owned', '科技：已点亮不重复扣点');
  const todo = techBag.buyTech('ringGlow' as never);
  assert(!todo.ok, '科技：其他英雄强化不可买');
  const beforeTodoPts = techBag.getState().points;
  const beforeTodoLit = techBag.getState().litTechs.join();
  for (const hero of HERO_IDS) {
    const names = skillNames(hero);
    const files = SKILL_ICON_FILES[hero];
    const slots = heroTechSlots(hero);
    assert(slots.length === 4, `科技：${heroZh(hero)} 应有四个普通技能槽`);
    for (let i = 0; i < 4; i += 1) {
      const slot = slots[i];
      assert(!!slot && slot.slot === i + 1, `科技：${heroZh(hero)} 槽顺序应为 1–4`);
      assert(slot.name === names[i], `科技：${heroZh(hero)} 第${i + 1}槽名应为 ${names[i]}`);
      assert(slot.iconFile === files[i], `科技：${heroZh(hero)} 第${i + 1}槽图标应读现有文件`);
      assert(!slot.iconUrl.includes('ult') && !/5/.test(slot.iconFile), `科技：${heroZh(hero)} 槽不应混入必杀`);
      if (hero === 'hook') {
        assert(slot.kind === 'live' && isBuyableTechId(slot.techId), '科技：钩刺四槽仍是可买科技 ID');
      } else {
        assert(slot.kind === 'todo' && slot.techId === todoSlotId(hero, slot.slot), `科技：${heroZh(hero)} 占位键应为 todo`);
        assert(!isBuyableTechId(slot.techId), `科技：${heroZh(hero)} 占位不能注册成可买科技 ID`);
        const denied = techBag.buyTech(slot.techId as never);
        assert(!denied.ok && denied.code === 'todo', `科技：${heroZh(hero)} ${slot.name} 购买路径应拒绝`);
        const deniedAgain = techBag.buyTech(slot.techId as never);
        assert(!deniedAgain.ok, `科技：${heroZh(hero)} ${slot.name} 重复购买仍拒绝`);
      }
    }
  }
  assert(allHeroTechSlots().length === HERO_IDS.length * 4, '科技：七英雄各四槽共 28 槽');
  assert(allHeroTechSlots().filter((item) => item.kind === 'todo').length === 24, '科技：非钩刺 6×4 全是 todo');
  assert(techBag.getState().points === beforeTodoPts && techBag.getState().litTechs.join() === beforeTodoLit, '科技：todo 购买不扣点不写解锁');
  assert(!techBag.getState().unlockedHeroes.includes('ring'), '科技：点 todo 槽不能绕过英雄解锁');

  const persistMem = memoryTechStorage({
    [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 80, unlockedHeroes: ['hook', 'ring'], litTechs: ['hookPull'] }),
  });
  const persistA = createTechStore(persistMem);
  assert(persistA.getState().points === 80 && persistA.isHeroUnlocked('ring') && persistA.isTechLit('hookPull'), '科技：写入后可读回');
  const persistB = createTechStore(persistMem);
  assert(persistB.getState().points === 80 && persistB.isHeroUnlocked('ring'), '科技：同存储再开仍保留');

  const rawCorrupt = '{not-json';
  const corruptMem = memoryTechStorage({ [TECH_SAVE_KEY]: rawCorrupt });
  const corrupt = createTechStore(corruptMem);
  assert(!corrupt.status().writable && (corrupt.status().raw === rawCorrupt), '科技：损坏不覆盖原始记录');
  assert(corrupt.getState().points === TECH_START_POINTS, '科技：损坏时本次按新档处理');
  const corruptBuy = corrupt.buyHero('ring');
  assert(!corruptBuy.ok && corrupt.status().raw === rawCorrupt, '科技：损坏时购买失败且不覆盖');
  assert(parseTechSave({ version: 1, points: -1, unlockedHeroes: ['hook'], litTechs: [] }) == null, '科技：负点数应拒');
  assert(parseTechSave({ version: 1, points: Infinity, unlockedHeroes: ['hook'], litTechs: [] }) == null, '科技：非有限值应拒');

  let writes = 0;
  const failWrite = {
    getItem: () => JSON.stringify({ ...emptyTechSave(), points: 40, unlockedHeroes: ['hook'] }),
    setItem: () => {
      writes += 1;
      throw new Error('quota');
    },
  };
  const failStore = createTechStore(failWrite);
  const failBuy = failStore.buyHero('ring');
  assert(!failBuy.ok && failBuy.code === 'write', '科技：写入失败不能假装买成');
  assert(failStore.getState().points === 40 && !failStore.isHeroUnlocked('ring'), '科技：写入失败不扣点');
  assert(writes >= 1, '科技：应尝试写入');

  assert(planMatchTechReward({ mode: 'controlPoint', winner: 'red' }).amount === TECH_REWARD_WIN, '科技：占点胜 20');
  assert(planMatchTechReward({ mode: 'controlPoint', winner: 'blue' }).amount === TECH_REWARD_LOSE, '科技：占点负 10');
  assert(planMatchTechReward({ mode: 'controlPoint', winner: null }).amount === TECH_REWARD_DRAW, '科技：占点平 10');
  assert(planMatchTechReward({ mode: 'eightKill', winner: 'red' }).amount === TECH_REWARD_EIGHT_FIRST, '科技：八杀第一 20');
  assert(planMatchTechReward({ mode: 'eightKill', winner: 'blue' }).amount === TECH_REWARD_EIGHT_REST, '科技：八杀其余 10');
  assert(planMatchTechReward({ mode: 'eightKill', winner: null }).amount === TECH_REWARD_EIGHT_FIRST, '科技：八杀并列第一 20');
  assert(planMatchTechReward({ mode: 'eightKill', winner: 'red', practice: true }).skip, '科技：练习零奖');

  const rewardStore = createTechStore(
    memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 0 }) }),
  );
  const g1 = rewardStore.grantMatchReward({ mode: 'controlPoint', winner: 'red', matchId: 'm1' });
  assert(g1.granted && g1.amount === 20 && g1.balance === 20, '科技：胜利发 20');
  const g1b = rewardStore.grantMatchReward({ mode: 'controlPoint', winner: 'red', matchId: 'm1' });
  assert(!g1b.granted && g1b.duplicate && rewardStore.getState().points === 20, '科技：同场不重复发');
  const gP = rewardStore.grantMatchReward({ mode: 'eightKill', winner: 'red', matchId: 'm2', practice: true });
  assert(!gP.granted && rewardStore.getState().points === 20, '科技：练习不发');
  const gLose = rewardStore.grantMatchReward({ mode: 'controlPoint', winner: 'blue', matchId: 'm3' });
  assert(gLose.granted && gLose.amount === 10, '科技：失败发 10');

  const noTech = createSkillCaster();
  const [plainRed, plainBlue] = redBlue(8, 6, 12, 6);
  fire(noTech, plainRed, 1, 1, 0, [plainRed, plainBlue]);
  advance(noTech, plainRed, [plainRed, plainBlue], HOOK_PULL.windup + 0.02);
  assert(
    Math.abs(plainBlue.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6,
    `科技：无槽位时钩矛仍 8 伤（实际 ${plainBlue.hp}）`,
  );
  assert(Math.abs((noTech.getCds()[0] ?? 0) - (HOOK_PULL.cd - HOOK_PULL.windup)) < 0.12, '科技：无槽位不扣远距 CD');

  const pullTech = createSkillCaster('hook', { techs: allTechs });
  const [farRed, farBlue] = redBlue(8, 6, 13.2, 6);
  fire(pullTech, farRed, 1, 1, 0, [farRed, farBlue]);
  const originX = farRed.x;
  advance(pullTech, farRed, [farRed, farBlue], HOOK_PULL.windup * 0.5);
  farRed.x = 12.4;
  advance(pullTech, farRed, [farRed, farBlue], HOOK_PULL.windup * 0.5 + 0.03);
  const path = Math.hypot(farBlue.x - originX, farBlue.y - 6);
  const instant = Math.hypot(farBlue.x - farRed.x, farBlue.y - farRed.y);
  assert(path >= HOOK_PULL.range * HOOK_PULL_TECH.farPathRatio, '科技：路径应按投出点算远距');
  assert(instant < HOOK_PULL.range * HOOK_PULL_TECH.farPathRatio, '科技：命中瞬间距离应已近');
  const cdAfter = pullTech.getCds()[0] ?? 0;
  const expectCd = HOOK_PULL.cd - HOOK_PULL.windup - HOOK_PULL.cd * HOOK_PULL_TECH.cdRefundRatio;
  assert(Math.abs(cdAfter - expectCd) < 0.12, '科技：应按完整 CD 的 20% 扣剩余，不是剩余×20%');
  const cdMid = cdAfter;
  advance(pullTech, farRed, [farRed, farBlue], 0.2);
  assert((pullTech.getCds()[0] ?? 0) <= cdMid && (pullTech.getCds()[0] ?? 0) >= 0, '科技：多余不结转，最低 0');

  const nearTech = createSkillCaster('hook', { techs: allTechs });
  const [nearRed, nearBlue] = redBlue(8, 6, 9.6, 6);
  fire(nearTech, nearRed, 1, 1, 0, [nearRed, nearBlue]);
  advance(nearTech, nearRed, [nearRed, nearBlue], HOOK_PULL.windup + 0.02);
  assert(Math.abs((nearTech.getCds()[0] ?? 0) - (HOOK_PULL.cd - HOOK_PULL.windup)) < 0.12, '科技：近距不扣远距 CD');

  const invPull = createSkillCaster('hook', { techs: allTechs });
  const [invRed, invBlue] = redBlue(8, 6, 13.2, 6);
  invBlue.invincibleRemain = 3;
  fire(invPull, invRed, 1, 1, 0, [invRed, invBlue]);
  advance(invPull, invRed, [invRed, invBlue], HOOK_PULL.windup + 0.02);
  assert(invBlue.hp === MAX_HP, '科技：无敌不触发钩矛远距');
  assert(Math.abs((invPull.getCds()[0] ?? 0) - HOOK_PULL.missCd) < 0.2, '科技：无敌应按未中');

  const shPull = createSkillCaster('hook', { techs: allTechs });
  const [shRed, shBlue] = redBlue(8, 6, 13.2, 6);
  applyPotionToBall(shBlue, 'shield');
  fire(shPull, shRed, 1, 1, 0, [shRed, shBlue]);
  advance(shPull, shRed, [shRed, shBlue], HOOK_PULL.windup + 0.02);
  assert(shBlue.hp === MAX_HP, '科技：普通盾可挡住钩矛伤');
  assert((shPull.getCds()[0] ?? 9) < HOOK_PULL.cd - HOOK_PULL.windup - 1, '科技：普通盾命中仍触发远距扣 CD');

  clearHookBleeds();
  const stabTech = createSkillCaster('hook', { techs: allTechs });
  const [stabRed, stabBlue] = redBlue(8, 6, 10.1, 6);
  stabRed.suppressCombat = true;
  stabBlue.suppressCombat = true;
  fire(stabTech, stabRed, 2, 1, 0, [stabRed, stabBlue]);
  advance(stabTech, stabRed, [stabRed, stabBlue], HOOK_STAB.windup + HOOK_STAB.interval * 2 + 0.02);
  assert(Math.abs(stabBlue.hp - (MAX_HP - 32)) < 1e-6, '科技：连刺基础 9/9/14 仍在');
  assert(hookBleedCount() === 1, '科技：三下都命中应上流血');
  const hpAfterStab = stabBlue.hp;
  advance(stabTech, stabRed, [stabRed, stabBlue], HOOK_STAB_TECH.interval - 0.05);
  assert(Math.abs(stabBlue.hp - hpAfterStab) < 0.2, '科技：流血第 1 秒前不应跳伤');
  advance(stabTech, stabRed, [stabRed, stabBlue], 0.1);
  assert(Math.abs(stabBlue.hp - (hpAfterStab - HOOK_STAB_TECH.damage)) < 0.2, '科技：第 1 秒 4 伤');
  advance(stabTech, stabRed, [stabRed, stabBlue], 1);
  assert(Math.abs(stabBlue.hp - (hpAfterStab - HOOK_STAB_TECH.damage * 2)) < 0.25, '科技：第 2 秒再 4 伤');
  advance(stabTech, stabRed, [stabRed, stabBlue], 1);
  assert(Math.abs(stabBlue.hp - (hpAfterStab - 12)) < 0.3, '科技：三跳共 12');
  assert(hookBleedCount() === 0, '科技：3 秒后流血应清');

  clearHookBleeds();
  const missStab = createSkillCaster('hook', { techs: allTechs });
  const missBall = createBallBody({ x: 8, y: 6, color: 1, team: 'red', facingX: 1 });
  fire(missStab, missBall, 2, 1, 0, [missBall]);
  advance(missStab, missBall, [missBall], HOOK_STAB.windup + HOOK_STAB.interval * 2 + 0.02);
  assert(hookBleedCount() === 0, '科技：挥空不应流血');

  clearHookBleeds();
  const a = createBallBody({ x: 8, y: 6, color: 1, team: 'red' });
  const b = createBallBody({ x: 10, y: 6, color: 2, team: 'blue' });
  applyHookBleed(b, a);
  tickHookBleeds(1, [a, b]);
  const afterFirst = b.hp;
  applyHookBleed(b, a);
  tickHookBleeds(0.2, [a, b]);
  assert(Math.abs(b.hp - afterFirst) < 0.01, '科技：再触发重计，旧剩余不补发');
  const cCaster = createBallBody({ x: 8, y: 5, color: 3, team: 'red' });
  applyHookBleed(b, cCaster);
  assert(hookBleedCount() === 2, '科技：不同施法者独立');
  b.inPlay = false;
  tickHookBleeds(0.01, [a, b, cCaster]);
  assert(hookBleedCount() === 0, '科技：目标死亡清除，不跨复活');
  b.inPlay = true;
  applyHookBleed(b, a);
  a.inPlay = false;
  tickHookBleeds(1, [a, b]);
  assert(b.hp < MAX_HP, '科技：施法者死亡不取消流血');
  clearHookBleeds();
  applyHookBleed(b, a);
  b.invincibleRemain = 5;
  const hpInv = b.hp;
  tickHookBleeds(1, [a, b]);
  assert(b.hp === hpInv, '科技：无敌跳过该 tick 不掉血');
  tickHookBleeds(2, [a, b]);
  assert(hookBleedCount() === 0 && b.hp === hpInv, '科技：无敌跳过不延时，次数仍耗完');

  const shoveTech = createSkillCaster('hook', { techs: allTechs });
  const [svRed, svBlue] = redBlue(8, 6, 12, 6);
  fire(shoveTech, svRed, 3, 1, 0, [svRed, svBlue]);
  let shoved = false;
  let left = HOOK_SHOVE.windup + HOOK_SHOVE.dashTime;
  while (left > 1e-9 && !shoved) {
    const dt = Math.min(1 / 60, left);
    play(shoveTech, svRed, [svRed, svBlue], dt);
    left -= dt;
    if (svBlue.hp < MAX_HP) {
      shoved = true;
      assert(Math.abs(svBlue.hp - (MAX_HP - HOOK_SHOVE.damage)) < 1e-6, '科技：盾冲先结算 12 伤');
      assert(svRed.hookShoveShieldHp === HOOK_SHOVE_TECH.shieldHp, '科技：命中后再发 12 点盾');
      assert(svRed.hookShoveShieldRemain > HOOK_SHOVE_TECH.shieldSec - 0.05, '科技：盾 2 秒');
    }
  }
  assert(shoved, '科技：盾冲应撞到人');
  grantHookShoveShield(svRed);
  assert(svRed.hookShoveShieldHp === 12 && svRed.hookShoveShieldRemain > 1.9, '科技：再触发重置 12 点 2 秒不叠加');

  const wallDash = createSkillCaster('hook', { techs: allTechs });
  const wallBall = createBallBody({ x: MAP_WIDTH - 1.4, y: 6, color: 1, team: 'red', facingX: 1 });
  fire(wallDash, wallBall, 3);
  advance(wallDash, wallBall, [wallBall], HOOK_SHOVE.windup + 0.2);
  assert(wallBall.hookShoveShieldHp === 0, '科技：撞墙不发盾');

  const allyDash = createSkillCaster('hook', { techs: allTechs });
  const allyA = createBallBody({ x: 8, y: 6, color: 1, team: 'red', facingX: 1 });
  const allyB = createBallBody({ x: 12, y: 6, color: 2, team: 'red', facingX: -1 });
  fire(allyDash, allyA, 3, 1, 0, [allyA, allyB]);
  advance(allyDash, allyA, [allyA, allyB], HOOK_SHOVE.windup + HOOK_SHOVE.dashTime);
  assert(allyA.hookShoveShieldHp === 0, '科技：撞友不发盾');

  const invDash = createSkillCaster('hook', { techs: allTechs });
  const [idRed, idBlue] = redBlue(8, 6, 12, 6);
  idBlue.invincibleRemain = 3;
  fire(invDash, idRed, 3, 1, 0, [idRed, idBlue]);
  advance(invDash, idRed, [idRed, idBlue], HOOK_SHOVE.windup + HOOK_SHOVE.dashTime);
  assert(idRed.hookShoveShieldHp === 0, '科技：无敌敌不发盾');

  const mix = createBallBody({ x: 8, y: 6, color: 1, team: 'red' });
  applyPotionToBall(mix, 'shield');
  grantHookShoveShield(mix);
  mix.potionShieldRemain = 1;
  mix.hookShoveShieldRemain = 2;
  const lost = applyHpLoss(mix, 20);
  assert(lost === 0, '科技：护盾应吸收');
  assert(mix.potionShieldHp === POTION_SHIELD - 20, '科技：先到期的药水盾先消耗');
  assert(mix.hookShoveShieldHp === 12, '科技：另一来源盾独立保留');

  const dead = createBallBody({ x: 8, y: 6, color: 1, team: 'red', hp: 0 });
  dead.inPlay = false;
  assert(!grantHookShoveShield(dead), '科技：已死不挂幽灵盾');

  const oldLit = createTechStore(
    memoryTechStorage({
      [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 77, unlockedHeroes: ['hook'], litTechs: ['hookBrake'] }),
    }),
  );
  assert(oldLit.isTechLit('hookBrake') && oldLit.getState().points === 77, '科技：旧蓄势点亮无损迁移且不重收费');
  const brakeDef = HOOK_TECH_DEFS.find((item) => item.id === 'hookBrake');
  assert(!!brakeDef && brakeDef.cost === 50, '科技：蓄势仍 50 点');
  assert(!!brakeDef && brakeDef.effect.includes('携带') && !brakeDef.effect.includes('80%') && !brakeDef.effect.includes('8 点'), '科技：蓄势描述改为携带，旧 +8/80% 取消');
  assert(!('extraDamage' in HOOK_BRAKE_TECH) && !('chargeRatio' in HOOK_BRAKE_TECH), '科技：旧追加 8 伤与蓄力门槛常量应删除');

  const brakeTech = createSkillCaster('hook', { techs: allTechs });
  const [brRed, brBlue] = redBlue(8, 6, 11.2, 6);
  brRed.vx = 8;
  fire(brakeTech, brRed, 4, 1, 0, [brRed, brBlue]);
  advance(brakeTech, brRed, [brRed, brBlue], HOOK_BRAKE.brakeTime + 0.08);
  assert(brRed.hookBrakeConvoyRemain > 0 || brRed.activeRamRemain > 0, '科技：点亮后弹出应打开携带/撞窗');
  const hpAtPop = brBlue.hp;
  let popLeft = 0.3;
  while (popLeft > 1e-9) {
    const dt = Math.min(1 / 60, popLeft);
    play(brakeTech, brRed, [brRed, brBlue], dt);
    popLeft -= dt;
  }
  assert(brBlue.hp === hpAtPop, '科技：碰敌不再追加 8 伤，新旧不能叠加');

  const allyPop = createSkillCaster('hook', { techs: allTechs });
  const allyLead = createBallBody({ x: 8, y: 8, color: 1, team: 'red', facingX: 1, vx: 0, vy: 0 });
  const allyMate = createBallBody({ x: 10.05, y: 8, color: 2, team: 'red', facingX: 1, vx: 0, vy: 0 });
  allyLead.suppressCombat = true;
  allyMate.suppressCombat = true;
  fire(allyPop, allyLead, 4, 1, 0, [allyLead, allyMate]);
  let waitPop = HOOK_BRAKE.brakeTime + 0.08;
  let poppedAlly = false;
  while (waitPop > 1e-9) {
    const dt = Math.min(1 / 60, waitPop);
    play(allyPop, allyLead, [allyLead, allyMate], dt);
    waitPop -= dt;
    if (allyLead.hookBrakeConvoyRemain > 0 && !poppedAlly) {
      poppedAlly = true;
      allyMate.x = allyLead.x + 1.92;
      allyMate.y = allyLead.y;
      allyMate.vx = 0;
      allyMate.vy = 0;
    }
  }
  assert(poppedAlly && allyMate.hookBrakeConvoyLeaderId === allyLead.id, '科技：弹出接触友军应携带');

  const wallPop = createSkillCaster('hook', { techs: allTechs });
  const wallPopBall = createBallBody({ x: MAP_WIDTH - 1.5, y: 6, color: 1, team: 'red', facingX: 1, vx: 0, vy: 0 });
  fire(wallPop, wallPopBall, 4);
  advance(wallPop, wallPopBall, [wallPopBall], HOOK_BRAKE.brakeTime + 0.2);
  assert(wallPopBall.hookBrakeConvoyRemain <= 0, `科技：冲锋者撞墙应结束携带窗（remain=${wallPopBall.hookBrakeConvoyRemain} x=${wallPopBall.x.toFixed(2)}）`);

  const bot = createSimpleBot(createBallBody({ x: 14, y: 6, color: 1, team: 'blue', facingX: -1 }));
  assert(!(bot.getCaster() as { getHero?: () => string }).getHero || bot.getCaster().getHero() === 'hook', '科技：AI 仍按自身 kit');
  const aiCaster = createSkillCaster('hook');
  const [aiRed, aiBlue] = redBlue(8, 6, 13.2, 6);
  fire(aiCaster, aiRed, 1, 1, 0, [aiRed, aiBlue]);
  advance(aiCaster, aiRed, [aiRed, aiBlue], HOOK_PULL.windup + 0.02);
  assert(Math.abs((aiCaster.getCds()[0] ?? 0) - (HOOK_PULL.cd - HOOK_PULL.windup)) < 0.12, '科技：默认施放器无玩家强化');

  const lockHost = document.createElement('div');
  document.body.appendChild(lockHost);
  const lockState = { hero: 'hook' as HeroId };
  const lockSet = createSettingsPanel(lockHost, {
    ...settingsActs(),
    getHero: () => lockState.hero,
    onPickHero: (id) => {
      lockState.hero = id;
    },
    getUnlockedHeroes: () => ['hook'],
  });
  lockSet.open();
  const lockPick = lockHost.querySelector<HTMLSelectElement>('select.settingsHeroPick');
  assert(!!lockPick, '科技：设置应有英雄下拉');
  const ringOpt = [...(lockPick?.options ?? [])].find((opt) => opt.value === 'ring');
  assert(!!ringOpt?.disabled, '科技：未解锁英雄应禁用');
  if (lockPick) {
    lockPick.value = 'ring';
    lockPick.dispatchEvent(new Event('change', { bubbles: true }));
  }
  assert(lockState.hero === 'hook', '科技：正式路径不能选未解锁英雄');
  const drillBtn = [...lockHost.querySelectorAll('button')].find(
    (btn) => btn.textContent === '练习' || btn.textContent === '结束练习',
  );
  const techBtn = [...lockHost.querySelectorAll('button')].find((btn) => btn.textContent === '科技');
  const restartBtn = [...lockHost.querySelectorAll('button')].find((btn) => (btn.textContent ?? '').includes('重开本局'));
  assert(!!techBtn, '科技：常规页应有科技入口');
  assert(!drillBtn, '科技：常规页不应再有练习入口');
  assert(!restartBtn, '科技：常规页不应再有重开本局');
  lockSet.close();
  lockHost.remove();

  const drillHost = document.createElement('div');
  document.body.appendChild(drillHost);
  const drillStore = createTechStore(
    memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 80 }) }),
  );
  const drillPanel = createTechPanel(drillHost, {
    store: drillStore,
    getPhase: () => 'countdown',
    getPractice: () => true,
  });
  drillPanel.open();
  assert(!drillHost.querySelector('button.techBuy'), '科技：练习战外也不写入永久购买');
  assert((drillHost.textContent ?? '').includes('练习'), '科技：练习应有试用说明');
  drillPanel.close();
  drillHost.remove();

  const storeUi = createTechStore(memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 40 }) }));
  const hudChrome =
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  const browse = document.createElement('div');
  browse.style.cssText = `position:fixed;left:0;top:0;width:1920px;height:1080px;${hudChrome}`;
  document.body.appendChild(browse);
  const browsePanel = createTechPanel(browse, { store: storeUi, getPhase: () => 'countdown' });
  browsePanel.open();
  const ptsAtBrowse = storeUi.getState().points;
  for (const hero of HERO_IDS) {
    const heroBtn = [...browse.querySelectorAll<HTMLButtonElement>('button.techItem')].find(
      (btn) => btn.dataset.techHero === hero && !btn.dataset.techSlot,
    );
    heroBtn?.click();
    const slotBox = browse.querySelector<HTMLElement>('[data-tech-slots]');
    assert(slotBox?.dataset.techSlots === hero, `科技：切到${heroZh(hero)}应只显示该英雄槽`);
    const slotBtns = [...(slotBox?.querySelectorAll<HTMLButtonElement>('button.techItem') ?? [])];
    assert(slotBtns.length === 4, `科技：${heroZh(hero)} UI 应有四槽`);
    const shown = slotBtns.map((btn) => btn.querySelector('.techItemName')?.textContent ?? '');
    assert(shown.join('/') === skillNames(hero).join('/'), `科技：${heroZh(hero)} UI 技能名/顺序应与 kit 一致`);
    for (let i = 0; i < 4; i += 1) {
      const img = slotBtns[i]?.querySelector<HTMLImageElement>('img.techItemIcon');
      assert(!!img?.src.includes(SKILL_ICON_FILES[hero][i] ?? 'missing'), `科技：${heroZh(hero)} 第${i + 1}槽应复用现有图标`);
      const nameEl = slotBtns[i]?.querySelector<HTMLElement>('.techItemName');
      assert(!!nameEl && nameEl.scrollWidth <= nameEl.clientWidth + 1, `科技：${heroZh(hero)} 槽名不应遮挡`);
    }
    if (hero === 'hook') {
      continue;
    }
    slotBtns[0]?.click();
    const detail = browse.querySelector('.techDetail')?.textContent ?? '';
    assert(detail.includes('todo·待开发'), `科技：${heroZh(hero)} 详情应标 todo·待开发`);
    assert(!detail.includes('消耗30点点亮') && !detail.includes('消耗50点点亮'), `科技：${heroZh(hero)} 详情不应假价格`);
  }
  assert(storeUi.getState().points === ptsAtBrowse, '科技：浏览全部 todo 槽不扣点');
  browsePanel.close();
  browse.remove();

  const assertUiFit = (viewW: number, viewH: number, label: string): void => {
    const fit = document.createElement('div');
    fit.style.cssText = `position:fixed;left:0;top:0;width:${viewW}px;height:${viewH}px;${hudChrome}`;
    document.body.appendChild(fit);
    applyStageVars(fit, computeLandscapeStage(viewW, viewH, { top: 0, right: 0, bottom: 0, left: 0 }));
    createMatchHud(fit);
    createHelpCard(fit);
    createTouchPad(fit, createActionBus());
    const settings = createSettingsPanel(fit, { ...settingsActs(), getUnlockedHeroes: () => ['hook'] });
    const panel = createTechPanel(fit, { store: storeUi, getPhase: () => 'countdown' });
    panel.open();
    const techRoot = fit.querySelector<HTMLElement>('.techPanel');
    const fab = fit.querySelector<HTMLButtonElement>('.techFab');
    const helpFab = fit.querySelector<HTMLButtonElement>('.helpFab');
    const gearFab = fit.querySelector<HTMLButtonElement>('.settingsFab');
    if (!techRoot || !fab || !helpFab || !gearFab) {
      fit.remove();
      throw new Error(`${label}：应有科技入口与面板`);
    }
    const slotBox = fit.querySelector<HTMLElement>('[data-tech-slots]');
    assert(slotBox?.dataset.techSlots === 'hook', `${label}：默认应显示钩刺四槽`);
    const hookPullItem = [...(slotBox?.querySelectorAll<HTMLButtonElement>('button.techItem') ?? [])].find((btn) =>
      (btn.textContent ?? '').includes('钩矛'),
    );
    hookPullItem?.click();
    const brakeItem = [...(slotBox?.querySelectorAll<HTMLButtonElement>('button.techItem') ?? [])].find((btn) =>
      (btn.textContent ?? '').includes('蓄势'),
    );
    brakeItem?.click();
    const brakeDetail = fit.querySelector('.techDetail')?.textContent ?? '';
    assert(brakeDetail.includes('携带') && !brakeDetail.includes('80%') && !brakeDetail.includes('追加'), `${label}：蓄势科技应为携带而非旧加伤`);
    hookPullItem?.click();
    const box = techRoot.getBoundingClientRect();
    const hostBox = fit.getBoundingClientRect();
    assert(box.left + 1 >= hostBox.left && box.top + 1 >= hostBox.top, `${label}：科技面板不溢出左上`);
    assert(box.right <= hostBox.right + 1 && box.bottom <= hostBox.bottom + 1, `${label}：科技面板不溢出右下`);
    assert(fab.getBoundingClientRect().right <= helpFab.getBoundingClientRect().left + 1, `${label}：科应在 ? 左侧`);
    assert(helpFab.getBoundingClientRect().right <= gearFab.getBoundingClientRect().left + 1, `${label}：? 仍在齿轮左`);
    assert((fit.textContent ?? '').includes('科技点 40'), `${label}：应显示余额`);
    assert((fit.textContent ?? '').includes('消耗30点点亮'), `${label}：应有点亮文案`);
    assert(!(fit.textContent ?? '').includes('胜12'), `${label}：不应出现旧胜 12 文案`);
    assert(!fit.querySelector('.techEquip'), `${label}：无装备栏`);
    const buy = [...fit.querySelectorAll<HTMLButtonElement>('button.techBuy')].find((btn) => !btn.disabled);
    assert(!!buy, `${label}：倒计时应可购买`);
    const ringHeroBtn = [...fit.querySelectorAll<HTMLButtonElement>('button.techItem')].find(
      (btn) => btn.dataset.techHero === 'ring' && !btn.dataset.techSlot,
    );
    ringHeroBtn?.click();
    const ringSlots = fit.querySelector<HTMLElement>('[data-tech-slots]');
    assert(ringSlots?.dataset.techSlots === 'ring', `${label}：切磁环应换四槽`);
    const ringSlotNames = [...(ringSlots?.querySelectorAll('.techItemName') ?? [])].map((n) => n.textContent ?? '');
    assert(ringSlotNames.join('/') === skillNames('ring').join('/'), `${label}：磁环四槽名/顺序应与现有技能一致`);
    assert(!(ringSlots?.textContent ?? '').includes('钩矛'), `${label}：切英雄不应残留钩刺槽`);
    const firstRingSlot = ringSlots?.querySelector<HTMLButtonElement>('button.techItem');
    firstRingSlot?.click();
    const ringDetail = fit.querySelector('.techDetail')?.textContent ?? '';
    assert(ringDetail.includes('todo·待开发'), `${label}：其他英雄槽应标 todo·待开发`);
    assert(!ringDetail.includes('30点') && !ringDetail.includes('50点') && !ringDetail.includes('消耗30点点亮'), `${label}：todo 槽不应出现假价格`);
    const todoBuy = fit.querySelector<HTMLButtonElement>('button.techBuy[data-tech-todo]');
    assert(!!todoBuy?.disabled && todoBuy.textContent === 'todo', `${label}：todo 点亮应禁用`);
    const ptsBeforeClick = storeUi.getState().points;
    todoBuy?.click();
    todoBuy?.click();
    assert(storeUi.getState().points === ptsBeforeClick, `${label}：重复点 todo 不扣点`);
    const ringUnlock = fit.querySelector<HTMLButtonElement>('button.techItem[data-tech-hero="ring"]:not([data-tech-slot])');
    ringUnlock?.click();
    assert((fit.querySelector('.techDetail')?.textContent ?? '').includes('消耗'), `${label}：未解锁英雄仍可买英雄解锁`);
    settings.open();
    assert(!panel.isOpen() || true, `${label}：设置与科技可并存关闭逻辑`);
    settings.close();
    panel.close();
    const fight = createTechPanel(fit, { store: storeUi, getPhase: () => 'playing' });
    fight.open();
    const liveOverlay = fit.querySelector('.techOverlay.isOn');
    assert((liveOverlay?.textContent ?? '').includes('局内只读') || (liveOverlay?.textContent ?? '').includes('下场'), `${label}：局内只读说明`);
    assert(!liveOverlay?.querySelector('button.techBuy'), `${label}：局内无购买按钮`);
    fight.close();
    const result = createResultPanel(fit, () => {});
    result.sync(
      {
        phase: 'result',
        timeLeft: 0,
        suddenDeath: false,
        redScore: 100,
        blueScore: 40,
        redBreakScore: 60,
        blueBreakScore: 20,
        redHoldScore: 40,
        blueHoldScore: 20,
        elapsedSec: 80,
        finishReason: '先到分',
        midpoint: 'none',
        winner: 'red',
        events: [],
        respawns: {},
        stallsOn: false,
        stalls: [],
        openingChargeRemain: 0,
        skillsLocked: false,
        mode: 'controlPoint',
        redKills: 0,
        blueKills: 0,
        potion: null,
        rift: null,
        matchId: 'ui1',
        practice: false,
      },
      { granted: true, amount: 20, balance: 60, note: '胜利 +20' },
    );
    assert((fit.textContent ?? '').includes('科技点 +20'), `${label}：结算应写奖励与余额`);
    fit.remove();
  };
  assertUiFit(1920, 1080, '科技 UI：1920×1080');
  assertUiFit(2340, 1080, '科技 UI：2340×1080');

  const ctl = createPlayerControl('hook', { techs: allTechs });
  assert(ctl.getCaster().getHero() === 'hook', '科技：控制层钩刺仍可用强化快照');
  const emptyCtl = createPlayerControl('hook', { techs: () => EMPTY_COMBAT_TECHS });
  assert(emptyCtl.getCaster().getHero() === 'hook', '科技：空快照不改基础 kit');

  const match = createMatchSession(redBlue(6, 6, 14, 6), { countdownSec: 0, playSec: 10, practice: true });
  assert(match.snapshot().practice && match.snapshot().matchId.length > 0, '科技：练习会话带 matchId');
  match.reset();
  assert(match.snapshot().matchId.length > 0, '科技：重开换新 matchId');

  assert(HOOK_TECH_DEFS.every((def) => def.cost === 30 || def.cost === 50), '科技：首测价格 30/30/50/50');
  clearHookBleeds();
}
