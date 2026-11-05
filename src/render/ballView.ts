import { Container, Graphics, Text } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { spearCdFill } from '../core/collisionDamage';
import { SPEAR_TIP_DIST } from '../core/constants';

export type BallViewSyncOpts = {
  charging?: boolean;
};

export type BallView = {
  root: Container;
  sync: (ball: BallBody, opts?: BallViewSyncOpts) => void;
};

/** 马棕 / 高光 / 阴影。队色不涂满马身。 */
const HORSE_FILL = 0x8b6914;
const HORSE_HIGH = 0xb8892a;
const HORSE_SHADOW = 0x5c4510;
/** 冲锋残影：降饱和马棕，不金闪。 */
const HORSE_TRAIL = 0x76622f;
const TEAM_RED = 0xc43c3c;
const TEAM_BLUE = 0x3a6fbf;
const SPEAR_GOLD = 0xd4a017;
const SHIELD_FILL = 0xfff8e7;
const INK = 0x3a2e24;
const ARMOR = 0x4a3a2c;
const HELMET = 0xc4b08a;

/**
 * 胖椭圆半轴（格）。长/短 = 1.5；中心对齐物理圆心。
 * 只改外观，不改 BALL_RADIUS。
 */
const HORSE_RY = 0.48;
const HORSE_RX = HORSE_RY * 1.55;
/** 骑士坐于长轴约 55% 偏后（0=鼻、1=尾）。 */
const RIDER_T = 0.55;
const RIDER_ALONG = HORSE_RX * (1 - 2 * RIDER_T);
/** 侧小圆盾直径 ≈ 马短轴 42%。 */
const SHIELD_R = HORSE_RY * 2 * 0.42 * 0.5;
const SHIELD_SIDE = HORSE_RY * 0.58;

const SLOT_FONT = 72;
const SLOT_SCALE = 0.0038;

const HP_BAR_WIDTH = 0.92;
const HP_BAR_HEIGHT = 0.1;
const HP_BAR_Y = -0.92;
const SPEAR_CD_HEIGHT = 0.042;
const SPEAR_CD_GAP = 0.016;
const SPEAR_CD_TRACK = 0x1a1410;
const SPEAR_CD_FILL = 0xe8d8b8;

const TRAIL_MAX = 5;
const TRAIL_SPACING = 0.34;
const ELLIPSE_STEPS = 28;

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    return { x: 1, y: 0 };
  }
  return { x: x / len, y: y / len };
}

function alongSide(along: number, side: number, fx: number, fy: number): { x: number; y: number } {
  return { x: along * fx - side * fy, y: along * fy + side * fx };
}

function drapeColor(ball: BallBody): number {
  return ball.team === 'blue' ? TEAM_BLUE : TEAM_RED;
}

function bodyAlpha(ball: BallBody): number {
  return ball.invincibleRemain > 0 || ball.phaseRemain > 0 ? 0.72 : 1;
}

function drawOrientedEllipse(
  g: Graphics,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fx: number,
  fy: number,
): void {
  const px = -fy;
  const py = fx;
  for (let i = 0; i <= ELLIPSE_STEPS; i += 1) {
    const t = (i / ELLIPSE_STEPS) * Math.PI * 2;
    const x = cx + Math.cos(t) * rx * fx + Math.sin(t) * ry * px;
    const y = cy + Math.cos(t) * rx * fy + Math.sin(t) * ry * py;
    if (i === 0) {
      g.moveTo(x, y);
    } else {
      g.lineTo(x, y);
    }
  }
  g.closePath();
}

function slotDigits(slot: number): string {
  return String(Math.max(1, Math.floor(slot)));
}

function makeSlotLabel(slot: number): Text {
  const label = new Text({
    text: slotDigits(slot),
    style: {
      fontFamily: 'ui-rounded, ui-sans-serif, system-ui, sans-serif',
      fontSize: SLOT_FONT,
      fontWeight: '800',
      fill: INK,
      stroke: { color: SHIELD_FILL, width: 5, join: 'round' },
      align: 'center',
    },
  });
  label.anchor.set(0.5, 0.52);
  label.eventMode = 'none';
  return label;
}

function shieldPos(fx: number, fy: number): { x: number; y: number } {
  return alongSide(RIDER_ALONG + 0.02, SHIELD_SIDE, fx, fy);
}

function syncSlotLabel(label: Text, ball: BallBody, fx: number, fy: number): void {
  const digits = slotDigits(ball.teamSlot);
  if (label.text !== digits) {
    label.text = digits;
  }
  const pos = shieldPos(fx, fy);
  label.position.set(pos.x, pos.y);
  label.scale.set(digits.length > 1 ? SLOT_SCALE * 0.72 : SLOT_SCALE);
  label.alpha = bodyAlpha(ball);
  label.visible = ball.inPlay;
}

