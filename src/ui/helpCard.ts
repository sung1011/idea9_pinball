import type { HeroId } from '../heroes/heroIds';
import { kitHelpSkills } from '../heroes/kitLabels';

export type HelpCard = {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
  setHero: (hero: HeroId) => void;
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

/** 说明卡：设置「怎么玩」打开；点空白或关闭钮收起。战场不再放 `?` 浮钮。 */
export function createHelpCard(host: HTMLElement, opts?: HelpCardOpts): HelpCard {
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

  const fillBody = (hero: HeroId): void => {
    body.replaceChildren();
    addBlock(body, '开局', [
      '红左底 / 蓝右底木栏 Stall，开口朝领地，大号倒计时 5 秒，栏内不可出。',
      '倒计时结束围栏消失，冲锋 2 秒：前 0.4 秒拉到峰值 7.5，禁技能、几乎锁拧、全程无敌。',
      '冲锋结束才点地纠偏、放技能。Esc 或点空白可跳过 Stall，直接开战。',
    ]);
    addBlock(body, '怎么动', [
      '骑士一直保底冲（约 2.5），点地 / 鼠标只纠偏方向，不加油门。金矛尖跟瞄准。',
      '左下角可随时换英雄，只换技能组，血量 / 位置 / 对局不变。',
      kitHelpSkills(hero),
      '按下进瞄，再按同键或左键释放；右键 / Esc 取消。长按技能键约 0.4 秒可看对外名和一行效果。',
      ...(hero === 'ring'
        ? ['囚环内敌方不能放位移技（钩矛 / 盾冲 / 蓄势 / 壁行 / 援勾 / 顶冲 / 侧闪 / 虚影 / 双索 / 易位）；圈内强放进 2 秒短 CD。']
        : hero === 'chain'
          ? ['愈链给己+扇内最近友 HOT；盾脉罩最近友（无则仅己）；援勾拉自己或轻拉残血友；扰锋拧敌朝向并打断短瞄准。']
          : hero === 'nail'
            ? ['甲垒 1.5s 碰撞伤×0.4，未破甲结束回 8；刺盾被主动撞反 12，主动开则 1s 首击反 16；顶冲冲 3 格；钉锚 0.6s 钉住，被推≥1 格断钉。']
            : hero === 'arc'
              ? ['侧闪 0.15s 后横移 2 格；掠刃开 2s 擦肩窗伤 11，同目标 1s 最多 1 次；回印 4s 后主动撞/擦伤额外 14；虚影 0.4s 无碰撞，结束速≥6 开 0.2s 撞窗。困圈内不可侧闪/虚影。']
              : hero === 'well'
                ? ['双索：先锁定≤6 敌人，再点落点≤5 飞出，目标轻拉向连线中点、伤 8、落地速 9。易位交换位置与 50% 速度。索桩 5s 当墙，己方撞桩开撞窗，同时仅 1 桩。回索需有桩，线上敌轻拉降速一档、伤 6。困圈内不可双索/易位。']
                : []),
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
  };

  fillBody('hook');

  card.append(head, body);
  overlay.appendChild(card);
  host.appendChild(overlay);

  const setOpen = (open: boolean): void => {
    overlay.classList.toggle('isOn', open);
  };

  const close = (): void => {
    setOpen(false);
  };

  const open = (): void => {
    opts?.onOpen?.();
    setOpen(true);
  };

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
      fillBody(hero);
    },
  };
}
