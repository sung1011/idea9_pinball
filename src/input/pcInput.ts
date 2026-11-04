import { screenToLogical, type WorldTransform } from '../render/worldTransform';
import { isAimUiTarget, type ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

const SKILL_KEYS: Record<string, SkillSlot> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
};

function trackPointer(
  ev: PointerEvent,
  canvas: HTMLCanvasElement,
  getTransform: () => WorldTransform,
  bus: ActionBus,
): void {
  if (isAimUiTarget(ev.target)) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const world = screenToLogical(ev.clientX - rect.left, ev.clientY - rect.top, getTransform());
  bus.setPointerLogical(world.x, world.y);
}

/** PC：鼠标持续设 targetDir；技能仅 1–4；左键释放；右键 / Esc 取消。R 只重开一局。触屏点地只纠偏。 */
export function bindPcInput(opts: {
  bus: ActionBus;
  canvas: HTMLCanvasElement;
  getTransform: () => WorldTransform;
}): () => void {
  const onMove = (ev: PointerEvent): void => {
    if (ev.pointerType !== 'mouse' && ev.buttons === 0) {
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
  window.addEventListener('keydown', onKey);
  window.addEventListener('contextmenu', onContext);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('contextmenu', onContext);
  };
}