/** 马身椭圆：阴影 → 填色 → 高光；前侧小耳。 */
function drawHorseBody(g: Graphics, fx: number, fy: number, alpha: number): void {
  const shadow = alongSide(-0.04, 0.03, fx, fy);
  drawOrientedEllipse(g, shadow.x, shadow.y, HORSE_RX * 1.02, HORSE_RY * 1.04, fx, fy);
  g.fill({ color: HORSE_SHADOW, alpha: alpha * 0.9 });

  drawOrientedEllipse(g, 0, 0, HORSE_RX, HORSE_RY, fx, fy);
  g.fill({ color: HORSE_FILL, alpha });
  g.stroke({ color: HORSE_SHADOW, width: 0.035, alpha: alpha * 0.95 });

  const hi = alongSide(0.12, -0.1, fx, fy);
  drawOrientedEllipse(g, hi.x, hi.y, HORSE_RX * 0.55, HORSE_RY * 0.42, fx, fy);
  g.fill({ color: HORSE_HIGH, alpha: alpha * 0.38 });

  for (const side of [-1, 1] as const) {
    const ear = alongSide(HORSE_RX * 0.78, side * HORSE_RY * 0.38, fx, fy);
    drawOrientedEllipse(g, ear.x, ear.y, 0.07, 0.045, fx, fy);
    g.fill({ color: HORSE_SHADOW, alpha: alpha * 0.95 });
  }
}

/** 鞍褥 + 队色短披条，不涂满马身。 */
function drawSaddleDrape(g: Graphics, fx: number, fy: number, team: number, alpha: number): void {
  const cloth = alongSide(RIDER_ALONG + 0.02, 0, fx, fy);
  drawOrientedEllipse(g, cloth.x, cloth.y, 0.11, HORSE_RY * 0.92, fx, fy);
  g.fill({ color: team, alpha: alpha * 0.95 });

  const cape = alongSide(RIDER_ALONG - HORSE_RX * 0.22, 0, fx, fy);
  drawOrientedEllipse(g, cape.x, cape.y, 0.16, HORSE_RY * 0.42, fx, fy);
  g.fill({ color: team, alpha: alpha * 0.88 });

  const seat = alongSide(RIDER_ALONG, 0, fx, fy);
  drawOrientedEllipse(g, seat.x, seat.y, 0.08, HORSE_RY * 0.4, fx, fy);
  g.fill({ color: HORSE_SHADOW, alpha: alpha * 0.7 });
}

/** 小 Q 骑士躯干，坐于鞍上。 */
function drawRider(g: Graphics, fx: number, fy: number, alpha: number): void {
  const body = alongSide(RIDER_ALONG, 0, fx, fy);
  drawOrientedEllipse(g, body.x, body.y, 0.13, 0.11, fx, fy);
  g.fill({ color: ARMOR, alpha });
  g.stroke({ color: 0x2a2218, width: 0.025, alpha: alpha * 0.9 });

  const head = alongSide(RIDER_ALONG + 0.07, 0, fx, fy);
  g.circle(head.x, head.y, 0.095);
  g.fill({ color: HELMET, alpha });
  g.stroke({ color: 0x2a2218, width: 0.022, alpha: alpha * 0.9 });

  const visor = alongSide(RIDER_ALONG + 0.11, 0, fx, fy);
  drawOrientedEllipse(g, visor.x, visor.y, 0.03, 0.055, fx, fy);
  g.fill({ color: 0x2a2218, alpha: alpha * 0.85 });
}

function drawSideShield(g: Graphics, fx: number, fy: number, alpha: number): void {
  const pos = shieldPos(fx, fy);
  g.circle(pos.x, pos.y, SHIELD_R);
  g.fill({ color: SHIELD_FILL, alpha });
  g.stroke({ color: INK, width: 0.03, alpha: alpha * 0.95 });
}

/** 矛尖跟 aim（否则 facing）；尖距对齐 SPEAR_TIP_DIST。 */
function drawTargetSpear(g: Graphics, fx: number, fy: number): void {
  const px = -fy;
  const py = fx;
  const rootX = fx * 0.48;
  const rootY = fy * 0.48;
  const guardX = fx * 0.78;
  const guardY = fy * 0.78;
  const tipX = fx * SPEAR_TIP_DIST;
  const tipY = fy * SPEAR_TIP_DIST;

  g.moveTo(rootX, rootY);
  g.lineTo(guardX, guardY);
  g.stroke({ color: SPEAR_GOLD, width: 0.055, cap: 'round' });

  g.moveTo(guardX + px * 0.09, guardY + py * 0.09);
  g.lineTo(guardX - px * 0.09, guardY - py * 0.09);
  g.stroke({ color: SPEAR_GOLD, width: 0.04, cap: 'round' });

  g.moveTo(tipX, tipY);
  g.lineTo(tipX - fx * 0.16 + px * 0.07, tipY - fy * 0.16 + py * 0.07);
  g.lineTo(tipX - fx * 0.16 - px * 0.07, tipY - fy * 0.16 - py * 0.07);
  g.closePath();
  g.fill({ color: SPEAR_GOLD });
}

