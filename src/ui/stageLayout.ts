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

/** 视口 client 坐标 → 宿主本地坐标。不旋转、不反解。 */
export function clientToHostLocal(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** 始终按 20×12 横构图取最大舞台；竖窗上下留黑边，横窗左右留黑边。 */
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
