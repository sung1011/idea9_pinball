import type { MatchSnapshot } from '../core/matchSession';

export type ResultTechInfo = {
  practice?: boolean;
  granted?: boolean;
  amount?: number;
  balance?: number;
  note?: string;
};

export type ResultPanel = {
  sync: (snap: MatchSnapshot, tech?: ResultTechInfo | null) => void;
};

function formatElapsed(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function addScoreRow(host: HTMLElement, label: string, red: number, blue: number, strong = false): void {
  const row = document.createElement('div');
  row.className = strong ? 'resultPanelRow isTotal' : 'resultPanelRow';
  const name = document.createElement('span');
  name.className = 'resultPanelLabel';
  name.textContent = label;
  const redEl = document.createElement('span');
  redEl.className = 'resultPanelRed';
  redEl.textContent = String(red);
  const blueEl = document.createElement('span');
  blueEl.className = 'resultPanelBlue';
  blueEl.textContent = String(blue);
  row.append(name, redEl, blueEl);
  host.appendChild(row);
}

const SHARD_COUNT = 12;

function makeBurst(): HTMLDivElement {
  const burst = document.createElement('div');
  burst.className = 'resultPanelBurst';
  burst.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    const shard = document.createElement('span');
    shard.className = 'resultPanelShard';
    shard.dataset.i = String(i + 1);
    burst.appendChild(shard);
  }
  return burst;
}

/** 局结束弹出：胜/负、双方总分与分项、用时；再来一局走现有重开。视觉为羊皮纸木框 + 热闹金矛碎裂。 */
export function createResultPanel(host: HTMLElement, onRestart: () => void): ResultPanel {
  const overlay = document.createElement('div');
  overlay.className = 'resultOverlay';
  overlay.setAttribute('data-touch-control', '');

  const card = document.createElement('div');
  card.className = 'resultPanel';

  const burst = makeBurst();

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'resultPanelClose';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', '关闭结算');

  const title = document.createElement('h2');
  title.className = 'resultPanelTitle';
  const reason = document.createElement('p');
  reason.className = 'resultPanelReason';

  const scores = document.createElement('div');
  scores.className = 'resultPanelScores';

  const elapsed = document.createElement('p');
  elapsed.className = 'resultPanelTime';

  const techLine = document.createElement('p');
  techLine.className = 'resultPanelTech';

  const again = document.createElement('button');
  again.type = 'button';
  again.className = 'resultPanelAgain';
  again.textContent = '再来一局';

  card.append(burst, closeBtn, title, reason, scores, elapsed, techLine, again);
  overlay.appendChild(card);
  host.appendChild(overlay);

  let dismissed = false;
  let lastPhase: MatchSnapshot['phase'] | '' = '';

  const hide = (): void => {
    overlay.classList.remove('isOn');
  };

  const close = (): void => {
    dismissed = true;
    hide();
  };

  const restartBurst = (): void => {
    burst.classList.remove('isBurst');
    void burst.offsetWidth;
    burst.classList.add('isBurst');
  };

  const fill = (snap: MatchSnapshot): void => {
    const win = snap.winner === 'red';
    title.textContent = win ? '胜利' : '失败';
    title.classList.toggle('isWin', win);
    title.classList.toggle('isLose', !win);
    card.classList.toggle('isWin', win);
    card.classList.toggle('isLose', !win);
    const who = snap.winner === 'red' ? '红方胜' : snap.winner === 'blue' ? '蓝方胜' : '结束';
    reason.textContent = snap.finishReason ? `${who} · ${snap.finishReason}` : who;

    scores.replaceChildren();
    const head = document.createElement('div');
    head.className = 'resultPanelRow isHead';
    const headGap = document.createElement('span');
    const headRed = document.createElement('span');
    headRed.className = 'resultPanelRed';
    headRed.textContent = '红';
    const headBlue = document.createElement('span');
    headBlue.className = 'resultPanelBlue';
    headBlue.textContent = '蓝';
    head.append(headGap, headRed, headBlue);
    scores.appendChild(head);
    if (snap.mode === 'eightKill') {
      addScoreRow(scores, '击杀', snap.redKills, snap.blueKills, true);
    } else {
      addScoreRow(scores, '总分', snap.redScore, snap.blueScore, true);
      addScoreRow(scores, '击破', snap.redBreakScore, snap.blueBreakScore);
      addScoreRow(scores, '领地', snap.redHoldScore, snap.blueHoldScore);
      const redOther = snap.redScore - snap.redBreakScore - snap.redHoldScore;
      const blueOther = snap.blueScore - snap.blueBreakScore - snap.blueHoldScore;
      if (redOther !== 0 || blueOther !== 0) {
        addScoreRow(scores, '其他', redOther, blueOther);
      }
    }

    elapsed.textContent = `用时 ${formatElapsed(snap.elapsedSec)}`;
  };

  const fillTech = (snap: MatchSnapshot, tech: ResultTechInfo | null | undefined): void => {
    if (snap.practice || tech?.practice) {
      techLine.textContent = '练习不发科技点';
      return;
    }
    if (tech?.note) {
      const amount = tech.amount ?? 0;
      const balance = tech.balance;
      if (tech.granted && amount > 0 && balance != null) {
        techLine.textContent = `科技点 +${amount} · 余额 ${balance}`;
        return;
      }
      techLine.textContent = tech.note;
      return;
    }
    techLine.textContent = '';
  };

  closeBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    close();
  });
  again.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    onRestart();
  });
  overlay.addEventListener('pointerdown', (ev) => {
    if (ev.target === overlay) {
      ev.preventDefault();
      close();
    }
  });

  return {
    sync(snap, tech) {
      if (snap.phase !== 'result') {
        dismissed = false;
        lastPhase = snap.phase;
        hide();
        return;
      }
      if (lastPhase !== 'result') {
        dismissed = false;
      }
      lastPhase = 'result';
      if (dismissed) {
        hide();
        return;
      }
      const justOpened = !overlay.classList.contains('isOn');
      fill(snap);
      fillTech(snap, tech);
      overlay.classList.add('isOn');
      if (justOpened) {
        restartBurst();
      }
    },
  };
}
