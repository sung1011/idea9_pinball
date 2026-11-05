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

export type LandscapeFlipInput = {
  viewW: number;
  viewH: number;
  orientationType?: string;
  orientationAngle?: number;
};

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function angleNear180(angle: number, eps = 1): boolean {
  const delta = Math.abs(normalizeAngle(angle) - 180);
  return Math.min(delta, 360 - delta) <= eps;
}

type ScreenOrientationLike = {
  type?: string;
  angle?: number;
};

function readScreenOrientation(): { type: string; angle: number | undefined } {
  const ori = (window.screen as Screen & { orientation?: ScreenOrientationLike } | undefined)?.orientation;
  if (ori?.type) {
    return { type: ori.type, angle: typeof ori.angle === 'number' ? ori.angle : undefined };
  }
  const legacy = (window as Window & { orientation?: number }).orientation;
  if (typeof legacy === 'number') {
    if (legacy === -90 || legacy === 270) {
      return { type: 'landscape-secondary', angle: legacy };
    }
    if (legacy === 90) {
      return { type: 'landscape-primary', angle: legacy };
    }
    return { type: '', angle: legacy };
  }
  return { type: ori?.type ?? '', angle: typeof ori?.angle === 'number' ? ori.angle : undefined };
}

/**
 * 只判定横屏翻转：已是横屏且 `landscape-secondary`（或 angle ≈ 180）才扶正。
 * 竖持 / PC 窄窗只 letterbox，不因「竖」去转；`landscape-primary` / 0° 不转。
 */
export function shouldFlipLandscape(input: LandscapeFlipInput): boolean {
  if (isPortraitViewport(input.viewW, input.viewH)) {
    return false;
  }
  const type = input.orientationType ?? '';
  if (type === 'landscape-primary' || type.startsWith('portrait')) {
    return false;
  }
  if (type === 'landscape-secondary') {
    return true;
  }
  return typeof input.orientationAngle === 'number' && angleNear180(input.orientationAngle);
}

export function wantsLandscapeFlip(width = window.innerWidth, height = window.innerHeight): boolean {
  const { type, angle } = readScreenOrientation();
  return shouldFlipLandscape({
    viewW: width,
    viewH: height,
    orientationType: type,
    orientationAngle: angle,
  });
}

/** 横屏翻转时 #app 原地 180° 扶正。尺寸用视口像素，避免 dvh 与 innerHeight 对不齐。 */
export function syncLandscapeFlip(
  host: HTMLElement,
  viewW = window.innerWidth,
  viewH = window.innerHeight,
): boolean {
  const flip = wantsLandscapeFlip(viewW, viewH);
  host.classList.toggle('isLandscapeFlip', flip);
  if (flip) {
    host.style.width = `${viewW}px`;
    host.style.height = `${viewH}px`;
    host.style.transformOrigin = 'top left';
    host.style.transform = `translate(${viewW}px, ${viewH}px) rotate(180deg)`;
  } else {
    host.style.width = '';
    host.style.height = '';
    host.style.transform = '';
    host.style.transformOrigin = '';
  }
  return flip;
}

/** 180° 扶正后安全区：物理上/右/下/左 → 舞台下/左/上/右。 */
export function remapInsetsForLandscapeFlip(insets: SafeInsets): SafeInsets {
  return {
    top: insets.bottom,
    right: insets.left,
    bottom: insets.top,
    left: insets.right,
  };
}

function hostHasLandscapeFlip(host: HTMLElement): boolean {
  return host.classList.contains('isLandscapeFlip') || !!host.closest('.isLandscapeFlip');
}

/**
 * 视口 client 坐标 → 宿主本地（未旋转）坐标。
 * 横屏翻转：`translate(W,H) rotate(180deg)` 原点左上，(x,y)→(W-x,H-y)。
 */
export function clientToHostLocal(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;
  if (!hostHasLandscapeFlip(host)) {
    return { x: vx, y: vy };
  }
  return { x: rect.width - vx, y: rect.height - vy };
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
