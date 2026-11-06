import { MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import { fitWorldToBox, screenToLogical } from '../render/worldTransform';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
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
  const b = host.getBoundingClientRect();
  return {
    left: a.left - b.left,
    top: a.top - b.top,
    right: a.right - b.left,
    bottom: a.bottom - b.top,
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
  const hostRect = host.getBoundingClientRect();
  const heroBox = localBox(heroRow, host);
  const skillBox = localBox(skills, host);
  const clusterBox = localBox(cluster, host);
  const midX = hostRect.width / 2;
  const midY = hostRect.height / 2;
  assert(heroBox.left < 24, `${label}：换英雄应贴视窗左上`);
  assert(heroBox.top < 24, `${label}：换英雄应贴视窗顶`);
  assert(heroBox.right < hostRect.width * 0.48, `${label}：换英雄不应伸进中场`);
  assert(heroBox.bottom < midY, `${label}：换英雄应留在上半屏`);
  assert(hostRect.width - skillBox.right < 24, `${label}：技能应贴视窗右侧`);
  assert(hostRect.height - skillBox.bottom < 24, `${label}：技能应贴视窗底`);
  assert(skillBox.left > hostRect.width * 0.28, `${label}：技能应偏右下，不挡中场领地`);
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
    assert(hostRect.width - gearBox.right < 24, `${label}：齿轮应贴视窗右上`);
  }
}

