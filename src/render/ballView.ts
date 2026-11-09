import { Container, Graphics, Text } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { spearCdFill } from '../core/collisionDamage';
import { BALL_RADIUS, SPEAR_TIP_DIST } from '../core/constants';

export type BallViewSyncOpts = {
  charging?: boolean;
  /** 仅本地玩家脚下双环；队友/敌方不要传 true */
  selfMark?: boolean;
};

export type BallView = {
  root: Container;
  sync: (ball: BallBody, opts?: BallViewSyncOpts) => void;
};

const SPEAR_GOLD = 0xffe08a;
const SHIELD_RIM = 0xf4f0e4;
/** 本人脚下双环：奶黄环 + 深棕细描边。外环约盾径 1.3 倍，略大于主体、不放大碰撞。 */
export const SELF_MARK = {
  innerRadius: BALL_RADIUS * 1.16,
  outerRadius: BALL_RADIUS * 1.3,
  milk: 0xf6e7a3,
  brown: 0x3a2210,
  band: 0.045 * (BALL_RADIUS / 0.5),
  outline: 0.016 * (BALL_RADIUS / 0.5),
} as const;

export function selfMarkActive(isSelf: boolean, inPlay: boolean): boolean {
  return isSelf && inPlay;
}

const SLOT_FILL = 0xf8f4ea;
const SLOT_STROKE = 0x1a1410;
const SLOT_FONT = 72;
const SLOT_SCALE = 0.009;
/** 骑士皮世界尺寸相对初版半径 0.5 的倍率，与碰撞圆同步 */
const SKIN = BALL_RADIUS / 0.5;

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    return { x: 1, y: 0 };
  }
  return { x: x / len, y: y / len };
}

/** 圆盾 + 本队第几人大号数字。盾半径与碰撞圆一致。 */
function drawKnightShield(g: Graphics, ball: BallBody): void {
  const alpha = ball.invincibleRemain > 0 || ball.phaseRemain > 0 ? 0.72 : 1;
  const rim =
    ball.hero === 'ring'
      ? 0xb8fff4
      : ball.hero === 'chain'
        ? 0x86efac
        : ball.hero === 'nail'
          ? 0xf4bf6a
          : ball.hero === 'arc'
            ? 0x7dd3fc
            : ball.hero === 'well'
              ? 0xf59e0b
              : ball.hero === 'mirror'
                ? 0xa5d8ff
                : SHIELD_RIM;
  g.circle(0, 0, BALL_RADIUS);
  g.fill({ color: ball.color, alpha });
  g.stroke({ color: rim, width: 0.055 * SKIN, alpha: 0.95 });
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
      fill: SLOT_FILL,
      stroke: { color: SLOT_STROKE, width: 8, join: 'round' },
      align: 'center',
    },
  });
  label.anchor.set(0.5, 0.52);
  label.eventMode = 'none';
  return label;
}

function syncSlotLabel(label: Text, ball: BallBody): void {
  const digits = slotDigits(ball.teamSlot);
  if (label.text !== digits) {
    label.text = digits;
  }
  label.scale.set((digits.length > 1 ? SLOT_SCALE * 0.72 : SLOT_SCALE) * SKIN);
  label.alpha = ball.invincibleRemain > 0 || ball.phaseRemain > 0 ? 0.72 : 1;
  label.visible = ball.inPlay;
}

/** 羽冠相对初版长度。只乘在主体羽冠上，冲锋残影不乘。 */
const PLUME_LENGTH = 0.6;

/** 羽冠：在瞄准/朝向反侧，略偏画面上方。 */
function drawPlume(g: Graphics, fx: number, fy: number, color: number): void {
  const rx = -fx;
  const ry = -fy;
  const px = -fy;
  const py = fx;
  const bx = rx * 0.42 * SKIN;
  const by = ry * 0.42 * SKIN;
  const lift = 0.12 * PLUME_LENGTH * SKIN;
  const midX = bx + (rx * 0.26 + px * 0.02) * PLUME_LENGTH * SKIN;
  const midY = by + ry * 0.26 * PLUME_LENGTH * SKIN - lift;
  const tipX = bx + rx * 0.52 * PLUME_LENGTH * SKIN;
  const tipY = by + ry * 0.52 * PLUME_LENGTH * SKIN - lift * 1.4;
  const halfW = 0.06 * PLUME_LENGTH * SKIN;
  const midW = 0.2 * PLUME_LENGTH * SKIN;

  g.moveTo(bx + px * halfW, by + py * halfW);
  g.quadraticCurveTo(midX + px * midW, midY + py * midW, tipX, tipY);
  g.quadraticCurveTo(midX - px * midW, midY - py * midW, bx - px * halfW, by - py * halfW);
  g.closePath();
  g.fill({ color, alpha: 0.96 });

  g.circle(bx, by, 0.042 * SKIN);
  g.fill({ color: SHIELD_RIM, alpha: 0.95 });
}

