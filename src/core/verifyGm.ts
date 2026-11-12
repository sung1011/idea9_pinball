import { bindDebugVelocity } from '../debug/debugVelocity';
import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import type { AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { createMatchHud } from '../ui/matchHud';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createTechPanel } from '../ui/techPanel';
import {
  createTechStore,
  emptyTechSave,
  GM_TECH_GRANT_COPY,
  GM_TECH_POINT_GRANT,
  memoryTechStorage,
  TECH_SAVE_KEY,
  TECH_START_POINTS,
} from './techSave';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function dummyVersions(): AppVersions {
  return {
    getState: () => ({
      entries: [],
      grouped: [],
      history: [],
      installed: null,
      pending: [],
      flash: '',
    }),
    subscribe: () => () => {},
    refresh: async () => {},
    checkUpdate: async () => {},
    applyUpdate: async () => {},
    dispose: () => {},
  };
}

const OLD_GM_COPY = ['背刺', '侧蹭', '对戳', '同向蹭', '红 +10', '蓝 +10', '跳 30s', '剩 1s', '立即回场', '换英雄', 'GM 调试'];

function openGm(host: HTMLElement): HTMLButtonElement {
  const gmTab = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'gm');
  gmTab?.click();
  const btn = host.querySelector<HTMLButtonElement>('[data-gm-grant="tech-plus-one"]');
  if (!btn) {
    throw new Error(`GM：页签应有${GM_TECH_GRANT_COPY}`);
  }
  return btn;
}

