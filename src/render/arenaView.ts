import { Container, Graphics } from 'pixi.js';
import {
  ARENA_CORNER_RADIUS,
  BLUE_SPAWNS,
  CONTROL_POINT,
  LEFT_PILLAR,
  MAP_HEIGHT,
  MAP_WIDTH,
  PILLAR_HEIGHT,
  PILLAR_WIDTH,
  RED_SPAWNS,
  RIGHT_PILLAR,
} from '../core/constants';
import type { MidpointHold } from '../core/matchSession';
import type { StallFence } from '../core/stallFences';

const WOOD = 0xc4a574;
const WOOD_DARK = 0x7a4e28;
const WOOD_WASH = 0xd8c08a;
const CREST = 0xf4f0e4;

function drawGrid(): Graphics {
  const grid = new Graphics();
  for (let x = 1; x < MAP_WIDTH; x += 1) {
    grid.moveTo(x, 0);
    grid.lineTo(x, MAP_HEIGHT);
  }
  for (let y = 1; y < MAP_HEIGHT; y += 1) {
    grid.moveTo(0, y);
    grid.lineTo(MAP_WIDTH, y);
  }
  grid.stroke({ color: 0x6a8a4a, width: 0.02, alpha: 0.28 });
  return grid;
}

function drawPillar(cx: number, cy: number): Graphics {
  const pillar = new Graphics();
  const rx = PILLAR_WIDTH / 2;
  const ry = PILLAR_HEIGHT / 2;
  pillar.ellipse(cx, cy + 0.06, rx, ry);
  pillar.fill({ color: 0x1a140c, alpha: 0.4 });
  pillar.ellipse(cx, cy, rx, ry);
  pillar.fill({ color: 0x6b5344 });
  pillar.stroke({ color: WOOD_DARK, width: 0.045 });
  pillar.ellipse(cx - 0.18, cy - 0.08, rx * 0.35, ry * 0.28);
  pillar.fill({ color: 0x8a7360, alpha: 0.35 });
  return pillar;
}

function holdColor(hold: MidpointHold): number {
  if (hold === 'red') {
    return 0xf68a8a;
  }
  if (hold === 'blue') {
    return 0x8ab4f6;
  }
  return CREST;
}

function drawHelmetCrest(g: Graphics, cx: number, cy: number, color: number): void {
  const s = 1.35;
  g.moveTo(cx, cy - 0.7 * s);
  g.quadraticCurveTo(cx + 0.5 * s, cy - 0.38 * s, cx + 0.4 * s, cy + 0.12 * s);
  g.lineTo(cx, cy + 0.62 * s);
  g.lineTo(cx - 0.4 * s, cy + 0.12 * s);
  g.quadraticCurveTo(cx - 0.5 * s, cy - 0.38 * s, cx, cy - 0.7 * s);
  g.closePath();
  g.stroke({ color, width: 0.07, alpha: 0.9 });

  g.moveTo(cx, cy - 0.86 * s);
  g.quadraticCurveTo(cx + 0.1 * s, cy - 0.7 * s, cx + 0.04 * s, cy - 0.5 * s);
  g.lineTo(cx - 0.04 * s, cy - 0.5 * s);
  g.quadraticCurveTo(cx - 0.1 * s, cy - 0.7 * s, cx, cy - 0.86 * s);
  g.closePath();
  g.fill({ color, alpha: 0.92 });

  g.ellipse(cx, cy - 0.1 * s, 0.3 * s, 0.34 * s);
  g.fill({ color, alpha: 0.96 });
  g.ellipse(cx - 0.2 * s, cy + 0.14 * s, 0.12 * s, 0.2 * s);
  g.fill({ color, alpha: 0.96 });
  g.ellipse(cx + 0.2 * s, cy + 0.14 * s, 0.12 * s, 0.2 * s);
  g.fill({ color, alpha: 0.96 });

  g.rect(cx - 0.045 * s, cy - 0.2 * s, 0.09 * s, 0.34 * s);
  g.fill({ color: 0x1a2018, alpha: 0.62 });
  g.rect(cx - 0.16 * s, cy + 0.01 * s, 0.32 * s, 0.055 * s);
  g.fill({ color: 0x1a2018, alpha: 0.55 });
}

function paintControl(g: Graphics, hold: MidpointHold): void {
  const color = holdColor(hold);
  const cx = CONTROL_POINT.x;
  const cy = CONTROL_POINT.y;
  g.clear();
  g.circle(cx, cy, CONTROL_POINT.radius);
  g.fill({ color: CREST, alpha: 0.06 });
  g.circle(cx, cy, CONTROL_POINT.radius);
  g.stroke({ color, width: 0.1, alpha: 0.95 });
  g.circle(cx, cy, CONTROL_POINT.radius * 0.82);
  g.stroke({ color, width: 0.03, alpha: 0.5 });
  drawHelmetCrest(g, cx, cy, color);
}

function drawSpawns(): Graphics {
  const g = new Graphics();
  for (const spawn of RED_SPAWNS) {
    g.circle(spawn.x, spawn.y, 0.42);
    g.stroke({ color: 0xe24a4a, width: 0.05, alpha: 0.45 });
  }
  for (const spawn of BLUE_SPAWNS) {
    g.circle(spawn.x, spawn.y, 0.42);
    g.stroke({ color: 0x3d7cf0, width: 0.05, alpha: 0.45 });
  }
  return g;
}

