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

export type VisibleViewBox = {
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

/** iPhone/iPad 加到主屏幕、Chrome/Edge 安装应用等独立窗。网页标签为 false。 */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }
    if (window.matchMedia('(display-mode: fullscreen)').matches) {
      return true;
    }
    if (window.matchMedia('(display-mode: minimal-ui)').matches) {
      return true;
    }
  } catch {
    /* matchMedia 不可用时不算独立窗 */
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/**
 * 真正可见盒：取 inner / client / visualViewport 的较小边，避免 100dvh 大于可见区。
 * visualViewport 的 offset 映射到宿主坐标，供战场原点使用。
 */
export function visibleViewSize(
  innerW: number,
  innerH: number,
  clientW: number,
  clientH: number,
  visual?: { width: number; height: number; offsetLeft?: number; offsetTop?: number } | null,
): VisibleViewBox {
  let width = Math.min(Math.max(1, innerW), Math.max(1, clientW));
  let height = Math.min(Math.max(1, innerH), Math.max(1, clientH));
  let x = 0;
  let y = 0;
  if (visual) {
    width = Math.min(width, Math.max(1, visual.width));
    height = Math.min(height, Math.max(1, visual.height));
    x = visual.offsetLeft ?? 0;
    y = visual.offsetTop ?? 0;
  }
  return { x, y, width, height };
}

export function readVisibleViewBox(host: HTMLElement): VisibleViewBox {
  const innerW = window.innerWidth;
  const innerH = window.innerHeight;
  const clientW = host.clientWidth || innerW;
  const clientH = host.clientHeight || innerH;
  const vv = window.visualViewport;
  return visibleViewSize(
    innerW,
    innerH,
    clientW,
    clientH,
    vv
      ? { width: vv.width, height: vv.height, offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop }
      : null,
  );
}

/**
 * 视口 client 坐标 → 宿主本地坐标。
 * 按 AABB 差值：clientX/Y 减去 rect.left/top。不对 #app 做 90° 旋转，因此不需要反解。
 */
export function clientToHostLocal(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/**
 * 按世界比例 cover 铺满可用安全区，保持比例不拉伸。
 * 永远按传入的横屏盒子计算：956:440 恰好看全图；更方的屏（如 16:9）左右略裁；更宽的屏裁上下。
 * 不在这里排竖屏战场，也不对宿主做 90° 旋转。
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

export function applyStageVars(host: HTMLElement, stage: StageRect, layoutW?: number, layoutH?: number): void {
  host.style.setProperty('--stage-left', `${stage.x}px`);
  host.style.setProperty('--stage-top', `${stage.y}px`);
  host.style.setProperty('--stage-right', `${stage.x + stage.width}px`);
  host.style.setProperty('--stage-bottom', `${stage.y + stage.height}px`);
  host.style.setProperty('--stage-center-x', `${stage.x + stage.width / 2}px`);
  host.style.setProperty('--stage-center-y', `${stage.y + stage.height * 0.42}px`);
  const width = layoutW ?? host.clientWidth;
  const height = layoutH ?? host.clientHeight;
  const portrait = isPortraitViewport(width, height);
  host.classList.toggle('isPortrait', portrait);
  host.classList.toggle('isLandscape', !portrait);
  host.classList.toggle('isShortHud', height <= 430);
  host.classList.toggle('isNarrowHud', width <= 420);
}
