import type { SkillCds } from '../core/skillCaster';
import { ULT_ENERGY_MAX } from '../core/ultEnergy';
import type { HeroId } from '../heroes/heroIds';
import { skillNames, skillShorts, skillTipCopy, ultName, ultShort, ULT_TODO_COPY } from '../heroes/kitLabels';
import { skillIconUrl } from '../heroes/skillIcons';
import {
  bindSkillIcon,
  createSkillCdFace,
  nextSkillCdTotal,
  syncSkillCdFace,
  type SkillCdFace,
} from '../ui/skillCdMask';
import { createSkillTip, SKILL_TIP_HOLD_MS } from '../ui/skillTip';
import { createAimStick } from './aimStick';
import type { ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

export type TouchPadStatus = {
  aimingSlot: number;
  skillCds: SkillCds;
  windupSlot?: number;
  fineTuneOn: boolean;
  hero?: HeroId;
  energy?: number;
  /** 死亡 / 结算时关摇杆，避免残留改向。默认开。 */
  stickEnabled?: boolean;
};

export type TouchPad = {
  sync: (status: TouchPadStatus) => void;
  showTodo: () => void;
  releaseStick: () => void;
};

export type TouchPadOpts = {
  /** 测试可设 0：按下立刻出提示。正式约 0.4s。 */
  holdMs?: number;
  /** 测试强制常显摇杆（桌面自测没有 coarse pointer）。 */
  forceStick?: boolean;
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

function isSkillSlot(slot: number): slot is SkillSlot {
  return slot === 1 || slot === 2 || slot === 3 || slot === 4 || slot === 5;
}

/** 横排技能四键 Skill1–4，其左第五键必杀+能量；锚在视窗右下。瞄准中「取消」锚在当前技能正上方。点在键上不抢 Aim（data-touch-control）。 */
export function createTouchPad(host: HTMLElement, bus: ActionBus, opts: TouchPadOpts = {}): TouchPad {
  const holdMs = opts.holdMs ?? SKILL_TIP_HOLD_MS;
  const root = document.createElement('div');
  root.className = 'touchLayer';

  const skills = document.createElement('div');
  skills.className = 'touchSkills';
  skills.dataset.touchControl = 'skills';
  const buttons: HTMLButtonElement[] = [];
  const faces: SkillCdFace[] = [];
  const cdTotals = [0, 0, 0, 0];
  let hero: HeroId = 'hook';
  let holdTimer = 0;
  let holdSlot: SkillSlot | 0 = 0;
  let cancelBtn: HTMLButtonElement | null = null;
  let todoTimer = 0;
  const tip = createSkillTip(root, () => (cancelBtn && !cancelBtn.hidden ? cancelBtn : null));

  const ultWrap = document.createElement('div');
  ultWrap.className = 'touchUlt';
  ultWrap.dataset.touchControl = 'ult';
  const ultRing = document.createElement('span');
  ultRing.className = 'touchUltRing';
  ultRing.setAttribute('aria-hidden', 'true');
  const ultBtn = document.createElement('button');
  ultBtn.type = 'button';
  ultBtn.className = 'touchUltBtn';
  ultBtn.dataset.touchControl = 'skill';
  ultBtn.dataset.slot = '5';
  const ultNameEl = document.createElement('span');
  ultNameEl.className = 'touchUltName';
  ultNameEl.textContent = ultShort('hook');
  const ultNeed = document.createElement('span');
  ultNeed.className = 'touchUltNeed';
  ultNeed.setAttribute('aria-hidden', 'true');
  ultBtn.append(ultNameEl, ultNeed);
  const ultTodo = document.createElement('div');
  ultTodo.className = 'touchUltTodo';
  ultTodo.textContent = ULT_TODO_COPY;
  ultWrap.append(ultRing, ultBtn, ultTodo);

  const hideTodo = (): void => {
    if (todoTimer) {
      window.clearTimeout(todoTimer);
      todoTimer = 0;
    }
    ultTodo.classList.remove('isOn');
  };

  const showTodo = (): void => {
    hideTodo();
    ultTodo.textContent = ULT_TODO_COPY;
    ultTodo.classList.add('isOn');
    todoTimer = window.setTimeout(() => {
      todoTimer = 0;
      ultTodo.classList.remove('isOn');
    }, 1100);
  };

  const hideTip = (): void => {
    if (holdTimer) {
      window.clearTimeout(holdTimer);
      holdTimer = 0;
    }
    holdSlot = 0;
    tip.hide();
  };

  const showTip = (slot: SkillSlot, btn: HTMLElement): void => {
    tip.show(btn, skillTipCopy(hero, slot));
  };

  const beginHold = (slot: SkillSlot, btn: HTMLElement): void => {
    hideTip();
    holdSlot = slot;
    if (holdMs <= 0) {
      showTip(slot, btn);
      return;
    }
    holdTimer = window.setTimeout(() => {
      holdTimer = 0;
      showTip(slot, btn);
    }, holdMs);
  };

  skills.appendChild(ultWrap);

  ultBtn.addEventListener('pointerdown', (ev: PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    bus.pushSkill(5);
    try {
      ultBtn.setPointerCapture(ev.pointerId);
    } catch {
      // 启动自测可能未接入文档。
    }
    beginHold(5, ultBtn);
  });
  ultBtn.addEventListener('pointerup', (ev: PointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    hideTip();
  });
  ultBtn.addEventListener('pointercancel', () => {
    hideTip();
  });
  ultBtn.addEventListener('contextmenu', (ev: Event) => {
    ev.preventDefault();
  });

  for (let slot = 1; slot <= 4; slot += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'touchSkillBtn';
    btn.dataset.touchControl = 'skill';
    btn.dataset.slot = String(slot);
    faces.push(createSkillCdFace(btn, skillShorts('hook')[slot - 1] ?? String(slot)));
    btn.addEventListener('pointerdown', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      bus.pushSkill(slot as SkillSlot);
      try {
        btn.setPointerCapture(ev.pointerId);
      } catch {
        // 未接入文档时（启动自测）没有捕获，松开靠 pointerup。
      }
      beginHold(slot as SkillSlot, btn);
    });
    btn.addEventListener('pointerup', (ev: PointerEvent) => {
      ev.preventDefault();
      ev.stopPropagation();
      hideTip();
    });
    btn.addEventListener('pointercancel', () => {
      hideTip();
    });
    btn.addEventListener('contextmenu', (ev: Event) => {
      ev.preventDefault();
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
    hideTip();
    bus.pushCancel();
  });

  const onGlobalRelease = (): void => {
    hideTip();
  };
  window.addEventListener('pointerup', onGlobalRelease);
  window.addEventListener('pointercancel', onGlobalRelease);

  cancelBtn = cancel;
  skills.appendChild(cancel);
  const stick = createAimStick(root, bus, { forceOn: opts.forceStick === true });
  root.append(skills);
  host.appendChild(root);
  preventPageGestures();

  const placeCancel = (slot: number): void => {
    if (!isSkillSlot(slot)) {
      cancel.hidden = true;
      return;
    }
    const btn = slot === 5 ? ultBtn : buttons[slot - 1];
    cancel.hidden = false;
    cancel.style.left = `${btn.offsetLeft + btn.offsetWidth / 2}px`;
  };

  return {
    showTodo,
    releaseStick: () => {
      stick.release();
    },
    sync: (status: TouchPadStatus) => {
      hero = status.hero ?? 'hook';
      root.classList.toggle('isFineTune', status.fineTuneOn);
      stick.setEnabled(status.stickEnabled !== false);
      placeCancel(status.aimingSlot);
      const shorts = skillShorts(hero);
      const names = skillNames(hero);
      for (let i = 0; i < buttons.length; i += 1) {
        const slot = (i + 1) as SkillSlot;
        const remain = status.skillCds[i] ?? 0;
        cdTotals[i] = nextSkillCdTotal(remain, cdTotals[i]);
        faces[i].name.textContent = shorts[i] ?? String(slot);
        buttons[i].setAttribute('aria-label', names[i] ?? shorts[i] ?? String(slot));
        bindSkillIcon(faces[i], skillIconUrl(hero, slot));
        buttons[i].classList.toggle('isAiming', status.aimingSlot === slot || status.windupSlot === slot);
        syncSkillCdFace(buttons[i], faces[i], remain, cdTotals[i]);
      }
      const energy = Math.max(0, Math.min(ULT_ENERGY_MAX, status.energy ?? 0));
      const filled = energy >= ULT_ENERGY_MAX - 1e-6;
      ultNameEl.textContent = ultShort(hero);
      ultBtn.setAttribute('aria-label', ultName(hero));
      ultBtn.classList.toggle('isAiming', status.aimingSlot === 5 || status.windupSlot === 5);
      ultBtn.classList.toggle('isReady', filled && hero === 'hook');
      ultWrap.classList.toggle('isHook', hero === 'hook');
      ultRing.style.setProperty('--ult-energy', (energy / ULT_ENERGY_MAX).toFixed(4));
      ultNeed.textContent = filled ? '' : String(Math.floor(energy));
      if (tip.isOn() && isSkillSlot(holdSlot)) {
        tip.syncCopy(skillTipCopy(hero, holdSlot));
      } else if (tip.isOn()) {
        tip.relayout();
      }
    },
  };
}
