import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { createMatchHud } from '../ui/matchHud';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createSkillTip } from '../ui/skillTip';
import {
  UI_THEME,
  applyUiTheme,
  cssColorHasGold,
  sameCssColor,
} from '../ui/uiTheme';

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

/** 局内 HUD chrome 色板：羊皮纸+木框，金只在计时，技能无金闪。 */
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
  createHelpCard(host);
  createSettingsPanel(host, {
    onRestart: () => {},
    onCollision: () => {},
    onScore: () => {},
    onAdvance: () => {},
    onJumpClock: () => {},
    onForceRespawn: () => {},
    versions: dummyVersions(),
  });
  document.body.appendChild(host);

  const cluster = host.querySelector<HTMLElement>('.matchHudCluster');
  const clock = host.querySelector<HTMLElement>('.matchHudClock');
  const red = host.querySelector<HTMLElement>('.matchHudRed');
  const blue = host.querySelector<HTMLElement>('.matchHudBlue');
  const wrap = host.querySelector<HTMLElement>('.matchHudHeroWrap');
  const stripe = host.querySelector<HTMLElement>('.matchHudHeroStripe');
  const pick = host.querySelector<HTMLElement>('.matchHudHero');
  const skill = host.querySelector<HTMLButtonElement>('.touchSkillBtn');
  const helpFab = host.querySelector<HTMLButtonElement>('.helpFab');
  const settingsFab = host.querySelector<HTMLButtonElement>('.settingsFab');
  if (!cluster || !clock || !red || !blue || !wrap || !stripe || !pick || !skill || !helpFab || !settingsFab) {
    host.remove();
    throw new Error('HUD 换皮：应有胶囊、下拉、技能键与 ?/齿轮');
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
  assert(sameCssColor(wrapCs.backgroundColor, UI_THEME.parchmentBase), '换英雄：羊皮纸底');
  assert(sameCssColor(wrapCs.borderTopColor, UI_THEME.panelBorder), '换英雄：panel_border');
  assert(sameCssColor(color(stripe, 'backgroundColor'), UI_THEME.teamRed), '换英雄：左侧队色条');
  assert(sameCssColor(color(pick, 'color'), UI_THEME.ink), '换英雄：文字 ink');
  assert(!cssColorHasGold(wrapCs.boxShadow) && !cssColorHasGold(wrapCs.borderTopColor), '换英雄：无金饰');

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
  host.remove();
}
