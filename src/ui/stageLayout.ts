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

/** 视口竖持（高>宽）时整屏按横屏排再转 90°，没有第二套竖屏可玩布局。 */
export function wantsForceLandscape(width = window.innerWidth, height = window.innerHeight): boolean {
  return isPortraitViewport(width, height);
}

/**
 * 竖持时 #app 按横屏盒子排：宽=视口长边（高），高=视口短边（宽），再 90° CW。
 * 家庭键/手机底边在右（常见右手横握）时画面正向。尺寸用视口像素，避免 dvh 对不齐。
 */
export function syncForceLandscape(
  host: HTMLElement,
  viewW = window.innerWidth,
  viewH = window.innerHeight,
): boolean {
  const wasForced = host.classList.contains('isForceLandscape');
  const force = wantsForceLandscape(viewW, viewH);
  host.classList.toggle('isForceLandscape', force);
  if (force) {
    host.style.width = `${viewH}px`;
    host.style.height = `${viewW}px`;
    host.style.transformOrigin = 'top left';
    host.style.transform = `translate(${viewW}px, 0) rotate(90deg)`;
  } else if (wasForced) {
    host.style.width = '';
    host.style.height = '';
    host.style.transform = '';
    host.style.transformOrigin = '';
  }
  return force;
}

/** 强制横屏后的舞台尺寸：宽=视口高（长边），高=视口宽（短边）。 */
export function forceLandscapeViewSize(viewW: number, viewH: number): { width: number; height: number } {
  return { width: viewH, height: viewW };
}

/**
 * 90° CW 后安全区：游戏顶沿手机右、左沿手机顶、底沿手机左、右沿手机底。
 * 家庭键在右横握时，物理底边对应游戏右侧。
 */
export function remapInsetsForForceLandscape(insets: SafeInsets): SafeInsets {
  return {
    top: insets.right,
    right: insets.bottom,
    bottom: insets.left,
    left: insets.top,
  };
}

function isForceLandscapeHost(host: HTMLElement): boolean {
  return host.classList.contains('isForceLandscape') || !!host.closest('.isForceLandscape');
}

/**
 * 视口 client 坐标 → 宿主本地坐标。
 * 未旋转：按 AABB 差值。
 * 强制横屏 `translate(viewW,0) rotate(90deg)`：原点左上，(vx,vy)→(vy, AABB宽−vx)。
 */
export function clientToHostLocal(
  host: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = host.getBoundingClientRect();
  const vx = clientX - rect.left;
  const vy = clientY - rect.top;
  if (!isForceLandscapeHost(host)) {
    return { x: vx, y: vy };
  }
  return { x: vy, y: rect.width - vx };
}

/**
 * 按世界比例 cover 铺满可用安全区，保持比例不拉伸。
 * 永远按传入的横屏盒子计算：956:440 恰好看全图；更方的屏（如 16:9）左右略裁；更宽的屏裁上下。
 * 竖持时先互换宽高再调用，不在这里排竖屏战场。
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
  const layoutW = host.clientWidth;
  const layoutH = host.clientHeight;
  const portrait = isPortraitViewport(layoutW, layoutH);
  host.classList.toggle('isPortrait', portrait);
  host.classList.toggle('isLandscape', !portrait);
  host.classList.toggle('isShortHud', layoutH <= 430);
  host.classList.toggle('isNarrowHud', layoutW <= 420);
}
