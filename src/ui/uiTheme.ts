/** 骑士冲杀 HUD chrome 色板 v0：中古骑士团 + 偏卡通 Q 版。局内金矛只点计时；结算板可用热闹金。 */

export const UI_THEME = {
  parchmentBase: '#F3E6C8',
  parchmentShadow: '#D4C19A',
  parchmentHighlight: '#FFF8E7',
  ink: '#3A2E24',
  inkMuted: '#6B5A48',
  woodFrame: '#8B5A2B',
  woodFrameDark: '#5C3A1A',
  panelBorder: '#A67C52',
  buttonIdle: '#F7EDD6',
  buttonPressed: '#C9B48A',
  teamRed: '#C43C3C',
  teamRedShadow: '#8E2A2A',
  teamRedHighlight: '#E86A5A',
  teamBlue: '#3A6FBF',
  teamBlueShadow: '#254A86',
  teamBlueHighlight: '#6A9AE0',
  goldSpear: '#D4A017',
  goldSpearShadow: '#A07812',
  goldSpearHighlight: '#F0C94A',
  cdMask: '#2A2218',
  cdMaskAlpha: 0.55,
  outlineUi: '#2F241A',
  floatDamage: '#E85A2A',
  floatHeal: '#3CB371',
  floatShield: '#3DB8C5',
} as const;

export type UiTheme = typeof UI_THEME;

export function hexToRgbChannels(hex: string): readonly [number, number, number] {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbChannels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function uiThemeCssVars(): Record<string, string> {
  return {
    '--parchment-base': UI_THEME.parchmentBase,
    '--parchment-shadow': UI_THEME.parchmentShadow,
    '--parchment-highlight': UI_THEME.parchmentHighlight,
    '--ink': UI_THEME.ink,
    '--ink-muted': UI_THEME.inkMuted,
    '--wood-frame': UI_THEME.woodFrame,
    '--wood-frame-dark': UI_THEME.woodFrameDark,
    '--panel-border': UI_THEME.panelBorder,
    '--button-idle': UI_THEME.buttonIdle,
    '--button-pressed': UI_THEME.buttonPressed,
    '--team-red': UI_THEME.teamRed,
    '--team-red-shadow': UI_THEME.teamRedShadow,
    '--team-red-highlight': UI_THEME.teamRedHighlight,
    '--team-blue': UI_THEME.teamBlue,
    '--team-blue-shadow': UI_THEME.teamBlueShadow,
    '--team-blue-highlight': UI_THEME.teamBlueHighlight,
    '--gold-spear': UI_THEME.goldSpear,
    '--gold-spear-shadow': UI_THEME.goldSpearShadow,
    '--gold-spear-highlight': UI_THEME.goldSpearHighlight,
    '--cd-mask': hexToRgba(UI_THEME.cdMask, UI_THEME.cdMaskAlpha),
    '--outline-ui': UI_THEME.outlineUi,
    '--float-damage': UI_THEME.floatDamage,
    '--float-heal': UI_THEME.floatHeal,
    '--float-shield': UI_THEME.floatShield,
  };
}

/** 把色板写到宿主 CSS 变量；`style.css` 里有同名回退。 */
export function applyUiTheme(root: HTMLElement): void {
  const vars = uiThemeCssVars();
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

export function parseCssColor(value: string): { r: number; g: number; b: number; a: number } | null {
  const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: rgb[4] === undefined ? 1 : Number(rgb[4]),
    };
  }
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const [r, g, b] = hexToRgbChannels(hex);
    return { r, g, b, a: 1 };
  }
  return null;
}

export function sameCssColor(value: string, hex: string, alpha = 1): boolean {
  const parsed = parseCssColor(value);
  if (!parsed) {
    return false;
  }
  const [r, g, b] = hexToRgbChannels(hex);
  return parsed.r === r && parsed.g === g && parsed.b === b && Math.abs(parsed.a - alpha) < 0.02;
}

/** 局内金只点在计时上：技能/齿轮/下拉的阴影与边框不得带金矛色。结算板可热闹金。 */
export function cssColorHasGold(value: string): boolean {
  const chunks = value.split(/,(?![^()]*\))/);
  for (const chunk of chunks) {
    const parsed = parseCssColor(chunk);
    if (!parsed || parsed.a < 0.08) {
      continue;
    }
    if (sameCssColor(chunk, UI_THEME.goldSpear, parsed.a)) {
      return true;
    }
    if (sameCssColor(chunk, UI_THEME.goldSpearHighlight, parsed.a)) {
      return true;
    }
    if (parsed.r > 220 && parsed.g > 180 && parsed.b < 160) {
      return true;
    }
  }
  return false;
}
