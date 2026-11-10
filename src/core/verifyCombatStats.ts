import {
  applyArmor,
  applyBurn,
  applyHealHot,
  createBallBody,
  type BallBody,
} from './ballBody';
import { applyCollisionCombat, type CollisionHit } from './collisionDamage';
import { BALL_RADIUS, MAX_HP, POTION_HEAL, RIFT_DAMAGE } from './constants';
import {
  createCombatStats,
  formatStatLabel,
  formatStatValue,
  statBarRatio,
} from './combatStats';
import { createActionBus, isAimUiTarget } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { createTouchPad } from '../input/touchPad';
import { createHelpCard } from '../ui/helpCard';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createCombatStatsPanel } from '../ui/combatStatsPanel';
import { applyStageVars, clientToHostLocal, computeLandscapeStage, type SafeInsets } from '../ui/stageLayout';
import { applyUiTheme, sameCssColor, UI_THEME } from '../ui/uiTheme';
import type { AppVersions } from '../ui/appVersion';
import { CHAIN_HEAL, CHAIN_SHIELD } from '../heroes/chainKit';
import { NAIL_ARMOR } from '../heroes/nailKit';
import { MIRROR_SHATTER } from '../heroes/mirrorKit';
import { createMatchRoster, createMatchSession } from './matchSession';
import { stepPhysics } from './physicsStep';
import { applyPotionToBall } from './potionField';
import { applySkillDamage } from './skillHits';
import { createSkillCaster } from './skillCaster';
import { resetTrapZones } from './trapZones';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
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

function hit(
  victim: BallBody,
  source: BallBody,
  damage: number,
  extra: Partial<CollisionHit> = {},
): CollisionHit {
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage,
    knockback: 0,
    relSpeed: 8,
    threshold: 0,
    ...extra,
  };
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

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  slot: SkillSlot,
  roster: readonly BallBody[],
  extra: Partial<ActionSample> = {},
): void {
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
}

function localBox(el: HTMLElement, host: HTMLElement): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  const a = el.getBoundingClientRect();
  const corners = [
    clientToHostLocal(host, a.left, a.top),
    clientToHostLocal(host, a.right, a.top),
    clientToHostLocal(host, a.left, a.bottom),
    clientToHostLocal(host, a.right, a.bottom),
  ];
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

function overlaps(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
}

function noRotate(el: HTMLElement): boolean {
  const transform = getComputedStyle(el).transform;
  return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
}

function fireOn(el: EventTarget, type: string, init: PointerEventInit = {}): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
      ...init,
    }),
  );
}

function redBlue(): [BallBody, BallBody] {
  const red = createBallBody({
    x: 6,
    y: 10,
    color: 0xe24a4a,
    label: '红1',
    team: 'red',
    teamSlot: 1,
    facingX: 1,
  });
  const blue = createBallBody({
    x: 14,
    y: 10,
    color: 0x3d7cf0,
    label: '蓝1',
    team: 'blue',
    teamSlot: 1,
    facingX: -1,
  });
  return [red, blue];
}