/** 矛尖：指示 targetDir（点地 / 鼠标 / bot 目标）。 */
function drawTargetSpear(g: Graphics, tx: number, ty: number): void {
  const { x: fx, y: fy } = unit(tx, ty);
  const px = -fy;
  const py = fx;
  const rootX = fx * 0.48 * SKIN;
  const rootY = fy * 0.48 * SKIN;
  const guardX = fx * 0.78 * SKIN;
  const guardY = fy * 0.78 * SKIN;
  const tipX = fx * SPEAR_TIP_DIST;
  const tipY = fy * SPEAR_TIP_DIST;

  g.moveTo(rootX, rootY);
  g.lineTo(guardX, guardY);
  g.stroke({ color: SPEAR_GOLD, width: 0.055 * SKIN, cap: 'round' });

  g.moveTo(guardX + px * 0.09 * SKIN, guardY + py * 0.09 * SKIN);
  g.lineTo(guardX - px * 0.09 * SKIN, guardY - py * 0.09 * SKIN);
  g.stroke({ color: SPEAR_GOLD, width: 0.04 * SKIN, cap: 'round' });

  g.moveTo(tipX, tipY);
  g.lineTo(tipX - fx * 0.16 * SKIN + px * 0.07 * SKIN, tipY - fy * 0.16 * SKIN + py * 0.07 * SKIN);
  g.lineTo(tipX - fx * 0.16 * SKIN - px * 0.07 * SKIN, tipY - fy * 0.16 * SKIN - py * 0.07 * SKIN);
  g.closePath();
  g.fill({ color: SPEAR_GOLD });
}

const HP_BAR_WIDTH = 0.92 * SKIN;
const HP_BAR_HEIGHT = 0.1 * SKIN;
const HP_BAR_Y = -0.74 * SKIN;
const SPEAR_CD_HEIGHT = 0.042 * SKIN;
const SPEAR_CD_GAP = 0.016 * SKIN;
const SPEAR_CD_TRACK = 0x1a1410;
const SPEAR_CD_FILL = 0xe8d8b8;

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

const TRAIL_MAX = 10;

function strokeMilkRing(g: Graphics, radius: number): void {
  g.circle(0, 0, radius);
  g.stroke({
    color: SELF_MARK.brown,
    width: SELF_MARK.band + SELF_MARK.outline * 2,
    cap: 'round',
  });
  g.circle(0, 0, radius);
  g.stroke({ color: SELF_MARK.milk, width: SELF_MARK.band, cap: 'round' });
}

/** 本人脚下双环。画在主体之下，不进冲锋残影。 */
export function drawSelfMarkRings(g: Graphics): void {
  strokeMilkRing(g, SELF_MARK.innerRadius);
  strokeMilkRing(g, SELF_MARK.outerRadius);
}

/** 冲锋残影：队色拖线 + 淡盾影 + 少量金尘。 */
function drawChargeFx(
  g: Graphics,
  next: BallBody,
  trail: readonly { x: number; y: number }[],
): void {
  const speed = Math.hypot(next.vx, next.vy);
  const { x: fx, y: fy } = unit(speed > 1e-6 ? next.vx : next.facingX, speed > 1e-6 ? next.vy : next.facingY);
  const px = -fy;
  const py = fx;

  for (let i = 1; i <= 5; i += 1) {
    const start = (0.18 + i * 0.16) * SKIN;
    const end = start + 0.38 * SKIN;
    const sway = (i % 2 === 0 ? 0.07 : -0.07) * SKIN;
    g.moveTo(-fx * start + px * sway, -fy * start + py * sway);
    g.lineTo(-fx * end + px * sway * 1.15, -fy * end + py * sway * 1.15);
    g.stroke({
      color: next.color,
      width: (0.11 - i * 0.012) * SKIN,
      alpha: 0.5 * (1 - i / 6),
      cap: 'round',
    });
  }

  for (let i = 1; i < trail.length; i += 1) {
    const alpha = 0.22 * (1 - i / TRAIL_MAX);
    g.circle(trail[i].x - next.x, trail[i].y - next.y, BALL_RADIUS * (0.82 - i * 0.04));
    g.fill({ color: next.color, alpha });
  }

  for (let i = 1; i <= 4; i += 1) {
    const d = 0.34 * i * SKIN;
    const sway = (i % 2 === 0 ? 0.12 : -0.12) * SKIN;
    g.circle(-fx * d + px * sway, -fy * d + py * sway, (0.055 + 0.02 * (5 - i)) * SKIN);
    g.fill({ color: SPEAR_GOLD, alpha: 0.32 * (1 - i / 5) });
  }
}

