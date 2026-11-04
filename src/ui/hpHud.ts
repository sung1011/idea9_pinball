import type { BallBody } from '../core/ballBody';
import type { CollisionHit, FacingZone } from '../core/collisionDamage';

const ZONE_LABEL: Record<FacingZone, string> = {
  front: '正面',
  side: '侧面',
  rear: '背面',
};

const MAX_HIT_LINES = 4;

export type HudStatus = {
  aimingSlot: number;
  skillCd: number;
  respawns?: Record<number, number>;
};

export type HpHud = {
  sync: (balls: BallBody[], status?: HudStatus) => void;
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
  const action = document.createElement('div');
  action.className = 'hpHudAction';
  action.textContent = '点地纠偏、无左摇杆 · 1–4 / QWE 同键瞄放';
  const fineTune = document.createElement('div');
  fineTune.className = 'hpHudFineTune';
  fineTune.textContent = '弱拧';
  const hintText = '碰撞：轻蹭只改方向；相对速度≥4 或主动撞窗才掉血';
  const log = document.createElement('div');
  log.className = 'hpHudLog';
  log.textContent = hintText;

  root.append(rows, action, fineTune, log);
  host.appendChild(root);

  const lines: string[] = [];

  const sync = (balls: BallBody[], status?: HudStatus): void => {
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
        if (!ball.inPlay) {
          const left = status?.respawns?.[ball.id] ?? 0;
          value.textContent = `回场 ${left.toFixed(1)}s`;
        } else {
          const ram = ball.activeRamRemain > 0 ? ` 撞窗${ball.activeRamRemain.toFixed(2)}s` : '';
          const tune = ball.fineTuneRemain > 0 ? ` 强拧${ball.fineTuneRemain.toFixed(2)}s` : '';
          const inv = ball.invincibleRemain > 0 ? ` 无敌${ball.invincibleRemain.toFixed(1)}s` : '';
          value.textContent = `${formatHp(ball.hp)}/${ball.maxHp}${inv}${ram}${tune}`;
        }
        row.classList.toggle('isOut', !ball.inPlay);

        row.append(name, track, value);
        return row;
      }),
    );

    const player = balls[0];
    const fine = player?.fineTuneRemain ?? 0;
    const parts: string[] = [];
    if (status && status.aimingSlot > 0) {
      parts.push(`瞄准技能${status.aimingSlot} · 再按同键或左键释放 · 右键/Esc/取消键取消`);
    }
    if (fine > 0) {
      parts.push(`强拧 ${fine.toFixed(2)}s`);
    } else if (status && status.skillCd > 0 && (!status.aimingSlot || status.aimingSlot === 0)) {
      parts.push(`技能CD ${status.skillCd.toFixed(2)}s`);
    }
    if (parts.length === 0) {
      parts.push('点地纠偏、无左摇杆 · 1–4 / QWE 同键瞄放');
    }
    action.textContent = parts.join(' · ');
    action.classList.toggle('isFineTune', fine > 0);
    action.classList.toggle('isAiming', !!status && status.aimingSlot > 0);
    fineTune.classList.toggle('isOn', fine > 0);
    fineTune.textContent = fine > 0 ? `强拧 ${fine.toFixed(2)}s` : '弱拧';
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
