import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createActionBus } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { createTouchPad } from '../input/touchPad';
import { fitWorldToBox, screenToLogical } from '../render/worldTransform';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { lockLandscape } from '../ui/lockLandscape';
import { createMatchHud } from '../ui/matchHud';
import { createSettingsPanel } from '../ui/settingsPanel';
import {
  applyStageVars,
  clientToHostLocal,
  computeLandscapeStage,
  forceLandscapeViewSize,
  isPortraitViewport,
  remapInsetsForForceLandscape,
  syncForceLandscape,
  wantsForceLandscape,
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

function assertSquareCover(stage: StageRect, viewW: number, viewH: number, insets: SafeInsets, label: string): void {
  assert(Math.abs(stage.width - stage.height) < 1e-6, `${label}：舞台应为 20×20 正方形`);
  assert(Math.abs(stage.width / stage.height - MAP_WIDTH / MAP_HEIGHT) < 1e-6, `${label}：舞台应保持世界比例、不拉伸`);
  assert(coversSafeArea(stage, viewW, viewH, insets), `${label}：cover 应铺满可用安全区`);
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

/** 永远横屏 cover：竖窗先转 90° 再按横屏盒子排；HUD 叠四角。无转屏提示。 */
export function verifyHudLayout(): void {
  const none: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assertSquareCover(landscape, 1600, 900, none, 'HUD：横窗');
  assert(landscape.y < -1, 'HUD：横窗 cover 应裁掉上下（y 为负）');
  assert(Math.abs(landscape.x) < 1e-6, 'HUD：横窗 cover 宽度应贴齐可用宽');

  const forcedSize = forceLandscapeViewSize(800, 1200);
  assert(forcedSize.width === 1200 && forcedSize.height === 800, 'HUD：竖窗应互换宽高再按横屏排');
  const forced = computeLandscapeStage(forcedSize.width, forcedSize.height, none);
  assertSquareCover(forced, 1200, 800, none, 'HUD：竖窗转横后');
  assert(forced.y < -1, 'HUD：竖窗转横后 cover 应裁掉上下');
  assert(Math.abs(forced.x) < 1e-6, 'HUD：竖窗转横后宽度应贴齐长边');

  const phoneForced = forceLandscapeViewSize(375, 667);
  assert(phoneForced.width === 667 && phoneForced.height === 375, 'HUD：竖持短边当高、长边当宽');
  const phoneStage = computeLandscapeStage(phoneForced.width, phoneForced.height, none);
  assertSquareCover(phoneStage, 667, 375, none, 'HUD：竖持转横');
  assert(phoneStage.y < -1, 'HUD：竖持转横后 cover 应超出上下，不是竖着的战场');

  const phoneLand = computeLandscapeStage(667, 375, none);
  assertSquareCover(phoneLand, 667, 375, none, 'HUD：横持');
  assert(phoneLand.y < -1, 'HUD：横持 cover 应超出上下');

  const pcWide = computeLandscapeStage(1920, 1080, none);
  assertSquareCover(pcWide, 1920, 1080, none, 'HUD：PC 宽窗');

  const square = computeLandscapeStage(800, 800, none);
  assertSquareCover(square, 800, 800, none, 'HUD：正方窗');
  assert(Math.abs(square.x) < 1e-6 && Math.abs(square.y) < 1e-6, 'HUD：正方窗 cover 应刚好铺满');

  const notch = computeLandscapeStage(1600, 900, { top: 0, right: 44, bottom: 0, left: 44 });
  assertSquareCover(notch, 1600, 900, { top: 0, right: 44, bottom: 0, left: 44 }, 'HUD：刘海横窗');
  assert(notch.x >= 44 - 1e-6, 'HUD：舞台应避开左侧安全区');
  assert(notch.x + notch.width <= 1600 - 44 + 1e-6, 'HUD：舞台应避开右侧安全区');
  assert(notch.y < -1, 'HUD：刘海横窗仍应 cover 裁上下');

  const xf = fitWorldToBox(landscape.x, landscape.y, landscape.width, landscape.height, MAP_WIDTH, MAP_HEIGHT);
  const mid = screenToLogical(800, 450, xf);
  assert(Math.abs(mid.x - 10) < 0.05 && Math.abs(mid.y - 10) < 0.05, 'HUD：视口中点应对准世界中心');
  const off = screenToLogical(-1, -1, xf);
  assert(off.x < 0 || off.y < 0, 'HUD：cover 裁掉的舞台边缘在视口外');

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');
  assert(wantsForceLandscape(375, 667) && !wantsForceLandscape(667, 375), 'HUD：竖持应强制横屏，横持不转');
  assert(!wantsForceLandscape(1600, 900), 'HUD：横窗不应旋转');

  const remapped = remapInsetsForForceLandscape({ top: 10, right: 1, bottom: 20, left: 2 });
  assert(
    remapped.top === 1 && remapped.right === 20 && remapped.bottom === 2 && remapped.left === 10,
    'HUD：90° CW 安全区应为上←右、右←下、下←左、左←上',
  );

  lockLandscape();

  const stageHost = document.createElement('div');
  stageHost.style.cssText = 'position:fixed;left:0;top:0;';
  document.body.appendChild(stageHost);
  const forcedOn = syncForceLandscape(stageHost, 375, 667);
  const forcedFrame = forceLandscapeViewSize(375, 667);
  applyStageVars(stageHost, computeLandscapeStage(forcedFrame.width, forcedFrame.height, none));
  assert(forcedOn, 'HUD：竖窗应打开强制横屏');
  assert(stageHost.classList.contains('isForceLandscape'), 'HUD：竖窗宿主应标 isForceLandscape');
  assert(stageHost.classList.contains('isLandscape') && !stageHost.classList.contains('isPortrait'), 'HUD：竖窗转横后应按横屏布局类');
  assert(stageHost.style.transform.includes('rotate(90deg)'), 'HUD：竖窗应 rotate(90deg)，家庭键在右时正向');
  assert(stageHost.style.width === '667px' && stageHost.style.height === '375px', 'HUD：竖窗布局盒应为横屏尺寸');
  stageHost.remove();

  const landProbe = document.createElement('div');
  landProbe.style.cssText = 'position:fixed;left:0;top:0;width:667px;height:375px';
  document.body.appendChild(landProbe);
  const landForce = syncForceLandscape(landProbe, 667, 375);
  assert(!landForce && !landProbe.classList.contains('isForceLandscape'), 'HUD：横窗不应旋转');
  assert(!landProbe.style.transform, 'HUD：横窗宿主不应写画面变换');
  landProbe.remove();

  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;';
  document.body.appendChild(probe);
  syncForceLandscape(probe, 200, 400);
  const mapped = clientToHostLocal(probe, 120, 50);
  probe.remove();
  assert(Math.abs(mapped.x - 50) < 2 && Math.abs(mapped.y - 80) < 2, 'HUD：强制横屏应反解点按坐标');

  const aimHost = document.createElement('div');
  aimHost.style.cssText = 'position:fixed;left:0;top:0;';
  const aimCanvas = document.createElement('canvas');
  aimCanvas.style.cssText = 'width:100%;height:100%;display:block';
  aimHost.appendChild(aimCanvas);
  document.body.appendChild(aimHost);
  syncForceLandscape(aimHost, 200, 400);
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
    Math.abs((aimSample.pointerX ?? 0) - 80) < 2 && Math.abs((aimSample.pointerY ?? 0) - 40) < 2,
    'HUD：旋转后瞄准应反解，不点左打右',
  );

  const plain = document.createElement('div');
  plain.style.cssText = 'position:fixed;left:40px;top:30px;width:100px;height:80px';
  document.body.appendChild(plain);
  const local = clientToHostLocal(plain, 60, 50);
  plain.remove();
  assert(Math.abs(local.x - 20) < 2 && Math.abs(local.y - 20) < 2, 'HUD：未旋转时应按视口差值取本地坐标');

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
  assert(landStage.y < -1, 'HUD：横窗舞台应 cover 裁掉上下');
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
  tallHost.style.cssText = `position:fixed;left:0;top:0;${hudChrome}`;
  createMatchHud(tallHost);
  createTouchPad(tallHost, createActionBus());
  createHelpCard(tallHost);
  document.body.appendChild(tallHost);
  syncForceLandscape(tallHost, 375, 667);
  const tallStage = computeLandscapeStage(667, 375, none);
  applyStageVars(tallHost, tallStage);
  const tallHud = tallHost.querySelector<HTMLElement>('.matchHud');
  const tallHero = tallHost.querySelector<HTMLElement>('.matchHudHeroRow');
  const tallSkills = tallHost.querySelector<HTMLElement>('.touchSkills');
  const tallCluster = tallHost.querySelector<HTMLElement>('.matchHudCluster');
  const tallHelp = tallHost.querySelector<HTMLElement>('.helpFab');
  const tallGear = tallHost.querySelector<HTMLElement>('.settingsFab');
  assert(tallHost.classList.contains('isForceLandscape'), 'HUD：窄高窗应旋转成横屏对局');
  assert(tallHost.classList.contains('isLandscape') && !tallHost.classList.contains('isPortrait'), 'HUD：窄高窗转横后应按横屏 HUD');
  assert(tallStage.y < -1, 'HUD：窄高窗转横后 cover 应裁掉上下，不是竖着的战场');
  assert(tallHost.style.transform.includes('rotate(90deg)'), 'HUD：窄高窗应 rotate(90deg)');
  assert(!tallHost.querySelector('.rotatePrompt'), 'HUD：窄高窗不应有转屏遮罩');
  assert(!hasRotatePromptCopy(tallHost.textContent ?? ''), 'HUD：窄高窗不应出现转屏文案');
  assert(!!tallHud && getComputedStyle(tallHud).display !== 'none', 'HUD：窄高窗不另做竖屏布局，也不藏 HUD');
  assert(!!tallSkills && getComputedStyle(tallSkills).display !== 'none', 'HUD：窄高窗技能层仍在');
  assert(noRotate(tallHero!) && noRotate(tallSkills!), 'HUD：技能/下拉自身无旋转，跟着整屏转');
  if (tallHero && tallSkills && tallCluster) {
    assertCornerHud(tallHost, tallHero, tallSkills, tallCluster, tallHelp, tallGear, 'HUD：竖窗转横');
  }
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