/** 本局伤害/治疗榜：实际扣血回血、归属、收起累计、页签、重开清零、不挡技能。 */
export function verifyCombatStats(): void {
  assert(formatStatLabel('红1') === '红1', '统计：名称应保留文字编号，不附加我');
  assert(formatStatLabel('蓝1') === '蓝1', '统计：非玩家名称应原样');
  assert(formatStatValue(12.4) === '12', '统计：累计值应四舍五入显示');
  assert(statBarRatio(50, 100) === 0.5 && statBarRatio(0, 0) === 0, '统计：数值条应按当前页签最大值比例');

  const stats = createCombatStats();
  const [red, blue] = redBlue();
  const ally = createBallBody({
    x: 6,
    y: 14,
    color: 0xc43d3d,
    label: '红2',
    team: 'red',
    teamSlot: 2,
  });
  const blue2 = createBallBody({
    x: 14,
    y: 14,
    color: 0x4f9bff,
    label: '蓝2',
    team: 'blue',
    teamSlot: 2,
  });
  const roster = [red, ally, blue, blue2];

  const overkillVic = createBallBody({ x: 8, y: 8, color: 0x3d7cf0, label: '蓝残', team: 'blue', hp: 5 });
  const overkillHit = applySkillDamage(overkillVic, red, 40);
  assert(overkillHit !== null && overkillHit.damage === 5, '统计：过量伤害只应按实际扣血');
  stats.applyHits(overkillHit ? [overkillHit] : []);
  assert(Math.abs(stats.totalsOf(red.id).damage - 5) < 1e-6, '统计：过量伤害不应把溢出记进输出');

  stats.applyHits([hit(blue, red, 12), hit(red, blue, 7)]);
  assert(Math.abs(stats.totalsOf(red.id).damage - 17) < 1e-6, '统计：普攻/技能直伤应记来源');
  assert(Math.abs(stats.totalsOf(blue.id).damage - 7) < 1e-6, '统计：双方输出应分开记');

  stats.applyHits([
    hit(blue, red, 9, { environment: true, sourceId: -1, sourceLabel: '地裂矛阵' }),
  ]);
  assert(Math.abs(stats.totalsOf(red.id).damage - 17) < 1e-6, '统计：环境伤害不应记任何人输出');
  assert(stats.totalsOf(-1).damage === 0, '统计：环境来源 id 不应入账');

  const shatter = applySkillDamage(red, red, MIRROR_SHATTER.selfDamage, {
    allowSelf: true,
    skipRefract: true,
    shatterCredit: MIRROR_SHATTER.selfDamage,
  });
  assert(shatter !== null && shatter.damage === MIRROR_SHATTER.selfDamage, '统计：裂镜自伤应仍走掉血');
  const beforeSelf = stats.totalsOf(red.id).damage;
  stats.applyHits(shatter ? [shatter] : []);
  assert(Math.abs(stats.totalsOf(red.id).damage - beforeSelf) < 1e-6, '统计：自伤不算对敌输出');

  const hotAlly = createBallBody({ x: 8, y: 8, color: 0xc43d3d, label: '红友', team: 'red', hp: 70 });
  applyHealHot(hotAlly, 6, 4, red.id);
  let hotHealed = 0;
  for (let i = 0; i < 60; i += 1) {
    const step = stepPhysics([hotAlly], 1 / 60);
    stats.applyHeals(step.heals);
    hotHealed += step.heals.reduce((sum, item) => sum + item.amount, 0);
  }
  assert(Math.abs(hotHealed - 6) < 0.35, '统计：HOT 1s 实际回血约 6');
  assert(Math.abs(stats.totalsOf(red.id).heal - hotHealed) < 1e-6, '统计：持续治疗应记施法者，不丢归属');
  assert(stats.totalsOf(hotAlly.id).heal === 0, '统计：被治者不应记成自己的治疗量');

  const full = createBallBody({ x: 9, y: 9, color: 0xe24a4a, label: '满血', team: 'red', hp: MAX_HP });
  applyHealHot(full, 8, 2, red.id);
  const overflowStats = createCombatStats();
  let overflow = 0;
  for (let i = 0; i < 30; i += 1) {
    const step = stepPhysics([full], 1 / 60);
    overflowStats.applyHeals(step.heals);
    overflow += step.heals.reduce((sum, item) => sum + item.amount, 0);
  }
  assert(overflow === 0 && overflowStats.totalsOf(red.id).heal === 0, '统计：溢出治疗不应入账');

  const almost = createBallBody({ x: 9, y: 10, color: 0xe24a4a, hp: MAX_HP - 2, team: 'red' });
  applyHealHot(almost, 8, 1, ally.id);
  const capStats = createCombatStats();
  for (let i = 0; i < 20; i += 1) {
    capStats.applyHeals(stepPhysics([almost], 1 / 60).heals);
  }
  assert(Math.abs(capStats.totalsOf(ally.id).heal - 2) < 1e-6, '统计：实际治疗应截到缺口 2');
  assert(almost.hp === MAX_HP, '统计：不应改回血公式');

  const potionBall = createBallBody({ x: 5, y: 5, color: 0xe24a4a, hp: 200, team: 'red', teamSlot: 1 });
  const gained = applyPotionToBall(potionBall, 'heal');
  assert(gained === POTION_HEAL, '统计：药剂应仍回实际血');
  const potionStats = createCombatStats();
  potionStats.applyHeals([{ unitId: potionBall.id, amount: gained, x: potionBall.x, y: potionBall.y }]);
  assert(potionStats.totalsOf(potionBall.id).heal === 0, '统计：无施法者药剂不应伪造英雄治疗量');

  const envVic = createBallBody({ x: 4, y: 4, color: 0x3d7cf0, team: 'blue' });
  const envStats = createCombatStats();
  envStats.applyHits([
    {
      victimId: envVic.id,
      sourceId: -1,
      victimLabel: envVic.label,
      sourceLabel: '地裂矛阵',
      damage: RIFT_DAMAGE,
      knockback: 0,
      relSpeed: 0,
      threshold: 0,
      environment: true,
    },
  ]);
  assert(envStats.totalsOf(red.id).damage === 0 && envStats.totalsOf(envVic.id).damage === 0, '统计：地裂不应记英雄输出');

  resetTrapZones();
  const chainRed = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    label: '红链',
    team: 'red',
    teamSlot: 1,
    facingX: 1,
    hero: 'chain',
    hp: 70,
  });
  const chainAlly = createBallBody({
    x: 10.5,
    y: 6,
    color: 0xc43d3d,
    label: '红友',
    team: 'red',
    teamSlot: 2,
    hero: 'hook',
    hp: 70,
  });
  const chainBlue = createBallBody({
    x: 14,
    y: 6,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
    teamSlot: 1,
    facingX: -1,
    hp: 70,
  });
  const chainStats = createCombatStats();
  const chain = createSkillCaster('chain');
  fire(chain, chainRed, 1, [chainRed, chainAlly, chainBlue]);
  let remain = CHAIN_HEAL.windup + 1;
  while (remain > 1e-9) {
    const dt = Math.min(1 / 60, remain);
    const skillHits = [...chain.tick(chainRed, dt, [chainRed, chainAlly, chainBlue])];
    const step = stepPhysics([chainRed, chainAlly, chainBlue], dt);
    skillHits.push(...chain.afterPhysics(chainRed, dt, [chainRed, chainAlly, chainBlue], false));
    chainStats.applyHits([...step.hits, ...skillHits]);
    chainStats.applyHeals(step.heals);
    remain -= dt;
  }
  assert(chainStats.totalsOf(chainRed.id).heal > 4, '统计：愈链实际回血应记施法者');
  assert(chainStats.totalsOf(chainAlly.id).heal === 0, '统计：愈链被治者不应记治疗榜');
  const afterHot = chainStats.totalsOf(chainRed.id).heal;
  chainRed.inPlay = false;
  remain = 0.5;
  while (remain > 1e-9) {
    const dt = Math.min(1 / 60, remain);
    chainStats.applyHeals(stepPhysics([chainRed, chainAlly, chainBlue], dt).heals);
    remain -= dt;
  }
  assert(chainStats.totalsOf(chainRed.id).heal > afterHot, '统计：施法者死亡后 HOT 仍应记原归属');
  chainRed.inPlay = true;

  resetTrapZones();
  const leechRed = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'chain',
    hp: 70,
  });
  const leechBlue = createBallBody({
    x: 11,
    y: 6,
    color: 0x3d7cf0,
    team: 'blue',
    facingX: -1,
    hp: 70,
  });
  const leechStats = createCombatStats();
  const leech = createSkillCaster('chain');
  fire(leech, leechRed, 2, [leechRed, leechBlue]);
  remain = 1;
  while (remain > 1e-9) {
    const dt = Math.min(1 / 60, remain);
    const skillHits = [...leech.tick(leechRed, dt, [leechRed, leechBlue])];
    const step = stepPhysics([leechRed, leechBlue], dt);
    skillHits.push(...leech.afterPhysics(leechRed, dt, [leechRed, leechBlue], false));
    leechStats.applyHits([...step.hits, ...skillHits]);
    leechStats.applyHeals(step.heals);
    remain -= dt;
  }
  assert(Math.abs(leechStats.totalsOf(leechRed.id).heal - CHAIN_SHIELD.dps) < 0.5, '统计：盾脉实际回血应记自己');
  assert(Math.abs(leechStats.totalsOf(leechRed.id).damage - CHAIN_SHIELD.dps) < 0.5, '统计：盾脉实际扣血应记自己输出');

  const nail = createBallBody({
    x: 10,
    y: 10,
    color: 0xe24a4a,
    team: 'red',
    hero: 'nail',
    hp: 70,
  });
  applyArmor(nail, NAIL_ARMOR.mul, NAIL_ARMOR.duration);
  const nailStats = createCombatStats();
  remain = NAIL_ARMOR.duration + 0.05;
  while (remain > 1e-9) {
    const dt = Math.min(1 / 60, remain);
    nailStats.applyHeals(stepPhysics([nail], dt).heals);
    remain -= dt;
  }
  assert(Math.abs(nailStats.totalsOf(nail.id).heal - NAIL_ARMOR.heal) < 1e-6, '统计：甲垒未破甲回血应记自己');

  const spearA = createBallBody({
    x: 10 - BALL_RADIUS * 1.1,
    y: 8,
    color: 0xe24a4a,
    vx: 8,
    facingX: 1,
    team: 'red',
    label: '红枪',
  });
  const spearB = createBallBody({
    x: 10 + BALL_RADIUS * 1.1,
    y: 8,
    color: 0x3d7cf0,
    vx: -8,
    facingX: -1,
    team: 'blue',
    label: '蓝枪',
  });
  const spearHits = applyCollisionCombat(spearA, spearB, 1, 0, 16);
  const spearStats = createCombatStats();
  spearStats.applyHits(spearHits);
  assert(spearStats.totalsOf(spearA.id).damage > 0 && spearStats.totalsOf(spearB.id).damage > 0, '统计：枪尖普攻应记双方实际输出');

  const burnVic = createBallBody({ x: 12, y: 8, color: 0x3d7cf0, team: 'blue', hp: 80 });
  const burnSrc = createBallBody({ x: 8, y: 8, color: 0xe24a4a, team: 'red' });
  applyBurn(burnVic, 6, 2, burnSrc.id);
  const burnStats = createCombatStats();
  remain = 1;
  while (remain > 1e-9) {
    const dt = Math.min(1 / 60, remain);
    const step = stepPhysics([burnVic, burnSrc], dt);
    burnStats.applyHits(step.hits);
    remain -= dt;
  }
  assert(Math.abs(burnStats.totalsOf(burnSrc.id).damage - 6) < 0.45, '统计：持续伤害应记原施法者');

  const tieA = createBallBody({ x: 1, y: 1, color: 0xe24a4a, label: '红1', team: 'red', teamSlot: 1 });
  const tieB = createBallBody({ x: 2, y: 1, color: 0x3d7cf0, label: '蓝1', team: 'blue', teamSlot: 1 });
  const tieC = createBallBody({ x: 3, y: 1, color: 0xc43d3d, label: '红2', team: 'red', teamSlot: 2 });
  const sortStats = createCombatStats();
  sortStats.applyHits([hit(tieB, tieA, 10), hit(tieA, tieB, 10), hit(tieA, tieC, 4)]);
  const dmgRows = sortStats.snapshot([tieA, tieB, tieC], tieA.id, 'damage');
  assert(dmgRows.length === 3, '统计：人数应随阵容，不写死 2v2');
  assert(dmgRows[0].value === 10 && dmgRows[1].value === 10, '统计：应按当前页签降序');
  assert(dmgRows[0].unitId === tieA.id && dmgRows[1].unitId === tieB.id, '统计：同值应稳定按阵容顺序');
  assert(dmgRows[0].isMe && !dmgRows[1].isMe, '统计：账本仍应认出当前玩家，不把玩家改成蓝队');
  assert(formatStatLabel(dmgRows[0].label) === '红1', '统计：显示名应跟既有红1归属，不改身份');
  const healRows = sortStats.snapshot([tieA, tieB, tieC], tieA.id, 'heal');
  assert(
    healRows[0].unitId === tieA.id && healRows[1].unitId === tieB.id && healRows[2].unitId === tieC.id,
    '统计：治疗页全 0 时应保持阵容稳定序',
  );

  const keep = createCombatStats();
  keep.applyHits([hit(blue, red, 11)]);
  red.inPlay = false;
  keep.applyHits([hit(blue, red, 3)]);
  red.inPlay = true;
  assert(Math.abs(keep.totalsOf(red.id).damage - 14) < 1e-6, '统计：死亡复活不应清零');

  const matchBalls = createMatchRoster({ player: 'hook', ally: 'chain', blue1: 'ring', blue2: 'nail' });
  const player = matchBalls.find((ball) => ball.team === 'red' && ball.teamSlot === 1);
  if (!player) {
    throw new Error('统计：阵容应有红1');
  }
  const eight = createMatchSession(matchBalls, { mode: 'eightKill', countdownSec: 0 });
  const point = createMatchSession(matchBalls, { mode: 'controlPoint', countdownSec: 0 });
  const modeStats = createCombatStats();
  modeStats.applyHits([hit(matchBalls[2], player, 8)]);
  eight.tick(0.05, []);
  point.tick(0.05, []);
  assert(modeStats.totalsOf(player.id).damage === 8, '统计：八杀与占点共用账本，模式切换前不清');
  modeStats.reset();
  assert(modeStats.totalsOf(player.id).damage === 0, '统计：重开/切模式应清零');
  modeStats.applyHits([hit(matchBalls[2], player, 6)]);
  eight.tick(0.05, []);
  assert(modeStats.totalsOf(player.id).damage === 6, '统计：结算前累计应保留');

  const uiStats = createCombatStats();
  const host = document.createElement('div');
  const hudChrome =
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px;--combat-stats-skill-clearance:110px';
  host.style.cssText = `position:relative;width:1920px;height:1080px;${hudChrome}`;
  applyUiTheme(host);
  document.body.appendChild(host);
  const panel = createCombatStatsPanel(host, uiStats);
  const pad = createTouchPad(host, createActionBus());
  createHelpCard(host);
  createSettingsPanel(host, {
    onRestart: () => {},
    onReload: () => {},
    versions: dummyVersions(),
  });
  applyStageVars(host, computeLandscapeStage(1920, 1080, { top: 0, right: 0, bottom: 0, left: 0 }));
  uiStats.applyHits([hit(blue, red, 20), hit(red, ally, 5)]);
  uiStats.applyHeals([{ unitId: ally.id, amount: 9, x: ally.x, y: ally.y, sourceId: red.id }]);
  panel.sync(roster, red.id);

  const root = host.querySelector<HTMLElement>('.combatStats');
  const board = host.querySelector<HTMLElement>('.combatStatsPanel');
  const dock = host.querySelector<HTMLButtonElement>('.combatStatsDock');
  const collapseBtn = host.querySelector<HTMLButtonElement>('.combatStatsCollapse');
  const damageTab = host.querySelector<HTMLButtonElement>('.combatStatsTab[data-tab="damage"]');
  const healTab = host.querySelector<HTMLButtonElement>('.combatStatsTab[data-tab="heal"]');
  if (!root || !board || !dock || !collapseBtn || !damageTab || !healTab) {
    host.remove();
    throw new Error('统计：应有面板、页签、收起与侧边按钮');
  }
  assert(panel.isCollapsed() && panel.getTab() === 'damage', '统计：默认收起且伤害页签');
  assert(board.hidden && !dock.hidden, '统计：进入时应只显示右侧展开钮');
  assert(damageTab.classList.contains('isOn') && !healTab.classList.contains('isOn'), '统计：默认伤害页签应选中');
  assert(getComputedStyle(board).display === 'none', '统计：默认收起后面板应完全隐藏');
  assert(getComputedStyle(dock).display !== 'none', '统计：默认收起后侧边钮应可见');
  assert(board.getAttribute('data-touch-control') === 'stats', '统计：面板点击应标 touch-control，不穿透战场');
  assert(isAimUiTarget(board) && isAimUiTarget(dock), '统计：点面板/侧边钮不应当成瞄准空白');
  const names = [...board.querySelectorAll('.combatStatsName')].map((el) => el.textContent);
  assert(names[0] === '红1', '统计：面板应显示红1 文字编号，不改成蓝队');
  assert(names.includes('蓝1') && names.includes('红2') && names.includes('蓝2'), '统计：应列出双方所有人');
  assert(names.every((name) => !!name && !name.includes('我')), '统计：名称不应带我标记');
  assert(!board.querySelector('.combatStatsFace, .combatStatsMarkSvg, svg'), '统计：行首不应再有图标');
  assert(!board.querySelector('.combatStatsSlot, .combatStatsDot'), '统计：行内不应再有排名序号或队色圆点');
  assert(!board.querySelector('[data-me]'), '统计：不应再留自我标签');
  assert(!(board.textContent ?? '').includes('· 我'), '统计：面板文案不应出现我');
  assert(
    [...board.querySelectorAll('.combatStatsRow')].every((row) => !/^\s*\d/.test(row.textContent ?? '')),
    '统计：行首不应再是排名数字',
  );
  fireOn(dock, 'pointerdown');
  assert(!panel.isCollapsed() && !board.hidden && dock.hidden, '统计：点侧边钮应展开面板');
  assert(getComputedStyle(dock).display === 'none', '统计：展开时侧边钮应完全隐藏，不能露在面板下');
  const redName = board.querySelector<HTMLElement>('.combatStatsRow[data-team="red"] .combatStatsName');
  const redVal = board.querySelector<HTMLElement>('.combatStatsRow[data-team="red"] .combatStatsVal');
  const blueName = board.querySelector<HTMLElement>('.combatStatsRow[data-team="blue"] .combatStatsName');
  const blueVal = board.querySelector<HTMLElement>('.combatStatsRow[data-team="blue"] .combatStatsVal');
  if (!redName || !redVal || !blueName || !blueVal) {
    host.remove();
    throw new Error('统计：红蓝行应有名称与数值');
  }
  assert(sameCssColor(getComputedStyle(redName).color, UI_THEME.teamRedShadow), '统计：红方名称应为深红');
  assert(sameCssColor(getComputedStyle(redVal).color, UI_THEME.teamRedShadow), '统计：红方数值应为深红');
  assert(sameCssColor(getComputedStyle(blueName).color, UI_THEME.teamBlueShadow), '统计：蓝方名称应为深蓝');
  assert(sameCssColor(getComputedStyle(blueVal).color, UI_THEME.teamBlueShadow), '统计：蓝方数值应为深蓝');
  assert(!!board.querySelector('.combatStatsBarFill'), '统计：应保留数值条');
  assert(!board.textContent?.includes('示例数据'), '统计：不应照抄 demo 示例数据');
  const reopenHost = document.createElement('div');
  const reopenPanel = createCombatStatsPanel(reopenHost, uiStats);
  assert(reopenPanel.isCollapsed(), '统计：再次进入应默认收起，不沿用上次打开');
  reopenHost.remove();
  panel.sync(roster, ally.id);
  const swapped = [...board.querySelectorAll('.combatStatsName')].map((el) => el.textContent);
  assert(swapped.includes('红1') && swapped.includes('红2'), '统计：切到队友仍应显示红1/红2 身份');
  assert(swapped.every((name) => !!name && !name.includes('我')), '统计：切英雄/切玩家后仍不应标我');
  panel.sync(roster, red.id);

  fireOn(healTab, 'pointerdown');
  assert(panel.getTab() === 'heal', '统计：触控点治疗页签应切换');
  panel.sync(roster, red.id);
  const healNames = [...board.querySelectorAll('.combatStatsName')].map((el) => el.textContent);
  const healFirst = healNames[0];
  assert(healFirst === '红1', '统计：治疗页应按治疗量降序且保留红1 身份');
  assert(!healFirst?.includes('我'), '统计：治疗页也不应标我');
  assert(healNames.includes('蓝1') && healNames.includes('红2'), '统计：治疗页仍应保留队伍编号文字');
  assert(!board.querySelector('.combatStatsSlot, .combatStatsDot'), '统计：治疗页也不应有排名序号或队色圆点');
  fireOn(collapseBtn, 'pointerdown');
  assert(panel.isCollapsed() && board.hidden && !dock.hidden, '统计：收起后只留侧边统计钮');
  assert(getComputedStyle(board).display === 'none', '统计：收起后面板应完全隐藏');
  assert(getComputedStyle(dock).display !== 'none', '统计：收起后侧边钮应可见');
  uiStats.applyHits([hit(blue, red, 8)]);
  fireOn(dock, 'pointerdown');
  assert(!panel.isCollapsed() && panel.getTab() === 'heal', '统计：展开应保留当前页签');
  panel.sync(roster, red.id);
  const healedVal = [...board.querySelectorAll('.combatStatsRow')]
    .find((row) => row.querySelector('.combatStatsName')?.textContent === '红1')
    ?.querySelector('.combatStatsVal')?.textContent;
  assert(healedVal === '9', '统计：收起后再展开治疗页应看到累计治疗');
  fireOn(damageTab, 'pointerdown');
  panel.sync(roster, red.id);
  const afterCollapse = uiStats.totalsOf(red.id).damage;
  assert(afterCollapse === 28, '统计：收起期间仍应累计');

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host.appendChild(canvas);
  const bus = createActionBus();
  const unbind = bindPcInput({
    bus,
    canvas,
    getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
    getAimingSlot: () => 0 as SkillSlot | 0,
  });
  fireOn(board, 'pointerdown', { clientX: 1800, clientY: 700, pointerType: 'touch' });
  const blocked = bus.sample(0, 0);
  assert(!blocked.confirmRelease, '统计：点面板不应穿透成释放');
  unbind();

  const none: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  panel.expand();
  panel.sync(roster, red.id);
  assertLayout(host, pad, 1920, 1080, none, '1920x1080');
  host.style.width = '2340px';
  host.style.height = '1080px';
  applyStageVars(host, computeLandscapeStage(2340, 1080, none));
  panel.expand();
  panel.sync(roster, red.id);
  assertLayout(host, pad, 2340, 1080, none, '2340x1080');

  uiStats.reset();
  panel.sync(roster, red.id);
  const zeroVal = [...board.querySelectorAll('.combatStatsVal')].every((el) => el.textContent === '0');
  assert(zeroVal, '统计：重开后面板应显示 0');
  assert(!panel.isCollapsed(), '统计：重开清零不应额外收起或展开');
  host.remove();
}

