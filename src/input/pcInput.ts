import { screenToLogical, type WorldTransform } from '../render/worldTransform';
import type { ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

const SKILL_KEYS: Record<string, SkillSlot> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  q: 1,
  w: 2,
  e: 3,
};

function isVirtualControl(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-touch-control]');
}

function trackMouse(
  ev: PointerEvent,
  canvas: HTMLCanvasElement,
  getTransform: () => WorldTransform,
  bus: ActionBus,
): void {
  if (ev.pointerType === 'touch') {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const world = screenToLogical(ev.clientX - rect.left, ev.clientY - rect.top, getTransform());
  bus.setMouseLogical(world.x, world.y);
}

/** PC：鼠标改 Aim；1–4 / QWE 技能；左键释放；右键 / Esc 取消。R 留给调试重置。 */
export function bindPcInput(opts: {
  bus: ActionBus;
  canvas: HTMLCanvasElement;
  getTransform: () => WorldTransform;
}): () => void {
  const onMove = (ev: PointerEvent): void => {
    trackMouse(ev, opts.canvas, opts.getTransform, opts.bus);
  };

  const onDown = (ev: PointerEvent): void => {
    trackMouse(ev, opts.canvas, opts.getTransform, opts.bus);
    if (isVirtualControl(ev.target)) {
      return;
    }
    if (ev.pointerType === 'touch' || ev.pointerType === 'pen') {
      opts.bus.pushCancel();
      return;
    }
    if (ev.button === 0) {
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
