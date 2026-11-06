import type { SkillTipCopy } from '../heroes/kitLabels';
import { clientToHostLocal } from './stageLayout';

/** 长按约 0.4s 才出提示，避免挡住点按进瞄 / 同键释放。 */
export const SKILL_TIP_HOLD_MS = 400;

export type SkillTip = {
  show: (anchor: HTMLElement, copy: SkillTipCopy) => void;
  hide: () => void;
  isOn: () => boolean;
  syncCopy: (copy: SkillTipCopy) => void;
  relayout: () => void;
};

/** 浮在技能键上方的短提示；不挡场地中心。 */
export function createSkillTip(host: HTMLElement, getClearance?: () => HTMLElement | null): SkillTip {
  const root = document.createElement('div');
  root.className = 'skillTip';
  root.setAttribute('aria-hidden', 'true');
  const name = document.createElement('div');
  name.className = 'skillTipName';
  const effect = document.createElement('div');
  effect.className = 'skillTipEffect';
  root.append(name, effect);
  host.appendChild(root);

  let anchor: HTMLElement | null = null;

  const write = (copy: SkillTipCopy): void => {
    name.textContent = copy.name;
    effect.textContent = copy.effect;
  };

  const place = (): void => {
    if (!anchor) {
      return;
    }
    const btnRect = anchor.getBoundingClientRect();
    const tipW = root.offsetWidth;
    const center = clientToHostLocal(host, btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2);
    const topLeft = clientToHostLocal(host, btnRect.left, btnRect.top);
    const botRight = clientToHostLocal(host, btnRect.right, btnRect.bottom);
    const localTop = Math.min(topLeft.y, botRight.y);
    const minCenter = tipW / 2 + 6;
    const maxCenter = host.clientWidth - tipW / 2 - 6;
    const x = Math.min(maxCenter, Math.max(minCenter, center.x));
    let top = Math.max(6, localTop - 8);
    const clearance = getClearance?.() ?? host.querySelector<HTMLElement>('.touchCancel');
    if (clearance && !clearance.hidden) {
      const cancelRect = clearance.getBoundingClientRect();
      const hostRect = host.getBoundingClientRect();
      if (cancelRect.width > 0 && cancelRect.height > 0 && hostRect.width > 0) {
        const tipLeft = hostRect.left + x - tipW / 2;
        const tipRight = tipLeft + tipW;
        const overlapsX = tipRight > cancelRect.left && tipLeft < cancelRect.right;
        if (overlapsX) {
          top = cancelRect.top - hostRect.top - 8;
        }
      }
    }
    root.style.left = `${x}px`;
    root.style.top = `${top}px`;
  };

  return {
    show(next, copy) {
      anchor = next;
      write(copy);
      root.classList.add('isOn');
      root.setAttribute('aria-hidden', 'false');
      place();
    },
    hide() {
      anchor = null;
      root.classList.remove('isOn');
      root.setAttribute('aria-hidden', 'true');
    },
    isOn() {
      return root.classList.contains('isOn');
    },
    syncCopy(copy) {
      if (!root.classList.contains('isOn')) {
        return;
      }
      write(copy);
      place();
    },
    relayout() {
      place();
    },
  };
}
