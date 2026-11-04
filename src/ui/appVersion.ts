export type ChangeLogItem = {
  title: string;
};

export type AppVersionEntry = {
  id: string;
  version: string;
  date: string;
  summary: string;
};

export type VersionGroup = {
  version: string;
  date: string;
  summaries: string[];
  ids: string[];
};

export type VersionState = {
  entries: AppVersionEntry[];
  grouped: VersionGroup[];
  history: VersionGroup[];
  installed: VersionGroup | null;
  pending: VersionGroup[];
  flash: string;
};

export type AppVersions = {
  getState: () => VersionState;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  checkUpdate: () => Promise<void>;
  applyUpdate: () => Promise<void>;
  dispose: () => void;
};

export const APP_VERSION = {
  version: __APP_VERSION__,
  sha: __GIT_SHA__,
};

export const CHANGE_LOG: readonly ChangeLogItem[] = [
  { title: '镜卫四技能落地：折光 / 反照 / 裂镜 / 镜壁；7 人池，同局可重复选' },
  { title: '竖持强制横屏显示，去掉转屏提示' },
  { title: '战斗飘字仅数字：伤害红橙、治疗绿、护盾青；从结算点上浮淡出' },
  { title: '技能键 CD：12 点起顺时针径向遮罩，剩余秒一位小数；长按提示 CD 中仍可用' },
  { title: 'Layout B 顶中一颗胶囊：红分 | 计时 | 蓝分（小队标）；去掉左上/右上独立比分' },
  { title: '囚环物理关死出不去；各持续技能时长 +2s（钉锚硬控 0.6s 不动）' },
  { title: '长按技能键约 0.4 秒弹出骑士对外名 + 一行效果；松开收起；CD 中也可看；不挡点按进瞄 / 同键释放' },
  { title: '战场 HUD Layout B：角落比分/计时胶囊、右下紧凑技能、左下换英雄；默认隐藏调试；横屏全屏、竖持强制横屏显示' },
  { title: '站点图标：红蓝对撞金矛 favicon / 触屏图标' },
  { title: '对局顶栏可随时换英雄：左下下拉指定 7 人；只换 kit，血量/位置/对局不变；GM · H 仍循环' },
  { title: '井绳四技能落地：索爆 / 易位 / 索桩 / 回索；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳 / 闪弧 / 井绳' },
  { title: '闪弧四技能落地：侧闪 / 掠刃 / 回印 / 虚影；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳 / 闪弧' },
];

export const ACKED_VERSION_KEY = 'idea9PinballAckedVersion';
export const HISTORY_LIMIT = 10;
export const POLL_MS = 10_000;

const RELOAD_PARAM = '_reload';
const FLASH_MS = 2000;

export function isAppVersionEntry(value: unknown): value is AppVersionEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.version === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.summary === 'string'
  );
}

export function parseVersions(data: unknown): AppVersionEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isAppVersionEntry);
}

/** 按 `version` 分组，保持文件顺序（新→旧）。 */
export function groupVersions(entries: AppVersionEntry[]): VersionGroup[] {
  const groups: VersionGroup[] = [];
  const byVersion = new Map<string, VersionGroup>();
  for (const entry of entries) {
    let group = byVersion.get(entry.version);
    if (!group) {
      group = { version: entry.version, date: entry.date, summaries: [], ids: [] };
      byVersion.set(entry.version, group);
      groups.push(group);
    }
    group.summaries.push(entry.summary);
    group.ids.push(entry.id);
    if (entry.date > group.date) {
      group.date = entry.date;
    }
  }
  return groups;
}

export function findGroupIndex(groups: VersionGroup[], acked: string | null): number {
  if (!acked) {
    return -1;
  }
  return groups.findIndex((group) => group.ids.includes(acked) || group.version === acked);
}

function versionsUrl(): string {
  return `${import.meta.env.BASE_URL}versions.json?t=${Date.now()}`;
}

function readAcked(): string | null {
  try {
    return localStorage.getItem(ACKED_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeAcked(id: string): void {
  try {
    localStorage.setItem(ACKED_VERSION_KEY, id);
  } catch {
    // ignore quota / private mode
  }
}

function stripReloadParam(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(RELOAD_PARAM)) {
    return;
  }
  url.searchParams.delete(RELOAD_PARAM);
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

export function hardReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set(RELOAD_PARAM, String(Date.now()));
  window.location.replace(url.toString());
}

export function createAppVersions(): AppVersions {
  let entries: AppVersionEntry[] = [];
  let ackedId: string | null = readAcked();
  let flash = '';
  let flashTimer = 0;
  let timer = 0;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const listener of listeners) {
      listener();
    }
  };

  const snapshot = (): VersionState => {
    const grouped = groupVersions(entries);
    const idx = findGroupIndex(grouped, ackedId);
    const installed = idx === -1 ? (grouped[0] ?? null) : grouped[idx];
    const pending = !ackedId
      ? grouped[0]
        ? [grouped[0]]
        : []
      : idx === -1
        ? grouped
        : grouped.slice(0, idx);
    return {
      entries,
      grouped,
      history: grouped.slice(0, HISTORY_LIMIT),
      installed,
      pending,
      flash,
    };
  };

  const showFlash = (message: string): void => {
    flash = message;
    emit();
    if (flashTimer) {
      window.clearTimeout(flashTimer);
    }
    flashTimer = window.setTimeout(() => {
      flash = '';
      flashTimer = 0;
      emit();
    }, FLASH_MS);
  };

  const refresh = async (): Promise<void> => {
    try {
      const response = await fetch(versionsUrl(), { cache: 'no-store' });
      if (!response.ok) {
        return;
      }
      const next = parseVersions(await response.json());
      if (!next.length) {
        return;
      }
      ackedId = readAcked();
      entries = next;
      emit();
    } catch {
      // ignore network errors; next poll retries
    }
  };

  const clearCaches = async (reloadDelayMs = 0): Promise<void> => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    } catch {
      // still reload so the shell refetches
    }
    if (reloadDelayMs > 0) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, reloadDelayMs);
      });
    }
    hardReload();
  };

  const applyUpdate = async (): Promise<void> => {
    const newest = entries[0];
    if (newest) {
      writeAcked(newest.id);
      ackedId = newest.id;
      emit();
    }
    try {
      await clearCaches();
    } catch {
      hardReload();
    }
  };

  const checkUpdate = async (): Promise<void> => {
    await refresh();
    const state = snapshot();
    if (!state.entries.length) {
      showFlash('暂时读不到版本说明');
      return;
    }
    if (state.pending.length) {
      showFlash('有新版本');
      return;
    }
    showFlash('已是最新');
  };

  stripReloadParam();
  void refresh();
  timer = window.setInterval(() => {
    void refresh();
  }, POLL_MS);

  return {
    getState: snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh,
    checkUpdate,
    applyUpdate,
    dispose: () => {
      if (timer) {
        window.clearInterval(timer);
        timer = 0;
      }
      if (flashTimer) {
        window.clearTimeout(flashTimer);
        flashTimer = 0;
      }
      listeners.clear();
    },
  };
}