/** 横竖同 cover：无 letterbox；HUD 叠四角（换英雄左上、比分顶中、?齿轮顶右、技能右下）。 */
export function verifyHudLayout(): void {
  const none: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assertSquareCover(landscape, 1600, 900, none, 'HUD：横窗');
  assert(landscape.y < -1, 'HUD：横窗 cover 应裁掉上下（y 为负）');
  assert(Math.abs(landscape.x) < 1e-6, 'HUD：横窗 cover 宽度应贴齐可用宽');

  const portrait = computeLandscapeStage(800, 1200, none);
  assertSquareCover(portrait, 800, 1200, none, 'HUD：竖窗');
  assert(portrait.x < -1, 'HUD：竖窗 cover 应裁掉左右（x 为负）');
  assert(Math.abs(portrait.y) < 1e-6, 'HUD：竖窗 cover 高度应贴齐可用高');

  const phonePortrait = computeLandscapeStage(375, 667, none);
  assertSquareCover(phonePortrait, 375, 667, none, 'HUD：竖持');
  assert(phonePortrait.x < -1, 'HUD：竖持 cover 应超出左右，不互换宽高');

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

  const stageHost = document.createElement('div');
  stageHost.style.cssText = 'position:fixed;left:0;top:0;width:375px;height:667px';
  document.body.appendChild(stageHost);
  applyStageVars(stageHost, computeLandscapeStage(375, 667, none));
  assert(stageHost.classList.contains('isPortrait') && !stageHost.classList.contains('isLandscape'), 'HUD：竖窗应标 isPortrait');
  assert(!stageHost.style.transform, 'HUD：宿主不应写画面变换');
  stageHost.remove();

  const plain = document.createElement('div');
  plain.style.cssText = 'position:fixed;left:40px;top:30px;width:100px;height:80px';
  document.body.appendChild(plain);
  const local = clientToHostLocal(plain, 60, 50);
  plain.remove();
  assert(Math.abs(local.x - 20) < 2 && Math.abs(local.y - 20) < 2, 'HUD：点应按视口差值取本地坐标，不反解');

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

  const hudChrome =
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  host.style.cssText = `position:relative;width:375px;height:667px;${hudChrome}`;
  document.body.appendChild(host);
  const portraitStage = computeLandscapeStage(375, 667, none);
  applyStageVars(host, portraitStage);
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
  const helpRect = helpFab.getBoundingClientRect();
  const gearRect = settingsFab.getBoundingClientRect();
  const clusterRect = cluster.getBoundingClientRect();
  const clusterTop = parseFloat(getComputedStyle(cluster).top);
  const heroDir = getComputedStyle(heroRow).flexDirection;
  const skillsDisplay = getComputedStyle(skills).display;
  const skillsDir = getComputedStyle(skills).flexDirection;
  const hostTransform = getComputedStyle(host).transform;
  helpFab.click();
  const helpOpenedByFab = help.isOpen();
  help.close();
  settings.open();
  const howTo = [...host.querySelectorAll('button')].find((btn) => btn.textContent === '怎么玩');
  howTo?.click();
  const helpOpenedBySettings = help.isOpen();
  const settingsClosedAfterHowTo = !settings.isOpen();
  help.close();
  assert(host.classList.contains('isPortrait') && !host.classList.contains('isLandscape'), 'HUD：竖窗宿主应标 isPortrait');
  assert(Number.isFinite(clusterTop) && clusterTop < 40, 'HUD：顶中胶囊应贴竖窗顶');
  assert(portraitStage.x < -1, 'HUD：竖窗舞台应 cover 超出左右');
  assert(heroDir === 'column', 'HUD：我/队友应竖叠');
  assert(skillsDisplay === 'flex' && skillsDir === 'row', 'HUD：四键应一行横排');
  assert(helpRect.right <= gearRect.left + 1, 'HUD：? 应在齿轮左侧');
  assert(Math.abs(helpRect.top - gearRect.top) < 2, 'HUD：? 应与齿轮顶对齐');
  assert(helpRect.left + 1 >= clusterRect.right, 'HUD：? 不应叠顶中比分');
  assert(hostTransform === 'none', 'HUD：宿主 transform 无旋转');
  assert(noRotate(host) && noRotate(heroRow) && noRotate(skills), 'HUD：技能/下拉无旋转');
  assert(helpOpenedByFab, 'HUD：点 ? 应打开同一份说明卡');
  assert(!!howTo, 'HUD：设置常规应仍有怎么玩');
  assert(helpOpenedBySettings && settingsClosedAfterHowTo, 'HUD：设置怎么玩应打开同一份说明卡');
  assertCornerHud(host, heroRow, skills, cluster, helpFab, settingsFab, 'HUD：竖窗');

  const landHost = document.createElement('div');
  landHost.style.cssText = `position:relative;width:1600px;height:900px;${hudChrome}`;
  createMatchHud(landHost);
  createTouchPad(landHost, createActionBus());
  document.body.appendChild(landHost);
  const landStage = computeLandscapeStage(1600, 900, none);
  applyStageVars(landHost, landStage);
  const landHero = landHost.querySelector<HTMLElement>('.matchHudHeroRow');
  const landSkills = landHost.querySelector<HTMLElement>('.touchSkills');
  const landCluster = landHost.querySelector<HTMLElement>('.matchHudCluster');
  const landHelp = landHost.querySelector<HTMLElement>('.helpFab');
  const landGear = landHost.querySelector<HTMLElement>('.settingsFab');
  if (!landHero || !landSkills || !landCluster) {
    throw new Error('HUD：横窗应有下拉、技能与胶囊');
  }
  createHelpCard(landHost);
  createSettingsPanel(landHost, {
    onOpen: () => {},
    onOpenHelp: () => {},
    onRestart: () => {},
    onCollision: () => {},
    onScore: () => {},
    onAdvance: () => {},
    onJumpClock: () => {},
    onForceRespawn: () => {},
    versions: dummyVersions(),
  });
  const landHelpFab = landHost.querySelector<HTMLElement>('.helpFab') ?? landHelp;
  const landGearFab = landHost.querySelector<HTMLElement>('.settingsFab') ?? landGear;
  const landHeroDir = getComputedStyle(landHero).flexDirection;
  const landSkillsDir = getComputedStyle(landSkills).flexDirection;
  const landNoRotate = noRotate(landHost) && noRotate(landHero) && noRotate(landSkills);
  const landIsLandscape = landHost.classList.contains('isLandscape') && !landHost.classList.contains('isPortrait');
  assert(landIsLandscape, 'HUD：横窗宿主应标 isLandscape');
  assert(landStage.y < -1, 'HUD：横窗舞台应 cover 裁掉上下');
  assert(landHeroDir === 'column', 'HUD：横窗我/队友仍应竖叠');
  assert(landSkillsDir === 'row', 'HUD：横窗四键仍应一行横排');
  assertCornerHud(landHost, landHero, landSkills, landCluster, landHelpFab, landGearFab, 'HUD：横窗');
  assert(landNoRotate, 'HUD：横窗技能/下拉无旋转');
  landHost.remove();

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
