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
      '本机固定 2v2：你控红 1，红 2 默认链生简 bot，对 2 名蓝简 bot（蓝 1 磁环、蓝 2 钩刺）。',
      '红左底 / 蓝右底木栏 Stall，开口朝领地，大号倒计时 5 秒，栏内不可出。',
      '倒计时结束围栏消失，冲锋 1 秒：前 0.2 秒拉到峰值 7.5，禁技能、几乎锁拧、全程无敌。',
      '冲锋结束才点地纠偏、放技能。Esc 或点空白可跳过 Stall，直接开战。',
    ]);
    addBlock(body, '怎么动', [
      '骑士一直保底冲（约 2.5），点地 / 鼠标只纠偏方向，不加油门。金矛尖跟瞄准。',
      '盾面大号数字是本队第几人（红 1、红 2、蓝 1、蓝 2），换英雄不换号。',
      '只有枪尖戳到对方身体、且相对速度够（≥4，技能后撞窗 2.5）才掉血；身子圆蹭圆只弹开不掉血。背刺不再更高伤。',
      '左下角可换自己或队友英雄，只换技能组，血量 / 位置 / 编号 / 对局不变。GM H 只循环红 1。',
      '竖持为主操作朝向；横持或 PC 任意窗同样 letterbox 可玩，不提示转屏、不翻转画面。',
      kitHelpSkills(hero),
      '按下进瞄，再按同键或左键释放；右键 / Esc 取消。长按技能键约 0.4 秒可看对外名和一行效果（CD 中也可）。CD 中键上从 12 点顺时针遮罩，并显示剩余秒（一位小数）。',
      ...(hero === 'ring'
        ? ['囚环物理关死出不去：圈内敌滑到边缘会被夹住，圈外仍可滑进；友军不受困。圈内敌仍不能放位移技（钩矛 / 盾冲 / 蓄势 / 壁行 / 援勾 / 顶冲 / 侧闪 / 虚影 / 易位），强放进 2 秒短 CD。']
          : hero === 'chain'
            ? ['愈链给己+扇内最近友 HOT 4s；盾脉罩最近友（无则仅己）3.2s；援勾拉自己或轻拉残血友；扰锋身周 5 格沉默 3 秒并打断瞄准，友军不受影响。']
          : hero === 'nail'
            ? ['甲垒 3.5s 碰撞伤×0.4，未破甲结束回 8；刺盾被主动撞反 12，主动开则 3s 首击反 16；顶冲冲 3 格；钉锚 0.6s 钉住，被推≥1 格断钉。']
            : hero === 'arc'
              ? ['侧闪 0.15s 后横移 2 格；掠刃开 4s 擦肩窗伤 11，同目标 1s 最多 1 次；回印 6s 后主动撞/擦伤额外 14；虚影 2.4s 无碰撞，结束速≥6 开 0.2s 撞窗。困圈内不可侧闪/虚影。']
              : hero === 'well'
                ? ['索爆：释放后 0.2s，身周半径 2.2 连炸 4 次、间隔 0.35s、每次伤 8，只打敌人；有桩则桩同步炸，4 次后收桩。易位交换位置与 50% 速度。索桩 7s 当墙，己方撞桩开撞窗，同时仅 1 桩。回索需有桩，线上敌伤 6 并定身 2 秒（超出硬控 0.6s 上限）。困圈内不可易位。']
                : hero === 'mirror'
                  ? ['折光 1.5 秒受伤减半，减免量记入反照账本。反照消耗账本扇形打首个敌人，伤害封顶 60；空账或无目标不进 CD。裂镜自伤 24 入账，周围溅 12 不入账，可把自己打进回场。镜壁身前短墙 2.5 秒，敌弹己开窗。']
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
