import type { MatchSnapshot } from '../core/matchSession';
import type { BallBody } from '../core/ballBody';
import { HERO_IDS, heroZh, isHeroId, type HeroId } from '../heroes/heroIds';

export type MatchHud = {
  sync: (snap: MatchSnapshot, balls: readonly BallBody[]) => void;
  setHero: (hero: HeroId) => void;
  setAllyHero: (hero: HeroId) => void;
};

export type MatchHudOpts = {
  hero?: HeroId;
  allyHero?: HeroId;
  onPickHero?: (hero: HeroId) => void;
  onPickAllyHero?: (hero: HeroId) => void;
};

const HELMET_SVG =
  '<svg class="matchHudMarkSvg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3c-3.2 0-6 1.7-7.4 4.2L3 11.2c.8.4 1.4 1.1 1.7 2V16c0 1.4 1.1 2.6 2.5 2.8l1.3.2v1.5h2.2v-1.7h2.6V20.5h2.2v-1.5l1.3-.2c1.4-.2 2.5-1.4 2.5-2.8v-2.8c.3-.9.9-1.6 1.7-2l-1.6-4C18 4.7 15.2 3 12 3Zm0 2c2.3 0 4.3 1.1 5.5 2.8L18.4 10H5.6L6.5 7.8C7.7 6.1 9.7 5 12 5Zm-3.2 7.2a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm6.4 0a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Z"/></svg>';

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
    return '下次击破';
  }
  const total = Math.max(0, Math.ceil(snap.timeLeft));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const clock = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return snap.phase === 'overtime' ? `加时 ${clock}` : clock;
}

function makeSep(): HTMLSpanElement {
  const sep = document.createElement('span');
  sep.className = 'matchHudSep';
  sep.setAttribute('aria-hidden', 'true');
  return sep;
}

function makeScoreSide(team: 'red' | 'blue'): { root: HTMLSpanElement; value: HTMLSpanElement } {
  const root = document.createElement('span');
  root.className = `matchHudSide matchHud${team === 'red' ? 'Red' : 'Blue'}`;
  const mark = document.createElement('span');
  mark.className = 'matchHudMark';
  mark.innerHTML = HELMET_SVG;
  const value = document.createElement('span');
  value.className = 'matchHudScoreVal';
  value.textContent = '0';
  if (team === 'red') {
    root.append(mark, value);
  } else {
    root.append(value, mark);
  }
  return { root, value };
}

/** 顶中比分胶囊贴窗顶；我/队友下拉贴视窗左上，略 inset。 */
export function createMatchHud(host: HTMLElement, opts: MatchHudOpts = {}): MatchHud {
  const root = document.createElement('div');
  root.className = 'matchHud';

  const cluster = document.createElement('div');
  cluster.className = 'matchHudCluster';
  const red = makeScoreSide('red');
  const clock = document.createElement('div');
  clock.className = 'matchHudClock';
  const blue = makeScoreSide('blue');
  cluster.append(red.root, makeSep(), clock, makeSep(), blue.root);

  const makeHeroPick = (
    className: string,
    ariaLabel: string,
    initial: HeroId,
    onPick?: (hero: HeroId) => void,
  ): HTMLSelectElement => {
    const pick = document.createElement('select');
    pick.className = className;
    pick.setAttribute('data-touch-control', 'hero');
    pick.setAttribute('aria-label', ariaLabel);
    for (const id of HERO_IDS) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = heroZh(id);
      pick.appendChild(option);
    }
    pick.value = initial;
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'keydown', 'keyup'] as const) {
      pick.addEventListener(type, stopHudUi);
    }
    pick.addEventListener('change', (ev) => {
      ev.stopPropagation();
      if (!isHeroId(pick.value)) {
        pick.value = initial;
        return;
      }
      onPick?.(pick.value);
    });
    return pick;
  };

  const makeHeroWrap = (tag: string, pick: HTMLSelectElement): HTMLLabelElement => {
    const wrap = document.createElement('label');
    wrap.className = 'matchHudHeroWrap';
    wrap.dataset.team = 'red';
    const stripe = document.createElement('span');
    stripe.className = 'matchHudHeroStripe';
    stripe.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'matchHudHeroTag';
    name.textContent = tag;
    wrap.append(stripe, name, pick);
    return wrap;
  };

  const pick = makeHeroPick('matchHudHero', '切换自己英雄', opts.hero ?? 'hook', opts.onPickHero);
  const allyPick = makeHeroPick(
    'matchHudHero matchHudAllyHero',
    '切换队友英雄',
    opts.allyHero ?? 'chain',
    opts.onPickAllyHero,
  );
  const heroRow = document.createElement('div');
  heroRow.className = 'matchHudHeroRow';
  heroRow.dataset.hud = 'heroPicks';
  heroRow.append(makeHeroWrap('我', pick), makeHeroWrap('队友', allyPick));

  const toast = document.createElement('div');
  toast.className = 'matchHudToast';

  const opening = document.createElement('div');
  opening.className = 'openingHud';
  const openingNum = document.createElement('div');
  openingNum.className = 'openingHudNum';
  const openingHint = document.createElement('div');
  openingHint.className = 'openingHudHint';
  opening.append(openingNum, openingHint);

  root.append(cluster, heroRow, toast);
  host.append(root, opening);

  return {
    setHero(hero) {
      pick.value = hero;
    },
    setAllyHero(hero) {
      allyPick.value = hero;
    },
    sync(snap, balls) {
      red.value.textContent = String(snap.redScore);
      blue.value.textContent = String(snap.blueScore);
      clock.textContent = formatClock(snap);
      clock.classList.toggle('isOvertime', snap.phase === 'overtime');
      clock.classList.toggle('isResult', snap.phase === 'result');
      cluster.dataset.hold = snap.midpoint;

      const waiting = balls
        .filter((ball) => !ball.inPlay)
        .map((ball) => {
          const left = snap.respawns[ball.id] ?? 0;
          return `${ball.label}回场 ${left.toFixed(1)}s`;
        });
      const charging = snap.openingChargeRemain > 0;
      const tip = snap.events.find(
        (event) =>
          event.kind === 'knockout' ||
          event.kind === 'assist' ||
          (event.kind === 'phase' && !charging),
      );
      toast.textContent = tip?.text ?? (waiting.length > 0 ? waiting.join(' · ') : '');

      const counting = snap.phase === 'countdown';
      opening.classList.toggle('isOn', counting);
      if (counting) {
        openingNum.textContent = String(Math.max(1, Math.ceil(snap.timeLeft)));
        openingHint.textContent = '栏内待命 · Esc / 点空白跳过';
      } else {
        openingNum.textContent = '';
        openingHint.textContent = '';
      }
    },
  };
}
