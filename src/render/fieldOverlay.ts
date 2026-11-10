import { Container, Graphics, Text } from 'pixi.js';
import type { BallBody } from '../core/ballBody';
import { listBoomFlashes } from '../core/boomFlashes';
import { POTION_RADIUS } from '../core/constants';
import { listMagnetWells, type MagnetWell } from '../core/magnetWells';
import { listMirrorWalls } from '../core/mirrorWalls';
import { POTION_KIND_COLOR, type PotionPickup } from '../core/potionField';
import type { RiftSnapshot } from '../core/riftHazard';
import { listStakes } from '../core/ropeStakes';
import { listTrapZones } from '../core/trapZones';
import { RING_FIELD } from '../heroes/ringKit';
import { MIRROR_REFRACT, MIRROR_WALL } from '../heroes/mirrorKit';
import { WELL_STAKE } from '../heroes/wellKit';

export type FieldOverlayExtras = {
  potion?: PotionPickup | null;
  rift?: RiftSnapshot | null;
};

export type FieldOverlay = {
  root: Container;
  sync: (balls: readonly BallBody[], extras?: FieldOverlayExtras) => void;
};

const AURA = 0x5eead4;
const TRAP = 0xa78bfa;
const MARK = 0xf0abfc;
const GRAZE = 0x7dd3fc;
const STAKE = 0xf59e0b;
const BOOM = 0xfb7185;
const GLASS = 0xa5d8ff;

const GOLD = 0xd4a017;
const WELL_MAG = 0x4f7cff;
const WELL_COUNT_SCALE = 0.03;

function paintPotion(g: Graphics, potion: PotionPickup): void {
  const color = POTION_KIND_COLOR[potion.kind];
  const r = POTION_RADIUS;
  g.circle(potion.x, potion.y + r * 0.12, r * 0.92);
  g.fill({ color: 0x1a140c, alpha: 0.35 });
  g.circle(potion.x, potion.y, r);
  g.fill({ color, alpha: 0.92 });
  g.stroke({ color: 0x2f241a, width: 0.06, alpha: 0.9 });
  g.circle(potion.x - r * 0.28, potion.y - r * 0.28, r * 0.28);
  g.fill({ color: 0xfff8e7, alpha: 0.35 });
  g.rect(potion.x - r * 0.18, potion.y - r * 1.15, r * 0.36, r * 0.42);
  g.fill({ color });
  g.stroke({ color: 0x2f241a, width: 0.045, alpha: 0.9 });
  g.rect(potion.x - r * 0.32, potion.y - r * 1.28, r * 0.64, r * 0.18);
  g.fill({ color: 0xf3e6c8 });
  g.stroke({ color: 0x8b5a2b, width: 0.04, alpha: 0.95 });
}

function paintRift(g: Graphics, rift: RiftSnapshot): void {
  const { x, y, radius } = rift;
  if (rift.phase === 'warn') {
    const pulse = 0.35 + 0.25 * Math.min(1, rift.remain / 2);
    g.circle(x, y, radius);
    g.fill({ color: 0x3a2e24, alpha: 0.22 });
    g.circle(x, y, radius);
    g.stroke({ color: GOLD, width: 0.12, alpha: 0.55 + pulse });
    g.circle(x, y, radius * 0.72);
    g.stroke({ color: GOLD, width: 0.04, alpha: 0.4 });
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2 + 0.2;
      const inner = radius * 0.18;
      const outer = radius * 0.88;
      g.moveTo(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner);
      g.lineTo(x + Math.cos(ang) * outer, y + Math.sin(ang) * outer);
    }
    g.stroke({ color: GOLD, width: 0.05, alpha: 0.7 });
    return;
  }
  g.circle(x, y, radius);
  g.fill({ color: GOLD, alpha: 0.16 });
  g.circle(x, y, radius);
  g.stroke({ color: GOLD, width: 0.1, alpha: 0.95 });
  const tips = 10;
  for (let i = 0; i < tips; i += 1) {
    const ang = (i / tips) * Math.PI * 2;
    const ox = Math.cos(ang);
    const oy = Math.sin(ang);
    const base = radius * 0.22;
    const tip = radius * 0.92;
    const side = 0.22;
    g.moveTo(x + ox * tip, y + oy * tip);
    g.lineTo(x + ox * base - oy * side, y + oy * base + ox * side);
    g.lineTo(x + ox * base + oy * side, y + oy * base - ox * side);
    g.closePath();
    g.fill({ color: GOLD, alpha: 0.95 });
    g.stroke({ color: 0xa07812, width: 0.04, alpha: 0.9 });
  }
}

function paintMagnetWell(g: Graphics, well: MagnetWell): void {
  const pulse = 0.16 + 0.12 * Math.min(1, well.remain / Math.max(well.duration, 1e-6));
  g.circle(well.x, well.y, well.radius);
  g.fill({ color: WELL_MAG, alpha: pulse });
  g.circle(well.x, well.y, well.radius);
  g.stroke({ color: WELL_MAG, width: 0.08, alpha: 0.88 });
  g.circle(well.x, well.y, well.radius * 0.18);
  g.stroke({ color: 0xdbe7ff, width: 0.045, alpha: 0.7 });
}

