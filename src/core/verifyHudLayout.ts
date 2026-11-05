import { createMatchHud } from '../ui/matchHud';
import {
  applyStageVars,
  clientToHostLocal,
  computeLandscapeStage,
  isPortraitViewport,
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

/** 竖窗 HUD：20×20 正方形 letterbox；顶中红|计时|蓝一颗胶囊，底左我/队友。 */
export function verifyHudLayout(): void {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assert(Math.abs(landscape.width - landscape.height) < 1e-6, 'HUD：舞台应为 20×20 正方形');
  assert(landscape.x > 10, 'HUD：横窗应左右留 letterbox');

  const portrait = computeLandscapeStage(800, 1200, none);
  assert(Math.abs(portrait.width - portrait.height) < 1e-6, 'HUD：竖窗舞台仍为正方形');
  assert(portrait.x + portrait.width <= 800 + 1e-6, 'HUD：竖窗舞台不应超出宽度');
  assert(portrait.y > 10, 'HUD：竖窗应上下留 letterbox');

  const phonePortrait = computeLandscapeStage(375, 667, none);
  assert(Math.abs(phonePortrait.width - phonePortrait.height) < 1e-6, 'HUD：竖持仍按正方形 letterbox，不互换宽高');
  assert(phonePortrait.y > 10, 'HUD：竖持应上下留黑边');

  const phoneLand = computeLandscapeStage(667, 375, none);
  assert(Math.abs(phoneLand.width - phoneLand.height) < 1e-6, 'HUD：横持仍为正方形');
  assert(phoneLand.x > 1, 'HUD：横持应左右留 letterbox');

  const pcWide = computeLandscapeStage(1920, 1080, none);
  assert(Math.abs(pcWide.width - pcWide.height) < 1e-6, 'HUD：PC 宽窗仍为正方形');

  const notch = computeLandscapeStage(1600, 900, { top: 0, right: 44, bottom: 0, left: 44 });
  assert(notch.x >= 44, 'HUD：舞台应避开左侧安全区');
  assert(notch.x + notch.width <= 1600 - 44 + 1e-6, 'HUD：舞台应避开右侧安全区');

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');

  const stageHost = document.createElement('div');
  stageHost.style.cssText = 'position:fixed;left:0;top:0;width:375px;height:667px';
  document.body.appendChild(stageHost);
  applyStageVars(stageHost, computeLandscapeStage(375, 667, none));
  assert(stageHost.classList.contains('isPortrait'), 'HUD：竖窗应标 isPortrait');
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
  const cluster = host.querySelector<HTMLElement>('.matchHudCluster');
  const red = host.querySelector<HTMLElement>('.matchHudRed .matchHudScoreVal');
  const blue = host.querySelector<HTMLElement>('.matchHudBlue .matchHudScoreVal');
  const clock = host.querySelector<HTMLElement>('.matchHudClock');
  const hero = host.querySelector<HTMLSelectElement>('select.matchHudHero:not(.matchHudAllyHero)');
  const allyHero = host.querySelector<HTMLSelectElement>('select.matchHudAllyHero');
  const heroRow = host.querySelector<HTMLElement>('.matchHudHeroRow');
  if (!cluster || !red || !blue || !clock || !hero || !allyHero || !heroRow) {
    throw new Error('HUD：应有顶中比分计时胶囊与自己/队友两个英雄下拉');
  }
  assert(!host.querySelector('.matchHudPill'), 'HUD：不应再有角落独立比分胶囊');
  assert(cluster.contains(red) && cluster.contains(clock) && cluster.contains(blue), 'HUD：红分/计时/蓝分应同在一颗胶囊');
  const sides = [...cluster.querySelectorAll('.matchHudSide')];
  assert(sides[0]?.classList.contains('matchHudRed') && sides[1]?.classList.contains('matchHudBlue'), 'HUD：胶囊顺序应为红 | 计时 | 蓝');
  assert(cluster.querySelectorAll('.matchHudMark').length === 2, 'HUD：红蓝两侧应有小队标');
  assert(cluster.contains(hero) === false && cluster.contains(allyHero) === false, 'HUD：英雄下拉应留在边缘，不进顶中胶囊');
  assert(heroRow.contains(hero) && heroRow.contains(allyHero), 'HUD：自己/队友下拉应同在左下');
  const tags = [...heroRow.querySelectorAll('.matchHudHeroTag')].map((el) => el.textContent);
  assert(tags[0] === '我' && tags[1] === '队友', 'HUD：双下拉标签应为我/队友');

  host.style.cssText =
    'position:relative;width:375px;height:667px;--hud-pad:8px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  document.body.appendChild(host);
  applyStageVars(host, computeLandscapeStage(375, 667, none));
  const clusterTop = parseFloat(getComputedStyle(cluster).top);
  const heroBottom = parseFloat(getComputedStyle(heroRow).bottom);
  const stageTop = parseFloat(getComputedStyle(host).getPropertyValue('--stage-top'));
  const heroDir = getComputedStyle(heroRow).flexDirection;
  host.remove();
  assert(Number.isFinite(clusterTop) && clusterTop < 40, 'HUD：顶中胶囊应贴竖窗顶');
  assert(Number.isFinite(heroBottom) && heroBottom < 40, 'HUD：双下拉应贴竖窗底');
  assert(stageTop > 80, 'HUD：竖窗舞台顶应落在 letterbox');
  assert(clusterTop < stageTop - 40, 'HUD：胶囊应在上黑边，不贴舞台边');
  assert(heroDir === 'column', 'HUD：竖窗我/队友应竖排，避免和技能挤一行');

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
}
