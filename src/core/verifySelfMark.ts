import { Graphics } from 'pixi.js';
import { BALL_RADIUS } from './constants';
import { createMatchRoster } from './matchSession';
import {
  createBallView,
  drawSelfMarkRings,
  SELF_MARK,
  selfMarkActive,
} from '../render/ballView';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function markLayer(view: ReturnType<typeof createBallView>): Graphics {
  const child = view.root.children[0];
  if (!(child instanceof Graphics)) {
    throw new Error('自身标记：双环应是最底层 Graphics');
  }
  return child;
}

/** 本地玩家脚下奶黄双环：只本人、死亡隐藏、不进残影、不改碰撞。 */
export function verifySelfMark(): void {
  assert(BALL_RADIUS === 1, '自身标记：碰撞半径仍应为 1');
  assert(Math.abs(SELF_MARK.outerRadius / BALL_RADIUS - 1.3) < 1e-9, '自身标记：外环应为盾径 1.3 倍');
  assert(SELF_MARK.innerRadius > BALL_RADIUS, '自身标记：内环应略大于主体');
  assert(SELF_MARK.innerRadius < SELF_MARK.outerRadius, '自身标记：应为内外双环');
  assert(SELF_MARK.milk === 0xf6e7a3, '自身标记：环色应为奶黄');
  assert(SELF_MARK.brown === 0x3a2210, '自身标记：描边应为深棕');
  assert(SELF_MARK.outline < SELF_MARK.band, '自身标记：棕描边应细于奶黄环');
  assert(selfMarkActive(true, true), '自身标记：本人存活应显示');
  assert(!selfMarkActive(true, false), '自身标记：本人死亡应隐藏');
  assert(!selfMarkActive(false, true), '自身标记：队友/敌方即使存活也没有');

  const rings = new Graphics();
  drawSelfMarkRings(rings);
  const ringBounds = rings.getLocalBounds();
  assert(ringBounds.width > BALL_RADIUS * 2, '自身标记：双环绘制后应宽于主体直径');
  assert(ringBounds.width < BALL_RADIUS * 2 * 1.55, '自身标记：双环不应过大挡住枪尖');

  const roster = createMatchRoster({ player: 'hook', ally: 'chain', blue1: 'ring', blue2: 'nail' });
  const player = roster.find((ball) => ball.team === 'red' && ball.teamSlot === 1);
  const ally = roster.find((ball) => ball.team === 'red' && ball.teamSlot === 2);
  const enemy = roster.find((ball) => ball.team === 'blue' && ball.teamSlot === 1);
  if (!player || !ally || !enemy) {
    throw new Error('自身标记：应能拿到红1/红2/蓝1');
  }
  const views = roster.map((ball) => createBallView(ball, { selfMark: ball.id === player.id }));
  const playerView = views[roster.indexOf(player)];
  const allyView = views[roster.indexOf(ally)];
  const enemyView = views[roster.indexOf(enemy)];
  assert(markLayer(playerView).visible, '自身标记：开局红1应有双环');
  assert(!markLayer(allyView).visible, '自身标记：队友不应有双环');
  assert(!markLayer(enemyView).visible, '自身标记：敌方不应有双环');

  player.hero = 'mirror';
  playerView.sync(player, { selfMark: player.id === player.id });
  assert(markLayer(playerView).visible, '自身标记：换英雄后仍只标实际玩家');
  assert(player.radius === BALL_RADIUS, '自身标记：换英雄不改碰撞半径');

  player.inPlay = false;
  playerView.sync(player, { selfMark: true });
  assert(!playerView.root.visible, '自身标记：死亡应隐藏整颗含双环');
  assert(!markLayer(playerView).visible, '自身标记：死亡后双环层应关掉');

  player.inPlay = true;
  player.hp = player.maxHp;
  playerView.sync(player, { selfMark: true, charging: true });
  assert(playerView.root.visible && markLayer(playerView).visible, '自身标记：复活后双环应回来');
  const fx = playerView.root.children[1];
  if (!(fx instanceof Graphics) || fx === markLayer(playerView)) {
    throw new Error('自身标记：冲锋残影应是另一层，不复制双环');
  }

  const restartId = player.id;
  playerView.sync(player, { selfMark: player.id === restartId });
  allyView.sync(ally, { selfMark: ally.id === restartId });
  assert(markLayer(playerView).visible, '自身标记：重开后仍标同一玩家 id');
  assert(!markLayer(allyView).visible, '自身标记：重开后队友仍无环');
}
