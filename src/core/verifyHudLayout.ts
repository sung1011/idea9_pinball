import { IPHONE_LANDSCAPE_LOGICAL_HEIGHT, IPHONE_LANDSCAPE_LOGICAL_WIDTH, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createActionBus, isAimUiTarget } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { createTouchPad } from '../input/touchPad';
import { fitWorldToBox, screenToLogical } from '../render/worldTransform';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { landscapeLockType, lockLandscape } from '../ui/lockLandscape';
import { createMatchHud } from '../ui/matchHud';
import { createBallBody } from './ballBody';
import { createCombatStats } from './combatStats';
import { createCombatStatsPanel } from '../ui/combatStatsPanel';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createTechPanel } from '../ui/techPanel';
import { createTechStore, memoryTechStorage } from './techSave';
import {
  applyStageVars,
  clientToHostLocal,
  computeLandscapeStage,
  isPortraitViewport,
  type SafeInsets,
  type StageRect,
} from '../ui/stageLayout';
import type { MatchModeId } from './matchMode';
import type { MatchSnapshot } from './matchSession';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function dummySnap(partial: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: 'playing',
    timeLeft: 187,
    suddenDeath: false,
    redScore: 15,
    blueScore: 30,
    redBreakScore: 15,
    blueBreakScore: 30,
    redHoldScore: 0,
    blueHoldScore: 0,
    elapsedSec: 53,
    finishReason: '',
    midpoint: 'none',
    winner: null,
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
    matchId: '',
    practice: false,
    ...partial,
  };
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

function noRotate(el: HTMLElement): boolean {
  const transform = getComputedStyle(el).transform;
  return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
}

