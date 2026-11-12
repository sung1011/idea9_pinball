import { DEFAULT_MATCH_MODE, isEightKill, type MatchModeId } from '../core/matchMode';
import type { HeroId } from '../heroes/heroIds';

export type HelpCard = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  setHero: (hero: HeroId) => void;
  setMode: (mode: MatchModeId) => void;
};

export type HelpCardOpts = {
  onOpen?: () => void;
};

export const HELP_SHARED_LINES = [
  '骑士自动滑行，点地或摇杆只调整朝向；电脑用鼠标瞄准。',
  '技能按一下瞄准，再按一次释放；长按技能键查看效果。',
  '枪尖命中才造成普攻伤害，身体相撞只弹开。',
  '被击破后 5 秒回场，回场后 2 秒无敌。',
] as const;

export const HELP_EIGHT_KILL_LINE = '八杀：先到 8 杀获胜，时间到比杀数。';
export const HELP_CONTROL_POINT_LINE = '击破和占圈获得积分，先到 100 分获胜，时间到比分。';

export function helpLines(mode: MatchModeId): readonly [string, string, string, string, string] {
  return [
    HELP_SHARED_LINES[0],
    HELP_SHARED_LINES[1],
    HELP_SHARED_LINES[2],
    HELP_SHARED_LINES[3],
    isEightKill(mode) ? HELP_EIGHT_KILL_LINE : HELP_CONTROL_POINT_LINE,
  ];
}

/** 顶右 `?` 与设置「怎么玩」打开同一份说明卡；点空白或关闭钮收起。 */
export function createHelpCard(host: HTMLElement, opts?: HelpCardOpts): HelpCard {
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'helpFab';
  fab.textContent = '?';
  fab.setAttribute('data-touch-control', '');
  fab.setAttribute('aria-label', '怎么玩');
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-expanded', 'false');

  const overlay = document.createElement('div');
  overlay.className = 'helpOverlay';
  overlay.setAttribute('data-touch-control', '');

  const card = document.createElement('div');
  card.className = 'helpCard';

  const head = document.createElement('div');
  head.className = 'helpCardHead';
  const title = document.createElement('h2');
  title.textContent = '怎么玩';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'helpCardClose';
  closeBtn.textContent = '×';
  closeBtn.setAttribute('aria-label', '关闭说明');
  head.append(title, closeBtn);

  const body = document.createElement('div');
  body.className = 'helpCardBody';

  let currentHero: HeroId = 'hook';
  let currentMode: MatchModeId = DEFAULT_MATCH_MODE;

  const fillBody = (hero: HeroId, mode: MatchModeId): void => {
    currentHero = hero;
    currentMode = mode;
    body.replaceChildren();
    const block = document.createElement('section');
    block.className = 'helpCardBlock';
    const list = document.createElement('ul');
    for (const line of helpLines(mode)) {
      const item = document.createElement('li');
      item.textContent = line;
      list.appendChild(item);
    }
    block.appendChild(list);
    body.appendChild(block);
  };

  fillBody('hook', DEFAULT_MATCH_MODE);

  card.append(head, body);
  overlay.appendChild(card);
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
    opts?.onOpen?.();
    setOpen(true);
  };

  fab.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const next = !overlay.classList.contains('isOn');
    if (next) {
      open();
      return;
    }
    close();
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
      if (ev.key !== 'Escape' || !overlay.classList.contains('isOn')) {
        return;
      }
      ev.preventDefault();
      ev.stopImmediatePropagation();
      close();
    },
    true,
  );

  return {
    open,
    close,
    isOpen: () => overlay.classList.contains('isOn'),
    setHero: (hero) => {
      fillBody(hero, currentMode);
    },
    setMode: (mode) => {
      fillBody(currentHero, mode);
    },
  };
}
