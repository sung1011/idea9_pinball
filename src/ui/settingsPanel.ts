import { loadGmEnabled, saveGmEnabled } from '../debug/gmState';
import type { CollisionTestKind } from '../debug/debugVelocity';
import type { TeamId } from '../core/ballBody';
import type { HeroId } from '../heroes/heroIds';
import { heroZh } from '../heroes/heroIds';
import { kitSettingsHint } from '../heroes/kitLabels';
import { APP_VERSION, CHANGE_LOG, type AppVersions } from './appVersion';

export type SettingsTab = 'general' | 'version' | 'gm';

export type SettingsPanel = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  isGmOn: () => boolean;
};

export type SettingsActions = {
  onOpen?: () => void;
  onOpenHelp?: () => void;
  onRestart: () => void;
  onCollision: (kind: CollisionTestKind) => void;
  onScore: (team: TeamId, points: number) => void;
  onAdvance: (sec: number) => void;
  onJumpClock: (sec: number) => void;
  onForceRespawn: () => void;
  getHero?: () => HeroId;
  onSwapHero?: () => void;
  versions: AppVersions;
};

const TABS: readonly { id: SettingsTab; label: string }[] = [
  { id: 'general', label: '常规' },
  { id: 'version', label: '版本' },
  { id: 'gm', label: 'GM' },
];

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

function addHint(host: HTMLElement, text: string): void {
  host.appendChild(el('p', 'settingsHint', text));
}