/** 马尾：主用尾，不画旧羽冠。 */
function drawHorseTail(g: Graphics, fx: number, fy: number, alpha: number): void {
  const px = -fy;
  const py = fx;
  const base = alongSide(-HORSE_RX * 0.92, 0, fx, fy);
  const len = 0.38;
  const lift = 0.035;
  const tipX = base.x - fx * len;
  const tipY = base.y - fy * len - lift;
  const midW = 0.15;
  const baseW = 0.055;
  const midX = base.x - fx * len * 0.46;
  const midY = base.y - fy * len * 0.46 - lift * 0.45;

  g.moveTo(base.x + px * baseW, base.y + py * baseW);
  g.quadraticCurveTo(midX + px * midW, midY + py * midW, tipX, tipY);
  g.quadraticCurveTo(midX - px * midW, midY - py * midW, base.x - px * baseW, base.y - py * baseW);
  g.closePath();
  g.fill({ color: HORSE_SHADOW, alpha: alpha * 0.96 });

  const hiX = base.x - fx * len * 0.55 + px * 0.03;
  const hiY = base.y - fy * len * 0.55 - lift * 0.6;
  g.moveTo(base.x + px * 0.02, base.y + py * 0.02);
  g.quadraticCurveTo(hiX, hiY, tipX + fx * 0.04, tipY + fy * 0.04);
  g.stroke({ color: HORSE_HIGH, width: 0.035, alpha: alpha * 0.45, cap: 'round' });
}

function drawHpBar(g: Graphics, hp: number, maxHp: number, spearCdRemain: number): void {
  const x = -HP_BAR_WIDTH / 2;
  g.rect(x, HP_BAR_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT);
  g.fill({ color: 0x102020, alpha: 0.8 });
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  if (ratio > 0) {
    const color = ratio > 0.5 ? 0x3dcc6f : ratio > 0.25 ? 0xe0b43a : 0xe24a4a;
    g.rect(x, HP_BAR_Y, HP_BAR_WIDTH * ratio, HP_BAR_HEIGHT);
    g.fill({ color });
  }

  const cdY = HP_BAR_Y + HP_BAR_HEIGHT + SPEAR_CD_GAP;
  const fill = spearCdFill(spearCdRemain);
  g.rect(x, cdY, HP_BAR_WIDTH, SPEAR_CD_HEIGHT);
  g.fill({ color: SPEAR_CD_TRACK, alpha: 0.82 });
  if (fill > 0) {
    g.rect(x, cdY, HP_BAR_WIDTH * fill, SPEAR_CD_HEIGHT);
    g.fill({ color: SPEAR_CD_FILL, alpha: 0.92 });
  }
}

function strokeHorseRing(
  g: Graphics,
  pad: number,
  fx: number,
  fy: number,
  color: number,
  width: number,
  alpha: number,
): void {
  drawOrientedEllipse(g, 0, 0, HORSE_RX + pad, HORSE_RY + pad, fx, fy);
  g.stroke({ color, width, alpha });
}

function drawStatusRings(g: Graphics, next: BallBody, fx: number, fy: number): void {
  if (next.invincibleRemain > 0) {
    const pulse = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(next.invincibleRemain * 10));
    strokeHorseRing(g, 0.14, fx, fy, 0xffffff, 0.07, pulse);
  }
  if (next.activeRamRemain > 0) {
    strokeHorseRing(g, 0.08, fx, fy, SPEAR_GOLD, 0.055, 0.95);
  }
  if (next.fineTuneRemain > 0) {
    strokeHorseRing(g, 0.16, fx, fy, 0x7ee8ff, 0.05, 0.9);
  }
  if (next.fieldRemain > 0) {
    strokeHorseRing(g, 0.22, fx, fy, 0x5eead4, 0.055, 0.88);
  }
  if (next.healRemain > 0) {
    strokeHorseRing(g, 0.2, fx, fy, 0x86efac, 0.05, 0.9);
  }
  if (next.shieldRemain > 0) {
    strokeHorseRing(g, 0.26, fx, fy, 0xfde68a, 0.06, 0.92);
  }
  if (next.armorRemain > 0) {
    strokeHorseRing(g, 0.28, fx, fy, 0xf4bf6a, 0.07, next.armorBroken ? 0.45 : 0.95);
  }
  if (next.reflectRemain > 0 && next.reflectArmed) {
    strokeHorseRing(g, 0.18, fx, fy, 0xfb7185, 0.055, 0.92);
  }
  if (next.pinRemain > 0) {
    strokeHorseRing(g, 0.12, fx, fy, 0xf59e0b, 0.07, 0.95);
  }
  if (next.grazeRemain > 0) {
    strokeHorseRing(g, 0.2, fx, fy, 0x7dd3fc, 0.05, 0.9);
  }
  if (next.echoMarkRemain > 0) {
    strokeHorseRing(g, 0.24, fx, fy, 0xf0abfc, 0.06, 0.92);
  }
  if (next.phaseRemain > 0) {
    strokeHorseRing(g, 0.16, fx, fy, 0xe0f2fe, 0.05, 0.7);
  }
  if (next.refractRemain > 0) {
    strokeHorseRing(g, 0.3, fx, fy, 0xa5d8ff, 0.06, 0.92);
  }
}

