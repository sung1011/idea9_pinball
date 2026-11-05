import { createMatchHud } from '../ui/matchHud';
import {
  clientToHostLocal,
  computeLandscapeStage,
  isPortraitViewport,
  remapInsetsForLandscapeFlip,
  shouldFlipLandscape,
  wantsLandscapeFlip,
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

/** Layout B：横构图舞台、竖窗 letterbox、仅横屏翻转扶正；顶中红|计时|蓝一颗胶囊。 */
export function verifyHudLayout(): void {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assert(landscape.width > landscape.height, 'HUD：横屏舞台应为横构图');
  assert(Math.abs(landscape.width / landscape.height - 20 / 12) < 1e-6, 'HUD：舞台比例应为 20×12');

  const portrait = computeLandscapeStage(800, 1200, none);
  assert(portrait.width > portrait.height, 'HUD：竖窗仍保持横构图');
  assert(portrait.x + portrait.width <= 800 + 1e-6, 'HUD：竖窗舞台不应超出宽度');
  assert(portrait.y > 10, 'HUD：竖窗应上下留 letterbox');

  const phonePortrait = computeLandscapeStage(375, 667, none);
  assert(phonePortrait.width > phonePortrait.height, 'HUD：竖持仍按横构图 letterbox，不互换宽高');
  assert(phonePortrait.y > 10, 'HUD：竖持应上下留黑边');

  const notch = computeLandscapeStage(1600, 900, { top: 0, right: 44, bottom: 0, left: 44 });
  assert(notch.x >= 44, 'HUD：舞台应避开左侧安全区');
  assert(notch.x + notch.width <= 1600 - 44 + 1e-6, 'HUD：舞台应避开右侧安全区');

  const remapped = remapInsetsForLandscapeFlip({ top: 10, right: 1, bottom: 20, left: 2 });
  assert(
    remapped.top === 20 && remapped.right === 2 && remapped.bottom === 10 && remapped.left === 1,
    'HUD：横屏翻转应上下、左右对调安全区',
  );

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');
  assert(!wantsLandscapeFlip(1600, 900), 'HUD：普通横屏窗口不应翻转');
  assert(
    !shouldFlipLandscape({
      viewW: 375,
      viewH: 667,
      orientationType: 'portrait-primary',
      orientationAngle: 0,
    }),
    'HUD：竖持不应再转画面',
  );
  assert(
    !shouldFlipLandscape({
      viewW: 800,
      viewH: 1200,
      orientationType: 'landscape-secondary',
      orientationAngle: 180,
    }),
    'HUD：PC 窄窗即使 secondary 也不因竖去转',
  );
  assert(
    !shouldFlipLandscape({
      viewW: 667,
      viewH: 375,
      orientationType: 'landscape-primary',
      orientationAngle: 0,
    }),
    'HUD：横持 primary / 0° 不应翻转',
  );
  assert(
    shouldFlipLandscape({
      viewW: 667,
      viewH: 375,
      orientationType: 'landscape-secondary',
      orientationAngle: 270,
    }),
    'HUD：横持 secondary 应扶正',
  );
  assert(
    shouldFlipLandscape({
      viewW: 667,
      viewH: 375,
      orientationAngle: 180,
    }),
    'HUD：横持 angle ≈ 180 应扶正',
  );
  assert(
    !shouldFlipLandscape({
      viewW: 667,
      viewH: 375,
      orientationType: 'portrait-secondary',
      orientationAngle: 180,
    }),
    'HUD：orientation 仍标竖屏时不翻转',
  );

  const probe = document.createElement('div');
  probe.className = 'isLandscapeFlip';
  probe.style.cssText =
    'position:fixed;left:0;top:0;width:400px;height:200px;transform-origin:top left;transform:translate(400px,200px) rotate(180deg)';
  document.body.appendChild(probe);
  const mapped = clientToHostLocal(probe, 150, 100);
  const child = document.createElement('div');
  child.style.cssText = 'position:absolute;inset:0';
  probe.appendChild(child);
  const mappedChild = clientToHostLocal(child, 150, 100);
  probe.remove();
  assert(Math.abs(mapped.x - 250) < 2 && Math.abs(mapped.y - 100) < 2, 'HUD：横屏翻转应反解点按坐标');
  assert(
    Math.abs(mappedChild.x - 250) < 2 && Math.abs(mappedChild.y - 100) < 2,
    'HUD：翻转后子层（技能 tip）坐标应与画面一致',
  );

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