/** 右上角齿轮：常规 / 版本 / GM。点空白关。与 `?` 说明卡分开。 */
export function createSettingsPanel(host: HTMLElement, actions: SettingsActions): SettingsPanel {
  let gmOn = loadGmEnabled();
  let tab: SettingsTab = 'general';

  const fab = el('button', 'settingsFab');
  fab.type = 'button';
  fab.setAttribute('data-touch-control', '');
  fab.setAttribute('aria-label', '设置');
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.07 7.07 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.59.22-1.14.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.84a.5.5 0 0 0 .12.64L4.86 11.06c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.4.31.64.22l2.39-.96c.49.4 1.04.72 1.63.94l.36 2.54c.05.24.26.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.59-.22 1.14-.53 1.63-.94l2.39.96c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"/></svg>';

  const overlay = el('div', 'settingsOverlay');
  overlay.setAttribute('data-touch-control', '');

  const panel = el('section', 'settingsPanel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'settingsTitle');

  const head = el('div', 'settingsHead');
  const title = el('h2', 'settingsTitle', '设置');
  title.id = 'settingsTitle';
  const closeBtn = el('button', 'settingsClose', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭设置');
  head.append(title, closeBtn);

  const nav = el('nav', 'settingsTabs');
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', '设置分页');
  const tabBtns = TABS.map((item) => {
    const btn = el('button', 'settingsTab', item.label);
    btn.type = 'button';
    btn.setAttribute('role', 'tab');
    btn.dataset.tab = item.id;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      tab = item.id;
      render();
    });
    nav.appendChild(btn);
    return btn;
  });

  const body = el('div', 'settingsBody');
  panel.append(head, nav, body);
  overlay.appendChild(panel);
  host.append(fab, overlay);

  const setOpen = (open: boolean): void => {
    overlay.classList.toggle('isOn', open);
    fab.classList.toggle('isOn', open);
    fab.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const close = (): void => {
    setOpen(false);
  };

  const open = (): void => {
    actions.onOpen?.();
    setOpen(true);
    render();
  };

  const isOpen = (): boolean => overlay.classList.contains('isOn');

  const setGm = (on: boolean): void => {
    gmOn = on;
    saveGmEnabled(on);
    render();
  };

  const renderGeneral = (): void => {
    const restart = el('button', 'settingsWide', '重开本局 · R');
    restart.type = 'button';
    restart.addEventListener('click', (ev) => {
      ev.preventDefault();
      actions.onRestart();
      close();
    });
    body.appendChild(restart);
    const helpBtn = el('button', 'settingsWide', '怎么玩');
    helpBtn.type = 'button';
    helpBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      close();
      actions.onOpenHelp?.();
    });
    body.appendChild(helpBtn);
    addHint(body, kitSettingsHint(actions.getHero?.() ?? 'hook'));
    addHint(body, '点地 / 鼠标只纠偏方向，不加油门。右键 / Esc 取消瞄准。');
    addHint(body, '本机固定 2v2。开局与每次 R：队友和两名敌方从含镜卫全池均匀随机（可重复）。左上可换自己或队友英雄（只换技能组）；换自己会记住下次缺省，换队友不会。无记录时你默认钩刺。竖持为主；横持或 PC 任意窗 letterbox 可玩，不转屏。GM 开时按 H 只循环红1：钩刺 → 磁环 → 链生 → 钉壳 → 闪弧 → 井绳 → 镜卫。');
  };

  const renderVersion = (): void => {
    const state = actions.versions.getState();
    const current = state.installed?.version ?? APP_VERSION.version;
    const card = el('div', 'settingsVerCard');
    card.appendChild(el('p', 'settingsVer', `当前版本 ${current}`));
    card.appendChild(el('p', 'settingsHint', `构建 ${APP_VERSION.sha}`));
    body.appendChild(card);

    const check = el('button', 'settingsWide', '检查更新');
    check.type = 'button';
    check.addEventListener('click', (ev) => {
      ev.preventDefault();
      void actions.versions.checkUpdate();
    });
    body.appendChild(check);
    if (state.pending.length > 0) {
      const apply = el('button', 'settingsWide', '更新');
      apply.type = 'button';
      apply.addEventListener('click', (ev) => {
        ev.preventDefault();
        void actions.versions.applyUpdate();
      });
      body.appendChild(apply);
    }
    if (state.flash) {
      body.appendChild(el('p', 'settingsFlash', state.flash));
    }
    addHint(body, '新版只靠轮询 versions.json。确认后本机记住，不再反复弹。发版请往该文件追加条目。');

    const notes = state.history;
    if (notes.length > 0) {
      body.appendChild(el('p', 'settingsNotesTitle', '最近更新'));
      for (const group of notes) {
        const row = el('div', 'settingsVerRow');
        const meta = el('p', 'settingsVerMeta');
        meta.append(el('strong', '', group.version), el('span', '', group.date));
        row.appendChild(meta);
        const list = el('ul', 'settingsNotes');
        for (const line of group.summaries) {
          list.appendChild(el('li', '', line));
        }
        row.appendChild(list);
        body.appendChild(row);
      }
      return;
    }
    if (CHANGE_LOG.length > 0) {
      body.appendChild(el('p', 'settingsNotesTitle', '最近更新'));
      const list = el('ol', 'settingsNotes');
      for (const item of CHANGE_LOG.slice(0, 10)) {
        list.appendChild(el('li', '', item.title));
      }
      body.appendChild(list);
    }
  };

  const gmBtn = (label: string, onClick: () => void): HTMLButtonElement => {
    const btn = el('button', 'settingsGmBtn', label);
    btn.type = 'button';
    btn.disabled = !gmOn;
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (!gmOn) {
        return;
      }
      onClick();
    });
    return btn;
  };

  const addGmGroup = (titleText: string, buttons: HTMLButtonElement[]): void => {
    const group = el('section', 'settingsGmGroup');
    group.appendChild(el('h3', 'settingsGmTitle', titleText));
    const grid = el('div', 'settingsGmGrid');
    for (const btn of buttons) {
      grid.appendChild(btn);
    }
    group.append(grid);
    body.appendChild(group);
  };

  const renderGm = (): void => {
    const toggleRow = el('label', 'settingsSwitch');
    const toggleText = el('span', '', 'GM 调试');
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = gmOn;
    toggle.setAttribute('aria-label', 'GM 调试');
    toggle.addEventListener('change', () => {
      setGm(toggle.checked);
    });
    toggleRow.append(toggleText, toggle);
    body.appendChild(toggleRow);
    addHint(body, gmOn ? '调试键已开：Z/X/C/V · F/G · T/Y · H 循环钩刺/磁环/链生/钉壳/闪弧/井绳/镜卫。' : 'GM 关：调试键无效，R 仍可重开。');

    addGmGroup('碰撞测', [
      gmBtn('背刺 Z', () => actions.onCollision('back')),
      gmBtn('侧蹭 X', () => actions.onCollision('side')),
      gmBtn('对戳 C', () => actions.onCollision('front')),
      gmBtn('轻蹭 V', () => actions.onCollision('graze')),
    ]);
    addGmGroup('分数', [
      gmBtn('红 +10 F', () => actions.onScore('red', 10)),
      gmBtn('蓝 +10 G', () => actions.onScore('blue', 10)),
      gmBtn('红 -10', () => actions.onScore('red', -10)),
      gmBtn('蓝 -10', () => actions.onScore('blue', -10)),
    ]);
    addGmGroup('时钟', [
      gmBtn('跳 30s T', () => actions.onAdvance(30)),
      gmBtn('剩 1s Y', () => actions.onJumpClock(1)),
    ]);
    addGmGroup('回场', [gmBtn('立即回场', () => actions.onForceRespawn())]);
    addGmGroup('英雄', [
      gmBtn(`换英雄 H · 当前${heroZh(actions.getHero?.() ?? 'hook')}`, () => {
        actions.onSwapHero?.();
        render();
      }),
    ]);
  };

  const render = (): void => {
    for (const btn of tabBtns) {
      const on = btn.dataset.tab === tab;
      btn.classList.toggle('isOn', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    body.replaceChildren();
    if (tab === 'general') {
      renderGeneral();
      return;
    }
    if (tab === 'version') {
      renderVersion();
      return;
    }
    renderGm();
  };

  fab.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    if (isOpen()) {
      close();
      return;
    }
    open();
  });
  closeBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    close();
  });
  overlay.addEventListener('pointerdown', (ev) => {
    if (ev.target === overlay) {
      ev.preventDefault();
      close();
    }
  });
  window.addEventListener(
    'keydown',
    (ev) => {
      if (ev.key !== 'Escape' || !isOpen()) {
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      close();
    },
    true,
  );

  render();
  actions.versions.subscribe(() => {
    if (tab === 'version') {
      render();
    }
  });
  return {
    open,
    close,
    isOpen,
    isGmOn: () => gmOn,
  };
}
