import { createBallBody } from './ballBody';
import { createMatchHud, formatHudCount } from '../ui/matchHud';
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
    ...partial,
  };
}

/** 自身离场时场中大号回场倒计时；只本人、不改 5s/2s、Stall 优先。 */
export function verifyRespawnHud(): void {
  assert(formatHudCount(5) === '5', '回场倒计时：满 5s 应显示 5');
  assert(formatHudCount(4.2) === '5', '回场倒计时：4.2s 应 ceil 成 5');
  assert(formatHudCount(4) === '4', '回场倒计时：整 4s 应显示 4');
  assert(formatHudCount(0.2) === '1', '回场倒计时：不足 1s 应显示 1');

  const host = document.createElement('div');
  document.body.appendChild(host);
  const hud = createMatchHud(host);
  const opening = host.querySelector<HTMLElement>('.openingHud');
  const openingNum = host.querySelector<HTMLElement>('.openingHudNum');
  const openingHint = host.querySelector<HTMLElement>('.openingHudHint');
  const toast = host.querySelector<HTMLElement>('.matchHudToast');
  if (!opening || !openingNum || !openingHint || !toast) {
    host.remove();
    throw new Error('回场倒计时：应有场中大号数字层');
  }
  assert(getComputedStyle(opening).pointerEvents === 'none', '回场倒计时：场中数字不应抢点击');

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
  assert(!opening.classList.contains('isOn'), '回场倒计时：自己在场不应出大号数字');
  assert(openingNum.textContent === '', '回场倒计时：自己在场数字应空');
  assert(toast.textContent === '', '回场倒计时：无人离场 toast 应空');

  ally.inPlay = false;
  foe.inPlay = false;
  hud.sync(
    dummySnap({
      respawns: { [ally.id]: 3.1, [foe.id]: 1.4 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(!opening.classList.contains('isOn'), '回场倒计时：仅队友/敌人离场不应出自己的大号数字');
  assert(toast.textContent.includes('红2回场') && toast.textContent.includes('蓝1回场'), '回场倒计时：他人离场仍走短 toast');
  assert(!toast.textContent.includes('红1回场'), '回场倒计时：自己在场 toast 不应写自己');

  self.inPlay = false;
  hud.sync(
    dummySnap({
      respawns: { [self.id]: 4.2, [ally.id]: 2.6 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn'), '回场倒计时：自己离场应出大号数字');
  assert(opening.dataset.kind === 'respawn', '回场倒计时：应标 respawn');
  assert(opening.classList.contains('isRespawn'), '回场倒计时：应加 isRespawn');
  assert(openingNum.textContent === '5', '回场倒计时：4.2s 应显示 5');
  assert(openingHint.textContent === '回场', '回场倒计时：提示应为回场');
  assert(toast.textContent.includes('红2回场') && !toast.textContent.includes('红1回场'), '回场倒计时：自己改走场中数字，toast 只留他人');

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
  assert(opening.classList.contains('isOn') && openingNum.textContent === '1', '回场倒计时：占点自己离场同样显示');
  assert(openingHint.textContent === '回场', '回场倒计时：占点提示仍为回场');

  hud.sync(
    dummySnap({
      phase: 'overtime',
      timeLeft: 12,
      respawns: { [self.id]: 2 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn') && openingNum.textContent === '2', '回场倒计时：加时自己离场仍显示');

  hud.sync(
    dummySnap({
      events: [{ kind: 'knockout', text: '红1击破蓝1' }],
      respawns: { [self.id]: 3.3, [ally.id]: 1.1 },
    }),
    [self, ally, foe],
    self.id,
  );
  assert(opening.classList.contains('isOn') && openingNum.textContent === '4', '回场倒计时：击破 toast 不应盖掉自己的大号数字');
  assert(toast.textContent === '红1击破蓝1', '回场倒计时：击破短 toast 仍可出');

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
  assert(opening.classList.contains('isOn'), '回场倒计时：Stall 大号倒计时应仍在');
  assert(opening.dataset.kind === 'stall', '回场倒计时：开局应标 stall');
  assert(!opening.classList.contains('isRespawn'), '回场倒计时：Stall 不应标回场');
  assert(openingNum.textContent === '5', '回场倒计时：Stall 秒数应仍显示');
  assert(openingHint.textContent?.includes('栏内待命'), '回场倒计时：Stall 提示不应被回场替换');

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
  assert(opening.dataset.kind === 'stall' && openingHint.textContent?.includes('栏内待命'), '回场倒计时：Stall 优先于自身回场');

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
  assert(!opening.classList.contains('isOn'), '回场倒计时：结算不应再出回场数字');
  assert(openingNum.textContent === '', '回场倒计时：结算数字应空');

  self.inPlay = true;
  hud.sync(dummySnap(), [self, ally, foe], self.id);
  assert(!opening.classList.contains('isOn'), '回场倒计时：回场后应收起');
  assert(!opening.classList.contains('isRespawn') && !opening.dataset.kind, '回场倒计时：回场后应清标记');

  host.remove();
}
