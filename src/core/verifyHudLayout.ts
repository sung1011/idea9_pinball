import { IPHONE_LANDSCAPE_LOGICAL_HEIGHT, IPHONE_LANDSCAPE_LOGICAL_WIDTH, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createActionBus } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { createTouchPad } from '../input/touchPad';
import { fitWorldToBox, screenToLogical } from '../render/worldTransform';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { landscapeLockType, lockLandscape } from '../ui/lockLandscape';
import { createMatchHud } from '../ui/matchHud';
import { createSettingsPanel } from '../ui/settingsPanel';
import {
  applyStageVars,
  clientToHostLocal,
  computeLandscapeStage,
  isPortraitViewport,
  type SafeInsets,
  type StageRect,
} from '../ui/stageLayout';
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
  heroRow: HTMLElement,
  skills: HTMLElement,
  cluster: HTMLElement,
  helpFab: HTMLElement | null,
  settingsFab: HTMLElement | null,
  label: string,
): void {
  const hostW = host.clientWidth;
  const hostH = host.clientHeight;
  const heroBox = localBox(heroRow, host);
  const skillBox = localBox(skills, host);
  const clusterBox = localBox(cluster, host);
  const midX = hostW / 2;
  const midY = hostH / 2;
  assert(heroBox.left < 24, `${label}：换英雄应贴视窗左上`);
  assert(heroBox.top < 24, `${label}：换英雄应贴视窗顶`);
  assert(heroBox.right < hostW * 0.48, `${label}：换英雄不应伸进中场`);
  assert(heroBox.bottom < midY, `${label}：换英雄应留在上半屏`);
  assert(hostW - skillBox.right < 24, `${label}：技能应贴视窗右侧`);
  assert(hostH - skillBox.bottom < 24, `${label}：技能应贴视窗底`);
  assert(skillBox.left > hostW * 0.28, `${label}：技能应偏右下，不挡中场领地`);
  assert(skillBox.top > midY, `${label}：技能应留在下半屏`);
  assert(clusterBox.top < 24, `${label}：比分胶囊应贴窗顶`);
  assert(Math.abs((clusterBox.left + clusterBox.right) / 2 - midX) < 24, `${label}：比分胶囊应顶中`);
  assert(heroBox.right <= clusterBox.left + 4 || heroBox.bottom <= clusterBox.top + 1, `${label}：换英雄不应挡住顶中胶囊`);
  if (helpFab && settingsFab) {
    const helpBox = localBox(helpFab, host);
    const gearBox = localBox(settingsFab, host);
    assert(helpBox.left + 1 >= clusterBox.right, `${label}：? 不应叠顶中比分`);
    assert(gearBox.left + 1 >= helpBox.right, `${label}：齿轮不应叠 ?`);
    assert(Math.abs(helpBox.top - gearBox.top) < 2, `${label}：? 应与齿轮顶对齐`);
    assert(hostW - gearBox.right < 24, `${label}：齿轮应贴视窗右上`);
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
  createTouchPad(host, createActionBus());
  const cluster = host.querySelector<HTMLElement>('.matchHudCluster');
  const red = host.querySelector<HTMLElement>('.matchHudRed .matchHudScoreVal');
  const blue = host.querySelector<HTMLElement>('.matchHudBlue .matchHudScoreVal');
  const clock = host.querySelector<HTMLElement>('.matchHudClock');
  const hero = host.querySelector<HTMLSelectElement>('select.matchHudHero:not(.matchHudAllyHero)');
  const allyHero = host.querySelector<HTMLSelectElement>('select.matchHudAllyHero');
  const heroRow = host.querySelector<HTMLElement>('.matchHudHeroRow');
  const skills = host.querySelector<HTMLElement>('.touchSkills');
  const skillBtns = [...host.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn')];
  if (!cluster || !red || !blue || !clock || !hero || !allyHero || !heroRow || !skills) {
    throw new Error('HUD：应有顶中比分计时胶囊、自己/队友下拉与技能键');
  }
  assert(!host.querySelector('.matchHudPill'), 'HUD：不应再有角落独立比分胶囊');
  assert(cluster.contains(red) && cluster.contains(clock) && cluster.contains(blue), 'HUD：红分/计时/蓝分应同在一颗胶囊');
  const sides = [...cluster.querySelectorAll('.matchHudSide')];
  assert(sides[0]?.classList.contains('matchHudRed') && sides[1]?.classList.contains('matchHudBlue'), 'HUD：胶囊顺序应为红 | 计时 | 蓝');
  assert(cluster.querySelectorAll('.matchHudMark').length === 2, 'HUD：红蓝两侧应有小队标');
  assert(cluster.contains(hero) === false && cluster.contains(allyHero) === false, 'HUD：英雄下拉应留在边缘，不进顶中胶囊');
  assert(heroRow.contains(hero) && heroRow.contains(allyHero), 'HUD：自己/队友下拉应同组');
  assert(heroRow.dataset.hud === 'heroPicks', 'HUD：双下拉应标 heroPicks');
  const tags = [...heroRow.querySelectorAll('.matchHudHeroTag')].map((el) => el.textContent);
  assert(tags[0] === '我' && tags[1] === '队友', 'HUD：双下拉标签应为我/队友');
  assert(skillBtns.length === 4, 'HUD：应为横排四技能键');
  assert(skillBtns.map((btn) => btn.dataset.slot).join('') === '1234', 'HUD：技能键从左到右应为 Skill1–4');

  host.style.cssText = `position:relative;width:1600px;height:900px;${hudChrome}`;
  document.body.appendChild(host);
  const landStage = computeLandscapeStage(1600, 900, none);
  applyStageVars(host, landStage);
  const help = createHelpCard(host);
  const settings = createSettingsPanel(host, {
    onOpen: () => help.close(),
    onOpenHelp: () => help.open(),
    onRestart: () => {},
    onCollision: () => {},
    onScore: () => {},
    onAdvance: () => {},
    onJumpClock: () => {},
    onForceRespawn: () => {},
    versions: dummyVersions(),
  });
  const helpFab = host.querySelector<HTMLButtonElement>('.helpFab');
  const settingsFab = host.querySelector<HTMLButtonElement>('.settingsFab');
  if (!helpFab || !settingsFab) {
    throw new Error('HUD：顶右应有 ? 与齿轮');
  }
  assert(helpFab.textContent === '?', 'HUD：说明钮应为 ?');
  const hostTransform = getComputedStyle(host).transform;
  const heroDir = getComputedStyle(heroRow).flexDirection;
  const skillsDisplay = getComputedStyle(skills).display;
  const skillsDir = getComputedStyle(skills).flexDirection;
  helpFab.click();
  const helpOpenedByFab = help.isOpen();
  const helpCopy = host.querySelector('.helpCardBody')?.textContent ?? '';
  help.close();
  settings.open();
  const settingsHint = [...host.querySelectorAll('.settingsHint')].map((el) => el.textContent ?? '').join('\n');
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
  assert(heroDir === 'column', 'HUD：我/队友应竖叠');
  assert(skillsDisplay === 'flex' && skillsDir === 'row', 'HUD：四键应一行横排');
  assertCornerHud(host, heroRow, skills, cluster, helpFab, settingsFab, 'HUD：横窗');
  assert(hostTransform === 'none', 'HUD：宿主 transform 无旋转');
  assert(noRotate(host) && noRotate(heroRow) && noRotate(skills), 'HUD：技能/下拉无旋转');
  assert(helpOpenedByFab, 'HUD：点 ? 应打开同一份说明卡');
  assert(!!howTo, 'HUD：设置常规应仍有怎么玩');
  assert(helpOpenedBySettings && settingsClosedAfterHowTo, 'HUD：设置怎么玩应打开同一份说明卡');

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

  hud.sync(dummySnap(), []);
  assert(red.textContent === '15' && blue.textContent === '30', 'HUD：胶囊应同步双方分数');
  assert(clock.textContent === '03:07', 'HUD：胶囊中间应为倒计时');
  hud.sync(dummySnap({ midpoint: 'red' }), []);
  assert(cluster.dataset.hold === 'red', 'HUD：领地归属应画在合并胶囊上');

  const opening = host.querySelector<HTMLElement>('.openingHud');
  const openingNum = host.querySelector<HTMLElement>('.openingHudNum');
  const toast = host.querySelector<HTMLElement>('.matchHudToast');
  if (!opening || !openingNum || !toast) {
    throw new Error('HUD：应有 Stall 倒计时层与短 toast');
  }
  hud.sync(dummySnap({ phase: 'countdown', timeLeft: 5, stallsOn: true, skillsLocked: true }), []);
  assert(opening.classList.contains('isOn'), 'HUD：Stall 应显示大号倒计时');
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
  host.remove();
}
