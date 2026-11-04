import { Container, Graphics, Text } from 'pixi.js';
import {
  ARENA_CORNER_RADIUS,
  CONTROL_POINT,
  LEFT_PILLAR,
  MAP_HEIGHT,
  MAP_WIDTH,
  PILLAR_HEIGHT,
  PILLAR_WIDTH,
  RIGHT_PILLAR,
} from '../core/constants';

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

function drawControlPoint(): Container {
  const group = new Container();
  const rings = new Graphics();
  rings.circle(CONTROL_POINT.x, CONTROL_POINT.y, CONTROL_POINT.radius);
  rings.stroke({ color: 0x5ef6f6, width: 0.1, alpha: 0.95 });
  rings.circle(CONTROL_POINT.x, CONTROL_POINT.y, CONTROL_POINT.radius * 0.82);
  rings.stroke({ color: 0x5ef6f6, width: 0.03, alpha: 0.5 });
  group.addChild(rings);

  // 先按像素栅格化再缩到逻辑单位，避免 0.55px 字体放大成色块。
  const labelWorldHeight = 0.55;
  const labelFontPx = 64;
  const label = new Text({
    text: '中点',
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
  return group;
}

/** 俯视空场地：圆角矩形 + 调试网格 + 中点圈 + 左右矮柱。 */
export function createArenaView(): Container {
  const root = new Container();

  const floor = new Graphics();
  floor.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, ARENA_CORNER_RADIUS);
  floor.fill({ color: 0x0f3f3f });
  floor.stroke({ color: 0x071f1f, width: 0.18 });
  root.addChild(floor);

  const clip = new Graphics();
  clip.roundRect(0, 0, MAP_WIDTH, MAP_HEIGHT, ARENA_CORNER_RADIUS);
  clip.fill({ color: 0xffffff });

  const inner = new Container();
  inner.addChild(clip);
  inner.mask = clip;
  inner.addChild(drawGrid());
  inner.addChild(drawPillar(LEFT_PILLAR.x, LEFT_PILLAR.y));
  inner.addChild(drawPillar(RIGHT_PILLAR.x, RIGHT_PILLAR.y));
  inner.addChild(drawControlPoint());
  root.addChild(inner);

  return root;
}
