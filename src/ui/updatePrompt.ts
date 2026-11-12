import type { AppVersions } from './appVersion';

export type UpdatePrompt = {
  dispose: () => void;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

/** 齿轮旁新版提示：只在 acked 之后还有更新时出现；点更新后记住并刷新。 */
export function createUpdatePrompt(host: HTMLElement, versions: AppVersions): UpdatePrompt {
  const card = el('aside', 'updatePrompt');
  card.setAttribute('data-touch-control', '');
  card.setAttribute('role', 'status');
  card.setAttribute('aria-live', 'polite');
  host.appendChild(card);

  const render = (): void => {
    const { pending } = versions.getState();
    card.replaceChildren();
    if (pending.length === 0) {
      card.classList.remove('isOn');
      return;
    }
    card.classList.add('isOn');
    card.appendChild(el('p', 'updatePromptTitle', '有新版本'));
    const apply = el('button', 'updatePromptBtn', '更新');
    apply.type = 'button';
    apply.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      void versions.applyUpdate();
    });
    card.appendChild(apply);
    const list = el('ul', 'updatePromptList');
    for (const group of pending) {
      for (const line of group.summaries) {
        list.appendChild(el('li', '', line));
      }
    }
    card.appendChild(list);
  };

  const unsub = versions.subscribe(render);
  render();
  return {
    dispose: () => {
      unsub();
      card.remove();
    },
  };
}
