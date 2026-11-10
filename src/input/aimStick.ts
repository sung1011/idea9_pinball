import type { ActionBus } from './actionBus';

/** 外径约 96–112 CSS px；正式横屏 104，矮窗 96。 */
export const AIM_STICK_SIZE_PX = 104;
export const AIM_STICK_SIZE_SHORT_PX = 96;
export const AIM_STICK_DEADZONE = 0.12;

export type StickRead = {
  knobX: number;
  knobY: number;
  dirX: number;
  dirY: number;
  active: boolean;
};

export type AimStick = {
  root: HTMLDivElement;
  setEnabled: (on: boolean) => void;
  release: () => void;
  dispose: () => void;
};

/** 相对底座中心的偏移 → 钳制后的摇杆头与单位方向。死区内无朝向输出。 */
export function readStickOffset(dx: number, dy: number, radius: number): StickRead {
  const r = Math.max(1, radius);
  const len = Math.hypot(dx, dy);
  const clamp = len > r && len > 1e-8 ? r / len : 1;
  const knobX = dx * clamp;
  const knobY = dy * clamp;
  const mag = Math.hypot(knobX, knobY) / r;
  if (mag < AIM_STICK_DEADZONE || mag < 1e-8) {
    return { knobX, knobY, dirX: 0, dirY: 0, active: false };
  }
  const n = Math.hypot(knobX, knobY);
  return { knobX, knobY, dirX: knobX / n, dirY: knobY / n, active: true };
}

function coarseStickQuery(): string {
  return '(pointer: coarse), (any-pointer: coarse), (hover: none)';
}

/** 左下半透明圆底座+圆头。输出单位方向给现有瞄准，不写世界坐标点。 */
export function createAimStick(host: HTMLElement, bus: ActionBus, opts: { forceOn?: boolean } = {}): AimStick {
  const root = document.createElement('div');
  root.className = 'touchStick';
  root.dataset.touchControl = 'stick';
  root.setAttribute('aria-label', '瞄准摇杆');
  root.setAttribute('role', 'slider');
  const base = document.createElement('div');
  base.className = 'touchStickBase';
  const head = document.createElement('div');
  head.className = 'touchStickHead';
  root.append(base, head);
  if (opts.forceOn) {
    root.classList.add('isForced');
  }
  host.appendChild(root);

  let pointerId: number | null = null;
  let enabled = true;

  const placeHead = (x: number, y: number): void => {
    head.style.transform = `translate(${x}px, ${y}px)`;
  };

  const restHead = (): void => {
    placeHead(0, 0);
  };

  const applyEvent = (ev: PointerEvent): void => {
    const box = root.getBoundingClientRect();
    const radius = box.width / 2;
    const read = readStickOffset(ev.clientX - (box.left + radius), ev.clientY - (box.top + radius), radius);
    placeHead(read.knobX, read.knobY);
    if (read.active) {
      bus.holdStick(read.dirX, read.dirY);
    } else {
      bus.holdStick();
    }
  };

  const hasCapture = (id: number): boolean => {
    try {
      return root.hasPointerCapture(id);
    } catch {
      return false;
    }
  };

  const endStick = (): void => {
    if (pointerId === null) {
      restHead();
      bus.releaseStick();
      return;
    }
    const id = pointerId;
    pointerId = null;
    try {
      if (hasCapture(id)) {
        root.releasePointerCapture(id);
      }
    } catch {
      // 启动自测可能未接入文档。
    }
    restHead();
    bus.releaseStick();
  };

  const onDown = (ev: PointerEvent): void => {
    if (!enabled) {
      ev.preventDefault();
      ev.stopPropagation();
      return;
    }
    if (pointerId !== null) {
      if (hasCapture(pointerId)) {
        ev.preventDefault();
        ev.stopPropagation();
        return;
      }
      endStick();
    }
    ev.preventDefault();
    ev.stopPropagation();
    pointerId = ev.pointerId;
    try {
      root.setPointerCapture(ev.pointerId);
    } catch {
      // 未接入文档时（启动自测）没有捕获。
    }
    applyEvent(ev);
  };

  const onMove = (ev: PointerEvent): void => {
    if (pointerId === null || ev.pointerId !== pointerId) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    applyEvent(ev);
  };

  const onUp = (ev: PointerEvent): void => {
    if (pointerId === null || ev.pointerId !== pointerId) {
      return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    endStick();
  };

  const onLost = (ev: PointerEvent): void => {
    if (pointerId === null || ev.pointerId !== pointerId) {
      return;
    }
    endStick();
  };

  const onWindowUp = (ev: PointerEvent): void => {
    if (pointerId === null || ev.pointerId !== pointerId) {
      return;
    }
    endStick();
  };

  const onBlur = (): void => {
    endStick();
  };

  const onOrient = (): void => {
    endStick();
  };

  const onVis = (): void => {
    if (document.visibilityState === 'hidden') {
      endStick();
    }
  };

  const onTouchShow = (ev: PointerEvent): void => {
    if (ev.pointerType === 'touch') {
      host.classList.add('isAimStickOn');
    }
  };

  const syncCoarse = (): void => {
    try {
      if (window.matchMedia(coarseStickQuery()).matches) {
        host.classList.add('isAimStickOn');
      }
    } catch {
      // matchMedia 在部分自测环境不可用。
    }
  };

  root.addEventListener('pointerdown', onDown);
  root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp);
  root.addEventListener('lostpointercapture', onLost);
  root.addEventListener('contextmenu', (ev: Event) => {
    ev.preventDefault();
  });
  window.addEventListener('pointerup', onWindowUp, true);
  window.addEventListener('pointercancel', onWindowUp, true);
  window.addEventListener('blur', onBlur);
  window.addEventListener('orientationchange', onOrient);
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pointerdown', onTouchShow);
  syncCoarse();

  return {
    root,
    setEnabled: (on: boolean) => {
      enabled = on;
      root.classList.toggle('isOff', !on);
      if (!on) {
        endStick();
      }
    },
    release: endStick,
    dispose: () => {
      endStick();
      root.removeEventListener('pointerdown', onDown);
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp);
      root.removeEventListener('lostpointercapture', onLost);
      window.removeEventListener('pointerup', onWindowUp, true);
      window.removeEventListener('pointercancel', onWindowUp, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('orientationchange', onOrient);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerdown', onTouchShow);
      root.remove();
    },
  };
}
