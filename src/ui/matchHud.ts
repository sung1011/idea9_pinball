import type { MatchSnapshot } from '../core/matchSession';
import type { BallBody } from '../core/ballBody';

export type MatchHud = {
  sync: (snap: MatchSnapshot, balls: readonly BallBody[]) => void;
};

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

export function createMatchHud(host: HTMLElement): MatchHud {
  const root = document.createElement('div');
  root.className = 'matchHud';

  const score = document.createElement('div');
  score.className = 'matchHudScore';
  const red = document.createElement('span');
  red.className = 'matchHudRed';
  const clock = document.createElement('span');
  clock.className = 'matchHudClock';
  const blue = document.createElement('span');
  blue.className = 'matchHudBlue';
  score.append(red, clock, blue);

  const meta = document.createElement('div');
  meta.className = 'matchHudMeta';
  const hold = document.createElement('span');
  hold.className = 'matchHudHold';
  const respawn = document.createElement('span');
  respawn.className = 'matchHudRespawn';
  meta.append(hold, respawn);

  const toast = document.createElement('div');
  toast.className = 'matchHudToast';

  root.append(score, meta, toast);
  host.appendChild(root);

  return {
    sync(snap, balls) {
      red.textContent = String(snap.redScore);
      blue.textContent = String(snap.blueScore);
      clock.textContent = formatClock(snap);
      clock.classList.toggle('isOvertime', snap.phase === 'overtime');
      clock.classList.toggle('isResult', snap.phase === 'result');
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
    },
  };
}
