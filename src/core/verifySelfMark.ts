import { Graphics, Texture } from 'pixi.js';
import { createBallBody } from './ballBody';
import { BALL_RADIUS } from './constants';
import { createMatchRoster } from './matchSession';
import {
  createBallView,
  drawSelfMarkRings,
  drawTeamRing,
  SELF_MARK,
  selfMarkActive,
} from '../render/ballView';
import { getHookRiderArt, setHookRiderArt } from '../render/hookRiderArt';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function markLayer(view: ReturnType<typeof createBallView>): Graphics {
  const child = view.root.children[0];
  if (!(child instanceof Graphics)) {
    throw new Error('自身标记：身份圈应是最底层 Graphics');
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

/** 本地玩家脚下单层奶黄身份圈：只本人、死亡隐藏、不进残影、不改碰撞；其他单位无常驻身份圈。 */
export function verifySelfMark(): void {
  assert(BALL_RADIUS === 1, '自身标记：碰撞半径仍应为 1');
  assert(Math.abs(SELF_MARK.outerRadius / BALL_RADIUS - 1.3) < 1e-9, '自身标记：单层半径应为盾径 1.3 倍');
  assert(SELF_MARK.innerRadius > BALL_RADIUS, '自身标记：旧内环常量保留但不绘制');
  assert(SELF_MARK.innerRadius < SELF_MARK.outerRadius, '自身标记：旧内环应小于现单层');
  assert(SELF_MARK.milk === 0xf6e7a3, '自身标记：环色应为奶黄');
  assert(SELF_MARK.brown === 0x3a2210, '自身标记：描边应为深棕');
  assert(SELF_MARK.outline < SELF_MARK.band, '自身标记：棕描边应细于奶黄环');
  assert(selfMarkActive(true, true), '自身标记：本人存活应显示');
  assert(!selfMarkActive(true, false), '自身标记：本人死亡应隐藏');
  assert(!selfMarkActive(false, true), '自身标记：队友/敌方即使存活也没有');

  const rings = new Graphics();
  drawSelfMarkRings(rings);
  const ringBounds = rings.getLocalBounds();
  assert(ringBounds.width > BALL_RADIUS * 2, '自身标记：单层绘制后应宽于主体直径');
  assert(ringBounds.width < BALL_RADIUS * 2 * 1.55, '自身标记：单层不应过大挡住枪尖');

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
  assert(markLayer(playerView).visible, '自身标记：开局红1应有身份圈');
  assert(!markLayer(allyView).visible, '自身标记：重复英雄友军不应有身份圈');
  assert(!markLayer(enemyView).visible, '自身标记：敌方不应有身份圈');

  player.hero = 'mirror';
  playerView.sync(player, { selfMark: player.id === player.id });
  assert(markLayer(playerView).visible, '自身标记：换英雄后仍只标实际玩家');
  assert(player.radius === BALL_RADIUS, '自身标记：换英雄不改碰撞半径');

  playerView.sync(player, { selfMark: false });
  assert(!markLayer(playerView).visible, '自身标记：非本地控制/旁观不应留圈');
  playerView.sync(player, { selfMark: true });
  assert(markLayer(playerView).visible, '自身标记：恢复本地控制后应回来');

  player.inPlay = false;
  playerView.sync(player, { selfMark: true });
  assert(!playerView.root.visible, '自身标记：死亡应隐藏整颗含身份圈');
  assert(!markLayer(playerView).visible, '自身标记：死亡后身份圈层应关掉');

  player.inPlay = true;
  player.hp = player.maxHp;
  playerView.sync(player, { selfMark: true, charging: true });
  assert(playerView.root.visible && markLayer(playerView).visible, '自身标记：复活后身份圈应回来');
  const fx = playerView.root.children[1];
  if (!(fx instanceof Graphics) || fx === markLayer(playerView)) {
    throw new Error('自身标记：冲锋残影应是另一层，不复制身份圈');
  }

  const restartId = player.id;
  playerView.sync(player, { selfMark: player.id === restartId });
  allyView.sync(ally, { selfMark: ally.id === restartId });
  assert(markLayer(playerView).visible, '自身标记：重开后仍标同一玩家 id');
  assert(!markLayer(allyView).visible, '自身标记：重开后队友仍无环');

  const prevArt = getHookRiderArt();
  try {
    setHookRiderArt({ body: stubTexture(), spear: stubTexture() });
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
    assert(markLayer(rp).visible, '自身标记：骑装本人应有单层身份圈');
    assert(!markLayer(ra).visible, '自身标记：骑装友军无常驻身份圈');
    assert(!markLayer(re).visible, '自身标记：骑装敌方无常驻身份圈');
    assert(emptyish(bodyGfx(rp)), '自身标记：本人骑装空闲时不再叠队色常驻圈');
    assert(emptyish(bodyGfx(ra)), '自身标记：友军骑装空闲时无常驻圈');
    assert(emptyish(bodyGfx(re)), '自身标记：敌方骑装空闲时无常驻圈');

    riderAlly.fieldRemain = 2;
    ra.sync(riderAlly, { selfMark: false });
    assert(!emptyish(bodyGfx(ra)), '自身标记：友军技能/状态圈应保留');
    assert(!markLayer(ra).visible, '自身标记：技能圈不是身份圈');
    riderAlly.fieldRemain = 0;
    riderAlly.invincibleRemain = 1.2;
    ra.sync(riderAlly, { selfMark: false });
    assert(!emptyish(bodyGfx(ra)), '自身标记：无敌状态圈应保留');
    riderAlly.invincibleRemain = 0;
    ra.sync(riderAlly, { selfMark: false });
    assert(emptyish(bodyGfx(ra)), '自身标记：状态结束后友军不应残留身份圈');
  } finally {
    setHookRiderArt(prevArt);
  }
}