/** 冲锋残影：同朝向胖椭圆马身 + 淡披条。禁止旧圆盾/圆球影与金尘。 */
function drawChargeFx(
  g: Graphics,
  next: BallBody,
  trail: readonly { x: number; y: number }[],
  fx: number,
  fy: number,
): void {
  const px = -fy;
  const py = fx;
  for (let i = 1; i <= 4; i += 1) {
    const start = 0.22 + i * 0.14;
    const end = start + 0.3;
    const sway = i % 2 === 0 ? 0.06 : -0.06;
    g.moveTo(-fx * start + px * sway, -fy * start + py * sway);
    g.lineTo(-fx * end + px * sway * 1.1, -fy * end + py * sway * 1.1);
    g.stroke({
      color: HORSE_TRAIL,
      width: 0.085 - i * 0.01,
      alpha: 0.3 * (1 - i / 5),
      cap: 'round',
    });
  }

  const drape = drapeColor(next);
  for (let i = 1; i < trail.length; i += 1) {
    const fade = 1 - i / TRAIL_MAX;
    const scale = 0.9 - i * 0.045;
    const ox = trail[i].x - next.x;
    const oy = trail[i].y - next.y;
    drawOrientedEllipse(g, ox, oy, HORSE_RX * scale, HORSE_RY * scale, fx, fy);
    g.fill({ color: HORSE_TRAIL, alpha: 0.34 * fade });
    const cloth = alongSide(RIDER_ALONG * scale, 0, fx, fy);
    drawOrientedEllipse(
      g,
      ox + cloth.x,
      oy + cloth.y,
      0.09 * scale,
      HORSE_RY * 0.82 * scale,
      fx,
      fy,
    );
    g.fill({ color: drape, alpha: 0.16 * fade });
  }
}

export function createBallView(ball: BallBody): BallView {
  const root = new Container();
  const fx = new Graphics();
  const body = new Graphics();
  const slotLabel = makeSlotLabel(ball.teamSlot);
  const spear = new Graphics();
  const hpBar = new Graphics();
  root.addChild(fx, body, slotLabel, spear, hpBar);
  const trail: Array<{ x: number; y: number }> = [];

  const sync = (next: BallBody, opts: BallViewSyncOpts = {}): void => {
    root.visible = next.inPlay;
    root.position.set(next.x, next.y);
    if (!next.inPlay) {
      trail.length = 0;
      fx.clear();
      slotLabel.visible = false;
      return;
    }

    if (opts.charging) {
      const last = trail[0];
      if (!last || Math.hypot(next.x - last.x, next.y - last.y) >= TRAIL_SPACING) {
        trail.unshift({ x: next.x, y: next.y });
        if (trail.length > TRAIL_MAX) {
          trail.length = TRAIL_MAX;
        }
      }
    } else {
      trail.length = 0;
    }

    const dir = next.hasAim ? unit(next.aimX, next.aimY) : unit(next.facingX, next.facingY);
    const alpha = bodyAlpha(next);

    fx.clear();
    if (opts.charging) {
      drawChargeFx(fx, next, trail, dir.x, dir.y);
    }

    body.clear();
    drawHorseBody(body, dir.x, dir.y, alpha);
    drawSaddleDrape(body, dir.x, dir.y, drapeColor(next), alpha);
    drawRider(body, dir.x, dir.y, alpha);
    drawSideShield(body, dir.x, dir.y, alpha);
    drawStatusRings(body, next, dir.x, dir.y);
    syncSlotLabel(slotLabel, next, dir.x, dir.y);

    spear.clear();
    drawTargetSpear(spear, dir.x, dir.y);
    drawHorseTail(spear, dir.x, dir.y, alpha);

    hpBar.clear();
    drawHpBar(hpBar, next.hp, next.maxHp, next.spearCdRemain);
  };

  sync(ball);
  return { root, sync };
}
