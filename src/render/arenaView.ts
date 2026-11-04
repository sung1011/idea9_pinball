import { Container, Graphics, Text } from 'pixi.js';
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
  grid.stroke({ color: 0x2a6a6a, width: 0.02, alpha: 0.45 });
  return grid;
}

function drawPillar(cx: number, cy: number): Graphics {
  const pillar = new Graphics();
  const rx = PILLAR_WIDTH / 2;
  const ry = PILLAR_HEIGHT / 2;
  pillar.ellipse(cx, cy + 0.06, rx, ry);
  pillar.fill({ color: 0x0a2222, alpha: 0.45 });
  pillar.ellipse(cx, cy, rx, ry);
  pillar.fill({ color: 0x2c5555 });
  pillar.stroke({ color: 0x1a3333, width: 0.04 });
  return pillar;
}

function holdColor(hold: MidpointHold): number {
  if (hold === 'red') {
    return 0xf68a8a;
  }
  if (hold === 'blue') {
    return 0x8ab4f6;
  }
  return 0x5ef6f6;
}

function paintControlRings(rings: Graphics, hold: MidpointHold): void {
  const color = holdColor(hold);
  rings.clear();
  rings.circle(CONTROL_POINT.x, CONTROL_POINT.y, CONTROL_POINT.radius);
  rings.stroke({ color, width: 0.1, alpha: 0.95 });
  rings.circle(CONTROL_POINT.x, CONTROL_POINT.y, CONTROL_POINT.radius * 0.82);
  rings.stroke({ color, width: 0.03, alpha: 0.5 });
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
  line.stroke({ color: 0x9af6f6, width: 0.03, alpha: 0.22 });
  return line;
}

function drawControlPoint(): { group: Container; syncHold: (hold: MidpointHold) => void } {
  const group = new Container();
  const rings = new Graphics();
  paintControlRings(rings, 'none');
  group.addChild(rings);

  // 先按像素栅格化再缩到逻辑单位，避免 0.55px 字体放大成色块。
  const labelWorldHeight = 0.55;
  const labelFontPx = 64;
  const label = new Text({
    text: '领地',
    style: {
      fontFamily: '"WenQuanYi Micro Hei", "Droid Sans Fallback", system-ui, sans-serif',
      fontSize: labelFontPx,
      fill: 0x9af6f6,
      align: 'center',
    },
  });
  label.anchor.set(0.5);
  label.scale.set(labelWorldHeight / labelFontPx);
  label.position.set(CONTROL_POINT.x, CONTROL_POINT.y);
  group.addChild(label);
  return {
    group,
    syncHold: (hold: MidpointHold) => paintControlRings(rings, hold),
  };
}

export type ArenaView = {
  root: Container;
  syncHold: (hold: MidpointHold) => void;
};

/** 俯视场地：圆角矩形 + 领地圈 + 左右矮柱 + 半场出生点。 */
export function createArenaView(): ArenaView {
  const root = new Container();

  const floor = new Graphics();
  floor.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, ARENA_CORNER_RADIUS);
  floor.fill({ color: 0x0f3f3f });
  floor.stroke({ color: 0x071f1f, width: 0.18 });
  root.addChild(floor);

  const clip = new Graphics();
  clip.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, ARENA_CORNER_RADIUS);
  clip.fill({ color: 0xffffff });

  const control = drawControlPoint();
  const inner = new Container();
  inner.addChild(clip);
  inner.mask = clip;
  inner.addChild(drawGrid());
  inner.addChild(drawHalfway());
  inner.addChild(drawSpawns());
  inner.addChild(drawPillar(LEFT_PILLAR.x, LEFT_PILLAR.y));
  inner.addChild(drawPillar(RIGHT_PILLAR.x, RIGHT_PILLAR.y));
  inner.addChild(control.group);
  root.addChild(inner);

  return { root, syncHold: control.syncHold };
}