/** GM 页只留科技点 +100：旧调试键/按钮不可触发，加点走现有存档且失败不假报。 */
export function verifyGm(): void {
  const store = createTechStore(
    memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 4 }) }),
  );
  const once = store.grantPoints(GM_TECH_POINT_GRANT);
  assert(once.ok && once.amount === GM_TECH_POINT_GRANT && once.balance === 104, 'GM：存档 +100 应成功入账');
  const again = store.grantPoints(GM_TECH_POINT_GRANT);
  assert(again.ok && again.balance === 204, 'GM：连续加点应各记一次');
  const reopened = createTechStore(memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify(store.getState()) }));
  assert(reopened.getState().points === 204, 'GM：刷新后应仍保留加点');

  const rawCorrupt = '{not-json';
  const corruptMem = memoryTechStorage({ [TECH_SAVE_KEY]: rawCorrupt });
  const corrupt = createTechStore(corruptMem);
  const corruptGrant = corrupt.grantPoints(GM_TECH_POINT_GRANT);
  assert(!corruptGrant.ok && corruptGrant.code === 'readonly', 'GM：损坏存档加点应失败');
  assert(
    corrupt.getState().points === TECH_START_POINTS && corrupt.status().raw === rawCorrupt,
    'GM：损坏时不覆盖原始记录',
  );

  let writes = 0;
  const failWrite = {
    getItem: () => JSON.stringify({ ...emptyTechSave(), points: 9, unlockedHeroes: ['hook'] }),
    setItem: () => {
      writes += 1;
      throw new Error('quota');
    },
  };
  const failStore = createTechStore(failWrite);
  const failGrant = failStore.grantPoints(GM_TECH_POINT_GRANT);
  assert(!failGrant.ok && failGrant.code === 'write', 'GM：写入失败不能假装加点成功');
  assert(failStore.getState().points === 9, 'GM：写入失败余额不变');
  assert(writes >= 1, 'GM：应尝试写入');

  const invalid = store.grantPoints(0);
  assert(!invalid.ok && store.getState().points === 204, 'GM：非法数量不入账');

  let resets = 0;
  const unbind = bindDebugVelocity({
    onReset: () => {
      resets += 1;
    },
  });
  for (const key of ['z', 'x', 'c', 'v', 'f', 'g', 't', 'y', 'h', 'Z', 'F', 'H']) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }
  assert(resets === 0, 'GM：旧调试键不应再触发');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
  assert(resets === 1, 'GM：R 仍应重开');
  unbind();

  const host = document.createElement('div');
  host.style.cssText =
    'position:relative;width:1920px;height:1080px;--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  document.body.appendChild(host);
  const uiStore = createTechStore(
    memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify({ ...emptyTechSave(), points: 2 }) }),
  );
  let grants = 0;
  createMatchHud(host);
  createHelpCard(host);
  createTouchPad(host, createActionBus());
  const settings = createSettingsPanel(host, {
    onRestart: () => {},
    onReload: () => {},
    onGrantTechPoint: () => {
      grants += 1;
      const got = uiStore.grantPoints(GM_TECH_POINT_GRANT);
      return got.ok;
    },
    versions: dummyVersions(),
  });
  const tech = createTechPanel(host, { store: uiStore, getPhase: () => 'countdown' });
  const gear = host.querySelector<HTMLButtonElement>('.settingsFab');
  const gmTab = [...host.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'gm');
  assert(!!gear && !!gmTab && gmTab.textContent === 'GM', 'GM：齿轮与 GM 页签应仍在');

  tech.open();
  assert(!host.querySelector('[data-gm-grant]'), 'GM：科技页不应有加点按钮');
  assert(
    ![...host.querySelectorAll('button')].some((btn) => btn.textContent === GM_TECH_GRANT_COPY && btn.closest('.techPanel')),
    'GM：科技页无加点入口',
  );
  tech.close();

  settings.open();
  const grantBtn = openGm(host);
  assert(grantBtn.textContent === GM_TECH_GRANT_COPY, 'GM：按钮文案应为科技点 +100');
  assert(!host.querySelector('input[aria-label="GM 调试"]'), 'GM：不应再有调试开关');
  const gmBody = host.querySelector('.settingsBody')?.textContent ?? '';
  for (const text of OLD_GM_COPY) {
    assert(!gmBody.includes(text), `GM：旧功能文案不应再出现（${text}）`);
  }

  grantBtn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  assert(grants === 0 && uiStore.getState().points === 2, 'GM：按下未抬起不应入账');
  grantBtn.click();
  assert(grants === 1 && uiStore.getState().points === 102, 'GM：一次点击应只加 100');
  assert(
    [...host.querySelectorAll('.settingsGmFloat')].filter((el) => el.textContent === GM_TECH_GRANT_COPY).length === 1,
    'GM：成功后应在按钮旁漂科技点 +100',
  );
  grantBtn.click();
  grantBtn.click();
  assert(grants === 3 && uiStore.getState().points === 302, 'GM：连点应各加 100、无多加');
  assert(
    [...host.querySelectorAll('.settingsGmFloat')].filter((el) => el.textContent === GM_TECH_GRANT_COPY).length === 3,
    'GM：连点应各出一条漂字',
  );

  let nested = 0;
  const nestedHost = document.createElement('div');
  document.body.appendChild(nestedHost);
  const nestedSettings = createSettingsPanel(nestedHost, {
    onRestart: () => {},
    onReload: () => {},
    onGrantTechPoint: () => {
      nested += 1;
      nestedHost.querySelector<HTMLButtonElement>('[data-gm-grant="tech-plus-one"]')?.click();
      return true;
    },
    versions: dummyVersions(),
  });
  nestedSettings.open();
  openGm(nestedHost).click();
  assert(nested === 1, 'GM：同一次点击重入不应重复记账');
  nestedHost.remove();

  const failHost = document.createElement('div');
  document.body.appendChild(failHost);
  const failUi = createTechStore({
    getItem: () => JSON.stringify({ ...emptyTechSave(), points: 1, unlockedHeroes: ['hook'] }),
    setItem: () => {
      throw new Error('quota');
    },
  });
  const failSettings = createSettingsPanel(failHost, {
    onRestart: () => {},
    onReload: () => {},
    onGrantTechPoint: () => failUi.grantPoints(GM_TECH_POINT_GRANT).ok,
    versions: dummyVersions(),
  });
  failSettings.open();
  openGm(failHost).click();
  assert(failUi.getState().points === 1, 'GM：失败余额不变');
  assert(!failHost.querySelector('.settingsGmFloat'), 'GM：失败不得漂成功文案');
  failHost.remove();

  settings.close();
  tech.open();
  assert((host.querySelector('.techBalance')?.textContent ?? '') === '科技点 302', 'GM：科技页应读到刷新后的余额');
  tech.close();

  const persisted = createTechStore(memoryTechStorage({ [TECH_SAVE_KEY]: JSON.stringify(uiStore.getState()) }));
  assert(persisted.getState().points === 302, 'GM：同存储再开仍保留');

  host.remove();
}
