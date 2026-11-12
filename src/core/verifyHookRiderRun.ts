import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { SPEAR_TIP_DIST } from './constants';
import { spearTipPos } from './collisionDamage';
import { createMatchRoster } from './matchSession';
import { createBallView } from '../render/ballView';
import { getHookRiderArt, hookRiderArtUrl, hookRiderRotation, setHookRiderArt } from '../render/hookRiderArt';
import { createHookRiderRunState, hookRiderRunIdentity, stepHookRiderGait } from '../render/hookRiderRun';
import {
  getHookRiderRunArt,
  HOOK_RIDER_RUN_BODY_BYTES,
  HOOK_RIDER_RUN_BODY_RED_BYTES,
  HOOK_RIDER_RUN_BYTES,
  HOOK_RIDER_RUN_FILES,
  HOOK_RIDER_RUN_FL_BYTES,
  HOOK_RIDER_RUN_FR_BYTES,
  HOOK_RIDER_RUN_HL_BYTES,
  HOOK_RIDER_RUN_HR_BYTES,
  HOOK_RIDER_RUN_LAYER_COUNT,
  HOOK_RIDER_RUN_RIDER_BYTES,
  HOOK_RIDER_RUN_RIDER_RED_BYTES,
  HOOK_RIDER_RUN_TAIL_BYTES,
  setHookRiderRunArt,
} from '../render/hookRiderRunArt';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

function spritesOf(view: ReturnType<typeof createBallView>): Sprite[] {
  return view.root.children.filter((child): child is Sprite => child instanceof Sprite);
}