function drawHalfway(): Graphics {
  const line = new Graphics();
  line.moveTo(MAP_WIDTH / 2, 0.35);
  line.lineTo(MAP_WIDTH / 2, MAP_HEIGHT - 0.35);
  line.stroke({ color: 0xe8f0dc, width: 0.03, alpha: 0.28 });
  return line;
}

function woodPost(g: Graphics, x: number, y: number, hw: number, hh: number): void {
  g.rect(x - hw, y - hh, hw * 2, hh * 2);
  g.fill({ color: WOOD });
  g.stroke({ color: WOOD_DARK, width: 0.03 });
}

function paintBanner(g: Graphics, cx: number, top: number, team: number, openToward: 1 | -1): void {
  const bw = 0.62;
  const bh = 2.15;
  g.rect(cx - bw / 2, top, bw, bh);
  g.fill({ color: team, alpha: 0.94 });
  g.stroke({ color: WOOD_DARK, width: 0.03, alpha: 0.7 });

  const midX = cx;
  const midY = top + bh * 0.48;
  g.moveTo(midX, midY - 0.38);
  g.lineTo(midX + 0.2 * openToward, midY + 0.06);
  g.lineTo(midX, midY + 0.22);
  g.lineTo(midX - 0.2 * openToward, midY + 0.06);
  g.closePath();
  g.fill({ color: CREST, alpha: 0.95 });

  const poleX = cx + (openToward > 0 ? -0.42 : 0.42);
  const poleTop = top - 0.15;
  g.moveTo(poleX, poleTop + 1.35);
  g.lineTo(poleX, poleTop);
  g.stroke({ color: WOOD_DARK, width: 0.04, cap: 'round' });
  g.moveTo(poleX, poleTop);
  g.lineTo(poleX + 0.38 * openToward, poleTop + 0.12);
  g.lineTo(poleX, poleTop + 0.26);
  g.closePath();
  g.fill({ color: team, alpha: 0.95 });
}

function paintStalls(g: Graphics, stalls: readonly StallFence[]): void {
  g.clear();
  for (const fence of stalls) {
    const team = fence.team === 'red' ? 0xe24a4a : 0x3d7cf0;
    const w = fence.maxX - fence.minX;
    const h = fence.maxY - fence.minY;
    const midY = (fence.minY + fence.maxY) / 2;
    const backX = fence.openToward > 0 ? fence.minX : fence.maxX;
    const openX = fence.openToward > 0 ? fence.maxX : fence.minX;

    g.rect(fence.minX, fence.minY, w, h);
    g.fill({ color: WOOD_WASH, alpha: 0.22 });

    const postW = 0.16;
    woodPost(g, fence.minX, fence.minY, postW, postW);
    woodPost(g, fence.maxX, fence.minY, postW, postW);
    woodPost(g, fence.minX, fence.maxY, postW, postW);
    woodPost(g, fence.maxX, fence.maxY, postW, postW);

    const slat = 1.15;
    for (let y = fence.minY + 0.55; y < fence.maxY - 0.35; y += slat) {
      woodPost(g, backX, y, 0.13, 0.42);
    }

    g.moveTo(backX, fence.minY);
    g.lineTo(backX, fence.maxY);
    g.stroke({ color: WOOD, width: 0.18, alpha: 0.95 });
    g.moveTo(fence.minX, fence.minY);
    g.lineTo(fence.maxX, fence.minY);
    g.stroke({ color: WOOD, width: 0.14, alpha: 0.92 });
    g.moveTo(fence.minX, fence.maxY);
    g.lineTo(fence.maxX, fence.maxY);
    g.stroke({ color: WOOD, width: 0.14, alpha: 0.92 });

    paintBanner(g, backX + fence.openToward * 0.48, midY - 1.15, team, fence.openToward);

    g.moveTo(openX, fence.minY);
    g.lineTo(openX, fence.maxY);
    g.stroke({ color: 0xffe08a, width: 0.09, alpha: 0.88 });
  }
}

export type ArenaView = {
  root: Container;
  syncHold: (hold: MidpointHold) => void;
  syncStalls: (stalls: readonly StallFence[]) => void;
};

/** 俯视场地：圆角矩形 + 领地纹章圈 + 左右矮柱 + 半场底线木栏。 */
export function createArenaView(): ArenaView {
  const root = new Container();

  const floor = new Graphics();
  floor.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, ARENA_CORNER_RADIUS);
  floor.fill({ color: 0x3d5a32 });
  floor.stroke({ color: 0x243818, width: 0.18 });
  root.addChild(floor);

  const clip = new Graphics();
  clip.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, ARENA_CORNER_RADIUS);
  clip.fill({ color: 0xffffff });

  const control = new Graphics();
  paintControl(control, 'none');
  const inner = new Container();
  inner.addChild(clip);
  inner.mask = clip;
  inner.addChild(drawGrid());
  inner.addChild(drawHalfway());
  inner.addChild(drawSpawns());
  inner.addChild(drawPillar(LEFT_PILLAR.x, LEFT_PILLAR.y));
  inner.addChild(drawPillar(RIGHT_PILLAR.x, RIGHT_PILLAR.y));
  inner.addChild(control);
  const stallGfx = new Graphics();
  inner.addChild(stallGfx);
  root.addChild(inner);

  return {
    root,
    syncHold: (hold) => paintControl(control, hold),
    syncStalls: (stalls) => paintStalls(stallGfx, stalls),
  };
}
