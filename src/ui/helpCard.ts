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

  const fillBody = (hero: HeroId): void => {
    body.replaceChildren();
    addBlock(body, '开局', [
      '本机固定 2v2：你控红 1，红 2 与两名蓝简 bot。开局和每次 R：队友与敌方从含镜卫的全英雄池均匀随机，允许同局重复。你的英雄记住上次所选，无记录时默认钩刺。',
      '地图 20×20。红左半场上下、蓝右半场上下各一出生；木栏 Stall 贴底线开口朝领地，大号倒计时 5 秒，栏内不可出。',
      '倒计时结束围栏消失，冲锋 1 秒：前 0.2 秒拉到峰值 7.5，禁技能、几乎锁拧、全程无敌。',
      '冲锋结束才点地纠偏、放技能。Esc 或点空白可跳过 Stall，直接开战。',
    ]);
    addBlock(body, '怎么动', [
      '骑士一直保底冲（约 2.5），点地 / 鼠标只纠偏方向，不加油门。金矛尖跟瞄准。',
      '骑士侧小圆盾上的数字是本队第几人（红 1、红 2、蓝 1、蓝 2），换英雄不换号。',
      '只有枪尖戳到对方身体才掉血；伤害 6×相对速度、单次上限 28。成功掉血后枪尖普攻 1 秒 CD，CD 中再戳不掉血。身子圆蹭圆只弹开不掉血。背刺不再更高伤。',
      '左上可换自己或队友英雄，只换技能组，血量 / 位置 / 编号 / 对局不变。换自己会立刻记住下次缺省，换队友不会。GM H 只循环红 1。',
      '竖持为主操作朝向；横持或 PC 任意窗同样 letterbox 可玩，不提示转屏、不翻转画面。',
      kitHelpSkills(hero),
      '按下进瞄，再按同键或左键释放。触屏瞄准中点空白即瞄向并释放，滑动只改朝向；点技能键 / 换英雄 / ? / 齿轮 / 取消键不抢成点空白。右键 / Esc 取消。长按技能键约 0.4 秒可看对外名和一行效果（CD 中也可）。CD 中键上从 12 点顺时针遮罩，并显示剩余秒（一位小数）。',
      ...(hero === 'ring'
        ? ['囚环物理关死出不去：圈内敌滑到边缘会被夹住，圈外仍可滑进；友军不受困。圈内敌仍不能放位移技（钩矛 / 盾冲 / 蓄势 / 壁行 / 援勾 / 顶冲 / 侧闪 / 虚影 / 易位），强放进 2 秒短 CD。']
          : hero === 'chain'
            ? ['愈链扇内友 HOT / 敌 DoT，每秒 6 共 4s；盾脉与一名敌人粘住吸血 3s（己+8/敌-8）；援勾拉向友或把敌弹远；扰锋身周 5 格沉默 3 秒并打断瞄准，友军不受影响。无合法目标进 2 秒短 CD。']
          : hero === 'nail'
            ? ['甲垒 3.5s 碰撞伤×0.4，未破甲结束回 8；刺盾被主动撞反 12，主动开则 3s 首击反 16；顶冲冲 3 格；钉锚 0.6s 钉住，被推≥1 格断钉。']
            : hero === 'arc'
              ? ['侧闪瞬移到瞄准扇内最近敌背后并朝向对敌；无目标进 2 秒短 CD。掠刃给自己刀刃荼毒 8s，下次枪尖成功掉血 +6 后清除。回印 6s 后主动撞额外 14；虚影 2.4s 无碰撞，结束速≥6 开 0.2s 撞窗。困圈内不可侧闪/虚影。']
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
      fillBody(hero);
    },
  };
}
