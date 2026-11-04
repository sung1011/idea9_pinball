import type { ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

const STICK_DEADZONE = 0.16;

export type TouchPadStatus = {
  aimingSlot: number;
  skillCd: number;
  fineTuneOn: boolean;
};

export type TouchPad = {
  sync: (status: TouchPadStatus) => void;
};

function bindStick(stick: HTMLElement, base: HTMLElement, knob: HTMLElement, bus: ActionBus): void {
  let pointerId: number | null = null;

  const placeKnob = (nx: number, ny: number): void => {
    knob.style.transform = `translate(${nx * 34}%, ${ny * 34}%)`;
  };

  const updateFromEvent = (ev: PointerEvent): void => {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = ev.clientX - cx;
    let dy = ev.clientY - cy;
    const max = Math.max(rect.width, rect.height) / 2;
    const len = Math.hypot(dx, dy);
    if (len > max && max > 0) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    const nx = max > 0 ? dx / max : 0;
    const ny = max > 0 ? dy / max : 0;
    placeKnob(nx, ny);
    const mag = Math.hypot(nx, ny);
    if (mag < STICK_DEADZONE) {
      bus.setStick(0, 0, true);
      return;
    }
    bus.setStick(nx, ny, true);
  };

  const endStick = (ev: PointerEvent): void => {
    if (pointerId === null || ev.pointerId !== pointerId) {
      return;
    }
    pointerId = null;
    placeKnob(0, 0);
    bus.setStick(0, 0, false);
  };

  stick.addEventListener('pointerdown', (ev: PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    pointerId = ev.pointerId;
    stick.setPointerCapture(ev.pointerId);
    updateFromEvent(ev);
  });
  stick.addEventListener('pointermove', (ev: PointerEvent) => {
    if (pointerId === null || ev.pointerId !== pointerId) {
      return;
    }
    ev.preventDefault();
    updateFromEvent(ev);
  });
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
}

function preventPageGestures(): void {
  const block = (ev: Event): void => {
    ev.preventDefault();
  };
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block);
  document.addEventListener('gesturechange', block);
  document.addEventListener('gestureend', block);
}

/** 横屏虚拟键：左摇杆 Aim/FineTune，右四键技能。点空白取消由 pcInput 按 touch 处理。 */
export function createTouchPad(host: HTMLElement, bus: ActionBus): TouchPad {
  const root = document.createElement('div');
  root.className = 'touchLayer';

  const stick = document.createElement('div');
  stick.className = 'touchStick';
  stick.dataset.touchControl = 'stick';
  const base = document.createElement('div');
  base.className = 'touchStickBase';
  const knob = document.createElement('div');
  knob.className = 'touchStickKnob';
  base.appendChild(knob);
  stick.appendChild(base);

  const skills = document.createElement('div');
  skills.className = 'touchSkills';
  skills.dataset.touchControl = 'skills';
  const buttons: HTMLButtonElement[] = [];
  for (let slot = 1; slot <= 4; slot += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'touchSkillBtn';
    btn.dataset.touchControl = 'skill';
    btn.dataset.slot = String(slot);
    btn.textContent = String(slot);
    btn.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      bus.pushSkill(slot as SkillSlot);
    });
    skills.appendChild(btn);
    buttons.push(btn);
  }

  root.append(stick, skills);
  host.appendChild(root);
  bindStick(stick, base, knob, bus);
  preventPageGestures();

  return {
    sync: (status: TouchPadStatus) => {
      root.classList.toggle('isFineTune', status.fineTuneOn);
      for (let i = 0; i < buttons.length; i += 1) {
        const slot = i + 1;
        buttons[i].classList.toggle('isAiming', status.aimingSlot === slot);
        buttons[i].classList.toggle('isCd', status.skillCd > 0);
      }
    },
  };
}
