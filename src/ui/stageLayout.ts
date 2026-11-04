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
const STAGE_GAP_PX = 6;

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

function isScreenPortrait(): boolean {
  const type = window.screen?.orientation?.type;
  if (type) {
    return type.startsWith('portrait');
  }
  const width = window.screen?.width ?? 0;
  const height = window.screen?.height ?? 0;
  return height > width;
}

export type ForceLandscapeInput = {
  viewW: number;
  viewH: number;
  screenPortrait: boolean;
  hoverNone: boolean;
  coarsePointer: boolean;
};

/** 触屏竖持才强制横屏。PC 把窗口拉窄只 letterbox，不转画面。 */
export function shouldForceLandscape(input: ForceLandscapeInput): boolean {
  if (!isPortraitViewport(input.viewW, input.viewH)) {
    return false;
  }
  if (!input.screenPortrait) {
    return false;
  }
  return input.hoverNone && input.coarsePointer;
}

export function wantsForceLandscape(width = window.innerWidth, height = window.innerHeight): boolean {
  return shouldForceLandscape({
    viewW: width,
    viewH: height,
    screenPortrait: isScreenPortrait(),
    hoverNone: window.matchMedia('(hover: none)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  });
}

/** 竖持时 #app 按横屏盒子排，再 90° CW 铺满竖屏。尺寸用视口像素，避免 dvh 与 innerHeight 对不齐。 */
export function syncForceLandscape(
  host: HTMLElement,
  viewW = window.innerWidth,
  viewH = window.innerHeight,
): boolean {
  const force = wantsForceLandscape(viewW, viewH);
  host.classList.toggle('isForceLandscape', force);
  if (force) {
    host.style.width = `${viewH}px`;
    host.style.height = `${viewW}px`;
    host.style.transformOrigin = 'top left';
    host.style.transform = `translate(${viewW}px, 0) rotate(90deg)`;
  } else {
    host.style.width = '';
    host.style.height = '';
    host.style.transform = '';
    host.style.transformOrigin = '';
  }
  return force;
}

/** 强制横屏后的舞台尺寸：宽=视口高，高=视口宽。 */
export function forceLandscapeViewSize(viewW: number, viewH: number): { width: number; height: number } {
  return { width: viewH, height: viewW };
}

/** 90° CW 后安全区：物理上/右/下/左 → 舞台右/下/左/上。 */
export function remapInsetsForForceLandscape(insets: SafeInsets): SafeInsets {
  return {
    top: insets.left,
    right: insets.top,
    bottom: insets.right,
    left: insets.bottom,
  };
}

/**
 * 视口 client 坐标 → 宿主本地（未旋转）坐标。
 * 强制横屏：`translate(100dvw,0) rotate(90deg)` 原点左上，(x,y)→(W-y,x)。
 */
export function clientToHostLocal(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;
  const rotated = host.classList.contains('isForceLandscape') || !!host.closest('.isForceLandscape');
  if (!rotated) {
    return { x: vx, y: vy };
  }
  return { x: vy, y: rect.width - vx };
}

/** 始终按 20×12 横构图取最大舞台；竖窗上下留黑边，不改成竖 HUD。 */
export function computeLandscapeStage(viewW: number, viewH: number, insets: SafeInsets): StageRect {
  const left = insets.left + STAGE_GAP_PX;
  const right = insets.right + STAGE_GAP_PX;
  const top = insets.top + STAGE_GAP_PX;
  const bottom = insets.bottom + STAGE_GAP_PX;
  const availW = Math.max(1, viewW - left - right);
  const availH = Math.max(1, viewH - top - bottom);
  let width: number;
  let height: number;
  if (availW / availH > WORLD_ASPECT) {
    height = availH;
    width = height * WORLD_ASPECT;
  } else {
    width = availW;
    height = width / WORLD_ASPECT;
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
  host.classList.toggle('isPortrait', isPortraitViewport(host.clientWidth, host.clientHeight));
}
