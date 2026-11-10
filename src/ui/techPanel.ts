import { HERO_IDS, heroZh, type HeroId } from '../heroes/heroIds';
import { heroTechSlots, isBuyableTechId, type HeroTechSlot } from '../core/heroTechSlots';
import { heroUnlockCost } from '../core/techIds';
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

type DetailKind = { kind: 'hero'; id: HeroId } | { kind: 'slot'; hero: HeroId; slot: 1 | 2 | 3 | 4 };

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

function focusHeroOf(sel: DetailKind): HeroId {
  return sel.kind === 'hero' ? sel.id : sel.hero;
}

function appendSlotIcon(host: HTMLElement, slot: HeroTechSlot): void {
  const img = document.createElement('img');
  img.className = 'techItemIcon';
  img.alt = '';
  img.draggable = false;
  img.decoding = 'async';
  img.setAttribute('aria-hidden', 'true');
  img.style.pointerEvents = 'none';
  if (slot.iconUrl) {
    img.onerror = () => {
      img.hidden = true;
    };
    img.src = slot.iconUrl;
  } else {
    img.hidden = true;
  }
  host.appendChild(img);
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
    const focusHero = focusHeroOf(selected);
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
      btn.dataset.techHero = id;
      if (focusHero === id) {
        btn.classList.add('isOn');
      }
      const price = id === 'hook' ? '免费' : unlocked ? '已解锁' : `${heroUnlockCost(state.unlockedHeroes)}点`;
      btn.append(el('span', 'techItemName', heroZh(id)), el('span', 'techItemMeta', price));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        selected = { kind: 'hero', id };
        render();
      });
      heroList.appendChild(btn);
    }
    heroBox.appendChild(heroList);
    body.appendChild(heroBox);

    const slots = heroTechSlots(focusHero);
    const techBox = el('section', 'techGroup');
    techBox.dataset.techSlots = focusHero;
    techBox.appendChild(el('h3', 'techGroupTitle', `${heroZh(focusHero)}技能槽`));
    const techList = el('div', 'techList techSlotList');
    for (const slot of slots) {
      const btn = el('button', 'techItem');
      btn.type = 'button';
      btn.setAttribute('data-touch-control', '');
      btn.dataset.techSlot = String(slot.slot);
      btn.dataset.techHero = slot.hero;
      if (selected.kind === 'slot' && selected.hero === slot.hero && selected.slot === slot.slot) {
        btn.classList.add('isOn');
      }
      const lead = el('span', 'techItemLead');
      appendSlotIcon(lead, slot);
      lead.appendChild(el('span', 'techItemName', slot.name));
      const meta = slot.kind === 'live' ? (state.litTechs.includes(slot.techId) ? '已点亮' : `${slot.cost}点`) : 'todo';
      btn.append(lead, el('span', 'techItemMeta', meta));
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        selected = { kind: 'slot', hero: slot.hero, slot: slot.slot };
        render();
      });
      techList.appendChild(btn);
    }
    techBox.appendChild(techList);
    body.appendChild(techBox);

    const detail = el('section', 'techDetail');
    fillDetail(detail, selected, slots, {
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
    slots: readonly HeroTechSlot[],
    ctx: { buyable: boolean; onDone: () => void },
  ): void => {
    const state = opts.store.getState();
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
        box.appendChild(el('p', 'techHint', '已解锁。练习试用不会改变这份正式解锁。下方四槽仍可浏览。'));
        box.appendChild(el('p', 'techStatus', '已解锁'));
        return;
      }
      box.appendChild(el('p', 'techHint', `消耗 ${cost} 点解锁（前三次付费英雄各 30，之后各 60；钩刺不计入次数）。不退款。未解锁也可浏览普通技能 todo 槽，不能绕过解锁。`));
      box.appendChild(el('p', 'techStatus', '未点亮'));
      if (!ctx.buyable) {
        return;
      }
      const btn = el('button', 'techBuy', `消耗${cost}点点亮`);
      btn.type = 'button';
      btn.setAttribute('data-touch-control', '');
      btn.dataset.techBuyHero = sel.id;
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
    const slot = slots.find((item) => item.slot === sel.slot) ?? slots[0];
    if (!slot) {
      return;
    }
    box.appendChild(el('h3', 'techDetailTitle', slot.name));
    if (slot.kind === 'todo') {
      box.appendChild(el('p', 'techHint', '该普通技能的科技强化尚未开放。不可购买、不可点亮、不扣资源。必杀不加入科技。'));
      box.appendChild(el('p', 'techStatus', 'todo·待开发'));
      const btn = el('button', 'techBuy', 'todo');
      btn.type = 'button';
      btn.disabled = true;
      btn.setAttribute('data-touch-control', '');
      btn.dataset.techTodo = slot.techId;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        const result = opts.store.buyTech(slot.techId as never);
        lastFlash = '';
        flash(box, result.ok ? '不应买成' : result.message, 'err');
      });
      box.appendChild(btn);
      return;
    }
    const lit = state.litTechs.includes(slot.techId);
    box.appendChild(el('p', 'techHint', slot.effect));
    if (lit) {
      box.appendChild(el('p', 'techStatus', '已点亮'));
      return;
    }
    box.appendChild(el('p', 'techHint', `价格 ${slot.cost} 点。点亮后永久生效，可与其他槽位同时开。不退款。`));
    box.appendChild(el('p', 'techStatus', state.points >= slot.cost ? '可点亮' : '资源不足'));
    if (!ctx.buyable) {
      return;
    }
    const btn = el('button', 'techBuy', `消耗${slot.cost}点点亮`);
    btn.type = 'button';
    btn.setAttribute('data-touch-control', '');
    if (!isBuyableTechId(slot.techId) || state.points < slot.cost || !opts.store.status().writable) {
      btn.disabled = true;
      btn.textContent = opts.store.status().writable ? '资源不足' : '无法保存';
    }
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      if (!isBuyableTechId(slot.techId)) {
        return;
      }
      const result = opts.store.buyTech(slot.techId);
      if (result.ok) {
        lastFlash = `已点亮${slot.name}`;
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