function assertLayout(
  host: HTMLElement,
  pad: ReturnType<typeof createTouchPad>,
  viewW: number,
  viewH: number,
  insets: SafeInsets,
  label: string,
): void {
  const skills = host.querySelector<HTMLElement>('.touchSkills');
  const cancel = host.querySelector<HTMLButtonElement>('button.touchCancel');
  const board = host.querySelector<HTMLElement>('.combatStatsPanel');
  const dock = host.querySelector<HTMLButtonElement>('.combatStatsDock');
  const helpFab = host.querySelector<HTMLButtonElement>('.helpFab');
  const settingsFab = host.querySelector<HTMLButtonElement>('.settingsFab');
  const root = host.querySelector<HTMLElement>('.combatStats');
  if (!skills || !board || !dock || !cancel || !root) {
    throw new Error(`统计：${label} 应有技能键与统计面板`);
  }
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false });
  const skillBox = localBox(skills, host);
  const boardBox = localBox(board, host);
  const texts = [...board.querySelectorAll<HTMLElement>('.combatStatsName, .combatStatsVal')];
  assert(
    texts.every((el) => el.scrollWidth <= el.clientWidth + 1),
    `统计：${label} 名称/数值不应溢出`,
  );
  assert(boardBox.right <= host.clientWidth + 1 && boardBox.left >= -1, `统计：${label} 面板不应溢出视窗`);
  assert(boardBox.bottom <= skillBox.top - 4, `统计：${label} 展开面板应在技能键上方，不遮挡`);
  assert(!overlaps(boardBox, skillBox), `统计：${label} 面板不应叠技能`);
  assert(host.clientWidth - boardBox.right < 24, `统计：${label} 面板应贴右侧`);
  assert(noRotate(root) && noRotate(board) && noRotate(dock), `统计：${label} 面板无 CSS 旋转`);
  if (helpFab && settingsFab) {
    const helpBox = localBox(helpFab, host);
    const gearBox = localBox(settingsFab, host);
    assert(!overlaps(boardBox, helpBox) && !overlaps(boardBox, gearBox), `统计：${label} 面板不应挡 ?/齿轮`);
  }
  pad.sync({ aimingSlot: 2, skillCds: [0, 0, 0, 0], fineTuneOn: false });
  assert(!cancel.hidden, `统计：${label} 瞄准中应显示取消`);
  const cancelBox = localBox(cancel, host);
  const liveBoard = localBox(board, host);
  assert(!overlaps(liveBoard, cancelBox), `统计：${label} 面板不应挡瞄准取消键`);
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false });

  const wasHidden = board.hidden;
  const dockWasHidden = dock.hidden;
  board.hidden = true;
  dock.hidden = false;
  const dockBox = localBox(dock, host);
  assert(!overlaps(dockBox, skillBox), `统计：${label} 侧边钮不挡技能`);
  assert(dockBox.bottom <= skillBox.top - 2, `统计：${label} 侧边钮应在技能键上方`);
  if (helpFab && settingsFab) {
    assert(!overlaps(dockBox, localBox(helpFab, host)), `统计：${label} 侧边钮不挡 ?`);
    assert(!overlaps(dockBox, localBox(settingsFab, host)), `统计：${label} 侧边钮不挡齿轮`);
  }
  assert(dockBox.right <= viewW - insets.right + 1, `统计：${label} 侧边钮不应越过右侧安全区`);
  assert(dockBox.left >= insets.left - 1, `统计：${label} 侧边钮应在视口内`);
  assert(dockBox.top >= insets.top - 1 && dockBox.bottom <= viewH - insets.bottom + 1, `统计：${label} 侧边钮应在安全区内`);
  board.hidden = wasHidden;
  dock.hidden = dockWasHidden;
}
