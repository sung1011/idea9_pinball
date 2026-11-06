import { MAP_HEIGHT, MAP_WIDTH } from '../core/constants';

export type SafeInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type StageRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const WORLD_ASPECT = MAP_WIDTH / MAP_HEIGHT;

/** 读 notch / 圆角安全区，没有则全 0。 */
export function readSafeInsets(): SafeInsets {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out: SafeInsets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return out;
}

export function isPortraitViewport(width = window.innerWidth, height = window.innerHeight): boolean {
  return height > width;
}

/** 视口 client 坐标 → 宿主本地坐标。不旋转、不反解。 */
export function clientToHostLocal(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/**
 * 按 20×20 正方形 cover 铺满可用安全区，保持比例不拉伸。
 * 宽屏：宽度贴齐可用宽，高度按世界比例放大后居中，裁掉上下多出部分（y 可负）。
 * 竖窗 / 更近正方形：高度贴齐可用高，宽度按世界比例放大后居中，裁掉左右多出部分（x 可负）。
 * 舞台可超出视口；点击坐标与舞台摆位用同一套矩形。
 */
export function computeLandscapeStage(viewW: number, viewH: number, insets: SafeInsets): StageRect {
  const left = insets.left;
  const right = insets.right;
  const top = insets.top;
  const bottom = insets.bottom;
  const availW = Math.max(1, viewW - left - right);
  const availH = Math.max(1, viewH - top - bottom);
  let width: number;
  let height: number;
  if (availW / availH > WORLD_ASPECT) {
    width = availW;
    height = width / WORLD_ASPECT;
  } else {
    height = availH;
    width = height * WORLD_ASPECT;
  }
  return {
    x: left + (availW - width) / 2,
    y: top + (availH - height) / 2,
    width,
    height,
  };
}

export function applyStageVars(host: HTMLElement, stage: StageRect): void {
  host.style.setProperty('--stage-left', `${stage.x}px`);
  host.style.setProperty('--stage-top', `${stage.y}px`);
  host.style.setProperty('--stage-right', `${stage.x + stage.width}px`);
  host.style.setProperty('--stage-bottom', `${stage.y + stage.height}px`);
  host.style.setProperty('--stage-center-x', `${stage.x + stage.width / 2}px`);
  host.style.setProperty('--stage-center-y', `${stage.y + stage.height * 0.42}px`);
  const portrait = isPortraitViewport(host.clientWidth, host.clientHeight);
  host.classList.toggle('isPortrait', portrait);
  host.classList.toggle('isLandscape', !portrait);
}