function makeWellCountdown(well: MagnetWell): Text {
  const label = new Text({
    text: well.remain.toFixed(1),
    style: {
      fontFamily: 'ui-rounded, ui-sans-serif, system-ui, sans-serif',
      fontSize: 48,
      fontWeight: '800',
      fill: 0xf8fbff,
      stroke: { color: 0x142038, width: 6, join: 'round' },
    },
  });
  label.anchor.set(0.5);
  label.scale.set(WELL_COUNT_SCALE);
  label.position.set(well.x, well.y);
  label.eventMode = 'none';
  return label;
}

/** 磁场身周圈 + 困圈落点圈 + 沉磁井场地圈与倒计时。 */
export function createFieldOverlay(): FieldOverlay {
  const root = new Container();
  root.eventMode = 'none';
  const gfx = new Graphics();
  const labels = new Container();
  labels.eventMode = 'none';
  root.addChild(gfx, labels);

  const sync = (balls: readonly BallBody[], extras: FieldOverlayExtras = {}): void => {
    gfx.clear();
    for (const child of labels.removeChildren()) {
      child.destroy();
    }
    if (extras.rift) {
      paintRift(gfx, extras.rift);
    }
    if (extras.potion) {
      paintPotion(gfx, extras.potion);
    }
    for (const well of listMagnetWells()) {
      paintMagnetWell(gfx, well);
      labels.addChild(makeWellCountdown(well));
    }
    for (const ball of balls) {
      if (!ball.inPlay || ball.fieldRemain <= 0) {
        continue;
      }
      const pulse = 0.14 + 0.08 * Math.min(1, ball.fieldRemain / RING_FIELD.duration);
      gfx.circle(ball.x, ball.y, RING_FIELD.radius);
      gfx.fill({ color: AURA, alpha: pulse });
      gfx.stroke({ color: AURA, width: 0.06, alpha: 0.55 });
    }
    for (const ball of balls) {
      if (!ball.inPlay) {
        continue;
      }
      if (ball.echoMarkRemain > 0) {
        gfx.circle(ball.x, ball.y, ball.radius + 0.28);
        gfx.stroke({ color: MARK, width: 0.06, alpha: 0.8 });
      }
      if (ball.grazeRemain > 0) {
        gfx.circle(ball.x, ball.y, ball.radius + 0.18);
        gfx.stroke({ color: GRAZE, width: 0.045, alpha: 0.7 });
      }
      if (ball.refractRemain > 0) {
        const pulse = 0.18 + 0.16 * Math.min(1, ball.refractRemain / MIRROR_REFRACT.duration);
        gfx.circle(ball.x, ball.y, ball.radius + 0.32);
        gfx.stroke({ color: GLASS, width: 0.07, alpha: 0.55 + pulse });
      }
      if (ball.potionDamageRemain > 0) {
        gfx.circle(ball.x, ball.y, ball.radius + 0.38);
        gfx.stroke({ color: POTION_KIND_COLOR.damage, width: 0.05, alpha: 0.8 });
      }
      if (ball.potionSpeedRemain > 0) {
        gfx.circle(ball.x, ball.y, ball.radius + 0.48);
        gfx.stroke({ color: POTION_KIND_COLOR.speed, width: 0.045, alpha: 0.75 });
      }
      if (ball.potionShieldRemain > 0 && ball.potionShieldHp > 0) {
        gfx.circle(ball.x, ball.y, ball.radius + 0.58);
        gfx.stroke({ color: POTION_KIND_COLOR.shield, width: 0.06, alpha: 0.8 });
      }
    }
    for (const zone of listTrapZones()) {
      const pulse = 0.16 + 0.1 * Math.min(1, zone.remain);
      gfx.circle(zone.x, zone.y, zone.radius);
      gfx.fill({ color: TRAP, alpha: pulse });
      gfx.stroke({ color: TRAP, width: 0.07, alpha: 0.7 });
    }
    for (const stake of listStakes()) {
      const pulse = 0.28 + 0.12 * Math.min(1, stake.remain / WELL_STAKE.duration);
      gfx.circle(stake.x, stake.y, stake.radius);
      gfx.fill({ color: STAKE, alpha: pulse });
      gfx.stroke({ color: STAKE, width: 0.07, alpha: 0.85 });
    }
    for (const wall of listMirrorWalls()) {
      const pulse = 0.22 + 0.16 * Math.min(1, wall.remain / MIRROR_WALL.duration);
      gfx.moveTo(wall.x0, wall.y0);
      gfx.lineTo(wall.x1, wall.y1);
      gfx.stroke({ color: GLASS, width: wall.halfWidth * 2, cap: 'round', alpha: 0.45 + pulse });
    }
    for (const flash of listBoomFlashes()) {
      const life = Math.max(flash.life, 1e-6);
      const pulse = 0.1 + 0.28 * Math.min(1, flash.remain / life);
      gfx.circle(flash.x, flash.y, flash.radius);
      gfx.fill({ color: BOOM, alpha: pulse });
      gfx.stroke({ color: BOOM, width: 0.07, alpha: 0.7 });
    }
  };

  return { root, sync };
}
