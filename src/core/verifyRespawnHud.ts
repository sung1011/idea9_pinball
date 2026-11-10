import { createBallBody } from './ballBody';
import { createMatchHud, formatHudCount, formatRespawnNeed } from '../ui/matchHud';
import type { MatchSnapshot } from './matchSession';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function dummySnap(partial: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: 'playing',
    timeLeft: 180,
    suddenDeath: false,
    redScore: 0,
    blueScore: 0,
    redBreakScore: 0,
    blueBreakScore: 0,
    redHoldScore: 0,
    blueHoldScore: 0,
    elapsedSec: 12,
    finishReason: '',
    midpoint: 'none',
    winner: null,
    events: [],
    respawns: {},
    stallsOn: false,
    stalls: [],
    openingChargeRemain: 0,
    skillsLocked: false,
    mode: 'eightKill',
    redKills: 0,
    blueKills: 0,
    potion: null,
    rift: null,
    matchId: '',
    practice: false,
    ...partial,
  };
}

function wantRespawnHudQa(): boolean {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).has('respawnHudQa');
}

/** 自身离场时屏幕中央偏上「复活还需 X 秒」；只本人、不改 5s/2s、Stall 优先。 */
export function verifyRespawnHud(): void {
  assert(formatHudCount(5) === '5', '复活倒计时：满 5s 应显示 5');
  assert(formatHudCount(4.2) === '5', '复活倒计时：4.2s 应 ceil 成 5');
  assert(formatHudCount(4) === '4', '复活倒计时：整 4s 应显示 4');
  assert(formatHudCount(0.2) === '1', '复活倒计时：不足 1s 应显示 1');
  assert(formatRespawnNeed(4.2) === '复活还需 5 秒', '复活倒计时：4.2s 完整句应为复活还需 5 秒');
  assert(formatRespawnNeed(0.8) === '复活还需 1 秒', '复活倒计时：0.8s 完整句应为复活还需 1 秒');
  assert(!formatRespawnNeed(3).includes('回场'), '复活倒计时：完整句不应写成回场');

  const host = document.createElement('div');
  document.body.appendChild(host);
  const hud = createMatchHud(host);
  const opening = host.querySelector<HTMLElement>('.openingHud');
  const openingNum = host.querySelector<HTMLElement>('.openingHudNum');
  const openingHint = host.querySelector<HTMLElement>('.openingHudHint');
  const toast = host.querySelector<HTMLElement>('.matchHudToast');
  if (!opening || !openingNum || !openingHint || !toast) {
    host.remove();
    throw new Error('复活倒计时：应有场中倒计时层');
  }
  assert(getComputedStyle(opening).pointerEvents === 'none', '复活倒计时：倒计时层不应抢点击');

  const self = createBallBody({
    x: 2,
    y: 4,
    color: 0xe24a4a,
    team: 'red',
    teamSlot: 1,
    label: '红1',
  });
  const ally = createBallBody({
    x: 2,
    y: 8,
    color: 0xc43d3d,
    team: 'red',
    teamSlot: 2,
    label: '红2',
  });
  const foe = createBallBody({
    x: 18,
    y: 4,
    color: 0x3d6ec4,
    team: 'blue',
    teamSlot: 1,
    label: '蓝1',
  });

  hud.sync(dummySnap(), [self, ally, foe], self.id);
  assert(!opening.classList.contains('isOn'), '复活倒计时：自己在场不应出倒计时');
  assert(openingNum.textContent === '', '复活倒计时：自己在场文案应空');
  assert(toast.textContent === '', '复活倒计时：无人离场 toast 应空');

  ally.inPlay = false;
  foe.inPlay = false;
  hud.sync(
    dummySnap({
      respawns: { [ally.id]: 3.1, [foe.id]: 1.4 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(!opening.classList.contains('isOn'), '复活倒计时：仅队友/敌人离场不应出自己的倒计时');
  assert(toast.textContent.includes('红2回场') && toast.textContent.includes('蓝1回场'), '复活倒计时：他人离场仍走短 toast');
  assert(!toast.textContent.includes('红1回场'), '复活倒计时：自己在场 toast 不应写自己');

  self.inPlay = false;
  hud.sync(
    dummySnap({
      respawns: { [self.id]: 4.2, [ally.id]: 2.6 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn'), '复活倒计时：自己离场应出倒计时');
  assert(opening.dataset.kind === 'respawn', '复活倒计时：应标 respawn');
  assert(opening.classList.contains('isRespawn'), '复活倒计时：应加 isRespawn');
  assert(openingNum.textContent === '复活还需 5 秒', '复活倒计时：4.2s 应显示复活还需 5 秒');
  assert(openingHint.textContent === '', '复活倒计时：不应再写回场');
  assert(!openingNum.textContent.includes('回场'), '复活倒计时：主文案不应写成回场');
  const respawnStyle = getComputedStyle(opening);
  assert(respawnStyle.pointerEvents === 'none', '复活倒计时：阵亡层仍不抢点击');
  assert(respawnStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || respawnStyle.backgroundColor === 'transparent', '复活倒计时：不应铺全屏遮罩');
  assert(toast.textContent.includes('红2回场') && !toast.textContent.includes('红1回场'), '复活倒计时：自己改走场中句，toast 只留他人');

  hud.sync(
    dummySnap({
      mode: 'controlPoint',
      redScore: 15,
      blueScore: 30,
      respawns: { [self.id]: 0.8 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn') && openingNum.textContent === '复活还需 1 秒', '复活倒计时：占点自己离场同样显示完整句');
  assert(openingHint.textContent === '', '复活倒计时：占点也不写回场');

  hud.sync(
    dummySnap({
      phase: 'overtime',
      timeLeft: 12,
      respawns: { [self.id]: 2 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn') && openingNum.textContent === '复活还需 2 秒', '复活倒计时：加时自己离场仍显示完整句');

  hud.sync(
    dummySnap({
      events: [{ kind: 'knockout', text: '红1击破蓝1' }],
      respawns: { [self.id]: 3.3, [ally.id]: 1.1 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn') && openingNum.textContent === '复活还需 4 秒', '复活倒计时：击破 toast 不应盖掉自己的倒计时');
  assert(toast.textContent === '红1击破蓝1', '复活倒计时：击破短 toast 仍可出');

  self.inPlay = true;
  hud.sync(
    dummySnap({
      phase: 'countdown',
      timeLeft: 5,
      stallsOn: true,
      skillsLocked: true,
      respawns: { [ally.id]: 4 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn'), '复活倒计时：Stall 大号倒计时应仍在');
  assert(opening.dataset.kind === 'stall', '复活倒计时：开局应标 stall');
  assert(!opening.classList.contains('isRespawn'), '复活倒计时：Stall 不应标复活');
  assert(openingNum.textContent === '5', '复活倒计时：Stall 秒数应仍显示');
  assert(openingHint.textContent?.includes('栏内待命'), '复活倒计时：Stall 提示不应被复活句替换');

  self.inPlay = false;
  hud.sync(
    dummySnap({
      phase: 'countdown',
      timeLeft: 3.2,
      stallsOn: true,
      respawns: { [self.id]: 4.9 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.dataset.kind === 'stall' && openingHint.textContent?.includes('栏内待命'), '复活倒计时：Stall 优先于自身复活');

  hud.sync(
    dummySnap({
      phase: 'result',
      winner: 'blue',
      finishReason: 'kills',
      respawns: { [self.id]: 4 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(!opening.classList.contains('isOn'), '复活倒计时：结算不应再出复活句');
  assert(openingNum.textContent === '', '复活倒计时：结算文案应空');

  self.inPlay = true;
  hud.sync(dummySnap(), [self, ally, foe], self.id);
  assert(!opening.classList.contains('isOn'), '复活倒计时：回场后应收起');
  assert(!opening.classList.contains('isRespawn') && !opening.dataset.kind, '复活倒计时：回场后应清标记');

  if (wantRespawnHudQa()) {
    self.inPlay = false;
    hud.sync(
      dummySnap({
        respawns: { [self.id]: 4.2 },
      }),
      [self, ally, foe],
      self.id,
    );
    const app = document.querySelector<HTMLElement>('#app');
    const root = host.querySelector<HTMLElement>('.matchHud');
    if (root) {
      root.style.display = 'none';
    }
    host.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:20';
    (app ?? document.body).appendChild(host);
    return;
  }

  host.remove();
}
