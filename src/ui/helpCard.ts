import { DEFAULT_MATCH_MODE, isEightKill, type MatchModeId } from '../core/matchMode';
import type { HeroId } from '../heroes/heroIds';
import { kitHelpSkills } from '../heroes/kitLabels';

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

  let currentHero: HeroId = 'hook';
  let currentMode: MatchModeId = DEFAULT_MATCH_MODE;

  const fillBody = (hero: HeroId, mode: MatchModeId): void => {
    currentHero = hero;
    currentMode = mode;
    body.replaceChildren();
    addBlock(body, '开局', [
      '本机固定 2v2：你控红 1，红 2 与两名蓝简 bot。开局和每次 R：队友与敌方从含镜卫的全英雄池均匀随机，允许同局重复。你的英雄记住上次所选，无记录时默认钩刺。',
      '左上最上方可切「八杀 / 占点」，记住上次所选；换模式会立刻重开倒计时。换英雄只换技能组，不重开。',
      '地图高 20、宽按 iPhone 18 Pro Max 横屏 956:440。红左半场上下、蓝右半场上下各一出生；木栏 Stall 贴底线开口朝中，大号倒计时 5 秒，栏内不可出。',
      '倒计时结束围栏消失，冲锋 1 秒：前 0.2 秒拉到峰值 7.5，禁技能、几乎锁拧、全程无敌。',
      '冲锋结束才点地纠偏、放技能。Esc 或点空白可跳过 Stall，直接开战。',
    ]);
    addBlock(body, '怎么动', [
      '骑士一直保底冲（约 2.5），点地 / 鼠标只纠偏方向，不加油门。金矛尖跟瞄准。',
      '盾面大号数字是本队第几人（红 1、红 2、蓝 1、蓝 2），换英雄不换号。',
      '只有枪尖戳到对方身体才掉血；伤害 6×相对速度、单次上限 28。成功掉血后枪尖普攻 1.5 秒 CD，CD 中再戳不掉血。身子圆蹭圆只弹开不掉血。背刺不再更高伤。',
      '设置常规页可换自己的英雄，只换技能组，血量 / 位置 / 编号 / 对局不变，立刻记住下次缺省。不能换队友；队友仍按开局随机。GM H 只循环红 1。',
      '始终横屏对局。系统锁当前横屏侧，不对画面做 90° 旋转，无转屏提示。',
      kitHelpSkills(hero),
      '按下进瞄，再按同键或左键释放。触屏瞄准中点空白即瞄向并释放，滑动只改朝向；点技能键 / ? / 齿轮 / 取消键 / 设置里的选择不抢成点空白。右键 / Esc 取消。长按技能键约 0.4 秒可看对外名和一行效果（CD 中也可）。CD 中键上从 12 点顺时针遮罩，并显示剩余秒（一位小数）。',
      '触屏左下常显半透明瞄准摇杆：拖动改枪尖/技能朝向，松手回中不放技能；不是自由移动。纯鼠标桌面不常显，仍用鼠标瞄准。',
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
    if (isEightKill(mode)) {
      addBlock(body, '怎么得分', [
        '用枪尖或技能把敌人打到击破，记 1 杀。顶中胶囊显示双方击杀数。',
        '助攻不计杀，不影响胜负。',
        '不计领地分。中央圈与左右矮柱在本模式隐藏，也不挡路。',
        '本模式无随机环境伤害圈。',
      ]);
      addBlock(body, '怎么赢', [
        '先到 8 杀立即获胜。',
        '240 秒到点，杀数多者胜。',
        '杀数相同则 30 秒加时，期间先超前 1 杀者胜。',
        '加时仍平则比双方剩余总血（倒地 / 离场按 0）。',
      ]);
      addBlock(body, '药水', [
        '正式开战第 10 秒出现第一瓶（开场倒计时不算），之后约每 45 秒刷新。场上同时只有 1 瓶；到点未捡走也会换角换种类。',
        '四角随机，距墙约 3 格。身体碰到就捡，先碰到的人获得。',
        '伤害加成：8 秒，枪尖和技能伤害 ×1.5。',
        '加速：8 秒，移速上限 8→10。',
        '加血：立即回复 80，上限 300。',
        '护盾：吸收 80 伤害，最多 10 秒或直到破完。',
        '加血不占增益栏；其余三种可同时存在。再捡同种会刷新时间（护盾吸收量回到 80）。',
      ]);
    } else {
      addBlock(body, '怎么得分', [
        '击破对方 +15。',
        '助攻 +5（击杀前 3 秒内最近 1 名队友）。',
        '领地：圈内活人数严格更多一方 +2/秒。',
        '本模式无药水、无地裂矛阵。中央圈与左右矮柱照常。',
      ]);
      addBlock(body, '怎么赢', [
        '先到 100 分立即结束。',
        '240 秒到点，分高者胜。',
        '平分则 30 秒加时，只计领地分。',
        '再平则看下一次击破。',
      ]);
    }
    addBlock(body, '回场', ['击破后 5 秒回场，回场 2 秒无敌。自己离场时屏幕中央偏上显示「复活还需 X 秒」，无遮罩；队友和敌人仍用短提示。']);
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
