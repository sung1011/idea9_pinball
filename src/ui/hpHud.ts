import type { BallBody } from '../core/ballBody';
import type { CollisionHit } from '../core/collisionDamage';
import type { AimHint, SkillCds, WindupInfo } from '../core/skillCaster';
import { kitHudLine, skillShorts } from '../heroes/kitLabels';

const MAX_HIT_LINES = 4;

export type HudStatus = {
  aimingSlot: number;
  skillCds: SkillCds;
  windup?: WindupInfo | null;
  aimHint?: AimHint | null;
  respawns?: Record<number, number>;
  charging?: boolean;
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
  return `${hit.sourceLabel}→${hit.victimLabel} 枪尖 伤${dmg} 弹${kb}`;
}

/** 调试血条 / 碰撞日志。Layout B 默认不挂到战场，血量改画在骑士头顶。 */
export function createHpHud(host: HTMLElement): HpHud {
  const root = document.createElement('div');
  root.className = 'hpHud';

  const rows = document.createElement('div');
  rows.className = 'hpHudRows';
  const action = document.createElement('div');
  action.className = 'hpHudAction';
  action.textContent = kitHudLine('hook');
  const fineTune = document.createElement('div');
  fineTune.className = 'hpHudFineTune';
  fineTune.textContent = '弱拧';
  const hintText = '碰撞：枪尖戳中且相对速度≥4（撞窗 2.5）才掉血；身子蹭只弹开';
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
          const stun = ball.stunRemain > 0 ? ` 硬直${ball.stunRemain.toFixed(2)}s` : '';
          const heal = ball.healRemain > 0 ? ` 愈${ball.healRemain.toFixed(1)}s` : '';
          const shield = ball.shieldRemain > 0 ? ` 盾${ball.shieldRemain.toFixed(1)}s` : '';
          const armor = ball.armorRemain > 0 ? ` 甲${ball.armorRemain.toFixed(1)}s` : '';
          const thorn = ball.reflectRemain > 0 && ball.reflectArmed ? ` 刺${ball.reflectRemain.toFixed(1)}s` : '';
          const pin = ball.pinRemain > 0 ? ` 钉${ball.pinRemain.toFixed(2)}s` : '';
          const graze = ball.grazeRemain > 0 ? ` 掠${ball.grazeRemain.toFixed(1)}s` : '';
          const mark = ball.echoMarkRemain > 0 ? ` 印${ball.echoMarkRemain.toFixed(1)}s` : '';
          const phase = ball.phaseRemain > 0 ? ` 虚${ball.phaseRemain.toFixed(2)}s` : '';
          const charge = status?.charging ? ' 冲锋' : '';
          value.textContent = `${formatHp(ball.hp)}/${ball.maxHp}${charge}${inv}${ram}${tune}${stun}${heal}${shield}${armor}${thorn}${pin}${graze}${mark}${phase}`;
        }
        row.classList.toggle('isOut', !ball.inPlay);

        row.append(name, track, value);
        return row;
      }),
    );

    const player = balls[0];
    const hero = player?.hero ?? 'hook';
    const shorts = skillShorts(hero);
    const fine = player?.fineTuneRemain ?? 0;
    const parts: string[] = [];
    if (status?.charging) {
      parts.push('冲锋加速中 · 禁技能 · 几乎锁拧 · 全程无敌');
    }
    if (status && status.aimingSlot > 0) {
      const name = shorts[status.aimingSlot - 1] ?? `技能${status.aimingSlot}`;
      if (status.aimHint?.stage === 2 && status.aimingSlot === 1) {
        parts.push(`已锁敌 · 再点落点释放${name} · 右键/Esc/取消键取消`);
      } else {
        parts.push(`瞄准${name} · 再按同键或左键释放；触屏点空白也可释放 · 右键/Esc/取消键取消`);
      }
    }
    if (status?.windup) {
      const name = shorts[status.windup.slot - 1] ?? `技能${status.windup.slot}`;
      parts.push(`前摇 ${name} ${status.windup.remain.toFixed(2)}s`);
    }
    if (fine > 0) {
      parts.push(`强拧 ${fine.toFixed(2)}s`);
    }
    if (status) {
      const cds = status.skillCds
        .map((cd, i) => (cd > 0 ? `${shorts[i]}${cd.toFixed(1)}` : `${shorts[i]}就绪`))
        .join(' ');
      parts.push(cds);
    }
    if (parts.length === 0) {
      parts.push(kitHudLine(hero));
    }
    action.textContent = parts.join(' · ');
    action.classList.toggle('isFineTune', fine > 0);
    action.classList.toggle('isAiming', !!status && status.aimingSlot > 0);
    action.classList.toggle('isCharge', !!status?.charging);
    fineTune.classList.toggle('isOn', fine > 0);
    fineTune.textContent = status?.charging
      ? '冲锋'
      : fine > 0
        ? `强拧 ${fine.toFixed(2)}s`
        : '弱拧';
    fineTune.classList.toggle('isCharge', !!status?.charging);
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
