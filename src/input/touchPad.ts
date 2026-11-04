import type { ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

export type TouchPadStatus = {
  aimingSlot: number;
  skillCd: number;
  fineTuneOn: boolean;
};

export type TouchPad = {
  sync: (status: TouchPadStatus) => void;
};

function preventPageGestures(): void {
  const block = (ev: Event): void => {
    ev.preventDefault();
  };
  document.addEventListener('touchmove', block, { passive: false });
  document.addEventListener('gesturestart', block);
  document.addEventListener('gesturechange', block);
  document.addEventListener('gestureend', block);
}

/** 右侧技能四键；无左摇杆。点在键上不抢 Aim（data-touch-control）。 */
export function createTouchPad(host: HTMLElement, bus: ActionBus): TouchPad {
  const root = document.createElement('div');
  root.className = 'touchLayer';

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

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'touchCancel';
  cancel.dataset.touchControl = 'cancel';
  cancel.hidden = true;
  cancel.textContent = '取消';
  cancel.addEventListener('pointerdown', (ev: PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    bus.pushCancel();
  });

  root.append(skills, cancel);
  host.appendChild(root);
  preventPageGestures();

  return {
    sync: (status: TouchPadStatus) => {
      root.classList.toggle('isFineTune', status.fineTuneOn);
      cancel.hidden = status.aimingSlot === 0;
      for (let i = 0; i < buttons.length; i += 1) {
        const slot = i + 1;
        buttons[i].classList.toggle('isAiming', status.aimingSlot === slot);
        buttons[i].classList.toggle('isCd', status.skillCd > 0);
      }
    },
  };
}
