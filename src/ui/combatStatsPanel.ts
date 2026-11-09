import type { BallBody } from '../core/ballBody';
import {
  formatStatLabel,
  formatStatValue,
  statBarRatio,
  type CombatStatRow,
  type CombatStats,
  type CombatStatTab,
} from '../core/combatStats';

export type CombatStatsPanel = {
  sync: (balls: readonly BallBody[], playerId: number) => void;
  isCollapsed: () => boolean;
  getTab: () => CombatStatTab;
  collapse: () => void;
  expand: () => void;
  setTab: (tab: CombatStatTab) => void;
};

function stopHudUi(ev: Event): void {
  ev.stopPropagation();
}

function bindBlock(el: HTMLElement): void {
  for (const type of [
    'pointerdown',
    'pointerup',
    'mousedown',
    'mouseup',
    'click',
    'touchstart',
    'keydown',
    'keyup',
  ] as const) {
    el.addEventListener(type, stopHudUi);
  }
  el.addEventListener('pointerdown', (ev: PointerEvent) => {
    ev.preventDefault();
  });
  el.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
  });
}

function onActivate(el: HTMLElement, fn: () => void): void {
  const run = (ev: Event): void => {
    ev.preventDefault();
    ev.stopPropagation();
    fn();
  };
  el.addEventListener('pointerdown', run);
  el.addEventListener('click', run);
}

function makeTab(tab: CombatStatTab, label: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'combatStatsTab';
  btn.dataset.tab = tab;
  btn.textContent = label;
  return btn;
}

function makeRow(): {
  root: HTMLDivElement;
  name: HTMLSpanElement;
  slot: HTMLSpanElement;
  fill: HTMLSpanElement;
  value: HTMLSpanElement;
} {
  const root = document.createElement('div');
  root.className = 'combatStatsRow';
  const slot = document.createElement('span');
  slot.className = 'combatStatsSlot';
  const dot = document.createElement('span');
  dot.className = 'combatStatsDot';
  dot.setAttribute('aria-hidden', 'true');
  const name = document.createElement('span');
  name.className = 'combatStatsName';
  const track = document.createElement('span');
  track.className = 'combatStatsBarTrack';
  const fill = document.createElement('span');
  fill.className = 'combatStatsBarFill';
  track.appendChild(fill);
  const value = document.createElement('span');
  value.className = 'combatStatsVal';
  root.append(slot, dot, name, track, value);
  return { root, name, slot, fill, value };
}

function paintRows(list: HTMLElement, rows: readonly CombatStatRow[], tab: CombatStatTab): void {
  const maxValue = rows.reduce((max, row) => Math.max(max, row.value), 0);
  const kids = [...list.children] as HTMLElement[];
  while (kids.length > rows.length) {
    const extra = kids.pop();
    extra?.remove();
  }
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    let node = kids[i];
    if (!node) {
      const made = makeRow();
      node = made.root;
      list.appendChild(node);
    }
    const name = node.querySelector<HTMLElement>('.combatStatsName');
    const slot = node.querySelector<HTMLElement>('.combatStatsSlot');
    const fill = node.querySelector<HTMLElement>('.combatStatsBarFill');
    const value = node.querySelector<HTMLElement>('.combatStatsVal');
    if (!name || !slot || !fill || !value) {
      continue;
    }
    node.dataset.unitId = String(row.unitId);
    node.dataset.team = row.team ?? '';
    node.dataset.tab = tab;
    name.textContent = formatStatLabel(row.label);
    slot.textContent = String(row.teamSlot);
    value.textContent = formatStatValue(row.value);
    fill.style.width = `${statBarRatio(row.value, maxValue) * 100}%`;
  }
}

/** 右下技能键上方的本局伤害/治疗榜；羊皮纸木框金边，默认为伤害且展开。 */
export function createCombatStatsPanel(host: HTMLElement, stats: CombatStats): CombatStatsPanel {
  let tab: CombatStatTab = 'damage';
  let collapsed = false;

  const root = document.createElement('div');
  root.className = 'combatStats';
  root.dataset.collapsed = '0';
  root.dataset.tab = 'damage';

  const panel = document.createElement('div');
  panel.className = 'combatStatsPanel';
  panel.setAttribute('data-touch-control', 'stats');
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', '本局统计');
  bindBlock(panel);

  const head = document.createElement('div');
  head.className = 'combatStatsHead';
  const tabs = document.createElement('div');
  tabs.className = 'combatStatsTabs';
  tabs.setAttribute('role', 'tablist');
  const damageTab = makeTab('damage', '伤害');
  const healTab = makeTab('heal', '治疗');
  damageTab.classList.add('isOn');
  tabs.append(damageTab, healTab);
  const collapseBtn = document.createElement('button');
  collapseBtn.type = 'button';
  collapseBtn.className = 'combatStatsCollapse';
  collapseBtn.dataset.action = 'collapse';
  collapseBtn.setAttribute('aria-label', '收起统计');
  collapseBtn.textContent = '收起';
  head.append(tabs, collapseBtn);

  const list = document.createElement('div');
  list.className = 'combatStatsList';
  panel.append(head, list);

  const dock = document.createElement('button');
  dock.type = 'button';
  dock.className = 'combatStatsDock';
  dock.setAttribute('data-touch-control', 'stats');
  dock.dataset.action = 'expand';
  dock.setAttribute('aria-label', '展开统计');
  dock.textContent = '统计';
  dock.hidden = true;
  bindBlock(dock);

  const applyChrome = (): void => {
    root.dataset.collapsed = collapsed ? '1' : '0';
    root.dataset.tab = tab;
    panel.hidden = collapsed;
    dock.hidden = !collapsed;
    damageTab.classList.toggle('isOn', tab === 'damage');
    healTab.classList.toggle('isOn', tab === 'heal');
    damageTab.setAttribute('aria-selected', tab === 'damage' ? 'true' : 'false');
    healTab.setAttribute('aria-selected', tab === 'heal' ? 'true' : 'false');
  };

  onActivate(damageTab, () => {
    tab = 'damage';
    applyChrome();
  });
  onActivate(healTab, () => {
    tab = 'heal';
    applyChrome();
  });
  onActivate(collapseBtn, () => {
    collapsed = true;
    applyChrome();
  });
  onActivate(dock, () => {
    collapsed = false;
    applyChrome();
  });

  applyChrome();
  root.append(panel, dock);
  host.appendChild(root);

  return {
    sync(balls, playerId) {
      paintRows(list, stats.snapshot(balls, playerId, tab), tab);
    },
    isCollapsed() {
      return collapsed;
    },
    getTab() {
      return tab;
    },
    collapse() {
      collapsed = true;
      applyChrome();
    },
    expand() {
      collapsed = false;
      applyChrome();
    },
    setTab(next) {
      tab = next;
      applyChrome();
    },
  };
}
