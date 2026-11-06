export const ROTATE_PROMPT_COPY = '请横过来再玩';

export type RotatePrompt = {
  sync: (portrait: boolean) => void;
  isOn: () => boolean;
};

/** 竖窗全屏提示：羊皮纸木框，不旋转画面，挡住对局输入。 */
export function createRotatePrompt(host: HTMLElement): RotatePrompt {
  const overlay = document.createElement('div');
  overlay.className = 'rotatePrompt';
  overlay.setAttribute('data-touch-control', '');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-label', ROTATE_PROMPT_COPY);

  const card = document.createElement('div');
  card.className = 'rotatePromptCard';
  const msg = document.createElement('p');
  msg.className = 'rotatePromptMsg';
  msg.textContent = ROTATE_PROMPT_COPY;
  card.appendChild(msg);
  overlay.appendChild(card);
  host.appendChild(overlay);

  const block = (ev: Event): void => {
    ev.preventDefault();
    ev.stopPropagation();
  };
  overlay.addEventListener('pointerdown', block);
  overlay.addEventListener('pointermove', block);
  overlay.addEventListener('pointerup', block);
  overlay.addEventListener('touchstart', block, { passive: false });
  overlay.addEventListener('touchmove', block, { passive: false });

  return {
    sync(portrait) {
      overlay.classList.toggle('isOn', portrait);
      overlay.setAttribute('aria-hidden', portrait ? 'false' : 'true');
    },
    isOn: () => overlay.classList.contains('isOn'),
  };
}