export function createBallView(ball: BallBody, init: BallViewSyncOpts = {}): BallView {
  const root = new Container();
  const mark = new Graphics();
  mark.eventMode = 'none';
  const fx = new Graphics();
  const body = new Graphics();
  const slotLabel = makeSlotLabel(ball.teamSlot);
  const hpBar = new Graphics();
  const spear = new Graphics();
  root.addChild(mark, fx, body, slotLabel, hpBar, spear);
  const trail: Array<{ x: number; y: number }> = [];
  let marked = !!init.selfMark;

  const sync = (next: BallBody, opts: BallViewSyncOpts = {}): void => {
    if (typeof opts.selfMark === 'boolean') {
      marked = opts.selfMark;
    }
    root.visible = next.inPlay;
    root.position.set(next.x, next.y);
    if (!next.inPlay) {
      trail.length = 0;
      fx.clear();
      mark.clear();
      mark.visible = false;
      slotLabel.visible = false;
      return;
    }

    if (opts.charging) {
      trail.unshift({ x: next.x, y: next.y });
      if (trail.length > TRAIL_MAX) {
        trail.length = TRAIL_MAX;
      }
    } else {
      trail.length = 0;
    }

    fx.clear();
    if (opts.charging) {
      drawChargeFx(fx, next, trail);
    }

    mark.clear();
    const showMark = selfMarkActive(marked, true);
    mark.visible = showMark;
    if (showMark) {
      drawSelfMarkRings(mark);
    }

    body.clear();
    drawKnightShield(body, next);
    syncSlotLabel(slotLabel, next);
    const dir = next.hasAim ? unit(next.aimX, next.aimY) : unit(next.facingX, next.facingY);
    drawPlume(body, dir.x, dir.y, next.color);
    if (next.invincibleRemain > 0) {
      const pulse = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(next.invincibleRemain * 10));
      body.circle(0, 0, BALL_RADIUS + 0.14 * SKIN);
      body.stroke({ color: 0xffffff, width: 0.07 * SKIN, alpha: pulse });
    }
    if (next.activeRamRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.08 * SKIN);
      body.stroke({ color: SPEAR_GOLD, width: 0.055 * SKIN, alpha: 0.95 });
    }
    if (next.fineTuneRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.16 * SKIN);
      body.stroke({ color: 0x7ee8ff, width: 0.05 * SKIN, alpha: 0.9 });
    }
    if (next.fieldRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.22 * SKIN);
      body.stroke({ color: 0x5eead4, width: 0.055 * SKIN, alpha: 0.88 });
    }
    if (next.healRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.2 * SKIN);
      body.stroke({ color: 0x86efac, width: 0.05 * SKIN, alpha: 0.9 });
    }
    if (next.burnRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.21 * SKIN);
      body.stroke({ color: 0xfb7185, width: 0.05 * SKIN, alpha: 0.88 });
    }
    if (next.shieldRemain > 0 || next.leechRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.26 * SKIN);
      body.stroke({ color: 0xfde68a, width: 0.06 * SKIN, alpha: 0.92 });
    }
    if (next.armorRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.28 * SKIN);
      body.stroke({ color: 0xf4bf6a, width: 0.07 * SKIN, alpha: next.armorBroken ? 0.45 : 0.95 });
    }
    if (next.reflectRemain > 0 && next.reflectArmed) {
      body.circle(0, 0, BALL_RADIUS + 0.18 * SKIN);
      body.stroke({ color: 0xfb7185, width: 0.055 * SKIN, alpha: 0.92 });
    }
    if (next.pinRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.12 * SKIN);
      body.stroke({ color: 0xf59e0b, width: 0.07 * SKIN, alpha: 0.95 });
    }
    if (next.grazeRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.2 * SKIN);
      body.stroke({ color: 0x7dd3fc, width: 0.05 * SKIN, alpha: 0.9 });
    }
    if (next.echoMarkRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.24 * SKIN);
      body.stroke({ color: 0xf0abfc, width: 0.06 * SKIN, alpha: 0.92 });
    }
    if (next.phaseRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.16 * SKIN);
      body.stroke({ color: 0xe0f2fe, width: 0.05 * SKIN, alpha: 0.7 });
    }
    if (next.refractRemain > 0) {
      body.circle(0, 0, BALL_RADIUS + 0.3 * SKIN);
      body.stroke({ color: 0xa5d8ff, width: 0.06 * SKIN, alpha: 0.92 });
    }

    hpBar.clear();
    drawHpBar(hpBar, next.hp, next.maxHp, next.spearCdRemain);

    spear.clear();
    if (next.hasAim) {
      drawTargetSpear(spear, next.aimX, next.aimY);
    } else {
      drawTargetSpear(spear, next.facingX, next.facingY);
    }
  };

  sync(ball, init);
  return { root, sync };
}
