import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { createMatchHud } from '../ui/matchHud';
import { createCombatStats } from './combatStats';
import { createCombatStatsPanel } from '../ui/combatStatsPanel';
import { createResultPanel } from '../ui/resultPanel';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createSkillTip } from '../ui/skillTip';
import {
  UI_THEME,
  applyUiTheme,
  cssColorHasGold,
  sameCssColor,
} from '../ui/uiTheme';
import type { MatchSnapshot } from './matchSession';

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

function color(el: HTMLElement, prop: 'color' | 'backgroundColor' | 'borderTopColor'): string {
  return getComputedStyle(el)[prop];
}

function borderPx(el: HTMLElement): number {
  return Number.parseFloat(getComputedStyle(el).borderTopWidth);
}

function dummyResultSnap(partial: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: 'result',
    timeLeft: 0,
    suddenDeath: false,
    redScore: 100,
    blueScore: 42,
    redBreakScore: 60,
    blueBreakScore: 30,
    redHoldScore: 40,
    blueHoldScore: 12,
    elapsedSec: 118,
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
    ...partial,
  };
}

/** 局内 HUD chrome + 说明卡/设置浮层：羊皮纸+木框，金只在计时；结算板同族并可热闹金。 */
export function verifyUiTheme(): void {
  assert(UI_THEME.parchmentBase === '#F3E6C8', '色板：parchment_base');
  assert(UI_THEME.parchmentShadow === '#D4C19A', '色板：parchment_shadow');
  assert(UI_THEME.parchmentHighlight === '#FFF8E7', '色板：parchment_highlight');
  assert(UI_THEME.ink === '#3A2E24', '色板：ink');
  assert(UI_THEME.inkMuted === '#6B5A48', '色板：ink_muted');
  assert(UI_THEME.woodFrame === '#8B5A2B', '色板：wood_frame');
  assert(UI_THEME.woodFrameDark === '#5C3A1A', '色板：wood_frame_dark');
  assert(UI_THEME.panelBorder === '#A67C52', '色板：panel_border');
  assert(UI_THEME.buttonIdle === '#F7EDD6', '色板：button_idle');
  assert(UI_THEME.buttonPressed === '#C9B48A', '色板：button_pressed');
  assert(UI_THEME.teamRed === '#C43C3C', '色板：team_red');
  assert(UI_THEME.teamRedShadow === '#8E2A2A', '色板：team_red_shadow');
  assert(UI_THEME.teamRedHighlight === '#E86A5A', '色板：team_red_highlight');
  assert(UI_THEME.teamBlue === '#3A6FBF', '色板：team_blue');
  assert(UI_THEME.teamBlueShadow === '#254A86', '色板：team_blue_shadow');
  assert(UI_THEME.teamBlueHighlight === '#6A9AE0', '色板：team_blue_highlight');
  assert(UI_THEME.goldSpear === '#D4A017', '色板：gold_spear');
  assert(UI_THEME.goldSpearShadow === '#A07812', '色板：gold_spear_shadow');
  assert(UI_THEME.goldSpearHighlight === '#F0C94A', '色板：gold_spear_highlight');
  assert(UI_THEME.cdMask === '#2A2218', '色板：cd_mask');
  assert(UI_THEME.cdMaskAlpha === 0.55, '色板：cd_mask alpha ≈55%');
  assert(UI_THEME.outlineUi === '#2F241A', '色板：outline_ui');

  const host = document.createElement('div');
  host.style.cssText =
    'position:relative;width:375px;height:667px;--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  applyUiTheme(host);
  createMatchHud(host);
  createTouchPad(host, createActionBus(), { holdMs: 0 });
  const statsUi = createCombatStatsPanel(host, createCombatStats());
  const help = createHelpCard(host);
  const settings = createSettingsPanel(host, {
    onRestart: () => {},
    onCollision: () => {},
    onScore: () => {},
    onAdvance: () => {},
    onJumpClock: () => {},
    onForceRespawn: () => {},
    versions: dummyVersions(),
  });
  const resultUi = createResultPanel(host, () => {});
  document.body.appendChild(host);

  const cluster = host.querySelector<HTMLElement>('.matchHudCluster');
  const clock = host.querySelector<HTMLElement>('.matchHudClock');
  const red = host.querySelector<HTMLElement>('.matchHudRed');
  const blue = host.querySelector<HTMLElement>('.matchHudBlue');
  const wrap = host.querySelector<HTMLElement>('.matchHudHeroWrap');
  const stripe = host.querySelector<HTMLElement>('.matchHudModeStripe');
  const pick = host.querySelector<HTMLElement>('select.matchHudMode');
  const skill = host.querySelector<HTMLButtonElement>('.touchSkillBtn');
  const helpFab = host.querySelector<HTMLButtonElement>('.helpFab');
  const settingsFab = host.querySelector<HTMLButtonElement>('.settingsFab');
  if (!cluster || !clock || !red || !blue || !wrap || !stripe || !pick || !skill || !helpFab || !settingsFab) {
    host.remove();
    throw new Error('HUD 换皮：应有胶囊、模式下拉、技能键与 ?/齿轮');
  }

  const clusterCs = getComputedStyle(cluster);
  assert(
    sameCssColor(clusterCs.backgroundColor, UI_THEME.parchmentBase),
    `比分胶囊：羊皮纸底（实际 ${clusterCs.backgroundColor}）`,
  );
  assert(clusterCs.borderTopStyle === 'solid', '比分胶囊：实线木框');
  assert(borderPx(cluster) >= 1, `比分胶囊：木框可见（实际 ${clusterCs.borderTopWidth}）`);
  assert(
    sameCssColor(clusterCs.borderTopColor, UI_THEME.woodFrame),
    `比分胶囊：wood_frame（实际 ${clusterCs.borderTopColor}）`,
  );
  assert(sameCssColor(color(clock, 'color'), UI_THEME.goldSpear), '计时应为 gold_spear');
  assert(sameCssColor(color(red, 'color'), UI_THEME.teamRed), '红分应为 team_red');
  assert(sameCssColor(color(blue, 'color'), UI_THEME.teamBlue), '蓝分应为 team_blue');

  const wrapCs = getComputedStyle(wrap);
  assert(sameCssColor(wrapCs.backgroundColor, UI_THEME.parchmentBase), '模式下拉：羊皮纸底');
  assert(sameCssColor(wrapCs.borderTopColor, UI_THEME.panelBorder), '模式下拉：panel_border');
  assert(sameCssColor(color(stripe, 'backgroundColor'), UI_THEME.woodFrame), '模式下拉：左侧木条');
  assert(sameCssColor(color(pick, 'color'), UI_THEME.ink), '模式下拉：文字 ink');
  assert(!cssColorHasGold(wrapCs.boxShadow) && !cssColorHasGold(wrapCs.borderTopColor), '模式下拉：无金饰');

  const skillCs = getComputedStyle(skill);
  assert(sameCssColor(skillCs.backgroundColor, UI_THEME.buttonIdle), `技能键：button_idle（实际 ${skillCs.backgroundColor}）`);
  assert(skillCs.borderTopStyle === 'solid', '技能键：实线木框');
  assert(borderPx(skill) >= 1, `技能键：木框可见（实际 ${skillCs.borderTopWidth}）`);
  assert(sameCssColor(skillCs.borderTopColor, UI_THEME.woodFrame), `技能键：wood_frame（实际 ${skillCs.borderTopColor}）`);
  assert(sameCssColor(skillCs.color, UI_THEME.ink), '技能键：图标 ink');
  assert(!cssColorHasGold(skillCs.boxShadow) && !cssColorHasGold(skillCs.borderTopColor), '技能键就绪：无金闪');
  skill.classList.add('isAiming');
  const aimingCs = getComputedStyle(skill);
  assert(sameCssColor(aimingCs.backgroundColor, UI_THEME.buttonPressed), '技能键按下：button_pressed');
  assert(!cssColorHasGold(aimingCs.boxShadow) && !cssColorHasGold(aimingCs.borderTopColor), '技能键瞄准：无金闪');
  skill.classList.remove('isAiming');

  const wipe = skill.querySelector<HTMLElement>('.touchSkillCdWipe');
  if (!wipe) {
    host.remove();
    throw new Error('HUD 换皮：技能键应有 CD 遮罩');
  }
  const cdMask = getComputedStyle(wipe).getPropertyValue('--cd-mask').trim() || getComputedStyle(host).getPropertyValue('--cd-mask').trim();
  assert(sameCssColor(cdMask, UI_THEME.cdMask, UI_THEME.cdMaskAlpha), 'CD 遮罩：cd_mask @55%');

  const fabCs = getComputedStyle(helpFab);
  const gearCs = getComputedStyle(settingsFab);
  assert(sameCssColor(fabCs.backgroundColor, UI_THEME.buttonIdle), '?：button_idle');
  assert(sameCssColor(fabCs.color, UI_THEME.ink), '?：图标 ink');
  assert(sameCssColor(gearCs.backgroundColor, UI_THEME.buttonIdle), '齿轮：button_idle');
  assert(sameCssColor(gearCs.color, UI_THEME.ink), '齿轮：图标 ink');
  assert(!cssColorHasGold(fabCs.boxShadow) && !cssColorHasGold(gearCs.boxShadow), '?/齿轮：无霓虹 glow');
  helpFab.classList.add('isOn');
  settingsFab.classList.add('isOn');
  assert(sameCssColor(color(helpFab, 'backgroundColor'), UI_THEME.buttonPressed), '? 按下：button_pressed');
  assert(sameCssColor(color(settingsFab, 'backgroundColor'), UI_THEME.buttonPressed), '齿轮按下：button_pressed');
  helpFab.classList.remove('isOn');
  settingsFab.classList.remove('isOn');

  const tip = createSkillTip(host);
  tip.show(skill, { name: '钩矛', effect: '勾中贴脸' });
  const tipRoot = host.querySelector<HTMLElement>('.skillTip.isOn');
  const tipName = tipRoot?.querySelector<HTMLElement>('.skillTipName') ?? null;
  const tipEffect = tipRoot?.querySelector<HTMLElement>('.skillTipEffect') ?? null;
  if (!tipRoot || !tipName || !tipEffect) {
    host.remove();
    throw new Error('HUD 换皮：应有技能 tip');
  }
  const tipCs = getComputedStyle(tipRoot);
  assert(sameCssColor(tipCs.backgroundColor, UI_THEME.parchmentBase), '技能 tip：羊皮纸底');
  assert(sameCssColor(color(tipName, 'color'), UI_THEME.ink), '技能 tip：标题 ink');
  assert(sameCssColor(color(tipEffect, 'color'), UI_THEME.inkMuted), '技能 tip：效果 ink_muted');
  assert(!cssColorHasGold(tipCs.borderTopColor) && !cssColorHasGold(color(tipName, 'color')), '技能 tip：无金闪');
  tip.hide();

  help.open();
  const helpCard = host.querySelector<HTMLElement>('.helpCard');
  const helpTitle = helpCard?.querySelector<HTMLElement>('h2') ?? null;
  const helpClose = host.querySelector<HTMLElement>('.helpCardClose');
  const helpH3 = host.querySelector<HTMLElement>('.helpCardBlock h3');
  const helpLi = host.querySelector<HTMLElement>('.helpCardBlock li');
  if (!helpCard || !helpTitle || !helpClose || !helpH3 || !helpLi) {
    host.remove();
    throw new Error('浮层换皮：应有说明卡标题、关闭钮与正文');
  }
  const helpCs = getComputedStyle(helpCard);
  assert(sameCssColor(helpCs.backgroundColor, UI_THEME.parchmentBase), `说明卡：羊皮纸底（实际 ${helpCs.backgroundColor}）`);
  assert(helpCs.borderTopStyle === 'solid', '说明卡：实线木框');
  assert(borderPx(helpCard) >= 1, `说明卡：木框可见（实际 ${helpCs.borderTopWidth}）`);
  assert(
    Math.abs(borderPx(helpCard) - borderPx(cluster)) < 0.2,
    `说明卡：木框应与 HUD 胶囊同宽（卡 ${helpCs.borderTopWidth} / 胶囊 ${clusterCs.borderTopWidth}）`,
  );
  assert(
    sameCssColor(helpCs.borderTopColor, UI_THEME.woodFrame),
    `说明卡：wood_frame（实际 ${helpCs.borderTopColor}）`,
  );
  assert(sameCssColor(color(helpTitle, 'color'), UI_THEME.ink), '说明卡标题：ink，非金');
  assert(sameCssColor(color(helpH3, 'color'), UI_THEME.ink), '说明卡小节：ink');
  assert(sameCssColor(color(helpLi, 'color'), UI_THEME.ink), '说明卡正文：ink');
  assert(!cssColorHasGold(color(helpTitle, 'color')) && !cssColorHasGold(helpCs.borderTopColor), '说明卡：无金边/金标题');
  const helpCloseCs = getComputedStyle(helpClose);
  assert(sameCssColor(helpCloseCs.backgroundColor, UI_THEME.buttonIdle), '说明卡关闭：button_idle');
  assert(sameCssColor(helpCloseCs.color, UI_THEME.ink), '说明卡关闭：ink');
  assert(sameCssColor(helpCloseCs.borderTopColor, UI_THEME.woodFrame), '说明卡关闭：木框');
  assert(!cssColorHasGold(helpCloseCs.boxShadow) && !cssColorHasGold(helpCloseCs.borderTopColor), '说明卡关闭：无金闪');
  help.close();

  settings.open();
  const panel = host.querySelector<HTMLElement>('.settingsPanel');
  const settingsTitle = host.querySelector<HTMLElement>('.settingsTitle');
  const settingsClose = host.querySelector<HTMLElement>('.settingsClose');
  const tabOn = host.querySelector<HTMLElement>('.settingsTab.isOn');
  const tabOff = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => !el.classList.contains('isOn'));
  const wide = host.querySelector<HTMLElement>('.settingsWide');
  const hint = host.querySelector<HTMLElement>('.settingsHint');
  if (!panel || !settingsTitle || !settingsClose || !tabOn || !tabOff || !wide || !hint) {
    host.remove();
    throw new Error('浮层换皮：应有设置标题、页签、按钮与次要文');
  }
  const panelCs = getComputedStyle(panel);
  assert(sameCssColor(panelCs.backgroundColor, UI_THEME.parchmentBase), `设置：羊皮纸底（实际 ${panelCs.backgroundColor}）`);
  assert(borderPx(panel) >= 1, `设置：木框可见（实际 ${panelCs.borderTopWidth}）`);
  assert(
    Math.abs(borderPx(panel) - borderPx(cluster)) < 0.2,
    `设置：木框应与 HUD 胶囊同宽（面板 ${panelCs.borderTopWidth} / 胶囊 ${clusterCs.borderTopWidth}）`,
  );
  assert(sameCssColor(panelCs.borderTopColor, UI_THEME.woodFrame), `设置：wood_frame（实际 ${panelCs.borderTopColor}）`);
  assert(sameCssColor(color(settingsTitle, 'color'), UI_THEME.ink), '设置标题：ink，非金');
  assert(!cssColorHasGold(color(settingsTitle, 'color')) && !cssColorHasGold(panelCs.borderTopColor), '设置：无金边/金标题');
  const closeCs = getComputedStyle(settingsClose);
  assert(sameCssColor(closeCs.backgroundColor, UI_THEME.buttonIdle), '设置关闭：button_idle');
  assert(sameCssColor(closeCs.color, UI_THEME.ink), '设置关闭：ink');
  assert(!cssColorHasGold(closeCs.boxShadow) && !cssColorHasGold(closeCs.borderTopColor), '设置关闭：无金闪');
  assert(sameCssColor(color(tabOn, 'color'), UI_THEME.ink), '设置页签选中：ink');
  assert(sameCssColor(color(tabOff, 'color'), UI_THEME.inkMuted), '设置页签未选：ink_muted');
  assert(sameCssColor(getComputedStyle(tabOn).borderTopColor, UI_THEME.woodFrame), '设置页签选中：木框');
  assert(sameCssColor(color(wide, 'backgroundColor'), UI_THEME.buttonIdle), '设置按钮：button_idle');
  assert(sameCssColor(getComputedStyle(wide).borderTopColor, UI_THEME.woodFrame), '设置按钮：木框');
  assert(sameCssColor(color(wide, 'color'), UI_THEME.ink), '设置按钮：ink');
  assert(!cssColorHasGold(getComputedStyle(wide).borderTopColor) && !cssColorHasGold(color(wide, 'color')), '设置按钮：无金闪');
  const heroRow = host.querySelector<HTMLElement>('.settingsHeroRow');
  const heroPick = host.querySelector<HTMLElement>('select.settingsHeroPick');
  if (!heroRow || !heroPick) {
    host.remove();
    throw new Error('设置换皮：常规页应有我的英雄选择');
  }
  const heroRowCs = getComputedStyle(heroRow);
  assert(sameCssColor(heroRowCs.backgroundColor, UI_THEME.parchmentBase), '我的英雄：羊皮纸底');
  assert(sameCssColor(heroRowCs.borderTopColor, UI_THEME.woodFrame), '我的英雄：木框');
  assert(sameCssColor(color(heroPick, 'backgroundColor'), UI_THEME.buttonIdle), '我的英雄选择：button_idle');
  assert(sameCssColor(getComputedStyle(heroPick).borderTopColor, UI_THEME.woodFrame), '我的英雄选择：木框');
  assert(sameCssColor(color(heroPick, 'color'), UI_THEME.ink), '我的英雄选择：ink');
  assert(!cssColorHasGold(heroRowCs.borderTopColor) && !cssColorHasGold(color(heroPick, 'color')), '我的英雄：无金闪');
  assert(sameCssColor(color(hint, 'color'), UI_THEME.inkMuted), '设置次要文：ink_muted');

  const versionTab = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'version');
  const gmTab = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'gm');
  versionTab?.click();
  const verCard = host.querySelector<HTMLElement>('.settingsVerCard');
  const notesTitle = host.querySelector<HTMLElement>('.settingsNotesTitle');
  const flashProbe = document.createElement('p');
  flashProbe.className = 'settingsFlash';
  host.appendChild(flashProbe);
  if (!verCard) {
    host.remove();
    throw new Error('浮层换皮：版本页应有版本卡');
  }
  assert(sameCssColor(getComputedStyle(verCard).backgroundColor, UI_THEME.parchmentBase), '版本卡：羊皮纸底');
  assert(sameCssColor(getComputedStyle(verCard).borderTopColor, UI_THEME.woodFrame), '版本卡：木框');
  if (notesTitle) {
    assert(sameCssColor(color(notesTitle, 'color'), UI_THEME.inkMuted), '版本次要标题：ink_muted');
  }
  assert(sameCssColor(color(flashProbe, 'color'), UI_THEME.ink), '版本提示：ink，非金');
  assert(!cssColorHasGold(color(flashProbe, 'color')), '版本提示：无金');
  flashProbe.remove();

  gmTab?.click();
  const gmTitle = host.querySelector<HTMLElement>('.settingsGmTitle');
  const gmBtn = host.querySelector<HTMLElement>('.settingsGmBtn');
  const gmSwitch = host.querySelector<HTMLElement>('.settingsSwitch');
  if (!gmTitle || !gmBtn || !gmSwitch) {
    host.remove();
    throw new Error('浮层换皮：GM 页应有分组标题、按钮与开关');
  }
  assert(sameCssColor(color(gmTitle, 'color'), UI_THEME.inkMuted), 'GM 分组：ink_muted');
  assert(sameCssColor(color(gmBtn, 'backgroundColor'), UI_THEME.buttonIdle), 'GM 按钮：button_idle');
  assert(sameCssColor(getComputedStyle(gmBtn).borderTopColor, UI_THEME.woodFrame), 'GM 按钮：木框');
  assert(sameCssColor(color(gmBtn, 'color'), UI_THEME.ink), 'GM 按钮：ink');
  assert(!cssColorHasGold(color(gmBtn, 'color')) && !cssColorHasGold(getComputedStyle(gmBtn).borderTopColor), 'GM 按钮：无金闪');
  assert(sameCssColor(color(gmSwitch, 'color'), UI_THEME.ink), 'GM 开关文：ink');
  settings.close();

  resultUi.sync(dummyResultSnap({ winner: 'red' }));
  const resultPanel = host.querySelector<HTMLElement>('.resultPanel');
  const resultTitle = host.querySelector<HTMLElement>('.resultPanelTitle');
  const resultClose = host.querySelector<HTMLElement>('.resultPanelClose');
  const resultAgain = host.querySelector<HTMLElement>('.resultPanelAgain');
  const resultReason = host.querySelector<HTMLElement>('.resultPanelReason');
  const resultRed = host.querySelector<HTMLElement>('.resultPanelRed');
  const resultBlue = host.querySelector<HTMLElement>('.resultPanelBlue');
  const resultShard = host.querySelector<HTMLElement>('.resultPanelShard');
  if (!resultPanel || !resultTitle || !resultClose || !resultAgain || !resultReason || !resultRed || !resultBlue || !resultShard) {
    host.remove();
    throw new Error('结算板换皮：应有标题、关闭、再来一局、比分与金矛碎片');
  }
  const resultCs = getComputedStyle(resultPanel);
  assert(sameCssColor(resultCs.backgroundColor, UI_THEME.parchmentBase), `结算板：羊皮纸底（实际 ${resultCs.backgroundColor}）`);
  assert(resultCs.borderTopStyle === 'solid', '结算板：实线木框');
  assert(borderPx(resultPanel) >= 1, `结算板：木框可见（实际 ${resultCs.borderTopWidth}）`);
  assert(
    Math.abs(borderPx(resultPanel) - borderPx(cluster)) < 0.2,
    `结算板：木框应与 HUD 胶囊同宽（板 ${resultCs.borderTopWidth} / 胶囊 ${clusterCs.borderTopWidth}）`,
  );
  assert(sameCssColor(resultCs.borderTopColor, UI_THEME.woodFrame), `结算板：wood_frame（实际 ${resultCs.borderTopColor}）`);
  assert(sameCssColor(color(resultTitle, 'color'), UI_THEME.goldSpear), '胜利标题：gold_spear 热闹金');
  assert(cssColorHasGold(color(resultTitle, 'color')), '结算板：允许热闹金矛');
  assert(sameCssColor(color(resultReason, 'color'), UI_THEME.inkMuted), '结算板副文：ink_muted');
  assert(sameCssColor(color(resultRed, 'color'), UI_THEME.teamRed), '结算板红分：team_red');
  assert(sameCssColor(color(resultBlue, 'color'), UI_THEME.teamBlue), '结算板蓝分：team_blue');
  const shardCs = getComputedStyle(resultShard);
  assert(
    sameCssColor(shardCs.backgroundColor, UI_THEME.goldSpear) ||
      sameCssColor(shardCs.backgroundColor, UI_THEME.goldSpearHighlight),
    `结算板碎片：gold_spear（实际 ${shardCs.backgroundColor}）`,
  );
  const resultCloseCs = getComputedStyle(resultClose);
  assert(sameCssColor(resultCloseCs.backgroundColor, UI_THEME.buttonIdle), '结算板关闭：button_idle');
  assert(sameCssColor(resultCloseCs.color, UI_THEME.ink), '结算板关闭：ink');
  assert(sameCssColor(resultCloseCs.borderTopColor, UI_THEME.woodFrame), '结算板关闭：木框');
  assert(sameCssColor(color(resultAgain, 'backgroundColor'), UI_THEME.buttonIdle), '结算板再来一局：button_idle');
  assert(sameCssColor(getComputedStyle(resultAgain).borderTopColor, UI_THEME.woodFrame), '结算板再来一局：木框');
  assert(sameCssColor(color(resultAgain, 'color'), UI_THEME.ink), '结算板再来一局：ink');

  resultUi.sync(dummyResultSnap({ winner: 'blue', redScore: 42, blueScore: 100 }));
  assert(sameCssColor(color(resultTitle, 'color'), UI_THEME.teamRed), '失败标题：team_red');
  assert(sameCssColor(color(resultPanel, 'backgroundColor'), UI_THEME.parchmentBase), '失败结算板：仍羊皮纸');

  const statsBoard = host.querySelector<HTMLElement>('.combatStatsPanel');
  const statsDock = host.querySelector<HTMLButtonElement>('.combatStatsDock');
  const statsTabOn = host.querySelector<HTMLElement>('.combatStatsTab.isOn');
  if (!statsBoard || !statsDock || !statsTabOn) {
    host.remove();
    throw new Error('统计换皮：应有面板、页签与侧边钮');
  }
  statsUi.expand();
  const statsCs = getComputedStyle(statsBoard);
  assert(sameCssColor(statsCs.backgroundColor, UI_THEME.parchmentBase), `统计面板：羊皮纸底（实际 ${statsCs.backgroundColor}）`);
  assert(statsCs.borderTopStyle === 'solid', '统计面板：实线木框');
  assert(borderPx(statsBoard) >= 1, `统计面板：木框可见（实际 ${statsCs.borderTopWidth}）`);
  assert(
    sameCssColor(statsCs.borderTopColor, UI_THEME.woodFrame),
    `统计面板：wood_frame（实际 ${statsCs.borderTopColor}）`,
  );
  assert(cssColorHasGold(statsCs.boxShadow), '统计面板：木框外允许金边');
  assert(sameCssColor(color(statsTabOn, 'color'), UI_THEME.ink), '统计页签选中：ink');
  const dockCs = getComputedStyle(statsDock);
  assert(sameCssColor(dockCs.backgroundColor, UI_THEME.buttonIdle) || statsDock.hidden, '统计侧边钮：button_idle');
  host.remove();
}
