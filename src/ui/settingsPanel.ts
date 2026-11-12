import {
  DEFAULT_MATCH_MODE,
  isMatchModeId,
  MATCH_MODE_IDS,
  MATCH_MODE_LABEL,
  type MatchModeId,
} from '../core/matchMode';
import { GM_TECH_GRANT_COPY } from '../core/techSave';
import { HERO_IDS, heroZh, isHeroId, type HeroId } from '../heroes/heroIds';
import { kitSettingsHint } from '../heroes/kitLabels';
import { APP_VERSION, CHANGE_LOG, type AppVersions } from './appVersion';

export type SettingsTab = 'general' | 'version' | 'gm';

export type SettingsPanel = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  setHero: (hero: HeroId) => void;
  setMode: (mode: MatchModeId) => void;
};

export type SettingsActions = {
  onOpen?: () => void;
  onOpenHelp?: () => void;
  onRestart: () => void;
  /** 硬刷新当前页；不清存档、不重开本局。 */
  onReload: () => void;
  /** 仅 GM 页「科技点 +100」。成功才返回 true，失败不得假报。 */
  onGrantTechPoint?: () => boolean;
  getHero?: () => HeroId;
  onPickHero?: (hero: HeroId) => void;
  getMode?: () => MatchModeId;
  onPickMode?: (mode: MatchModeId) => void;
  getUnlockedHeroes?: () => readonly HeroId[];
  getPractice?: () => boolean;
  onPractice?: () => void;
  onEndPractice?: () => void;
  onOpenTech?: () => void;
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
  let tab: SettingsTab = 'general';
  let granting = false;

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

  const renderGeneral = (): void => {
    const currentMode = actions.getMode?.() ?? DEFAULT_MATCH_MODE;
    const modeRow = el('label', 'settingsModeRow');
    modeRow.appendChild(el('span', 'settingsModeLabel', '玩法'));
    const modePick = document.createElement('select');
    modePick.className = 'settingsModePick';
    modePick.setAttribute('data-touch-control', 'mode');
    modePick.setAttribute('aria-label', '切换对局模式');
    for (const id of MATCH_MODE_IDS) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = MATCH_MODE_LABEL[id];
      modePick.appendChild(option);
    }
    modePick.value = currentMode;
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'keydown', 'keyup'] as const) {
      modePick.addEventListener(type, (ev) => {
        ev.stopPropagation();
      });
    }
    modePick.addEventListener('change', (ev) => {
      ev.stopPropagation();
      if (!isMatchModeId(modePick.value)) {
        modePick.value = actions.getMode?.() ?? DEFAULT_MATCH_MODE;
        return;
      }
      actions.onPickMode?.(modePick.value);
    });
    modeRow.appendChild(modePick);
    body.appendChild(modeRow);

    const currentHero = actions.getHero?.() ?? 'hook';
    const practice = !!actions.getPractice?.();
    const unlocked = new Set<HeroId>(['hook', ...(actions.getUnlockedHeroes?.() ?? [])]);
    const heroRow = el('label', 'settingsHeroRow');
    heroRow.appendChild(el('span', 'settingsHeroLabel', '我的英雄'));
    const heroPick = document.createElement('select');
    heroPick.className = 'settingsHeroPick';
    heroPick.setAttribute('data-touch-control', 'hero');
    heroPick.setAttribute('aria-label', '我的英雄');
    for (const id of HERO_IDS) {
      const option = document.createElement('option');
      option.value = id;
      const open = practice || unlocked.has(id);
      option.disabled = !open;
      option.textContent = open ? heroZh(id) : `${heroZh(id)} · 未解锁`;
      heroPick.appendChild(option);
    }
    heroPick.value = currentHero;
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'keydown', 'keyup'] as const) {
      heroPick.addEventListener(type, (ev) => {
        ev.stopPropagation();
      });
    }
    heroPick.addEventListener('change', (ev) => {
      ev.stopPropagation();
      if (!isHeroId(heroPick.value)) {
        heroPick.value = actions.getHero?.() ?? 'hook';
        return;
      }
      const allow = !!actions.getPractice?.() || heroPick.value === 'hook' || (actions.getUnlockedHeroes?.() ?? []).includes(heroPick.value);
      if (!allow) {
        heroPick.value = actions.getHero?.() ?? 'hook';
        return;
      }
      actions.onPickHero?.(heroPick.value);
    });
    heroRow.appendChild(heroPick);
    body.appendChild(heroRow);

    const restart = el('button', 'settingsWide', '重开本局 · R');
    restart.type = 'button';
    restart.addEventListener('click', (ev) => {
      ev.preventDefault();
      actions.onRestart();
      close();
    });
    body.appendChild(restart);
    const reload = el('button', 'settingsWide', '刷新游戏');
    reload.type = 'button';
    reload.setAttribute('aria-label', '刷新游戏');
    reload.addEventListener('click', (ev) => {
      ev.preventDefault();
      actions.onReload();
    });
    body.appendChild(reload);
    const helpBtn = el('button', 'settingsWide', '怎么玩');
    helpBtn.type = 'button';
    helpBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      close();
      actions.onOpenHelp?.();
    });
    body.appendChild(helpBtn);
    const techBtn = el('button', 'settingsWide', '科技');
    techBtn.type = 'button';
    techBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      close();
      actions.onOpenTech?.();
    });
    body.appendChild(techBtn);
    const drill = el('button', 'settingsWide', practice ? '结束练习' : '练习');
    drill.type = 'button';
    drill.setAttribute('aria-label', practice ? '结束练习' : '练习');
    drill.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (practice) {
        actions.onEndPractice?.();
      } else {
        actions.onPractice?.();
      }
      close();
    });
    body.appendChild(drill);
    addHint(body, kitSettingsHint(currentHero));
    addHint(body, '点地 / 鼠标只纠偏方向，不加油门。瞄准中触屏点空白即瞄向并释放，滑动只改朝向。右键 / Esc 取消瞄准。');
    addHint(
      body,
      '本机固定 2v2。开局与每次 R：队友和两名敌方从含镜卫全池均匀随机（可重复）。常规页「玩法」可切八杀 / 占点，记住上次所选；换玩法立刻重开倒计时（重开不发科技点）。常规页「我的英雄」只列已解锁英雄；钩刺免费，其他用科技点解锁。练习可试用全部英雄，不解锁也不发点。不能换队友。进度只存在本机。设置 GM 页可点「科技点 +100」。',
    );
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

  const spawnGmFloat = (row: HTMLElement): void => {
    const node = el('span', 'settingsGmFloat', GM_TECH_GRANT_COPY);
    node.setAttribute('aria-live', 'polite');
    node.addEventListener('animationend', () => node.remove());
    row.appendChild(node);
  };

  const renderGm = (): void => {
    const row = el('div', 'settingsGmGrant');
    const btn = el('button', 'settingsGmBtn', GM_TECH_GRANT_COPY);
    btn.type = 'button';
    btn.setAttribute('data-touch-control', '');
    btn.setAttribute('data-gm-grant', 'tech-plus-one');
    btn.setAttribute('aria-label', GM_TECH_GRANT_COPY);
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (granting) {
        return;
      }
      granting = true;
      let ok = false;
      try {
        ok = !!actions.onGrantTechPoint?.();
      } finally {
        granting = false;
      }
      if (ok) {
        spawnGmFloat(row);
      }
    });
    row.appendChild(btn);
    body.appendChild(row);
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
    setHero(hero) {
      const pick = body.querySelector<HTMLSelectElement>('select.settingsHeroPick');
      if (pick) {
        pick.value = hero;
      }
      if (tab === 'general') {
        render();
      }
    },
    setMode(mode) {
      const pick = body.querySelector<HTMLSelectElement>('select.settingsModePick');
      if (pick) {
        pick.value = mode;
      }
      if (tab === 'general') {
        render();
      }
    },
  };
}
