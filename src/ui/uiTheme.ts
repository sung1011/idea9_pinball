export type UiThemeId = 'meadow' | 'iron' | 'board' | 'ink';

export type UiThemeOption = {
  id: UiThemeId;
  label: string;
  blurb: string;
  /** Pixi 场地底色，与 CSS `--bg-app` 对齐 */
  canvasBg: number;
};

export const UI_THEMES: readonly UiThemeOption[] = [
  {
    id: 'meadow',
    label: '台地青绿',
    blurb: '现版：青绿面板 + 青白字，偏场地氛围。',
    canvasBg: 0x1a2820,
  },
  {
    id: 'iron',
    label: '铸铁骑士',
    blurb: '炭灰面板 + 黄铜点缀，更硬、更少青光。',
    canvasBg: 0x1c1a17,
  },
  {
    id: 'board',
    label: '赛场比分板',
    blurb: '深石板比分条，数字更大，更像电子记分牌。',
    canvasBg: 0x14181c,
  },
  {
    id: 'ink',
    label: '墨金纹章',
    blurb: '墨底金边，标题偏衬线，偏纹章感。',
    canvasBg: 0x12141c,
  },
] as const;

const STORAGE_KEY = 'idea9.uiTheme';
const DEFAULT_THEME: UiThemeId = 'meadow';

type ThemeListener = (theme: UiThemeOption) => void;

const listeners = new Set<ThemeListener>();

function isThemeId(value: string): value is UiThemeId {
  return UI_THEMES.some((theme) => theme.id === value);
}

export function getUiTheme(id: UiThemeId): UiThemeOption {
  return UI_THEMES.find((theme) => theme.id === id) ?? UI_THEMES[0];
}

export function loadUiThemeId(): UiThemeId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isThemeId(raw)) {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function applyUiTheme(id: UiThemeId): UiThemeOption {
  const theme = getUiTheme(id);
  document.documentElement.dataset.uiTheme = theme.id;
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    /* ignore */
  }
  for (const listener of listeners) {
    listener(theme);
  }
  return theme;
}

export function onUiThemeChange(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 启动时读本地偏好并落到 `html[data-ui-theme]`。 */
export function bootUiTheme(): UiThemeOption {
  return applyUiTheme(loadUiThemeId());
}
