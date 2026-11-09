import type { Container } from 'pixi.js';

export type WorldTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

/** 进入时锁定的战场像素尺寸；之后只平移，不改比例。 */
export type WorldViewLock = {
  scale: number;
  pixelW: number;
  pixelH: number;
};

/** 将逻辑世界等比适配到屏幕（不拉伸）。 */
export function fitWorldToScreen(
  screenWidth: number,
  screenHeight: number,
  worldWidth: number,
  worldHeight: number,
  paddingPx: number,
): WorldTransform {
  return fitWorldToBox(0, 0, screenWidth, screenHeight, worldWidth, worldHeight, paddingPx);
}

/** 将逻辑世界等比装进指定舞台盒（cover 盒可超出视口；不拉伸）。 */
export function fitWorldToBox(
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  worldWidth: number,
  worldHeight: number,
  paddingPx = 0,
): WorldTransform {
  const availW = Math.max(1, boxW - paddingPx * 2);
  const availH = Math.max(1, boxH - paddingPx * 2);
  const scale = Math.min(availW / worldWidth, availH / worldHeight);
  return {
    scale,
    offsetX: boxX + (boxW - worldWidth * scale) / 2,
    offsetY: boxY + (boxH - worldHeight * scale) / 2,
  };
}

export function captureWorldViewLock(
  transform: WorldTransform,
  worldWidth: number,
  worldHeight: number,
): WorldViewLock {
  return {
    scale: transform.scale,
    pixelW: worldWidth * transform.scale,
    pixelH: worldHeight * transform.scale,
  };
}

/** 把已锁定像素尺寸的世界放进当前盒：只居中，不拉伸。盒外裁切，盒内空余留给背景。 */
export function placeLockedWorld(
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  lock: WorldViewLock,
): WorldTransform {
  return {
    scale: lock.scale,
    offsetX: boxX + (boxW - lock.pixelW) / 2,
    offsetY: boxY + (boxH - lock.pixelH) / 2,
  };
}

export function applyWorldTransform(target: Container, transform: WorldTransform): void {
  target.position.set(transform.offsetX, transform.offsetY);
  target.scale.set(transform.scale);
}

export function logicalToScreen(
  x: number,
  y: number,
  transform: WorldTransform,
): { x: number; y: number } {
  return {
    x: transform.offsetX + x * transform.scale,
    y: transform.offsetY + y * transform.scale,
  };
}

export function screenToLogical(
  x: number,
  y: number,
  transform: WorldTransform,
): { x: number; y: number } {
  return {
    x: (x - transform.offsetX) / transform.scale,
    y: (y - transform.offsetY) / transform.scale,
  };
}
