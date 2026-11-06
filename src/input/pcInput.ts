import { screenToLogical, type WorldTransform } from '../render/worldTransform';
import { clientToHostLocal } from '../ui/stageLayout';
import { isAimUiTarget, type ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

const SKILL_KEYS: Record<string, SkillSlot> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
};

/** 触屏位移超过此像素视为滑动（只改瞄准），否则视为点空白。 */
export const TOUCH_AIM_TAP_SLOP_PX = 12;

type TouchAimStroke = {
  pointerId: number;
  startX: number;
  startY: number;
  dragged: boolean;
};

function isTouchPointer(ev: PointerEvent): boolean {
  return ev.pointerType === 'touch';
}

function trackPointer(
  ev: PointerEvent,
  canvas: HTMLCanvasElement,
  getTransform: () => WorldTransform,
  bus: ActionBus,
): void {
  if (isAimUiTarget(ev.target)) {
    return;
  }
  const frame = canvas.parentElement ?? canvas;
  const local = clientToHostLocal(frame, ev.clientX, ev.clientY);
  const world = screenToLogical(local.x, local.y, getTransform());
  bus.setPointerLogical(world.x, world.y);
}

function markStrokeMoved(stroke: TouchAimStroke, ev: PointerEvent): void {
  if (ev.pointerId !== stroke.pointerId) {
    return;
  }
  const dist = Math.hypot(ev.clientX - stroke.startX, ev.clientY - stroke.startY);
  if (dist > TOUCH_AIM_TAP_SLOP_PX) {
    stroke.dragged = true;
  }
}

/** PC：鼠标持续设 targetDir；技能仅 1–4；左键释放；右键 / Esc 取消。R 只重开一局。触屏瞄准中点空白=瞄向并释放，滑动只改向。 */
export function bindPcInput(opts: {
  bus: ActionBus;
  canvas: HTMLCanvasElement;
  getTransform: () => WorldTransform;
  getAimingSlot: () => SkillSlot | 0;
}): () => void {
  let stroke: TouchAimStroke | null = null;

  const onMove = (ev: PointerEvent): void => {
    if (stroke) {
      markStrokeMoved(stroke, ev);
    }
    const liveTouch = !!stroke && ev.pointerId === stroke.pointerId;
    if (ev.pointerType !== 'mouse' && ev.buttons === 0 && !liveTouch) {
      return;
    }
    trackPointer(ev, opts.canvas, opts.getTransform, opts.bus);
  };

  const onDown = (ev: PointerEvent): void => {
    if (isAimUiTarget(ev.target)) {
      return;
    }
    trackPointer(ev, opts.canvas, opts.getTransform, opts.bus);
    if (ev.pointerType === 'mouse' && ev.button === 0) {
      opts.bus.pushRelease();
    }
    if (ev.button === 2) {
      ev.preventDefault();
      opts.bus.pushCancel();
    }
    if (isTouchPointer(ev) && !stroke) {
      stroke = {
        pointerId: ev.pointerId,
        startX: ev.clientX,
        startY: ev.clientY,
        dragged: false,
      };
    }
  };

  const onUp = (ev: PointerEvent): void => {
    if (!stroke || ev.pointerId !== stroke.pointerId) {
      return;
    }
    const dragged = stroke.dragged;
    stroke = null;
    if (dragged || isAimUiTarget(ev.target) || opts.getAimingSlot() === 0) {
      return;
    }
    trackPointer(ev, opts.canvas, opts.getTransform, opts.bus);
    opts.bus.pushRelease();
  };

  const onCancel = (ev: PointerEvent): void => {
    if (stroke && ev.pointerId === stroke.pointerId) {
      stroke = null;
    }
  };

  const onKey = (ev: KeyboardEvent): void => {
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) {
      return;
    }
    if (isAimUiTarget(ev.target)) {
      return;
    }
    const key = ev.key.toLowerCase();
    if (key === 'escape') {
      ev.preventDefault();
      opts.bus.pushCancel();
      return;
    }
    const slot = SKILL_KEYS[key];
    if (!slot) {
      return;
    }
    ev.preventDefault();
    opts.bus.pushSkill(slot);
  };

  const onContext = (ev: Event): void => {
    ev.preventDefault();
  };

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);
  window.addEventListener('contextmenu', onContext);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('contextmenu', onContext);
  };
}
