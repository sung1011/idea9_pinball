import { bindDebugVelocity } from '../debug/debugVelocity';
import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import { ACKED_VERSION_KEY, type AppVersions } from '../ui/appVersion';
import { createHelpCard } from '../ui/helpCard';
import { createMatchHud } from '../ui/matchHud';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createTechPanel } from '../ui/techPanel';
import { clearLastHeroId, LAST_HERO_STORAGE_KEY } from '../heroes/lastHeroId';
import { LAST_MODE_STORAGE_KEY } from './lastModeId';
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

function memoryBag(init: Record<string, string> = {}) {
  const map = new Map(Object.entries(init));
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
  };
}

/** GM 页科技点 +100 与初始化：旧调试键/按钮不可触发，加点/重置走现有存档且失败不假报。 */
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

  const richBag = memoryBag({
    [TECH_SAVE_KEY]: JSON.stringify({
      ...emptyTechSave(),
      points: 250,
      unlockedHeroes: ['hook', 'ring'],
      litTechs: ['hookPull'],
    }),
    [LAST_HERO_STORAGE_KEY]: 'ring',
    [LAST_MODE_STORAGE_KEY]: 'controlPoint',
    [ACKED_VERSION_KEY]: 'v0.0.68-tech-start-100',
    'otherApp.save': 'keep-me',
  });
  const rich = createTechStore(richBag);
  const cancelled = { ...rich.getState() };
  const resetOnce = rich.resetToNewSave();
  assert(
    resetOnce.ok &&
      resetOnce.state.points === TECH_START_POINTS &&
      resetOnce.state.unlockedHeroes.join() === 'hook' &&
      resetOnce.state.litTechs.length === 0,
    'GM：初始化应恢复新档 100 / 仅钩刺 / 未点亮',
  );
  assert(richBag.getItem(LAST_MODE_STORAGE_KEY) === 'controlPoint', 'GM：初始化不应清玩法偏好');
  assert(richBag.getItem(ACKED_VERSION_KEY) === 'v0.0.68-tech-start-100', 'GM：初始化不应清版本确认');
  assert(richBag.getItem('otherApp.save') === 'keep-me', 'GM：初始化不应删其他项目键');
  clearLastHeroId(richBag);
  assert(richBag.getItem(LAST_HERO_STORAGE_KEY) == null, 'GM：初始化应只清上次英雄进度键');
  const richReload = createTechStore(richBag);
  assert(
    richReload.getState().points === TECH_START_POINTS &&
      richReload.getState().unlockedHeroes.join() === 'hook' &&
      richReload.getState().litTechs.length === 0,
    'GM：初始化后刷新仍是新档',
  );
  const afterResetGrant = richReload.grantPoints(GM_TECH_POINT_GRANT);
  assert(afterResetGrant.ok && afterResetGrant.balance === 200, 'GM：初始化后 +100 仍可用');
  assert(cancelled.points === 250 && cancelled.unlockedHeroes.includes('ring'), 'GM：对照旧状态应仍是初始化前快照');

  const corruptReset = corrupt.resetToNewSave();
  assert(!corruptReset.ok && corruptReset.code === 'readonly', 'GM：损坏存档初始化应失败');
  assert(corrupt.status().raw === rawCorrupt, 'GM：损坏时初始化不覆盖原始记录');

  const failReset = failStore.resetToNewSave();
  assert(!failReset.ok && failReset.code === 'write', 'GM：写入失败不能假装初始化成功');
  assert(failStore.getState().points === 9, 'GM：写入失败初始化余额不变');

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

  const resetHost = document.createElement('div');
  resetHost.style.cssText = host.style.cssText;
  document.body.appendChild(resetHost);
  const resetMem = memoryBag({
    [TECH_SAVE_KEY]: JSON.stringify({
      ...emptyTechSave(),
      points: 180,
      unlockedHeroes: ['hook', 'ring'],
      litTechs: ['hookBrake'],
    }),
  });
  const resetStore = createTechStore(resetMem);
  let resetCalls = 0;
  const resetSettings = createSettingsPanel(resetHost, {
    onRestart: () => {},
    onReload: () => {},
    onGrantTechPoint: () => resetStore.grantPoints(GM_TECH_POINT_GRANT).ok,
    onResetProgress: () => {
      resetCalls += 1;
      return resetStore.resetToNewSave().ok;
    },
    versions: dummyVersions(),
  });
  resetSettings.open();
  const initBtn = (() => {
    const gmTabBtn = [...resetHost.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'gm');
    gmTabBtn?.click();
    const btn = resetHost.querySelector<HTMLButtonElement>('[data-gm-reset="init"]');
    if (!btn) {
      throw new Error('GM：页签应有初始化');
    }
    return btn;
  })();
  assert(initBtn.textContent === '初始化', 'GM：初始化按钮文案');
  assert(!resetHost.querySelector('[data-gm-reset="confirm"]'), 'GM：未点初始化不应出确认');
  initBtn.click();
  assert(resetCalls === 0 && resetStore.getState().points === 180, 'GM：点初始化未确认不应改存档');
  const confirmHint = resetHost.querySelector('.settingsBody')?.textContent ?? '';
  assert(confirmHint.includes('将清空本机进度'), 'GM：二次确认应提示将清空进度');
  assert(confirmHint.includes('确定'), 'GM：二次确认应询问确定');
  const cancelBtn = resetHost.querySelector<HTMLButtonElement>('[data-gm-reset="cancel"]');
  if (!cancelBtn) {
    throw new Error('GM：二次确认应有取消');
  }
  cancelBtn.click();
  assert(resetCalls === 0 && resetStore.getState().points === 180, 'GM：取消初始化不改任何存档');
  assert(resetStore.getState().unlockedHeroes.includes('ring') && resetStore.isTechLit('hookBrake'), 'GM：取消后解锁与科技仍在');
  assert(!!resetHost.querySelector('[data-gm-reset="init"]'), 'GM：取消后应回到初始化按钮');
  resetHost.querySelector<HTMLButtonElement>('[data-gm-reset="init"]')?.click();
  resetHost.querySelector<HTMLButtonElement>('[data-gm-reset="confirm"]')?.click();
  assert(resetCalls === 1, 'GM：确认初始化应只执行一次');
  assert(
    resetStore.getState().points === TECH_START_POINTS &&
      resetStore.getState().unlockedHeroes.join() === 'hook' &&
      resetStore.getState().litTechs.length === 0,
    'GM：确认后应恢复新档 100 / 仅钩刺 / 未点亮',
  );
  assert(
    [...resetHost.querySelectorAll('.settingsGmFloat')].some((el) => el.textContent === '已初始化'),
    'GM：确认成功应漂已初始化',
  );
  const resetReload = createTechStore(resetMem);
  assert(resetReload.getState().points === TECH_START_POINTS, 'GM：确认初始化后刷新仍保持');
  const stillGrant = resetHost.querySelector<HTMLButtonElement>('[data-gm-grant="tech-plus-one"]');
  stillGrant?.click();
  assert(resetStore.getState().points === 200, 'GM：初始化后科技点 +100 仍可用');
  const generalTab = [...resetHost.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'general');
  generalTab?.click();
  const generalCopy = [...resetHost.querySelectorAll('button')].map((btn) => btn.textContent ?? '');
  assert(!generalCopy.some((text) => text.includes('重开本局')), 'GM：常规页无重开本局');
  assert(!generalCopy.includes('练习') && !generalCopy.includes('结束练习'), 'GM：常规页无练习入口');
  resetHost.remove();

  const failResetHost = document.createElement('div');
  document.body.appendChild(failResetHost);
  const failResetUi = createTechStore({
    getItem: () => JSON.stringify({ ...emptyTechSave(), points: 70, unlockedHeroes: ['hook'] }),
    setItem: () => {
      throw new Error('quota');
    },
  });
  const failResetSettings = createSettingsPanel(failResetHost, {
    onRestart: () => {},
    onReload: () => {},
    onResetProgress: () => failResetUi.resetToNewSave().ok,
    versions: dummyVersions(),
  });
  failResetSettings.open();
  [...failResetHost.querySelectorAll<HTMLElement>('.settingsTab')].find((el) => el.dataset.tab === 'gm')?.click();
  failResetHost.querySelector<HTMLButtonElement>('[data-gm-reset="init"]')?.click();
  failResetHost.querySelector<HTMLButtonElement>('[data-gm-reset="confirm"]')?.click();
  assert(failResetUi.getState().points === 70, 'GM：初始化失败余额不变');
  assert(
    ![...failResetHost.querySelectorAll('.settingsGmFloat')].some((el) => el.textContent === '已初始化'),
    'GM：初始化失败不得漂成功文案',
  );
  failResetHost.remove();

  host.remove();
}
