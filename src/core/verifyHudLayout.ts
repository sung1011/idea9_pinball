import { createMatchHud } from '../ui/matchHud';
import { computeLandscapeStage, isPortraitViewport, shouldShowRotateHint, wantsRotateHint } from '../ui/stageLayout';
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

/** Layout B：横构图舞台、竖窗 letterbox、触屏竖持才转横提示；顶中红|计时|蓝一颗胶囊。 */
export function verifyHudLayout(): void {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assert(landscape.width > landscape.height, 'HUD：横屏舞台应为横构图');
  assert(Math.abs(landscape.width / landscape.height - 20 / 12) < 1e-6, 'HUD：舞台比例应为 20×12');

  const portrait = computeLandscapeStage(800, 1200, none);
  assert(portrait.width > portrait.height, 'HUD：竖窗仍保持横构图');
  assert(portrait.x + portrait.width <= 800 + 1e-6, 'HUD：竖窗舞台不应超出宽度');
  assert(portrait.y > 10, 'HUD：竖窗应上下留 letterbox');

  const notch = computeLandscapeStage(1600, 900, { top: 0, right: 44, bottom: 0, left: 44 });
  assert(notch.x >= 44, 'HUD：舞台应避开左侧安全区');
  assert(notch.x + notch.width <= 1600 - 44 + 1e-6, 'HUD：舞台应避开右侧安全区');

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');
  assert(!wantsRotateHint(1600, 900), 'HUD：横屏窗口不应出转横提示');
  assert(
    !shouldShowRotateHint({
      viewW: 800,
      viewH: 1200,
      screenPortrait: false,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：PC 竖窗（屏幕仍横）不应出转横提示',
  );
  assert(
    shouldShowRotateHint({
      viewW: 375,
      viewH: 667,
      screenPortrait: true,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：手机竖持应出转横提示',
  );
  assert(
    !shouldShowRotateHint({
      viewW: 667,
      viewH: 375,
      screenPortrait: false,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：手机横持不应出转横提示',
  );

  const host = document.createElement('div');
  const hud = createMatchHud(host);
  const cluster = host.querySelector<HTMLElement>('.matchHudCluster');
  const red = host.querySelector<HTMLElement>('.matchHudRed .matchHudScoreVal');
  const blue = host.querySelector<HTMLElement>('.matchHudBlue .matchHudScoreVal');
  const clock = host.querySelector<HTMLElement>('.matchHudClock');
  const hero = host.querySelector<HTMLSelectElement>('select.matchHudHero');
  if (!cluster || !red || !blue || !clock || !hero) {
    throw new Error('HUD：应有顶中比分计时胶囊与英雄下拉');
  }
  assert(!host.querySelector('.matchHudPill'), 'HUD：不应再有角落独立比分胶囊');
  assert(cluster.contains(red) && cluster.contains(clock) && cluster.contains(blue), 'HUD：红分/计时/蓝分应同在一颗胶囊');
  const sides = [...cluster.querySelectorAll('.matchHudSide')];
  assert(sides[0]?.classList.contains('matchHudRed') && sides[1]?.classList.contains('matchHudBlue'), 'HUD：胶囊顺序应为红 | 计时 | 蓝');
  assert(cluster.querySelectorAll('.matchHudMark').length === 2, 'HUD：红蓝两侧应有小队标');
  assert(cluster.contains(hero) === false, 'HUD：英雄下拉应留在边缘，不进顶中胶囊');

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
