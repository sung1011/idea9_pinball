import { wantsRotateHint } from './stageLayout';

export type RotateHint = {
  sync: () => void;
};

/** 竖屏手机：转横提示。不另做竖屏 HUD。 */
export function createRotateHint(host: HTMLElement): RotateHint {
  const root = document.createElement('div');
  root.className = 'rotateHint';
  root.setAttribute('data-touch-control', 'rotate');
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', '请横屏游玩');

  const card = document.createElement('div');
  card.className = 'rotateHintCard';

  const icon = document.createElement('div');
  icon.className = 'rotateHintIcon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<svg viewBox="0 0 64 64" width="64" height="64"><rect x="18" y="8" width="28" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="32" cy="48" r="2.4" fill="currentColor"/><path d="M50 22c6 6 6 16 0 22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M50 18v8h-8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const title = document.createElement('p');
  title.className = 'rotateHintTitle';
  title.textContent = '请将设备横过来';

  const sub = document.createElement('p');
  sub.className = 'rotateHintSub';
  sub.textContent = '本局以横屏为主，竖持不切换界面';

  card.append(icon, title, sub);
  root.appendChild(card);
  host.appendChild(root);

  const sync = (): void => {
    const on = wantsRotateHint();
    root.classList.toggle('isOn', on);
    root.setAttribute('aria-hidden', on ? 'false' : 'true');
  };

  sync();
  return { sync };
}
