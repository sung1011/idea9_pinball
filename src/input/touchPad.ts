import type { SkillCds } from '../core/skillCaster';
import type { HeroId } from '../heroes/heroIds';
import { skillShorts, skillTipCopy } from '../heroes/kitLabels';
import { createSkillTip, SKILL_TIP_HOLD_MS } from '../ui/skillTip';
import type { ActionBus } from './actionBus';
import type { SkillSlot } from './actionTypes';

export type TouchPadStatus = {
  aimingSlot: number;
  skillCds: SkillCds;
  windupSlot?: number;
  fineTuneOn: boolean;
  hero?: HeroId;
};

export type TouchPad = {
  sync: (status: TouchPadStatus) => void;
};

export type TouchPadOpts = {
  /** 测试可设 0：按下立刻出提示。正式约 0.4s。 */
  holdMs?: number;
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
  return slot === 1 || slot === 2 || slot === 3 || slot === 4;
}

/** 右侧技能四键；无左摇杆。点在键上不抢 Aim（data-touch-control）。 */
export function createTouchPad(host: HTMLElement, bus: ActionBus, opts: TouchPadOpts = {}): TouchPad {
  const holdMs = opts.holdMs ?? SKILL_TIP_HOLD_MS;
  const root = document.createElement('div');
  root.className = 'touchLayer';

  const skills = document.createElement('div');
  skills.className = 'touchSkills';
  skills.dataset.touchControl = 'skills';
  const buttons: HTMLButtonElement[] = [];
  let hero: HeroId = 'hook';
  let holdTimer = 0;
  let holdSlot: SkillSlot | 0 = 0;
  const tip = createSkillTip(root);

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

  for (let slot = 1; slot <= 4; slot += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'touchSkillBtn';
    btn.dataset.touchControl = 'skill';
    btn.dataset.slot = String(slot);
    btn.textContent = skillShorts('hook')[slot - 1] ?? String(slot);
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

  root.append(skills, cancel);
  host.appendChild(root);
  preventPageGestures();

  return {
    sync: (status: TouchPadStatus) => {
      hero = status.hero ?? 'hook';
      root.classList.toggle('isFineTune', status.fineTuneOn);
      cancel.hidden = status.aimingSlot === 0;
      const shorts = skillShorts(hero);
      for (let i = 0; i < buttons.length; i += 1) {
        const slot = i + 1;
        buttons[i].textContent = shorts[i] ?? String(slot);
        buttons[i].classList.toggle('isAiming', status.aimingSlot === slot || status.windupSlot === slot);
        buttons[i].classList.toggle('isCd', (status.skillCds[i] ?? 0) > 0);
      }
      if (tip.isOn() && isSkillSlot(holdSlot)) {
        tip.syncCopy(skillTipCopy(hero, holdSlot));
      }
    },
  };
}
