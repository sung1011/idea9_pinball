import { HERO_IDS, heroZh, type HeroId } from '../heroes/heroIds';
import { HOOK_TECH_DEFS, type HookTechDef } from '../core/hookTech';
import { heroUnlockCost, type HookTechId } from '../core/techIds';
import type { MatchPhase } from '../core/matchSession';
import type { TechStore } from '../core/techSave';

export type TechPanel = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  sync: () => void;
};

export type TechPanelOpts = {
  store: TechStore;
  getPhase?: () => MatchPhase;
  getPractice?: () => boolean;
  onChanged?: () => void;
  onOpen?: () => void;
};

type DetailKind = { kind: 'hero'; id: HeroId } | { kind: 'tech'; id: HookTechId } | { kind: 'todo'; id: HeroId };

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

function canBuyNow(phase: MatchPhase | undefined): boolean {
  return phase !== 'playing' && phase !== 'overtime';
}

/** 顶右「科」：羊皮纸科技树。局内只读，倒计时/结算可买，下场进场快照生效。 */
export function createTechPanel(host: HTMLElement, opts: TechPanelOpts): TechPanel {
  let selected: DetailKind = { kind: 'hero', id: 'hook' };
  let lastFlash = '';

  const fab = el('button', 'techFab', '科');
  fab.type = 'button';
  fab.setAttribute('data-touch-control', '');
  fab.setAttribute('aria-label', '科技');
  fab.setAttribute('aria-haspopup', 'dialog');

  const overlay = el('div', 'techOverlay');
  overlay.setAttribute('data-touch-control', '');

  const panel = el('section', 'techPanel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'techTitle');

  const head = el('div', 'techHead');
  const title = el('h2', 'techTitle', '科技');
  title.id = 'techTitle';
  const closeBtn = el('button', 'techClose', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭科技');
  head.append(title, closeBtn);

  const body = el('div', 'techBody');
  panel.append(head, body);
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

  const isOpen = (): boolean => overlay.classList.contains('isOn');

  const flash = (hostEl: HTMLElement, text: string, kind: 'ok' | 'err'): void => {
    const node = el('p', kind === 'ok' ? 'techFlash isOk' : 'techFlash isErr', text);
    hostEl.appendChild(node);
  };

  const render = (): void => {
    const state = opts.store.getState();
    const status = opts.store.status();
    const phase = opts.getPhase?.();
    const practice = !!opts.getPractice?.();
    const buyable = canBuyNow(phase) && !practice;
    body.replaceChildren();

    const balance = el('p', 'techBalance', `科技点 ${state.points}`);
    body.appendChild(balance);
    body.appendChild(el('p', 'techHint', '进度仅保存在本机。清除浏览器数据会丢失科技点、英雄解锁与槽位。'));
    if (status.message) {
      body.appendChild(el('p', 'techWarn', status.message));
    }
    if (lastFlash) {
      body.appendChild(el('p', 'techFlash isOk', lastFlash));
    }
    if (practice) {
      body.appendChild(el('p', 'techHint', '练习可试用全部英雄，不写入永久解锁，也不发科技点。点亮请结束练习后在战外购买。'));
    }
    if (!canBuyNow(phase)) {
      body.appendChild(el('p', 'techWarn', '局内只读。科技购买下场进场生效，当前对局已锁定进场快照。'));
    }

    const heroBox = el('section', 'techGroup');
    heroBox.appendChild(el('h3', 'techGroupTitle', '英雄'));
    const heroList = el('div', 'techList');
    for (const id of HERO_IDS) {
      const unlocked = id === 'hook' || state.unlockedHeroes.includes(id);
      const btn = el('button', 'techItem');
      btn.type = 'button';
      btn.setAttribute('data-touch-control', '');
      if (selected.kind === 'hero' && selected.id === id) {
        btn.classList.add('isOn');
      }
      const price = id === 'hook' ? '免费' : unlocked ? '已解锁' : `${heroUnlockCost(state.unlockedHeroes)}点`;
      btn.append(el('span', '', heroZh(id)), el('span', 'techItemMeta', price));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        selected = { kind: 'hero', id };
        render();
      });
      heroList.appendChild(btn);
    }
    heroBox.appendChild(heroList);
    body.appendChild(heroBox);

    const techBox = el('section', 'techGroup');
    techBox.appendChild(el('h3', 'techGroupTitle', '钩刺技能槽'));
    const techList = el('div', 'techList');
    for (const def of HOOK_TECH_DEFS) {
      const lit = state.litTechs.includes(def.id);
      const btn = el('button', 'techItem');
      btn.type = 'button';
      btn.setAttribute('data-touch-control', '');
      if (selected.kind === 'tech' && selected.id === def.id) {
        btn.classList.add('isOn');
      }
      const price = lit ? '已点亮' : `${def.cost}点`;
      btn.append(el('span', '', def.name), el('span', 'techItemMeta', price));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        selected = { kind: 'tech', id: def.id };
        render();
      });
      techList.appendChild(btn);
    }
    techBox.appendChild(techList);
    body.appendChild(techBox);

    const todoBox = el('section', 'techGroup');
    todoBox.appendChild(el('h3', 'techGroupTitle', '其他英雄强化'));
    const todoList = el('div', 'techList');
    for (const id of HERO_IDS) {
      if (id === 'hook') {
        continue;
      }
      const btn = el('button', 'techItem');
      btn.type = 'button';
      btn.setAttribute('data-touch-control', '');
      if (selected.kind === 'todo' && selected.id === id) {
        btn.classList.add('isOn');
      }
      btn.append(el('span', '', heroZh(id)), el('span', 'techItemMeta', 'todo'));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        selected = { kind: 'todo', id };
        render();
      });
      todoList.appendChild(btn);
    }
    todoBox.appendChild(todoList);
    body.appendChild(todoBox);

    const detail = el('section', 'techDetail');
    fillDetail(detail, selected, {
      buyable,
      onDone: () => {
        opts.onChanged?.();
        render();
      },
    });
    body.appendChild(detail);
  };

  const fillDetail = (
    box: HTMLElement,
    sel: DetailKind,
    ctx: { buyable: boolean; onDone: () => void },
  ): void => {
    const state = opts.store.getState();
    if (sel.kind === 'todo') {
      box.appendChild(el('h3', 'techDetailTitle', `${heroZh(sel.id)}强化`));
      box.appendChild(el('p', 'techHint', 'todo：其他英雄技能强化首版不可购买。'));
      return;
    }
    if (sel.kind === 'hero') {
      const unlocked = sel.id === 'hook' || state.unlockedHeroes.includes(sel.id);
      const cost = heroUnlockCost(state.unlockedHeroes);
      box.appendChild(el('h3', 'techDetailTitle', heroZh(sel.id)));
      if (sel.id === 'hook') {
        box.appendChild(el('p', 'techHint', '钩刺初始免费。解锁后技能槽无需额外前置即可点亮。'));
        box.appendChild(el('p', 'techStatus', '已解锁'));
        return;
      }
      if (unlocked) {
        box.appendChild(el('p', 'techHint', '已解锁。练习试用不会改变这份正式解锁。'));
        box.appendChild(el('p', 'techStatus', '已解锁'));
        return;
      }
      box.appendChild(el('p', 'techHint', `消耗 ${cost} 点解锁（前三次付费英雄各 30，之后各 60；钩刺不计入次数）。不退款。`));
      box.appendChild(el('p', 'techStatus', '未点亮'));
      if (!ctx.buyable) {
        return;
      }
      const btn = el('button', 'techBuy', `消耗${cost}点点亮`);
      btn.type = 'button';
      btn.setAttribute('data-touch-control', '');
      if (state.points < cost || !opts.store.status().writable) {
        btn.disabled = true;
        btn.textContent = opts.store.status().writable ? '资源不足' : '无法保存';
      }
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const result = opts.store.buyHero(sel.id);
        if (result.ok) {
          lastFlash = `已解锁${heroZh(sel.id)}`;
          ctx.onDone();
          return;
        }
        lastFlash = '';
        flash(box, result.message, 'err');
      });
      box.appendChild(btn);
      return;
    }
    const def: HookTechDef = HOOK_TECH_DEFS.find((item) => item.id === sel.id) ?? HOOK_TECH_DEFS[0];
    const lit = state.litTechs.includes(def.id);
    box.appendChild(el('h3', 'techDetailTitle', def.name));
    box.appendChild(el('p', 'techHint', def.effect));
    if (lit) {
      box.appendChild(el('p', 'techStatus', '已点亮'));
      return;
    }
    box.appendChild(el('p', 'techHint', `价格 ${def.cost} 点。点亮后永久生效，可与其他槽位同时开。不退款。`));
    box.appendChild(el('p', 'techStatus', state.points >= def.cost ? '可点亮' : '资源不足'));
    if (!ctx.buyable) {
      return;
    }
    const btn = el('button', 'techBuy', `消耗${def.cost}点点亮`);
    btn.type = 'button';
    btn.setAttribute('data-touch-control', '');
    if (state.points < def.cost || !opts.store.status().writable) {
      btn.disabled = true;
      btn.textContent = opts.store.status().writable ? '资源不足' : '无法保存';
    }
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
        const result = opts.store.buyTech(def.id);
        if (result.ok) {
          lastFlash = `已点亮${def.name}`;
          ctx.onDone();
          return;
        }
        lastFlash = '';
        flash(box, result.message, 'err');
    });
    box.appendChild(btn);
  };

  const open = (): void => {
    opts.onOpen?.();
    setOpen(true);
    render();
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
  opts.store.subscribe(() => {
    if (isOpen()) {
      render();
    }
  });

  return {
    open,
    close,
    isOpen,
    sync: render,
  };
}
