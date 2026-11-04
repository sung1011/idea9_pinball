export type HelpCard = {
  close: () => void;
  isOpen: () => boolean;
};

export type HelpCardOpts = {
  onOpen?: () => void;
};

function addBlock(host: HTMLElement, title: string, lines: readonly string[]): void {
  const block = document.createElement('section');
  block.className = 'helpCardBlock';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  for (const line of lines) {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  }
  block.append(heading, list);
  host.appendChild(block);
}

/** 右上角 `?`：点击开关；点空白或关闭钮收起。与齿轮设置分开。 */
export function createHelpCard(host: HTMLElement, opts?: HelpCardOpts): HelpCard {
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'helpFab';
  fab.textContent = '?';
  fab.setAttribute('data-touch-control', '');
  fab.setAttribute('aria-label', '说明');

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
  addBlock(body, '开局', [
    '红左底 / 蓝右底木栏 Stall，开口朝领地，大号倒计时 5 秒，栏内不可出。',
    '倒计时结束围栏消失，冲锋 2 秒：前 0.4 秒拉到峰值 7.5，禁技能、几乎锁拧、全程无敌。',
    '冲锋结束才点地纠偏、放技能。Esc 或点空白可跳过 Stall，直接开战。',
  ]);
  addBlock(body, '怎么动', [
    '骑士一直保底冲（约 2.5），点地 / 鼠标只纠偏方向，不加油门。金矛尖跟瞄准。',
    '技能 1–4：1 钩矛 / 2 连刺×3 / 3 盾冲 / 4 蓄势。',
    '按下进瞄，再按同键或左键释放；右键 / Esc 取消。',
  ]);
  addBlock(body, '怎么得分', [
    '击破对方 +15。',
    '助攻 +5（击杀前 3 秒内最近 1 名队友）。',
    '领地：圈内活人数严格更多一方 +2/秒。',
  ]);
  addBlock(body, '怎么赢', [
    '先到 100 分立即结束。',
    '240 秒到点，分高者胜。',
    '平分则 30 秒加时，只计领地分。',
    '再平则看下一次击破。',
  ]);
  addBlock(body, '回场', ['击破后 5 秒回场，回场 2 秒无敌。']);

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

  fab.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const next = !overlay.classList.contains('isOn');
    if (next) {
      opts?.onOpen?.();
    }
    setOpen(next);
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
    close,
    isOpen: () => overlay.classList.contains('isOn'),
  };
}
