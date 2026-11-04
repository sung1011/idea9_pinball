import type { MatchSnapshot } from '../core/matchSession';
import type { BallBody } from '../core/ballBody';
import {
  OPENING_CHARGE_RAMP_SEC,
  OPENING_CHARGE_SEC,
  OPENING_CHARGE_SPEED,
} from '../core/constants';
import { HERO_IDS, heroZh, isHeroId, type HeroId } from '../heroes/heroIds';

export type MatchHud = {
  sync: (snap: MatchSnapshot, balls: readonly BallBody[]) => void;
  setHero: (hero: HeroId) => void;
};

export type MatchHudOpts = {
  hero?: HeroId;
  onPickHero?: (hero: HeroId) => void;
};

function stopHudUi(ev: Event): void {
  ev.stopPropagation();
}

function formatClock(snap: MatchSnapshot): string {
  if (snap.phase === 'countdown') {
    return `开战 ${Math.max(1, Math.ceil(snap.timeLeft))}`;
  }
  if (snap.phase === 'result') {
    if (snap.winner === 'red') {
      return '红方胜';
    }
    if (snap.winner === 'blue') {
      return '蓝方胜';
    }
    return '结束';
  }
  if (snap.phase === 'overtime' && snap.suddenDeath) {
    return '加时 · 下次击破';
  }
  const total = Math.max(0, Math.ceil(snap.timeLeft));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const clock = `${m}:${s.toString().padStart(2, '0')}`;
  return snap.phase === 'overtime' ? `加时 ${clock}` : clock;
}

function holdText(hold: MatchSnapshot['midpoint']): string {
  if (hold === 'red') {
    return '领地 红';
  }
  if (hold === 'blue') {
    return '领地 蓝';
  }
  return '领地 争夺';
}

export function createMatchHud(host: HTMLElement, opts: MatchHudOpts = {}): MatchHud {
  const root = document.createElement('div');
  root.className = 'matchHud';

  const bar = document.createElement('div');
  bar.className = 'matchHudBar';

  const score = document.createElement('div');
  score.className = 'matchHudScore';
  const red = document.createElement('span');
  red.className = 'matchHudRed';
  const clock = document.createElement('span');
  clock.className = 'matchHudClock';
  const blue = document.createElement('span');
  blue.className = 'matchHudBlue';
  score.append(red, clock, blue);

  const pick = document.createElement('select');
  pick.className = 'matchHudHero';
  pick.setAttribute('data-touch-control', 'hero');
  pick.setAttribute('aria-label', '切换英雄');
  for (const id of HERO_IDS) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = heroZh(id);
    pick.appendChild(option);
  }
  pick.value = opts.hero ?? 'hook';
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'keydown', 'keyup'] as const) {
    pick.addEventListener(type, stopHudUi);
  }
  pick.addEventListener('change', (ev) => {
    ev.stopPropagation();
    if (!isHeroId(pick.value)) {
      pick.value = opts.hero ?? 'hook';
      return;
    }
    opts.onPickHero?.(pick.value);
  });
  bar.append(score, pick);

  const meta = document.createElement('div');
  meta.className = 'matchHudMeta';
  const hold = document.createElement('span');
  hold.className = 'matchHudHold';
  const respawn = document.createElement('span');
  respawn.className = 'matchHudRespawn';
  meta.append(hold, respawn);

  const toast = document.createElement('div');
  toast.className = 'matchHudToast';

  const opening = document.createElement('div');
  opening.className = 'openingHud';
  const openingNum = document.createElement('div');
  openingNum.className = 'openingHudNum';
  const openingTick = document.createElement('div');
  openingTick.className = 'openingHudTick';
  const openingHint = document.createElement('div');
  openingHint.className = 'openingHudHint';
  opening.append(openingNum, openingTick, openingHint);

  root.append(bar, meta, toast);
  host.append(root, opening);

  return {
    setHero(hero) {
      pick.value = hero;
    },
    sync(snap, balls) {
      red.textContent = String(snap.redScore);
      blue.textContent = String(snap.blueScore);
      const chargingClock = snap.openingChargeRemain > 0 && snap.phase !== 'countdown';
      clock.textContent = chargingClock
        ? `冲锋 ${snap.openingChargeRemain.toFixed(1)}s`
        : formatClock(snap);
      clock.classList.toggle('isOvertime', snap.phase === 'overtime');
      clock.classList.toggle('isResult', snap.phase === 'result');
      clock.classList.toggle('isCharge', chargingClock);
      hold.textContent = holdText(snap.midpoint);
      hold.dataset.hold = snap.midpoint;

      const waiting = balls
        .filter((ball) => !ball.inPlay)
        .map((ball) => {
          const left = snap.respawns[ball.id] ?? 0;
          return `${ball.label}回场 ${left.toFixed(1)}s`;
        });
      respawn.textContent = waiting.length > 0 ? waiting.join(' · ') : '';

      const tip = snap.events.find(
        (event) => event.kind === 'knockout' || event.kind === 'assist' || event.kind === 'phase',
      );
      toast.textContent = tip?.text ?? '';

      const counting = snap.phase === 'countdown';
      const charging = snap.openingChargeRemain > 0;
      opening.classList.toggle('isOn', counting || charging);
      opening.classList.toggle('isCharge', charging && !counting);
      if (counting) {
        openingNum.textContent = String(Math.max(1, Math.ceil(snap.timeLeft)));
        openingTick.textContent = '';
        openingHint.textContent = '栏内待命 · Esc / 点空白跳过';
      } else if (charging) {
        openingNum.textContent = '冲锋';
        openingTick.textContent = snap.openingChargeRemain.toFixed(1);
        const elapsed = OPENING_CHARGE_SEC - snap.openingChargeRemain;
        const ramping = elapsed < OPENING_CHARGE_RAMP_SEC;
        openingHint.textContent = ramping
          ? `加速中 → ${OPENING_CHARGE_SPEED} · 禁技能 · 无敌`
          : `峰值 ${OPENING_CHARGE_SPEED} · 禁技能 · 无敌`;
      } else {
        openingNum.textContent = '';
        openingTick.textContent = '';
        openingHint.textContent = '';
      }
    },
  };
}
