import { HERO_IDS } from '../heroes/heroIds';
import type { AppVersions } from '../ui/appVersion';
import {
  createHelpCard,
  HELP_CONTROL_POINT_LINE,
  HELP_EIGHT_KILL_LINE,
  HELP_SHARED_LINES,
  helpLines,
} from '../ui/helpCard';
import { createSettingsPanel } from '../ui/settingsPanel';

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

function bodyLines(host: HTMLElement): string[] {
  return [...host.querySelectorAll('.helpCardBody li')].map((item) => item.textContent ?? '');
}

function fullyInside(inner: DOMRect, outer: DOMRect, pad = 1): boolean {
  return (
    inner.top >= outer.top - pad &&
    inner.left >= outer.left - pad &&
    inner.bottom <= outer.bottom + pad &&
    inner.right <= outer.right + pad
  );
}

const STALE = ['练习可试用', '重开本局', '开局', '怎么动', '怎么得分', '怎么赢', '药水', '加时', '沉磁井', '均血', '956'];

/** 怎么玩仅 5 条精简稿；两入口同一卡；换玩法只换末条，换英雄不插回细则。 */
export function verifyHelpCard(): void {
  assert(helpLines('eightKill')[4] === HELP_EIGHT_KILL_LINE, '说明卡：八杀末条应逐字');
  assert(helpLines('controlPoint')[4] === HELP_CONTROL_POINT_LINE, '说明卡：占点末条应逐字');
  assert(helpLines('eightKill').slice(0, 4).join('|') === HELP_SHARED_LINES.join('|'), '说明卡：共用四条应逐字');

  const host = document.createElement('div');
  host.style.cssText =
    'position:relative;width:844px;height:390px;overflow:hidden;' +
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;' +
    '--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  document.body.appendChild(host);
  const help = createHelpCard(host);
  const settings = createSettingsPanel(host, {
    onOpen: () => help.close(),
    onOpenHelp: () => help.open(),
    onRestart: () => {},
    onReload: () => {},
    versions: dummyVersions(),
  });

  const fab = host.querySelector<HTMLButtonElement>('.helpFab');
  const overlay = host.querySelector<HTMLElement>('.helpOverlay');
  const card = host.querySelector<HTMLElement>('.helpCard');
  const closeBtn = host.querySelector<HTMLButtonElement>('.helpCardClose');
  if (!fab || !overlay || !card || !closeBtn) {
    host.remove();
    throw new Error('说明卡：应有 ?、遮罩、卡片与关闭钮');
  }
  assert(fab.getAttribute('aria-label') === '怎么玩', '说明卡：? 的 aria 应为怎么玩');
  assert(!help.isOpen() && !overlay.classList.contains('isOn'), '说明卡：默认关闭');

  fab.click();
  assert(help.isOpen() && overlay.classList.contains('isOn'), '说明卡：点 ? 应打开');
  const eight = bodyLines(host);
  assert(eight.length === 5, `说明卡：? 入口应为 5 条（实际 ${eight.length}）`);
  assert(eight.join('|') === helpLines('eightKill').join('|'), '说明卡：缺省八杀五条应逐字');
  assert(!host.querySelector('.helpCardBlock h3'), '说明卡：不应再保留原分章节标题');
  for (const stale of STALE) {
    assert(!eight.join('').includes(stale), `说明卡：不应再写「${stale}」`);
  }

  help.setHero('ring');
  help.setHero('chain');
  help.setHero('mirror');
  for (const hero of HERO_IDS) {
    help.setHero(hero);
    const lines = bodyLines(host);
    assert(lines.length === 5, `说明卡：换 ${hero} 仍应为 5 条`);
    assert(lines.join('|') === helpLines('eightKill').join('|'), `说明卡：换 ${hero} 不应插回英雄细则`);
  }

  help.setMode('controlPoint');
  const point = bodyLines(host);
  assert(point.length === 5, '说明卡：占点仍为 5 条');
  assert(point.slice(0, 4).join('|') === HELP_SHARED_LINES.join('|'), '说明卡：切占点前四条不变');
  assert(point[4] === HELP_CONTROL_POINT_LINE, '说明卡：占点末条应逐字');
  assert(!point.join('').includes('先到 8 杀'), '说明卡：占点不应残留八杀末条');

  help.setMode('eightKill');
  const back = bodyLines(host);
  assert(back[4] === HELP_EIGHT_KILL_LINE, '说明卡：切回八杀末条应逐字');
  assert(!back.join('').includes('先到 100 分'), '说明卡：八杀不应写占点百分');

  closeBtn.click();
  assert(!help.isOpen(), '说明卡：点 × 应关闭');

  fab.click();
  overlay.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  assert(!help.isOpen(), '说明卡：点遮罩空白应关闭');

  fab.click();
  assert(help.isOpen(), '说明卡：再次点 ? 应打开');
  fab.click();
  assert(!help.isOpen(), '说明卡：再点 ? 应关闭');

  settings.open();
  const howTo = [...host.querySelectorAll('button')].find((btn) => btn.textContent === '怎么玩');
  assert(!!howTo, '说明卡：设置常规应有怎么玩');
  howTo?.click();
  assert(help.isOpen() && !settings.isOpen(), '说明卡：设置怎么玩应打开同一份并关掉设置');
  const fromSettings = bodyLines(host);
  assert(fromSettings.length === 5, '说明卡：设置入口也应只有 5 条');
  assert(fromSettings.join('|') === helpLines('eightKill').join('|'), '说明卡：设置入口文案应与 ? 同一份');
  help.close();
  host.remove();

  const short = document.createElement('div');
  short.style.cssText =
    'position:fixed;left:0;top:0;width:667px;height:320px;overflow:hidden;' +
    '--hud-pad:8px;--hud-fab:28px;--hud-fab-gap:4px;' +
    '--hud-safe-top:0px;--hud-safe-right:0px;--hud-safe-bottom:0px;--hud-safe-left:0px';
  document.body.appendChild(short);
  const shortHelp = createHelpCard(short);
  shortHelp.open();
  const shortCard = short.querySelector<HTMLElement>('.helpCard');
  const shortItems = [...short.querySelectorAll<HTMLElement>('.helpCardBody li')];
  if (!shortCard || shortItems.length !== 5) {
    short.remove();
    throw new Error('说明卡：横屏矮窗仍应有 5 条');
  }
  const cardBox = shortCard.getBoundingClientRect();
  const hostBox = short.getBoundingClientRect();
  assert(cardBox.height > 40 && cardBox.height <= hostBox.height + 1, '说明卡：矮窗卡片应在视窗内可读');
  for (const [i, item] of shortItems.entries()) {
    const box = item.getBoundingClientRect();
    assert(box.height >= 12, `说明卡：矮窗第 ${i + 1} 条应有高度`);
    assert(fullyInside(box, cardBox), `说明卡：矮窗第 ${i + 1} 条应落在卡片内`);
    assert(item.textContent === helpLines('eightKill')[i], `说明卡：矮窗第 ${i + 1} 条应逐字`);
  }
  shortHelp.close();
  assert(!shortHelp.isOpen(), '说明卡：矮窗关闭后应收起');
  short.remove();
}