function runRootOf(view: ReturnType<typeof createBallView>): Container {
  const found = view.root.children.find(
    (child) => child instanceof Container && !(child instanceof Graphics) && !(child instanceof Sprite),
  );
  if (!(found instanceof Container)) {
    throw new Error('四蹄：应有分层 Container');
  }
  return found;
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

function poseIdle(pose: ReturnType<typeof hookRiderRunIdentity>): boolean {
  return (
    pose.amp === 0 &&
    pose.bodyY === 0 &&
    pose.riderY === 0 &&
    pose.riderRot === 0 &&
    pose.tailRot === 0 &&
    pose.fl.dx === 0 &&
    pose.fl.dy === 0 &&
    pose.fr.dx === 0 &&
    pose.hl.dy === 0 &&
    pose.hr.dy === 0
  );
}

/** 分层四蹄：7 层显示、速度错相、枪尖/root 误差 0；不改碰撞。 */
export function verifyHookRiderRun(): void {
  const prev = getHookRiderArt();
  const prevRun = getHookRiderRunArt();
  try {
    assert(HOOK_RIDER_RUN_LAYER_COUNT === 7, '四蹄：绘制层应为 7');
    assert(HOOK_RIDER_RUN_FILES.body === 'hookRunBody.webp', '四蹄：身躯文件名');
    assert(HOOK_RIDER_RUN_FILES.bodyRed === 'hookRunBodyRed.webp', '四蹄：红身躯文件名');
    assert(HOOK_RIDER_RUN_FILES.rider === 'hookRunRider.webp', '四蹄：骑手文件名');
    assert(HOOK_RIDER_RUN_FILES.riderRed === 'hookRunRiderRed.webp', '四蹄：红骑手文件名');
    assert(HOOK_RIDER_RUN_FILES.tail === 'hookRunTail.webp', '四蹄：尾文件名');
    assert(HOOK_RIDER_RUN_FILES.fl === 'hookRunLegFl.webp', '四蹄：前左文件名');
    assert(HOOK_RIDER_RUN_FILES.fr === 'hookRunLegFr.webp', '四蹄：前右文件名');
    assert(HOOK_RIDER_RUN_FILES.hl === 'hookRunLegHl.webp', '四蹄：后左文件名');
    assert(HOOK_RIDER_RUN_FILES.hr === 'hookRunLegHr.webp', '四蹄：后右文件名');
    assert(HOOK_RIDER_RUN_BODY_BYTES === 15384, '四蹄：身躯字节');
    assert(HOOK_RIDER_RUN_BODY_RED_BYTES === 15564, '四蹄：红身躯字节');
    assert(HOOK_RIDER_RUN_RIDER_BYTES === 8424, '四蹄：骑手字节');
    assert(HOOK_RIDER_RUN_RIDER_RED_BYTES === 8398, '四蹄：红骑手字节');
    assert(HOOK_RIDER_RUN_TAIL_BYTES === 1814, '四蹄：尾字节');
    assert(HOOK_RIDER_RUN_FL_BYTES === 1016, '四蹄：前左字节');
    assert(HOOK_RIDER_RUN_FR_BYTES === 1258, '四蹄：前右字节');
    assert(HOOK_RIDER_RUN_HL_BYTES === 1020, '四蹄：后左字节');
    assert(HOOK_RIDER_RUN_HR_BYTES === 1238, '四蹄：后右字节');
    assert(HOOK_RIDER_RUN_BYTES === 54116, '四蹄：分层合计 54116');
    assert(hookRiderArtUrl(HOOK_RIDER_RUN_FILES.body).includes('/rider/hookRunBody.webp'), '四蹄：身躯 URL');
    assert(hookRiderArtUrl(HOOK_RIDER_RUN_FILES.hr).includes('/rider/hookRunLegHr.webp'), '四蹄：后右 URL');

    const rest = createHookRiderRunState();
    const idle = stepHookRiderGait(rest, { vx: 0, vy: 0, facingX: 0, facingY: -1, dt: 1 });
    assert(poseIdle(idle), '四蹄：静止应收步到 identity');

    const run = createHookRiderRunState();
    let gait = hookRiderRunIdentity();
    for (let i = 0; i < 24; i += 1) {
      gait = stepHookRiderGait(run, { vx: 0, vy: -8, facingX: 0, facingY: -1, dt: 0.05 });
    }
    assert(gait.amp > 0.35, '四蹄：高速应有步态幅度');
    assert(Math.abs(gait.hl.dy) + Math.abs(gait.hr.dy) + Math.abs(gait.fl.dy) + Math.abs(gait.fr.dy) > 0.02, '四蹄：高速四蹄应错相位移');
    assert(Math.abs(gait.bodyY) > 0, '四蹄：高速应有身体起伏');
    assert(Math.abs(gait.riderY) + Math.abs(gait.riderRot) > 0, '四蹄：骑手应随动');
    assert(Math.abs(gait.tailRot) > 0, '四蹄：尾应摆动');

    const side = createHookRiderRunState();
    const sidePose = stepHookRiderGait(side, { vx: 8, vy: 0, facingX: 0, facingY: -1, dt: 0.2 });
    assert(near(sidePose.sideFade, 0.3, 1e-4), '四蹄：侧滑应弱化幅度且不改朝向输入');
    assert(!sidePose.reverse, '四蹄：纯侧滑不应判后滑');

    const back = createHookRiderRunState();
    stepHookRiderGait(back, { vx: 0, vy: 8, facingX: 0, facingY: -1, dt: 0.2 });
    const backPose = stepHookRiderGait(back, { vx: 0, vy: 8, facingX: 0, facingY: -1, dt: 0.2 });
    assert(backPose.reverse, '四蹄：后滑应反相');

    const blueBody = stubTexture();
    const redBody = stubTexture();
    const spearTex = stubTexture();
    const runBlue = stubTexture();
    const runRed = stubTexture();
    const runRider = stubTexture();
    const runRiderRed = stubTexture();
    const runTail = stubTexture();
    const runFl = stubTexture();
    const runFr = stubTexture();
    const runHl = stubTexture();
    const runHr = stubTexture();
    setHookRiderArt({ body: blueBody, bodyRed: redBody, spear: spearTex });
    setHookRiderRunArt({
      body: runBlue,
      bodyRed: runRed,
      rider: runRider,
      riderRed: runRiderRed,
      tail: runTail,
      fl: runFl,
      fr: runFr,
      hl: runHl,
      hr: runHr,
    });

    const roster = createMatchRoster({ player: 'hook', ally: 'chain', blue1: 'ring', blue2: 'nail' });
    const hookBall = roster.find((ball) => ball.hero === 'hook');
    const chainBall = roster.find((ball) => ball.hero === 'chain');
    const red1 = roster.find((ball) => ball.team === 'red' && ball.teamSlot === 1);
    const blue1 = roster.find((ball) => ball.team === 'blue' && ball.teamSlot === 1);
    if (!hookBall || !chainBall || !red1 || !blue1) {
      throw new Error('四蹄：应能拿到钩刺与红蓝样本');
    }

    hookBall.x = 4;
    hookBall.y = 7;
    hookBall.vx = 0;
    hookBall.vy = -8;
    hookBall.hasAim = true;
    hookBall.aimX = 0;
    hookBall.aimY = -1;
    hookBall.facingX = 0;
    hookBall.facingY = -1;
    const hookView = createBallView(hookBall);
    const runRoot = runRootOf(hookView);
    assert(runRoot.children.length === HOOK_RIDER_RUN_LAYER_COUNT, '四蹄：Container 内应为 7 层');
    const hookSprites = spritesOf(hookView);
    assert(hookSprites.length === 2, '四蹄：root 直系仍为人马整图+枪头两张 Sprite');
    hookView.sync(hookBall, { runDt: 0.05 });
    assert(!hookSprites[0].visible, '四蹄：开跑时应隐藏静态整图');
    assert(hookSprites[1].visible, '四蹄：枪头应保持可见');
    assert(runRoot.visible, '四蹄：分层根应可见');
    assert(near(runRoot.rotation, hookRiderRotation(0, -1)), '四蹄：朝上旋转应为 0');
    const hit = spearTipPos(hookBall);
    assert(near(hookSprites[1].position.x, hit.x - hookBall.x), '四蹄：枪尖 x 应对齐命中点');
    assert(near(hookSprites[1].position.y, hit.y - hookBall.y), '四蹄：枪尖 y 应对齐命中点');
    assert(near(hookView.root.x, hookBall.x) && near(hookView.root.y, hookBall.y), '四蹄：root 不随腿动');
    assert(near(SPEAR_TIP_DIST, 2.24), '四蹄：枪尖距仍 2.24');

    hookBall.vx = 8;
    hookBall.vy = 0;
    hookView.sync(hookBall, { runDt: 0.05 });
    assert(near(runRoot.rotation, hookRiderRotation(0, -1)), '四蹄：侧滑马头仍跟瞄准不追速度');
    const sideHit = spearTipPos(hookBall);
    assert(near(hookSprites[1].position.x, sideHit.x - hookBall.x), '四蹄：侧滑枪尖 x 仍 0 误差');
    assert(near(hookSprites[1].position.y, sideHit.y - hookBall.y), '四蹄：侧滑枪尖 y 仍 0 误差');

    hookBall.vx = 0;
    hookBall.vy = 8;
    hookView.sync(hookBall, { runDt: 0.05 });
    assert(near(runRoot.rotation, hookRiderRotation(0, -1)), '四蹄：后滑马头仍跟瞄准');

    const dirs = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];
    for (const dir of dirs) {
      hookBall.aimX = dir.x;
      hookBall.aimY = dir.y;
      hookBall.facingX = dir.x;
      hookBall.facingY = dir.y;
      hookBall.vx = dir.x * 6;
      hookBall.vy = dir.y * 6;
      hookView.sync(hookBall, { runDt: 0.016 });
      const tip = spearTipPos(hookBall);
      assert(near(hookSprites[1].position.x, tip.x - hookBall.x), `四蹄：${dir.x},${dir.y} 枪尖 x`);
      assert(near(hookSprites[1].position.y, tip.y - hookBall.y), `四蹄：${dir.x},${dir.y} 枪尖 y`);
      assert(near(hookView.root.x, hookBall.x) && near(hookView.root.y, hookBall.y), `四蹄：${dir.x},${dir.y} root`);
    }

    const redView = createBallView(red1);
    redView.sync(red1, { runDt: 0 });
    const redRun = runRootOf(redView);
    const redBodySpr = redRun.children.find((child) => child instanceof Sprite && child.texture === runRed);
    const redRiderSpr = redRun.children.find((child) => child instanceof Sprite && child.texture === runRiderRed);
    assert(!!redBodySpr, '四蹄：红方分层身躯应换红甲盾');
    assert(!!redRiderSpr, '四蹄：红方骑手应换红甲');

    const blueView = createBallView(blue1);
    blueView.sync(blue1, { runDt: 0 });
    const blueRun = runRootOf(blueView);
    const blueBodySpr = blueRun.children.find((child) => child instanceof Sprite && child.texture === runBlue);
    assert(!!blueBodySpr, '四蹄：蓝方分层身躯应保持原图');

    chainBall.facingX = -1;
    chainBall.facingY = 0;
    chainBall.hasAim = false;
    const chainView = createBallView(chainBall);
    chainView.sync(chainBall, { runDt: 0.02, selfMark: true });
    assert(runRootOf(chainView).children.length === 7, '四蹄：其他英雄同样 7 层');
    assert(chainView.root.children[0] instanceof Graphics, '四蹄：自身标记仍在 children[0]');
    assert(chainView.root.children[1] instanceof Graphics, '四蹄：残影仍在 children[1]');

    hookBall.inPlay = false;
    hookView.sync(hookBall, { runDt: 0.016 });
    assert(!hookView.root.visible, '四蹄：死亡隐藏整颗');
    assert(!runRoot.visible, '四蹄：死亡隐藏分层，不残影');

    hookBall.inPlay = true;
    hookView.sync(hookBall, { runDt: 0.016 });
    assert(hookView.root.visible, '四蹄：复活后应可见');
    assert(runRoot.visible, '四蹄：复活后分层应回来');
    assert(hookSprites[1].visible, '四蹄：复活后枪头不丢图');

    hookView.sync(hookBall, { showRun: false, runDt: 0 });
    assert(hookSprites[0].visible, '四蹄：显式关闭时应回退整图');
    assert(!runRoot.visible, '四蹄：显式关闭时应隐藏分层');
  } finally {
    setHookRiderArt(prev);
    setHookRiderRunArt(prevRun);
  }
}
