import type { BallBody } from '../core/ballBody';
import type { CollisionHit, FacingZone } from '../core/collisionDamage';

const ZONE_LABEL: Record<FacingZone, string> = {
  front: '正面',
  side: '侧面',
  rear: '背面',
};

const MAX_HIT_LINES = 4;

export type HpHud = {
  sync: (balls: BallBody[]) => void;
  pushHits: (hits: CollisionHit[]) => void;
  resetLog: () => void;
};

function formatHp(hp: number): string {
  return String(Math.max(0, Math.round(hp)));
}

function formatHit(hit: CollisionHit): string {
  const dmg = hit.damage.toFixed(1);
  const kb = hit.knockback.toFixed(2);
  return `${hit.sourceLabel}→${hit.victimLabel} ${ZONE_LABEL[hit.zone]}×${hit.coeff.toFixed(2)} 伤${dmg} 弹${kb}`;
}

export function createHpHud(host: HTMLElement): HpHud {
  const root = document.createElement('div');
  root.className = 'hpHud';

  const rows = document.createElement('div');
  rows.className = 'hpHudRows';
  const hintText = '碰撞：轻蹭只改方向；相对速度≥4 或主动撞窗才掉血';
  const log = document.createElement('div');
  log.className = 'hpHudLog';
  log.textContent = hintText;

  root.append(rows, log);
  host.appendChild(root);

  const lines: string[] = [];

  const sync = (balls: BallBody[]): void => {
    rows.replaceChildren(
      ...balls.map((ball) => {
        const row = document.createElement('div');
        row.className = 'hpHudRow';

        const name = document.createElement('span');
        name.className = 'hpHudName';
        name.style.color = `#${ball.color.toString(16).padStart(6, '0')}`;
        name.textContent = ball.label;

        const track = document.createElement('span');
        track.className = 'hpHudTrack';
        const fill = document.createElement('span');
        fill.className = 'hpHudFill';
        const ratio = ball.maxHp > 0 ? Math.max(0, Math.min(1, ball.hp / ball.maxHp)) : 0;
        fill.style.width = `${(ratio * 100).toFixed(1)}%`;
        fill.style.background = ratio > 0.5 ? '#3dcc6f' : ratio > 0.25 ? '#e0b43a' : '#e24a4a';
        track.appendChild(fill);

        const value = document.createElement('span');
        value.className = 'hpHudValue';
        const ram = ball.activeRamRemain > 0 ? ` 撞窗${ball.activeRamRemain.toFixed(2)}s` : '';
        value.textContent = `${formatHp(ball.hp)}/${ball.maxHp}${ram}`;

        row.append(name, track, value);
        return row;
      }),
    );
  };

  const pushHits = (hits: CollisionHit[]): void => {
    if (hits.length === 0) {
      return;
    }
    for (const hit of hits) {
      lines.unshift(formatHit(hit));
    }
    if (lines.length > MAX_HIT_LINES) {
      lines.length = MAX_HIT_LINES;
    }
    log.textContent = lines.join(' · ');
  };

  const resetLog = (): void => {
    lines.length = 0;
    log.textContent = hintText;
  };

  return { sync, pushHits, resetLog };
}
