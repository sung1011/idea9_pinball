import { createMatchHud } from '../ui/matchHud';
import {
  clientToHostLocal,
  computeLandscapeStage,
  forceLandscapeViewSize,
  isPortraitViewport,
  remapInsetsForForceLandscape,
  shouldForceLandscape,
  wantsForceLandscape,
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

/** Layout B：横构图舞台、竖窗 letterbox、触屏竖持强制横屏；顶中红|计时|蓝一颗胶囊。 */
export function verifyHudLayout(): void {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assert(landscape.width > landscape.height, 'HUD：横屏舞台应为横构图');
  assert(Math.abs(landscape.width / landscape.height - 20 / 12) < 1e-6, 'HUD：舞台比例应为 20×12');

  const portrait = computeLandscapeStage(800, 1200, none);
  assert(portrait.width > portrait.height, 'HUD：竖窗仍保持横构图');
  assert(portrait.x + portrait.width <= 800 + 1e-6, 'HUD：竖窗舞台不应超出宽度');
  assert(portrait.y > 10, 'HUD：竖窗应上下留 letterbox');

  const forced = forceLandscapeViewSize(375, 667);
  const forcedStage = computeLandscapeStage(forced.width, forced.height, none);
  assert(forced.width === 667 && forced.height === 375, 'HUD：竖持强制横屏应互换宽高');
  assert(forcedStage.width > forcedStage.height, 'HUD：强制横屏舞台仍为横构图');

  const notch = computeLandscapeStage(1600, 900, { top: 0, right: 44, bottom: 0, left: 44 });
  assert(notch.x >= 44, 'HUD：舞台应避开左侧安全区');
  assert(notch.x + notch.width <= 1600 - 44 + 1e-6, 'HUD：舞台应避开右侧安全区');

  const remapped = remapInsetsForForceLandscape({ top: 10, right: 1, bottom: 20, left: 2 });
  assert(
    remapped.top === 2 && remapped.right === 10 && remapped.bottom === 1 && remapped.left === 20,
    'HUD：强制横屏应旋转安全区',
  );

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');
  assert(!wantsForceLandscape(1600, 900), 'HUD：横屏窗口不应强制旋转');
  assert(
    !shouldForceLandscape({
      viewW: 800,
      viewH: 1200,
      screenPortrait: false,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：PC 竖窗（屏幕仍横）不应强制旋转',
  );
  assert(
    shouldForceLandscape({
      viewW: 375,
      viewH: 667,
      screenPortrait: true,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：手机竖持应强制横屏',
  );
  assert(
    !shouldForceLandscape({
      viewW: 667,
      viewH: 375,
      screenPortrait: false,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：手机横持不应再旋转',
  );

  const probe = document.createElement('div');
  probe.className = 'isForceLandscape';
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:400px;height:200px;transform-origin:top left;transform:translate(200px,0) rotate(90deg)';
  document.body.appendChild(probe);
  const mapped = clientToHostLocal(probe, 150, 100);
  probe.remove();
  assert(Math.abs(mapped.x - 100) < 2 && Math.abs(mapped.y - 50) < 2, 'HUD：强制横屏应反解点按坐标');

  const plain = document.createElement('div');
  plain.style.cssText = 'position:fixed;left:40px;top:30px;width:100px;height:80px';
  document.body.appendChild(plain);
  const unrotated = clientToHostLocal(plain, 60, 50);
  plain.remove();
  assert(Math.abs(unrotated.x - 20) < 2 && Math.abs(unrotated.y - 20) < 2, 'HUD：未旋转时应按视口差值取本地坐标');

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
