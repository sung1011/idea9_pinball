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
  root.addChild(body, hpBar, arrow);

  const sync = (next: BallBody): void => {
    root.position.set(next.x, next.y);

    body.clear();
    body.circle(0, 0, BALL_RADIUS);
    body.fill({ color: next.color });
    body.stroke({ color: 0xffffff, width: 0.045, alpha: 0.9 });
    if (next.activeRamRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.08);
      body.stroke({ color: 0xffe08a, width: 0.055, alpha: 0.95 });
    }

    hpBar.clear();
    drawHpBar(hpBar, next.hp, next.maxHp);

    const speed = Math.hypot(next.vx, next.vy);
    arrow.clear();
    drawArrow(arrow, next.facingX, next.facingY, speed);
  };

  sync(ball);
  return { root, sync };
}