function overlaps(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
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

function coversSafeArea(stage: StageRect, viewW: number, viewH: number, insets: SafeInsets): boolean {
  const left = insets.left;
  const right = viewW - insets.right;
  const top = insets.top;
  const bottom = viewH - insets.bottom;
  return (
    stage.x <= left + 1e-6 &&
    stage.x + stage.width >= right - 1e-6 &&
    stage.y <= top + 1e-6 &&
    stage.y + stage.height >= bottom - 1e-6
  );
}

function assertWorldCover(stage: StageRect, viewW: number, viewH: number, insets: SafeInsets, label: string): void {
  assert(Math.abs(stage.width / stage.height - MAP_WIDTH / MAP_HEIGHT) < 1e-6, `${label}：舞台应保持世界比例、不拉伸`);
  assert(coversSafeArea(stage, viewW, viewH, insets), `${label}：cover 应铺满可用安全区`);
}

function assertExactFit(stage: StageRect, viewW: number, viewH: number, insets: SafeInsets, label: string): void {
  assertWorldCover(stage, viewW, viewH, insets, label);
  const availW = viewW - insets.left - insets.right;
  const availH = viewH - insets.top - insets.bottom;
  assert(Math.abs(stage.x - insets.left) < 1e-6 && Math.abs(stage.y - insets.top) < 1e-6, `${label}：目标机应恰好看全图、无黑边`);
  assert(Math.abs(stage.width - availW) < 1e-6 && Math.abs(stage.height - availH) < 1e-6, `${label}：目标机舞台应贴齐可用区`);
}

function assertCropSides(stage: StageRect, viewW: number, viewH: number, insets: SafeInsets, label: string): void {
  assertWorldCover(stage, viewW, viewH, insets, label);
  assert(Math.abs(stage.y - insets.top) < 1e-6, `${label}：更方的屏 cover 高度应贴齐可用高`);
  assert(stage.x < insets.left - 1, `${label}：更方的屏 cover 应左右略裁、无黑边`);
}

function assertCropTopBottom(stage: StageRect, viewW: number, viewH: number, insets: SafeInsets, label: string): void {
  assertWorldCover(stage, viewW, viewH, insets, label);
  assert(Math.abs(stage.x - insets.left) < 1e-6, `${label}：更宽的屏 cover 宽度应贴齐可用宽`);
  assert(stage.y < insets.top - 1, `${label}：更宽的屏 cover 应裁掉上下、无黑边`);
}

function assertCornerHud(
  host: HTMLElement,
  skills: HTMLElement,
  cluster: HTMLElement,
  helpFab: HTMLElement | null,
  settingsFab: HTMLElement | null,
  label: string,
  techFab: HTMLElement | null = null,
): void {
  const hostW = host.clientWidth;
  const hostH = host.clientHeight;
  const skillBox = localBox(skills, host);
  const clusterBox = localBox(cluster, host);
  const midX = hostW / 2;
  const midY = hostH / 2;
  assert(hostW - skillBox.right < 24, `${label}：技能应贴视窗右侧`);
  assert(hostH - skillBox.bottom < 24, `${label}：技能应贴视窗底`);
  assert(skillBox.left > hostW * 0.28, `${label}：技能应偏右下，不挡中场领地`);
  assert(skillBox.top > midY, `${label}：技能应留在下半屏`);
  assert(clusterBox.top < 24, `${label}：比分胶囊应贴窗顶`);
  assert(Math.abs((clusterBox.left + clusterBox.right) / 2 - midX) < 24, `${label}：比分胶囊应顶中`);
  if (helpFab && settingsFab) {
    const helpBox = localBox(helpFab, host);
    const gearBox = localBox(settingsFab, host);
    assert(helpBox.left + 1 >= clusterBox.right, `${label}：? 不应叠顶中比分`);
    assert(gearBox.left + 1 >= helpBox.right, `${label}：齿轮不应叠 ?`);
    assert(Math.abs(helpBox.top - gearBox.top) < 2, `${label}：? 应与齿轮顶对齐`);
    assert(hostW - gearBox.right < 24, `${label}：齿轮应贴视窗右上`);
    if (techFab) {
      const techBox = localBox(techFab, host);
      assert(techBox.right <= helpBox.left + 1, `${label}：科应在 ? 左侧`);
      assert(Math.abs(techBox.top - gearBox.top) < 2, `${label}：科应与齿轮顶对齐`);
      assert(techBox.left + 1 >= clusterBox.right, `${label}：科不应叠顶中比分`);
    }
  }
}

function hasRotatePromptCopy(text: string): boolean {
  return /请横过来|请旋转设备|请旋转/.test(text);
}

/** 永远横屏 cover：系统锁当前横屏侧；不对 #app 转 90°；HUD 叠四角。无转屏提示。 */
export function verifyHudLayout(): void {
  const none: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const targetW = IPHONE_LANDSCAPE_LOGICAL_WIDTH;
  const targetH = IPHONE_LANDSCAPE_LOGICAL_HEIGHT;
  const target = computeLandscapeStage(targetW, targetH, none);
  assertExactFit(target, targetW, targetH, none, 'HUD：iPhone 18 Pro Max 横屏');

  const landscape = computeLandscapeStage(1600, 900, none);
  assertCropSides(landscape, 1600, 900, none, 'HUD：横窗 16:9');

  const sixteenNine = computeLandscapeStage(1280, 720, none);
  assertCropSides(sixteenNine, 1280, 720, none, 'HUD：1280×720');

  const phoneLand = computeLandscapeStage(667, 375, none);
  assertCropSides(phoneLand, 667, 375, none, 'HUD：横持');

  const pcWide = computeLandscapeStage(1920, 1080, none);
  assertCropSides(pcWide, 1920, 1080, none, 'HUD：PC 宽窗');

  const square = computeLandscapeStage(800, 800, none);
  assertCropSides(square, 800, 800, none, 'HUD：正方窗');

  const ultra = computeLandscapeStage(2560, 1080, none);
  assertCropTopBottom(ultra, 2560, 1080, none, 'HUD：超宽屏');

  const notchInsets: SafeInsets = { top: 0, right: 44, bottom: 0, left: 44 };
  const notch = computeLandscapeStage(1600, 900, notchInsets);
  assertCropSides(notch, 1600, 900, notchInsets, 'HUD：刘海横窗');
  assert(notch.y >= -1e-6, 'HUD：刘海横窗高度应贴齐可用高，不在上下加黑边');

  const xf = fitWorldToBox(landscape.x, landscape.y, landscape.width, landscape.height, MAP_WIDTH, MAP_HEIGHT);
  const mid = screenToLogical(800, 450, xf);
  assert(
    Math.abs(mid.x - MAP_WIDTH / 2) < 0.05 && Math.abs(mid.y - MAP_HEIGHT / 2) < 0.05,
    'HUD：视口中点应对准世界中心',
  );
  const off = screenToLogical(-1, -1, xf);
  assert(off.x < 0 || off.y < 0, 'HUD：cover 裁掉的舞台边缘在视口外');
  const targetXf = fitWorldToBox(target.x, target.y, target.width, target.height, MAP_WIDTH, MAP_HEIGHT);
  const targetOrigin = screenToLogical(0, 0, targetXf);
  const targetFar = screenToLogical(targetW, targetH, targetXf);
  assert(Math.abs(targetOrigin.x) < 0.05 && Math.abs(targetOrigin.y) < 0.05, 'HUD：目标机左上应对准世界原点');
  assert(
    Math.abs(targetFar.x - MAP_WIDTH) < 0.05 && Math.abs(targetFar.y - MAP_HEIGHT) < 0.05,
    'HUD：目标机右下应对准世界右下，不裁掉战场',
  );

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');
  assert(landscapeLockType('landscape-secondary') === 'landscape-secondary', 'HUD：已在 secondary 应锁这一侧');
  assert(landscapeLockType('landscape-primary') === 'landscape-primary', 'HUD：已在 primary 应锁这一侧');
  assert(landscapeLockType('portrait-primary') === 'landscape-primary', 'HUD：竖持应锁 landscape-primary');
  assert(landscapeLockType(undefined) === 'landscape-primary', 'HUD：未知朝向应锁 landscape-primary');

  lockLandscape();

  const landProbe = document.createElement('div');
  landProbe.style.cssText = 'position:fixed;left:0;top:0;width:667px;height:375px';
  document.body.appendChild(landProbe);
  applyStageVars(landProbe, computeLandscapeStage(667, 375, none));
  assert(!landProbe.classList.contains('isForceLandscape'), 'HUD：横窗不应标 isForceLandscape');
  assert(!landProbe.style.transform, 'HUD：横窗宿主不应写画面变换');
  assert(noRotate(landProbe), 'HUD：横窗不对 #app 转 90°');
  landProbe.remove();

  const tallProbe = document.createElement('div');
  tallProbe.style.cssText = 'position:fixed;left:0;top:0;width:375px;height:667px';
  document.body.appendChild(tallProbe);
  applyStageVars(tallProbe, computeLandscapeStage(375, 667, none));
  assert(!tallProbe.classList.contains('isForceLandscape'), 'HUD：竖窗不应标 isForceLandscape');
  assert(!tallProbe.style.transform.includes('rotate'), 'HUD：竖窗宿主不应写 rotate');
  assert(noRotate(tallProbe), 'HUD：竖窗也不对 #app 转 90°，不另做可玩竖屏布局');
  assert(tallProbe.classList.contains('isPortrait') && !tallProbe.classList.contains('isLandscape'), 'HUD：竖窗只标 isPortrait');
  tallProbe.remove();

  const aimHost = document.createElement('div');
  aimHost.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:120px';
  const aimCanvas = document.createElement('canvas');
  aimCanvas.style.cssText = 'width:100%;height:100%;display:block';
  aimHost.appendChild(aimCanvas);
  document.body.appendChild(aimHost);
  const aimBus = createActionBus();
  const unbindAim = bindPcInput({
    canvas: aimCanvas,
    getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
    bus: aimBus,
    getAimingSlot: () => 0,
  });
  aimCanvas.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 160,
      clientY: 80,
    }),
  );
  const aimSample = aimBus.sample(0, 0);
  unbindAim();
  aimHost.remove();
  assert(
    Math.abs((aimSample.pointerX ?? 0) - 160) < 2 && Math.abs((aimSample.pointerY ?? 0) - 80) < 2,
    'HUD：瞄准应按 AABB 取本地坐标，不点左打右',
  );

  const plain = document.createElement('div');
  plain.style.cssText = 'position:fixed;left:40px;top:30px;width:100px;height:80px';
  document.body.appendChild(plain);
  const local = clientToHostLocal(plain, 60, 50);
  plain.remove();
  assert(Math.abs(local.x - 20) < 2 && Math.abs(local.y - 20) < 2, 'HUD：应按视口差值取本地坐标');

  const hudChrome =
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';

  const host = document.createElement('div');
  const hud = createMatchHud(host);
  const pad = createTouchPad(host, createActionBus(), { forceStick: true });
  const statsUi = createCombatStatsPanel(host, createCombatStats());
  statsUi.sync([], 0);
  const cluster = host.querySelector<HTMLElement>('.matchHudCluster');
  const red = host.querySelector<HTMLElement>('.matchHudRed .matchHudScoreVal');
  const blue = host.querySelector<HTMLElement>('.matchHudBlue .matchHudScoreVal');
  const clock = host.querySelector<HTMLElement>('.matchHudClock');
  const skills = host.querySelector<HTMLElement>('.touchSkills');
  const skillBtns = [...host.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn')];
  const cancelBtn = host.querySelector<HTMLButtonElement>('button.touchCancel');
  if (!cluster || !red || !blue || !clock || !skills || !cancelBtn) {
    throw new Error('HUD：应有顶中比分计时胶囊、技能键与取消键');
  }
  assert(!host.querySelector('.matchHudLeft'), 'HUD：左上不应再有玩法入口层');
  assert(!host.querySelector('select.matchHudMode'), 'HUD：左上不应再有玩法下拉');
  assert(!host.querySelector('.matchHudHeroRow'), 'HUD：左上不应再有我/队友下拉');
  assert(!host.querySelector('select.matchHudAllyHero'), 'HUD：不应再有队友选择');
  assert(!host.querySelector('select.matchHudHero'), 'HUD：局内不应再有自己英雄下拉');
  assert(!host.querySelector('.matchHudPill'), 'HUD：不应再有角落独立比分胶囊');
  assert(cluster.contains(red) && cluster.contains(clock) && cluster.contains(blue), 'HUD：红分/计时/蓝分应同在一颗胶囊');
  const sides = [...cluster.querySelectorAll('.matchHudSide')];
  assert(sides[0]?.classList.contains('matchHudRed') && sides[1]?.classList.contains('matchHudBlue'), 'HUD：胶囊顺序应为红 | 计时 | 蓝');
  assert(cluster.querySelectorAll('.matchHudMark').length === 2, 'HUD：红蓝两侧应有小队标');
  const ultBtn = host.querySelector<HTMLButtonElement>('button.touchUltBtn');
  assert(skillBtns.length === 4, 'HUD：应为横排四技能键');
  assert(skillBtns.map((btn) => btn.dataset.slot).join('') === '1234', 'HUD：技能键从左到右应为 Skill1–4');
  assert(!!ultBtn && ultBtn.dataset.slot === '5', 'HUD：右侧技能行应另有第五键必杀');
  assert(cancelBtn.textContent === '取消', 'HUD：取消键文案应为取消');
  assert(cancelBtn.hidden, 'HUD：未瞄准时取消键应隐藏');

  host.style.cssText = `position:relative;width:1600px;height:900px;${hudChrome}`;
  document.body.appendChild(host);
  const landStage = computeLandscapeStage(1600, 900, none);
  applyStageVars(host, landStage);
  const help = createHelpCard(host);
  let restarts = 0;
  let reloads = 0;
  let modePicks = 0;
  const modeState = { mode: 'eightKill' as MatchModeId };
  const settings = createSettingsPanel(host, {
    onOpen: () => help.close(),
    onOpenHelp: () => help.open(),
    onRestart: () => {
      restarts += 1;
    },
    onReload: () => {
      reloads += 1;
    },
    onCollision: () => {},
    onScore: () => {},
    onAdvance: () => {},
    onJumpClock: () => {},
    onForceRespawn: () => {},
    getMode: () => modeState.mode,
    onPickMode: (mode) => {
      modePicks += 1;
      if (modeState.mode === mode) {
        return;
      }
      modeState.mode = mode;
    },
    versions: dummyVersions(),
  });
  const helpFab = host.querySelector<HTMLButtonElement>('.helpFab');
  const settingsFab = host.querySelector<HTMLButtonElement>('.settingsFab');
  createTechPanel(host, { store: createTechStore(memoryTechStorage()) });
  const techFab = host.querySelector<HTMLButtonElement>('.techFab');
  if (!helpFab || !settingsFab) {
    throw new Error('HUD：顶右应有 ? 与齿轮');
  }
  if (!techFab) {
    throw new Error('HUD：顶右应有科技入口');
  }
  assert(helpFab.textContent === '?', 'HUD：说明钮应为 ?');
  const hostTransform = getComputedStyle(host).transform;
  const skillsDisplay = getComputedStyle(skills).display;
  const skillsDir = getComputedStyle(skills).flexDirection;
  helpFab.click();
  const helpOpenedByFab = help.isOpen();
  const helpCopy = host.querySelector('.helpCardBody')?.textContent ?? '';
  help.close();
  settings.open();
  const modePick = host.querySelector<HTMLSelectElement>('select.settingsModePick');
  const modeLabel = host.querySelector('.settingsModeLabel')?.textContent;
  const heroPick = host.querySelector<HTMLSelectElement>('select.settingsHeroPick');
  const heroLabel = host.querySelector('.settingsHeroLabel')?.textContent;
  if (!modePick) {
    throw new Error('HUD：设置常规页应有玩法选择');
  }
  if (!heroPick) {
    throw new Error('HUD：设置常规页应有我的英雄选择');
  }
  assert(modeLabel === '玩法', 'HUD：常规页选择标签应为玩法');
  assert(
    [...modePick.options].map((opt) => opt.textContent).join('/') === '八杀/占点',
    'HUD：玩法选项应为八杀/占点',
  );
  assert(modePick.value === 'eightKill', 'HUD：玩法缺省应为八杀');
  assert(modePick.getAttribute('data-touch-control') === 'mode', 'HUD：玩法下拉应标 data-touch-control');
  assert(isAimUiTarget(modePick), 'HUD：点设置玩法选择不应抢 Aim');
  modePick.value = 'controlPoint';
  modePick.dispatchEvent(new Event('change', { bubbles: true }));
  assert(modeState.mode === 'controlPoint' && modePicks === 1, 'HUD：选占点应立刻切玩法');
  modePick.value = 'eightKill';
  modePick.dispatchEvent(new Event('change', { bubbles: true }));
  assert(modeState.mode === 'eightKill' && modePicks === 2, 'HUD：选八杀应立刻切回');
  const beforeGm = modePicks;
  const gmTab = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'gm');
  gmTab?.click();
  const gmToggle = host.querySelector<HTMLInputElement>('input[aria-label="GM 调试"]');
  if (!gmToggle) {
    throw new Error('HUD：GM 页应有调试开关');
  }
  gmToggle.checked = !gmToggle.checked;
  gmToggle.dispatchEvent(new Event('change', { bubbles: true }));
  const generalTab = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'general');
  generalTab?.click();
  const modeAfterGm = host.querySelector<HTMLSelectElement>('select.settingsModePick');
  assert(modeAfterGm?.value === 'eightKill' && modePicks === beforeGm, 'HUD：开关 GM 不应重置玩法');
  assert(heroPick.options.length === 7, 'HUD：设置常规页应有我的英雄七人选择');
  assert(heroLabel === '我的英雄', 'HUD：常规页选择标签应为我的英雄');
  assert(isAimUiTarget(heroPick), 'HUD：点设置英雄选择不应抢 Aim');
  const settingsHint = [...host.querySelectorAll('.settingsHint')].map((el) => el.textContent ?? '').join('\n');
  const reloadBtn = [...host.querySelectorAll('button')].find((btn) => btn.textContent === '刷新游戏');
  assert(!!reloadBtn, 'HUD：设置常规应有刷新游戏');
  reloadBtn?.click();
  assert(reloads === 1 && restarts === 0, 'HUD：刷新游戏应硬刷新当前页，不重开本局、不清存档');
  const liveMode = host.querySelector<HTMLSelectElement>('select.settingsModePick');
  assert(liveMode?.value === 'eightKill' && modePicks === beforeGm, 'HUD：刷新游戏按钮不应改玩法');
  const howTo = [...host.querySelectorAll('button')].find((btn) => btn.textContent === '怎么玩');
  howTo?.click();
  const helpOpenedBySettings = help.isOpen();
  const settingsClosedAfterHowTo = !settings.isOpen();
  help.close();
  assert(host.classList.contains('isLandscape') && !host.classList.contains('isPortrait'), 'HUD：横窗宿主应标 isLandscape');
  assert(landStage.x < -1 && Math.abs(landStage.y) < 1e-6, 'HUD：横窗 16:9 舞台应左右略裁、无上下黑边');
  assert(!host.querySelector('.rotatePrompt'), 'HUD：不应有转屏遮罩');
  assert(!hasRotatePromptCopy(helpCopy), 'HUD：说明卡不应写竖屏/转屏提示');
  assert(!hasRotatePromptCopy(settingsHint), 'HUD：设置页不应写竖屏/转屏提示');
  assert(!helpCopy.includes('左上可换自己或队友'), 'HUD：说明卡不应再写左上换自己/队友');
  assert(!helpCopy.includes('左上最上方可切'), 'HUD：说明卡不应再写左上切玩法');
  assert(helpCopy.includes('设置常规页「玩法」可切「八杀 / 占点」'), 'HUD：说明卡应写从常规页切玩法');
  assert(helpCopy.includes('设置常规页可换自己的英雄'), 'HUD：说明卡应写从常规页换自己');
  assert(helpCopy.includes('瞄准摇杆'), 'HUD：说明卡应提到触屏左下瞄准摇杆');
  assert(helpCopy.includes('顶右「科」'), 'HUD：说明卡应写科技入口');
  assert(!settingsHint.includes('左上可换自己或队友'), 'HUD：常规页提示不应再写左上换队友');
  assert(settingsHint.includes('常规页「玩法」可切八杀 / 占点'), 'HUD：常规页提示应写玩法入口');
  assert(skillsDisplay === 'flex' && skillsDir === 'row', 'HUD：四键应一行横排');
  assertCornerHud(host, skills, cluster, helpFab, settingsFab, 'HUD：横窗', techFab);
  const skillSize = skillBtns[0].getBoundingClientRect();
  assert(skillSize.width >= 56 && skillSize.width <= 64, `HUD：技能键应约 60px（实际 ${skillSize.width}）`);
  assert(Math.abs(skillSize.width - skillSize.height) < 1, 'HUD：技能键应保持圆形');
  const stick = host.querySelector<HTMLElement>('.touchStick');
  if (!stick) {
    throw new Error('HUD：左下应有瞄准摇杆');
  }
  const stickBox = localBox(stick, host);
  const skillsForStick = localBox(skills, host);
  assert(stickBox.right - stickBox.left >= 96 && stickBox.right - stickBox.left <= 112, 'HUD：瞄准摇杆外径应约 96–112');
  assert(stickBox.left < 24, 'HUD：瞄准摇杆应贴视窗左下');
  assert(host.clientHeight - stickBox.bottom < 24, 'HUD：瞄准摇杆应贴视窗底');
  assert(stickBox.right < host.clientWidth * 0.45, 'HUD：瞄准摇杆不应伸进中场');
  assert(!overlaps(stickBox, skillsForStick), 'HUD：瞄准摇杆不应叠右下技能');
  assert(stick.getAttribute('data-touch-control') === 'stick', 'HUD：摇杆点击应标 touch-control');
  pad.sync({
    aimingSlot: 2,
    skillCds: [0, 0, 0, 0],
    fineTuneOn: false,
  });
  assert(!cancelBtn.hidden, 'HUD：瞄准中应显示取消键');
  const cancelBox = localBox(cancelBtn, host);
  const skill2Box = localBox(skillBtns[1], host);
  const skill4Box = localBox(skillBtns[3], host);
  const cancelMid = (cancelBox.left + cancelBox.right) / 2;
  const skill2Mid = (skill2Box.left + skill2Box.right) / 2;
  assert(Math.abs(cancelMid - skill2Mid) < 8, 'HUD：取消键应水平居中在当前瞄准技能上');
  assert(cancelBox.bottom <= skill2Box.top - 4, 'HUD：取消键应在瞄准技能正上方');
  assert(skill2Box.top - cancelBox.bottom <= 12, 'HUD：取消键与技能键间距约 6–8px');
  assert(cancelBox.right < skill4Box.right - 4, 'HUD：取消键不应出现在技能行右侧');
  const statsBoard = host.querySelector<HTMLElement>('.combatStatsPanel');
  const statsDock = host.querySelector<HTMLButtonElement>('.combatStatsDock');
  if (!statsBoard || !statsDock) {
    throw new Error('HUD：右下应有统计面板');
  }
  assert(statsBoard.hidden && !statsDock.hidden, 'HUD：统计面板默认收起');
  assert(statsUi.getTab() === 'damage', 'HUD：统计面板默认伤害页签');
  const skillBox = localBox(skills, host);
  const dockBox = localBox(statsDock, host);
  assert(dockBox.bottom <= skillBox.top - 2, 'HUD：统计侧边钮应在技能键上方');
  assert(!overlaps(dockBox, skillBox), 'HUD：统计侧边钮不应叠技能');
  assert(noRotate(statsDock), 'HUD：统计侧边钮无旋转');
  statsUi.expand();
  const statsBox = localBox(statsBoard, host);
  assert(statsBox.bottom <= skillBox.top - 4, 'HUD：统计面板应在技能键上方');
  assert(statsBox.bottom <= cancelBox.top - 2, 'HUD：统计面板不应挡住取消键');
  assert(noRotate(statsBoard), 'HUD：统计面板无旋转');
  pad.sync({
    aimingSlot: 0,
    skillCds: [0, 0, 0, 0],
    fineTuneOn: false,
  });
  assert(cancelBtn.hidden, 'HUD：退出瞄准应隐藏取消键');
  assert(hostTransform === 'none', 'HUD：宿主 transform 无旋转');
  assert(noRotate(host) && noRotate(skills), 'HUD：技能无旋转');
  assert(helpOpenedByFab, 'HUD：点 ? 应打开同一份说明卡');
  assert(!!howTo, 'HUD：设置常规应仍有怎么玩');
  assert(helpOpenedBySettings && settingsClosedAfterHowTo, 'HUD：设置怎么玩应打开同一份说明卡');

  const assertSettingsFit = (viewW: number, viewH: number, label: string): void => {
    const fitHost = document.createElement('div');
    fitHost.style.cssText = `position:fixed;left:0;top:0;width:${viewW}px;height:${viewH}px;${hudChrome}`;
    document.body.appendChild(fitHost);
    applyStageVars(fitHost, computeLandscapeStage(viewW, viewH, none));
    const fitHud = createMatchHud(fitHost);
    createTouchPad(fitHost, createActionBus(), { forceStick: true });
    const fitSettings = createSettingsPanel(fitHost, {
      onRestart: () => {},
      onReload: () => {},
      onCollision: () => {},
      onScore: () => {},
      onAdvance: () => {},
      onJumpClock: () => {},
      onForceRespawn: () => {},
      getMode: () => 'eightKill',
      versions: dummyVersions(),
    });
    fitSettings.open();
    const panel = fitHost.querySelector<HTMLElement>('.settingsPanel');
    const pick = fitHost.querySelector<HTMLSelectElement>('select.settingsModePick');
    const overlay = fitHost.querySelector<HTMLElement>('.settingsOverlay');
    if (!panel || !pick || !overlay) {
      fitHost.remove();
      throw new Error(`${label}：设置常规应有玩法选择`);
    }
    const panelBox = localBox(panel, fitHost);
    const pickBox = localBox(pick, fitHost);
    assert(panelBox.left >= -1 && panelBox.top >= -1, `${label}：设置面板不应溢出左上`);
    assert(panelBox.right <= viewW + 1 && panelBox.bottom <= viewH + 1, `${label}：设置面板不应溢出右下`);
    assert(pickBox.left >= panelBox.left && pickBox.right <= panelBox.right, `${label}：玩法下拉不应溢出面板`);
    assert(pickBox.top >= panelBox.top && pickBox.bottom <= panelBox.bottom, `${label}：玩法下拉应完整可见`);
    overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    assert(!fitSettings.isOpen(), `${label}：点空白应关闭设置`);
    assert(!fitHost.querySelector('.matchHudLeft') && !fitHost.querySelector('select.matchHudMode'), `${label}：左上不应残留玩法入口`);
    fitHud.sync(dummySnap(), []);
    fitHost.remove();
  };
  assertSettingsFit(1920, 1080, 'HUD：1920×1080');
  assertSettingsFit(2340, 1080, 'HUD：2340×1080');

  const tallHost = document.createElement('div');
  tallHost.style.cssText = `position:fixed;left:0;top:0;width:375px;height:667px;${hudChrome}`;
  createMatchHud(tallHost);
  createTouchPad(tallHost, createActionBus());
  createHelpCard(tallHost);
  document.body.appendChild(tallHost);
  applyStageVars(tallHost, computeLandscapeStage(375, 667, none));
  assert(!tallHost.classList.contains('isForceLandscape'), 'HUD：窄高窗不应标 isForceLandscape');
  assert(noRotate(tallHost), 'HUD：窄高窗不对 #app 转 90°');
  assert(!tallHost.querySelector('.rotatePrompt'), 'HUD：窄高窗不应有转屏遮罩');
  assert(!hasRotatePromptCopy(tallHost.textContent ?? ''), 'HUD：窄高窗不应出现转屏文案');
  tallHost.remove();

  const shortLand = document.createElement('div');
  shortLand.style.cssText = `position:fixed;left:0;top:0;width:667px;height:375px;${hudChrome}`;
  createTouchPad(shortLand, createActionBus());
  document.body.appendChild(shortLand);
  applyStageVars(shortLand, computeLandscapeStage(667, 375, none));
  assert(shortLand.classList.contains('isLandscape') && shortLand.classList.contains('isShortHud'), 'HUD：矮横窗应标 isLandscape + isShortHud');
  const shortBtn = shortLand.querySelector<HTMLButtonElement>('.touchSkillBtn');
  if (!shortBtn) {
    throw new Error('HUD：矮横窗应有技能键');
  }
  const shortSize = shortBtn.getBoundingClientRect();
  assert(shortSize.width >= 56, `HUD：矮横窗技能键不应缩回 40px（实际 ${shortSize.width}）`);
  shortLand.remove();

  hud.sync(dummySnap(), []);
  assert(red.textContent === '15' && blue.textContent === '30', 'HUD：胶囊应同步双方分数');
  assert(clock.textContent === '03:07', 'HUD：胶囊中间应为倒计时');
  hud.sync(dummySnap({ mode: 'eightKill', redKills: 4, blueKills: 7, redScore: 90, blueScore: 10 }), []);
  assert(red.textContent === '4' && blue.textContent === '7', 'HUD：八杀应显示击杀数');
  hud.sync(dummySnap({ midpoint: 'red' }), []);
  assert(cluster.dataset.hold === 'red', 'HUD：领地归属应画在合并胶囊上');

  const opening = host.querySelector<HTMLElement>('.openingHud');
  const openingNum = host.querySelector<HTMLElement>('.openingHudNum');
  const openingHint = host.querySelector<HTMLElement>('.openingHudHint');
  const toast = host.querySelector<HTMLElement>('.matchHudToast');
  if (!opening || !openingNum || !openingHint || !toast) {
    throw new Error('HUD：应有 Stall 倒计时层与短 toast');
  }
  hud.sync(dummySnap({ phase: 'countdown', timeLeft: 5, stallsOn: true, skillsLocked: true }), []);
  assert(opening.classList.contains('isOn'), 'HUD：Stall 应显示大号倒计时');
  assert(opening.dataset.kind === 'stall', 'HUD：Stall 应标 stall');
  assert(openingNum.textContent === '5', 'HUD：Stall 倒计时应显示秒数');
  hud.sync(
    dummySnap({
      phase: 'playing',
      openingChargeRemain: 1,
      skillsLocked: true,
      events: [{ kind: 'phase', text: '冲锋' }],
    }),
    [],
  );
  assert(!opening.classList.contains('isOn'), 'HUD：冲锋阶段不应出说明板');
  assert(openingNum.textContent === '', 'HUD：冲锋阶段不应写冲锋字');
  assert(toast.textContent !== '冲锋', 'HUD：冲锋阶段 toast 不应解释冲锋');

  const self = createBallBody({
    x: 2,
    y: 4,
    color: 0xe24a4a,
    team: 'red',
    teamSlot: 1,
    label: '红1',
  });
  self.inPlay = false;
  hud.sync(dummySnap({ respawns: { [self.id]: 4.2 } }), [self], self.id);
  assert(opening.classList.contains('isOn') && opening.dataset.kind === 'respawn', 'HUD：自己离场应出复活倒计时');
  assert(openingNum.textContent === '复活还需 5 秒', 'HUD：自身阵亡应显示复活还需 X 秒');
  assert(openingHint.textContent === '', 'HUD：阵亡层不应再写回场');
  const openingPaint = getComputedStyle(opening);
  assert(openingPaint.pointerEvents === 'none', 'HUD：复活倒计时不应抢点击');
  assert(
    openingPaint.backgroundColor === 'rgba(0, 0, 0, 0)' || openingPaint.backgroundColor === 'transparent',
    'HUD：复活倒计时不应铺全屏遮罩',
  );
  const respawnBox = localBox(opening, host);
  const skillHudBox = localBox(skills, host);
  const hostMidY = 900 / 2;
  const respawnMidY = (respawnBox.top + respawnBox.bottom) / 2;
  const respawnMidX = (respawnBox.left + respawnBox.right) / 2;
  assert(respawnBox.left >= -1 && respawnBox.top >= -1, 'HUD：复活倒计时不应溢出左上');
  assert(respawnBox.right <= 1600 + 1 && respawnBox.bottom <= 900 + 1, 'HUD：复活倒计时不应溢出右下');
  assert(!overlaps(respawnBox, skillHudBox), 'HUD：复活倒计时不应挡住技能键');
  assert(respawnMidY < hostMidY - 20, 'HUD：复活倒计时应在屏幕中央偏上');
  assert(Math.abs(respawnMidX - 800) < 80, 'HUD：复活倒计时应水平居中');
  host.remove();
}
