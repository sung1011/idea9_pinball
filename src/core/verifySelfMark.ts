import { Graphics, Texture } from 'pixi.js';
import { createBallBody } from './ballBody';
import { BALL_RADIUS } from './constants';
import { createMatchRoster } from './matchSession';
import {
  createBallView,
  drawSelfMark,
  drawTeamRing,
  HP_BAR_LAYOUT,
  SELF_MARK,
  selfMarkActive,
  selfMarkBob,
  selfMarkTipY,
} from '../render/ballView';
import { getHookRiderArt, setHookRiderArt } from '../render/hookRiderArt';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function markLayer(view: ReturnType<typeof createBallView>): Graphics {
  const child = view.root.children[0];
  if (!(child instanceof Graphics)) {
    throw new Error('自身标记：标记层应是最底层 Graphics');
  }
  return child;
}

function bodyGfx(view: ReturnType<typeof createBallView>): Graphics {
  const graphics = view.root.children.filter((child): child is Graphics => child instanceof Graphics);
  const body = graphics[2];
  if (!body) {
    throw new Error('自身标记：应能拿到主体 Graphics');
  }
  return body;
}

function stubTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 8;
  canvas.height = 8;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 8, 8);
  }
  return Texture.from(canvas);
}

function emptyish(g: Graphics): boolean {
  const b = g.getLocalBounds();
  return b.width < 0.05 && b.height < 0.05;
}

function asColorNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value >>> 0;
  }
  if (value && typeof value === 'object' && 'toNumber' in value) {
    const toNumber = (value as { toNumber?: unknown }).toNumber;
    if (typeof toNumber === 'function') {
      const n = (toNumber as () => number).call(value);
      if (typeof n === 'number' && Number.isFinite(n)) {
        return n >>> 0;
      }
    }
  }
  return null;
}

function fillColors(g: Graphics): number[] {
  const colors: number[] = [];
  for (const inst of g.context.instructions) {
    if (inst.action !== 'fill' && inst.action !== 'stroke') {
      continue;
    }
    const style = inst.data?.style as { color?: unknown } | undefined;
    const n = asColorNum(style?.color);
    if (n !== null) {
      colors.push(n);
    }
  }
  return colors;
}

