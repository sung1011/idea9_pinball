import { Container, Graphics } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { BALL_RADIUS, SPEED_CAP } from '../core/constants';

export type BallView = {
  root: Container;
  sync: (ball: BallBody) => void;
};

function drawArrow(g: Graphics, fx: number, fy: number, speed: number): void {
  const len = 0.26 + 0.34 * Math.min(1, speed / SPEED_CAP);
  const tipX = fx * len;
  const tipY = fy * len;
  const tailX = fx * 0.06;
  const tailY = fy * 0.06;
  g.moveTo(tailX, tailY);
  g.lineTo(tipX, tipY);
  g.stroke({ color: 0xffffff, width: 0.07, cap: 'round' });

  const px = -fy;
  const py = fx;
  const head = 0.16;
  const wing = 0.09;
  g.moveTo(tipX, tipY);
  g.lineTo(tipX - fx * head + px * wing, tipY - fy * head + py * wing);
  g.lineTo(tipX - fx * head - px * wing, tipY - fy * head - py * wing);
  g.closePath();
  g.fill({ color: 0xffffff });
}

/** 矛尖：指示 targetDir（点地 / 鼠标 / bot 目标）。 */
function drawTargetSpear(g: Graphics, tx: number, ty: number): void {
  const len = Math.hypot(tx, ty);
  if (len < 1e-6) {
    return;
  }
  const fx = tx / len;
  const fy = ty / len;
  const tipX = fx * 0.92;
  const tipY = fy * 0.92;
  g.moveTo(fx * 0.5, fy * 0.5);
  g.lineTo(tipX, tipY);
  g.stroke({ color: 0xffe08a, width: 0.06, cap: 'round' });

  const px = -fy;
  const py = fx;
  g.moveTo(tipX, tipY);
  g.lineTo(tipX - fx * 0.14 + px * 0.07, tipY - fy * 0.14 + py * 0.07);
  g.lineTo(tipX - fx * 0.14 - px * 0.07, tipY - fy * 0.14 - py * 0.07);
  g.closePath();
  g.fill({ color: 0xffe08a });
}

function drawHpBar(g: Graphics, hp: number, maxHp: number): void {
  const width = 0.92;
  const height = 0.1;
  const x = -width / 2;
  const y = -0.74;
  g.rect(x, y, width, height);
  g.fill({ color: 0x102020, alpha: 0.8 });
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  if (ratio <= 0) {
    return;
  }
  const color = ratio > 0.5 ? 0x3dcc6f : ratio > 0.25 ? 0xe0b43a : 0xe24a4a;
  g.rect(x, y, width * ratio, height);
  g.fill({ color });
}

export function createBallView(ball: BallBody): BallView {
  const root = new Container();
  const body = new Graphics();
  const hpBar = new Graphics();
  const arrow = new Graphics();
  const spear = new Graphics();
  root.addChild(body, hpBar, arrow, spear);

  const sync = (next: BallBody): void => {
    root.visible = next.inPlay;
    root.position.set(next.x, next.y);
    if (!next.inPlay) {
      return;
    }

    body.clear();
    body.circle(0, 0, BALL_RADIUS);
    body.fill({ color: next.color, alpha: next.invincibleRemain > 0 ? 0.72 : 1 });
    body.stroke({ color: 0xffffff, width: 0.045, alpha: 0.9 });
    if (next.invincibleRemain > 0) {
      const pulse = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(next.invincibleRemain * 10));
      body.circle(0, 0, BALL_RADIUS + 0.14);
      body.stroke({ color: 0xffffff, width: 0.07, alpha: pulse });
    }
    if (next.activeRamRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.08);
      body.stroke({ color: 0xffe08a, width: 0.055, alpha: 0.95 });
    }
    if (next.fineTuneRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.16);
      body.stroke({ color: 0x7ee8ff, width: 0.05, alpha: 0.9 });
    }

    hpBar.clear();
    drawHpBar(hpBar, next.hp, next.maxHp);

    const speed = Math.hypot(next.vx, next.vy);
    arrow.clear();
    drawArrow(arrow, next.facingX, next.facingY, speed);
    spear.clear();
    if (next.hasAim) {
      drawTargetSpear(spear, next.aimX, next.aimY);
    }
  };

  sync(ball);
  return { root, sync };
}
