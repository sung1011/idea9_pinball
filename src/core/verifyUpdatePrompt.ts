import type { AppVersions, VersionGroup, VersionState } from '../ui/appVersion';
import { createUpdatePrompt } from '../ui/updatePrompt';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function group(partial: Partial<VersionGroup> & Pick<VersionGroup, 'summaries'>): VersionGroup {
  return {
    version: '0.0.70',
    date: '2026-11-12',
    ids: ['v-test'],
    ...partial,
  };
}

function mockVersions(pending: VersionGroup[], onApply?: () => void): AppVersions {
  const state: VersionState = {
    entries: [],
    grouped: pending,
    history: pending,
    installed: pending[0] ?? null,
    pending,
    flash: '',
  };
  return {
    getState: () => state,
    subscribe: () => () => {},
    refresh: async () => {},
    checkUpdate: async () => {},
    applyUpdate: async () => {
      onApply?.();
    },
    dispose: () => {},
  };
}

function mountHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement('div');
  host.style.cssText =
    `position:relative;width:${width}px;height:${height}px;overflow:hidden;` +
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;' +
    '--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  document.body.appendChild(host);
  return host;
}

function fullyInside(inner: DOMRect, outer: DOMRect, pad = 0.5): boolean {
  return (
    inner.top >= outer.top - pad &&
    inner.left >= outer.left - pad &&
    inner.bottom <= outer.bottom + pad &&
    inner.right <= outer.right + pad
  );
}

/** 有新版本弹框：更新钮在标题下、列表前；无更新不出现；点更新仍走 applyUpdate。 */
export function verifyUpdatePrompt(): void {
  const lines = ['头条说明', '第二条', '第三条'];
  const pending = [
    group({ version: '0.0.70', summaries: lines.slice(0, 2), ids: ['a'] }),
    group({ version: '0.0.69', summaries: lines.slice(2), ids: ['b'] }),
  ];
  let applied = 0;
  const host = mountHost(844, 390);
  const prompt = createUpdatePrompt(host, mockVersions(pending, () => {
    applied += 1;
  }));
  const card = host.querySelector<HTMLElement>('.updatePrompt');
  const title = host.querySelector<HTMLElement>('.updatePromptTitle');
  const btn = host.querySelector<HTMLButtonElement>('.updatePromptBtn');
  const list = host.querySelector<HTMLUListElement>('.updatePromptList');
  if (!card || !title || !btn || !list) {
    host.remove();
    throw new Error('更新弹框：有 pending 时应渲染标题、更新钮与列表');
  }
  assert(card.classList.contains('isOn'), '更新弹框：有 pending 应显示');
  assert(host.querySelectorAll('.updatePromptBtn').length === 1, '更新弹框：不得新增第二颗更新钮');
  assert(btn.textContent === '更新', '更新弹框：按钮文案仍是更新');
  const kids = [...card.children];
  assert(kids[0] === title, '更新弹框：标题应在最前');
  assert(kids[1] === btn, '更新弹框：更新钮应在标题后、列表前');
  assert(kids[2] === list, '更新弹框：版本列表应在更新钮之后');
  assert(kids.length === 3, '更新弹框：有更新时只应有标题、按钮、列表');
  const listText = [...list.querySelectorAll('li')].map((item) => item.textContent);
  assert(
    listText.join('|') === lines.join('|'),
    `更新弹框：列表内容与顺序应不变（实际 ${listText.join('|')}）`,
  );

  const titleBox = title.getBoundingClientRect();
  const btnBox = btn.getBoundingClientRect();
  const listBox = list.getBoundingClientRect();
  const cardBox = card.getBoundingClientRect();
  assert(btnBox.top + 0.5 >= titleBox.bottom, '更新弹框：布局上按钮应在标题之下');
  assert(listBox.top + 0.5 >= btnBox.bottom, '更新弹框：布局上列表应在按钮之下');
  assert(card.scrollTop === 0, '更新弹框：打开时卡片滚动应在顶部');
  assert(list.scrollTop === 0, '更新弹框：打开时列表滚动应在顶部');
  assert(fullyInside(btnBox, cardBox), '更新弹框：横屏矮窗初始位置应看得见更新钮');
  assert(btnBox.height >= 36, '更新弹框：更新钮应保持可点高度');

  btn.click();
  assert(applied === 1, '更新弹框：点击仍只调用一次 applyUpdate');
  prompt.dispose();
  host.remove();

  const longLines = Array.from({ length: 24 }, (_, i) => `说明 ${i + 1}`);
  const shortHost = mountHost(667, 320);
  const shortPrompt = createUpdatePrompt(shortHost, mockVersions([group({ summaries: longLines })]));
  const shortCard = shortHost.querySelector<HTMLElement>('.updatePrompt');
  const shortBtn = shortHost.querySelector<HTMLButtonElement>('.updatePromptBtn');
  const shortList = shortHost.querySelector<HTMLUListElement>('.updatePromptList');
  if (!shortCard || !shortBtn || !shortList) {
    shortHost.remove();
    throw new Error('更新弹框：矮窗长列表仍应有更新钮');
  }
  assert(shortCard.scrollTop === 0, '更新弹框：矮窗打开时卡片滚动在顶');
  assert(
    fullyInside(shortBtn.getBoundingClientRect(), shortCard.getBoundingClientRect()),
    '更新弹框：矮窗长列表初始滚动位置仍应看见更新钮',
  );
  assert(
    shortBtn.getBoundingClientRect().bottom <= shortList.getBoundingClientRect().top + 0.5,
    '更新弹框：矮窗长列表仍应先按钮后列表',
  );
  assert(
    shortList.scrollHeight > shortList.clientHeight - 1,
    '更新弹框：长列表应在按钮下方自己滚动，不把按钮顶出视野',
  );
  shortPrompt.dispose();
  shortHost.remove();

  const idleHost = mountHost(844, 390);
  const idle = createUpdatePrompt(idleHost, mockVersions([]));
  const idleCard = idleHost.querySelector<HTMLElement>('.updatePrompt');
  assert(!!idleCard && !idleCard.classList.contains('isOn'), '更新弹框：无 pending 不应显示');
  assert(!idleHost.querySelector('.updatePromptBtn'), '更新弹框：无更新状态不得出现更新钮');
  assert(!idleCard?.querySelector('.updatePromptList'), '更新弹框：无更新状态不渲染列表');
  idle.dispose();
  idleHost.remove();
}