/** 本地玩家血条上方金色倒三角：只本人、死亡隐藏、不随朝向转、不进残影；其他单位无常驻三角。 */
export function verifySelfMark(): void {
  assert(BALL_RADIUS === 1, '自身标记：碰撞半径仍应为 1');
  assert(SELF_MARK.gold === 0xffd24a, '自身标记：填充应为亮金');
  assert(SELF_MARK.brown === 0x3a2210, '自身标记：描边应为深棕');
  assert(SELF_MARK.halfWidth * 2 < HP_BAR_LAYOUT.width, '自身标记：底边应窄于血条，不遮条');
  assert(SELF_MARK.height > 0.2, '自身标记：高度应可辨');
  assert(SELF_MARK.bob > 0 && SELF_MARK.bob < SELF_MARK.gap, '自身标记：浮幅应轻微且不压进血条');
  assert(SELF_MARK.period > 1 && SELF_MARK.period < 2, '自身标记：浮动周期应缓慢不闪');
  assert(selfMarkActive(true, true), '自身标记：本人存活应显示');
  assert(!selfMarkActive(true, false), '自身标记：本人死亡应隐藏');
  assert(!selfMarkActive(false, true), '自身标记：队友/敌方即使存活也没有');
  assert(near(selfMarkBob(0), 0), '自身标记：相位 0 浮移应为 0');
  assert(near(selfMarkBob(Math.PI / 2), SELF_MARK.bob), '自身标记：相位 π/2 应为最大上浮');
  assert(selfMarkTipY(SELF_MARK.bob) + SELF_MARK.outline / 2 < HP_BAR_LAYOUT.y, '自身标记：最大下浮仍应在血条上方');

  const mark = new Graphics();
  drawSelfMark(mark, 0);
  const rest = mark.getLocalBounds();
  assert(rest.width > SELF_MARK.halfWidth, '自身标记：倒三角应有宽度');
  assert(rest.width < BALL_RADIUS * 2, '自身标记：倒三角不应再画成脚底大环');
  assert(rest.height > SELF_MARK.height * 0.8, '自身标记：倒三角应有高度');
  assert(rest.y + rest.height < HP_BAR_LAYOUT.y + 1e-4, '自身标记：尖应朝血条且不盖住血条');
  const colors = fillColors(mark);
  assert(colors.includes(SELF_MARK.gold >>> 0), '自身标记：应填充亮金');
  assert(colors.includes(SELF_MARK.brown >>> 0), '自身标记：应有深色描边');

  const teamSwatch = new Graphics();
  drawTeamRing(teamSwatch, createBallBody({ x: 0, y: 0, color: 0xe24a4a, team: 'red' }));
  assert(teamSwatch.getLocalBounds().width > 0, '自身标记：队色描边函数仍用当前红');

  const roster = createMatchRoster({ player: 'hook', ally: 'hook', blue1: 'ring', blue2: 'nail' });
  const player = roster.find((ball) => ball.team === 'red' && ball.teamSlot === 1);
  const ally = roster.find((ball) => ball.team === 'red' && ball.teamSlot === 2);
  const enemy = roster.find((ball) => ball.team === 'blue' && ball.teamSlot === 1);
  if (!player || !ally || !enemy) {
    throw new Error('自身标记：应能拿到红1/红2/蓝1');
  }
  assert(player.hero === ally.hero, '自身标记：同局重复英雄应仍能区分本地控制');
  assert(player.color === 0xe24a4a && enemy.color === 0x3d7cf0, '自身标记：红蓝队色应保持当前');

  const views = roster.map((ball) => createBallView(ball, { selfMark: ball.id === player.id }));
  const playerView = views[roster.indexOf(player)];
  const allyView = views[roster.indexOf(ally)];
  const enemyView = views[roster.indexOf(enemy)];
  assert(markLayer(playerView).visible, '自身标记：开局红1应有倒三角');
  assert(!markLayer(allyView).visible, '自身标记：重复英雄友军不应有倒三角');
  assert(!markLayer(enemyView).visible, '自身标记：敌方不应有倒三角');
  assert(near(markLayer(playerView).rotation, 0), '自身标记：开局倒三角旋转应为 0');

  player.facingX = -1;
  player.facingY = 0.4;
  player.hasAim = true;
  player.aimX = 0.2;
  player.aimY = -1;
  playerView.sync(player, { selfMark: true, runDt: 0 });
  assert(near(markLayer(playerView).rotation, 0), '自身标记：朝向变化倒三角不得旋转');
  const facingBounds = markLayer(playerView).getLocalBounds();
  assert(Math.abs(facingBounds.x + facingBounds.width / 2) < 0.08, '自身标记：倒三角应仍居中在血条上方');

  player.x = 12.5;
  player.y = 9.25;
  playerView.sync(player, { selfMark: true, runDt: 0 });
  assert(near(playerView.root.x, 12.5) && near(playerView.root.y, 9.25), '自身标记：倒三角应随角色/血条平移');

  const y0 = markLayer(playerView).getLocalBounds().y;
  playerView.sync(player, { selfMark: true, runDt: SELF_MARK.period / 4 });
  const y1 = markLayer(playerView).getLocalBounds().y;
  assert(Math.abs(y1 - y0 - SELF_MARK.bob) < 0.04, '自身标记：四分之一周期应轻微上下浮动');
  playerView.sync(player, { selfMark: true, runDt: (SELF_MARK.period * 3) / 4 });
  const y2 = markLayer(playerView).getLocalBounds().y;
  assert(Math.abs(y2 - y0) < 0.04, '自身标记：整周期应回到附近，不得闪烁跳变');

  player.hero = 'mirror';
  playerView.sync(player, { selfMark: player.id === player.id });
  assert(markLayer(playerView).visible, '自身标记：换英雄后仍只标实际玩家');
  assert(player.radius === BALL_RADIUS, '自身标记：换英雄不改碰撞半径');

  playerView.sync(player, { selfMark: false });
  assert(!markLayer(playerView).visible, '自身标记：非本地控制/旁观不应留三角');
  playerView.sync(player, { selfMark: true });
  assert(markLayer(playerView).visible, '自身标记：恢复本地控制后应回来');
  assert(playerView.root.children.filter((child) => child === markLayer(playerView)).length === 1, '自身标记：不得重复叠加标记层');

  player.inPlay = false;
  playerView.sync(player, { selfMark: true });
  assert(!playerView.root.visible, '自身标记：死亡应隐藏整颗含倒三角');
  assert(!markLayer(playerView).visible, '自身标记：死亡后标记层应关掉');

  player.inPlay = true;
  player.hp = player.maxHp;
  playerView.sync(player, { selfMark: true, charging: true });
  assert(playerView.root.visible && markLayer(playerView).visible, '自身标记：复活后倒三角应回来');
  const fx = playerView.root.children[1];
  if (!(fx instanceof Graphics) || fx === markLayer(playerView)) {
    throw new Error('自身标记：冲锋残影应是另一层，不复制倒三角');
  }

  const restartId = player.id;
  playerView.sync(player, { selfMark: player.id === restartId });
  allyView.sync(ally, { selfMark: ally.id === restartId });
  assert(markLayer(playerView).visible, '自身标记：重开后仍标同一玩家 id');
  assert(!markLayer(allyView).visible, '自身标记：重开后队友仍无三角');

  const prevArt = getHookRiderArt();
  try {
    const riderStub = stubTexture();
    setHookRiderArt({ body: riderStub, bodyRed: riderStub, spear: stubTexture() });
    const riderRoster = createMatchRoster({ player: 'arc', ally: 'arc', blue1: 'well', blue2: 'nail' });
    const riderPlayer = riderRoster.find((ball) => ball.team === 'red' && ball.teamSlot === 1);
    const riderAlly = riderRoster.find((ball) => ball.team === 'red' && ball.teamSlot === 2);
    const riderEnemy = riderRoster.find((ball) => ball.team === 'blue' && ball.teamSlot === 1);
    if (!riderPlayer || !riderAlly || !riderEnemy) {
      throw new Error('自身标记：骑装核对应能拿到红1/红2/蓝1');
    }
    const riderViews = riderRoster.map((ball) => createBallView(ball, { selfMark: ball.id === riderPlayer.id }));
    const rp = riderViews[riderRoster.indexOf(riderPlayer)];
    const ra = riderViews[riderRoster.indexOf(riderAlly)];
    const re = riderViews[riderRoster.indexOf(riderEnemy)];
    rp.sync(riderPlayer, { selfMark: true });
    ra.sync(riderAlly, { selfMark: false });
    re.sync(riderEnemy, { selfMark: false });
    assert(markLayer(rp).visible, '自身标记：骑装本人应有金色倒三角');
    assert(!markLayer(ra).visible, '自身标记：骑装友军无常驻三角');
    assert(!markLayer(re).visible, '自身标记：骑装敌方无常驻三角');
    assert(emptyish(bodyGfx(rp)), '自身标记：本人骑装空闲时不再叠队色常驻圈');
    assert(emptyish(bodyGfx(ra)), '自身标记：友军骑装空闲时无常驻圈');
    assert(emptyish(bodyGfx(re)), '自身标记：敌方骑装空闲时无常驻圈');
    assert(fillColors(markLayer(rp)).includes(SELF_MARK.gold >>> 0), '自身标记：骑装本人倒三角应为亮金');

    riderAlly.fieldRemain = 2;
    ra.sync(riderAlly, { selfMark: false });
    assert(!emptyish(bodyGfx(ra)), '自身标记：友军技能/状态圈应保留');
    assert(!markLayer(ra).visible, '自身标记：技能圈不是自身倒三角');
    riderAlly.fieldRemain = 0;
    riderAlly.invincibleRemain = 1.2;
    ra.sync(riderAlly, { selfMark: false });
    assert(!emptyish(bodyGfx(ra)), '自身标记：无敌状态圈应保留');
    riderAlly.invincibleRemain = 0;
    ra.sync(riderAlly, { selfMark: false });
    assert(emptyish(bodyGfx(ra)), '自身标记：状态结束后友军不应残留自身标记');
  } finally {
    setHookRiderArt(prevArt);
  }
}
