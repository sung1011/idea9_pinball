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

export type RotateHintInput = {
  viewW: number;
  viewH: number;
  screenPortrait: boolean;
  hoverNone: boolean;
  coarsePointer: boolean;
};

/** 设备竖持才转横提示。PC 把窗口拉窄只 letterbox，不挡操作。 */
export function shouldShowRotateHint(input: RotateHintInput): boolean {
  if (!isPortraitViewport(input.viewW, input.viewH)) {
    return false;
  }
  if (!input.screenPortrait) {
    return false;
  }
  return input.hoverNone && input.coarsePointer;
}

export function wantsRotateHint(width = window.innerWidth, height = window.innerHeight): boolean {
  return shouldShowRotateHint({
    viewW: width,
    viewH: height,
    screenPortrait: isScreenPortrait(),
    hoverNone: window.matchMedia('(hover: none)').matches,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  });
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
  host.classList.toggle('isRotateHint', wantsRotateHint(host.clientWidth, host.clientHeight));
}
