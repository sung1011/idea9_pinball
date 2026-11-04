import type { SkillTipCopy } from '../heroes/kitLabels';

/** 长按约 0.4s 才出提示，避免挡住点按进瞄 / 同键释放。 */
export const SKILL_TIP_HOLD_MS = 400;

export type SkillTip = {
  show: (anchor: HTMLElement, copy: SkillTipCopy) => void;
  hide: () => void;
  isOn: () => boolean;
  syncCopy: (copy: SkillTipCopy) => void;
};

/** 浮在技能键上方的短提示；不挡场地中心。 */
export function createSkillTip(host: HTMLElement): SkillTip {
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
    const hostRect = host.getBoundingClientRect();
    const btnRect = anchor.getBoundingClientRect();
    const tipW = root.offsetWidth;
    const centerX = btnRect.left + btnRect.width / 2 - hostRect.left;
    const minCenter = tipW / 2 + 6;
    const maxCenter = hostRect.width - tipW / 2 - 6;
    const x = Math.min(maxCenter, Math.max(minCenter, centerX));
    const y = btnRect.top - hostRect.top - 8;
    root.style.left = `${x}px`;
    root.style.top = `${Math.max(6, y)}px`;
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
  };
}
