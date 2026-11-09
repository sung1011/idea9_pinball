import { MAP_HEIGHT, MAP_WIDTH } from '../core/constants';
import { computeLandscapeStage, isPortraitViewport, type SafeInsets, type StageRect } from '../ui/stageLayout';
import {
  captureWorldViewLock,
  fitWorldToBox,
  placeLockedWorld,
  type WorldTransform,
  type WorldViewLock,
} from './worldTransform';

export type WorldViewLayout = {
  transform: WorldTransform;
  lock: WorldViewLock;
  stage: StageRect;
};

const NONE: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

function stageOf(transform: WorldTransform, lock: WorldViewLock): StageRect {
  return {
    x: transform.offsetX,
    y: transform.offsetY,
    width: lock.pixelW,
    height: lock.pixelH,
  };
}

/** 宽≥高视为稳定横屏（含正方）；竖窗不永久锁比例。 */
export function canLockWorldView(viewW: number, viewH: number): boolean {
  return !isPortraitViewport(viewW, viewH);
}

/** 进入/刷新：按当前窗做一次既有 cover 适配。仅横屏结果应由会话锁住。 */
export function enterWorldView(viewW: number, viewH: number, insets: SafeInsets = NONE): WorldViewLayout {
  const cover = computeLandscapeStage(viewW, viewH, insets);
  const transform = fitWorldToBox(cover.x, cover.y, cover.width, cover.height, MAP_WIDTH, MAP_HEIGHT);
  const lock = captureWorldViewLock(transform, MAP_WIDTH, MAP_HEIGHT);
  return { transform, lock, stage: stageOf(transform, lock) };
}

/** 窗口变化：只把锁定战场放进当前安全区，不改比例。 */
export function followWorldView(
  viewW: number,
  viewH: number,
  lock: WorldViewLock,
  insets: SafeInsets = NONE,
): WorldViewLayout {
  const boxW = Math.max(1, viewW - insets.left - insets.right);
  const boxH = Math.max(1, viewH - insets.top - insets.bottom);
  const transform = placeLockedWorld(insets.left, insets.top, boxW, boxH, lock);
  return { transform, lock, stage: stageOf(transform, lock) };
}

export type WorldViewSession = {
  enter: (viewW: number, viewH: number, insets?: SafeInsets) => WorldViewLayout;
  follow: (viewW: number, viewH: number, insets?: SafeInsets) => WorldViewLayout;
  getLock: () => WorldViewLock | null;
};

/**
 * 首次稳定横屏才锁 scale/pixelW/pixelH。
 * 竖窗只做临时 cover、不锁死；横屏直进一次适配即锁。
 * 锁后 resize / visualViewport 只 follow；再次 enter（刷新）才重新走首次适配。
 */
export function createWorldViewSession(): WorldViewSession {
  let lock: WorldViewLock | null = null;
  return {
    enter: (viewW, viewH, insets = NONE) => {
      const layout = enterWorldView(viewW, viewH, insets);
      if (canLockWorldView(viewW, viewH)) {
        lock = layout.lock;
      } else {
        lock = null;
      }
      return layout;
    },
    follow: (viewW, viewH, insets = NONE) => {
      if (!lock) {
        const layout = enterWorldView(viewW, viewH, insets);
        if (canLockWorldView(viewW, viewH)) {
          lock = layout.lock;
        }
        return layout;
      }
      return followWorldView(viewW, viewH, lock, insets);
    },
    getLock: () => lock,
  };
}
