import { Graphics } from 'pixi.js';
import { createBallBody } from './ballBody';
import { BALL_RADIUS, FLOOR_SPEED, FRICTION, REST_SPEED, SPEED_CAP } from './constants';
import { stepPhysics } from './physicsStep';
import {
  createHoofDustView,
  HOOF_DUST,
  hoofDustAlignFactor,
  hoofDustAlong,
  hoofDustBelowChrome,
  hoofDustDragDir,
  hoofDustEmitOrigins,
  hoofDustHeading,
  hoofDustIntensity,
  hoofDustPuffSize,
  hoofDustSpeedFactor,
} from '../render/hoofDust';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 1e-5): boolean {
  return Math.abs(a - b) < eps;
}

function sample(vx: number, vy: number, fx: number, fy: number) {
  return { vx, vy, facingX: fx, facingY: fy };
}

function body(init: { x: number; y: number; facingX: number; facingY: number; team: 'red' | 'blue' }) {
  return createBallBody({
    x: init.x,
    y: init.y,
    facingX: init.facingX,
    facingY: init.facingY,
    team: init.team,
    color: init.team === 'red' ? 0xe24a4a : 0x3d7cf0,
  });
}

function countLive(view: ReturnType<typeof createHoofDustView>): number {
  return view.liveCount();
}

function fillCount(g: Graphics): number {
  let n = 0;
  for (const inst of g.context.instructions) {
    if (inst.action === 'fill') {
      n += 1;
    }
  }
  return n;
}

function bounds(g: Graphics): { x: number; y: number; w: number; h: number } {
  const b = g.getLocalBounds();
  return { x: b.x, y: b.y, w: b.width, h: b.height };
}

/** 后蹄贴地扬尘：同向少/侧滑中/反向多，低速减弱，位移反向拖散；不改物理。 */
export function verifyHoofDust(): void {
  assert(BALL_RADIUS === 1, '扬尘：碰撞半径不得被扬尘改掉');
  assert(FRICTION > 1.4 && FRICTION < 1.6, '扬尘：摩擦常数不得被扬尘改掉');
  assert(FLOOR_SPEED === 2.5 && SPEED_CAP === 8, '扬尘：速度帽/保底速不得被扬尘改掉');
  assert(HOOF_DUST.same < HOOF_DUST.side && HOOF_DUST.side < HOOF_DUST.reverse, '扬尘：同向<侧滑<反向');
  assert(HOOF_DUST.maxAlpha < 0.4, '扬尘：透明度应限制，避免遮血条/三角/技能圈');
  assert(HOOF_DUST.cap >= 48 && HOOF_DUST.cap <= 96, '扬尘：粒子应有上限');
  assert(HOOF_DUST.rest === REST_SPEED, '扬尘：近静止门槛应跟 REST_SPEED，避免只看角度');

  const fwd = sample(8, 0, 1, 0);
  const side = sample(8, 0, 0, -1);
  const back = sample(-8, 0, 1, 0);
  assert(near(hoofDustAlong(fwd), 1, 1e-4), '扬尘：同向点积应为 1');
  assert(near(hoofDustAlong(side), 0, 1e-4), '扬尘：侧滑点积应为 0');
  assert(near(hoofDustAlong(back), -1, 1e-4), '扬尘：反向点积应为 -1');
  const iFwd = hoofDustIntensity(fwd);
  const iSide = hoofDustIntensity(side);
  const iBack = hoofDustIntensity(back);
  assert(iFwd > 0.05, '扬尘：同向高速仍应有少量尘');
  assert(iFwd < iSide && iSide < iBack, '扬尘：同等速度同向<侧滑<反向');
  assert(hoofDustPuffSize(iFwd) < hoofDustPuffSize(iSide), '扬尘：同向尘团应小于侧滑');
  assert(hoofDustPuffSize(iSide) < hoofDustPuffSize(iBack), '扬尘：侧滑尘团应小于反向');
  assert(near(hoofDustAlignFactor(1), HOOF_DUST.same), '扬尘：同向对齐系数');
  assert(near(hoofDustAlignFactor(0), HOOF_DUST.side), '扬尘：侧滑对齐系数');
  assert(near(hoofDustAlignFactor(-1), HOOF_DUST.reverse), '扬尘：反向对齐系数');

  assert(hoofDustSpeedFactor(0) === 0, '扬尘：静止速度因子为 0');
  assert(hoofDustIntensity(sample(0, 0, 1, 0)) === 0, '扬尘：静止即使朝向任意也无尘');
  assert(hoofDustIntensity(sample(0, 0, -1, 0)) === 0, '扬尘：静止反向朝向也无尘，不得只看角度');
  assert(hoofDustIntensity(sample(REST_SPEED, 0, -1, 0)) === 0, '扬尘：近静止无尘');
  const slowBack = hoofDustIntensity(sample(-1.2, 0, 1, 0));
  const fastBack = hoofDustIntensity(sample(-8, 0, 1, 0));
  assert(slowBack > 0 && slowBack < fastBack, '扬尘：低速反向应弱于高速反向');
  assert(hoofDustPuffSize(slowBack) < hoofDustPuffSize(fastBack), '扬尘：低速尘团应更小');

  const dragSide = hoofDustDragDir(8, 0);
  assert(near(dragSide.x, -1) && near(dragSide.y, 0), '扬尘：拖散应沿实际位移反向，不是马头反向');
  const head = hoofDustHeading(side);
  assert(near(head.x, 0) && near(head.y, -1), '扬尘：侧滑时马头仍朝瞄准');
  assert(Math.abs(dragSide.x - -head.x) > 0.5, '扬尘：侧滑拖散不得等于朝向反向');

  const rider = body({ x: 10, y: 8, facingX: 1, facingY: 0, team: 'red' });
  const [hl, hr] = hoofDustEmitOrigins(rider);
  assert(hl.x < rider.x && hr.x < rider.x, '扬尘：后蹄应在马头后方');
  assert(hoofDustBelowChrome(rider.y, hl.y) && hoofDustBelowChrome(rider.y, hr.y), '扬尘：后蹄应低于血条/三角带');
  const aimed = body({ x: 10, y: 8, facingX: 1, facingY: 0, team: 'blue' });
  aimed.hasAim = true;
  aimed.aimX = 0;
  aimed.aimY = 1;
  const [aimHl] = hoofDustEmitOrigins(aimed);
  assert(aimHl.y < aimed.y, '扬尘：瞄准朝下时后蹄应在上方（位移反方向的蹄侧）');

  const view = createHoofDustView();
  assert(view.root.children[0] instanceof Graphics, '扬尘：应有程序绘制层');
  const gfx = view.root.children[0] as Graphics;

  const still = body({ x: 6, y: 6, facingX: 1, facingY: 0, team: 'red' });
  still.vx = 0;
  still.vy = 0;
  for (let i = 0; i < 12; i += 1) {
    view.sync([still], 0.05);
  }
  assert(countLive(view) === 0, '扬尘：静止不应产尘');
  assert(fillCount(gfx) === 0, '扬尘：静止不应留下填充');

  const runFwd = body({ x: 6, y: 6, facingX: 1, facingY: 0, team: 'red' });
  runFwd.vx = 8;
  runFwd.vy = 0;
  const runSide = body({ x: 8, y: 6, facingX: 0, facingY: -1, team: 'red' });
  runSide.vx = 8;
  runSide.vy = 0;
  const runBack = body({ x: 10, y: 6, facingX: 1, facingY: 0, team: 'red' });
  runBack.vx = -8;
  runBack.vy = 0;

  view.clear();
  for (let i = 0; i < 8; i += 1) {
    view.sync([runFwd], 0.05);
  }
  const nFwd = countLive(view);
  const bFwd = bounds(gfx);
  view.clear();
  for (let i = 0; i < 8; i += 1) {
    view.sync([runSide], 0.05);
  }
  const nSide = countLive(view);
  const bSide = bounds(gfx);
  view.clear();
  for (let i = 0; i < 8; i += 1) {
    view.sync([runBack], 0.05);
  }
  const nBack = countLive(view);
  const bBack = bounds(gfx);
  assert(nFwd > 0 && nFwd < nSide && nSide < nBack, `扬尘：同等速度尘量应递增 ${nFwd}/${nSide}/${nBack}`);
  assert(bFwd.w * bFwd.h > 0 && bFwd.w * bFwd.h < bSide.w * bSide.h, '扬尘：同向尘团铺开应小于侧滑');
  assert(bSide.w * bSide.h < bBack.w * bBack.h, '扬尘：侧滑尘团铺开应小于反向');

  view.clear();
  runBack.x = 12;
  runBack.y = 10;
  runBack.vx = -8;
  runBack.vy = 0;
  const originX = hoofDustEmitOrigins(runBack).reduce((s, p) => s + p.x, 0) / 2;
  for (let i = 0; i < 10; i += 1) {
    view.sync([runBack], 0.04);
  }
  const dragged = bounds(gfx);
  assert(dragged.x + dragged.w / 2 > originX + 0.02, '扬尘：向左滑时应向右（位移反向）拖散，不得只朝马头反向');
  assert(hoofDustBelowChrome(runBack.y, dragged.y), '扬尘：尘团不应盖到血条/三角高度');

  const pin = body({ x: 4, y: 4, facingX: 1, facingY: 0, team: 'blue' });
  pin.vx = 8;
  pin.vy = 0;
  const vx0 = pin.vx;
  const fy0 = pin.facingY;
  view.sync([pin], 0.05);
  const beforePhys = { vx: pin.vx, vy: pin.vy, x: pin.x, y: pin.y };
  stepPhysics([pin], 1 / 60);
  assert(pin.vx !== vx0 || pin.x !== beforePhys.x, '扬尘：对照物理仍应自行滑动');
  pin.vx = beforePhys.vx;
  pin.vy = beforePhys.vy;
  pin.x = beforePhys.x;
  pin.y = beforePhys.y;
  view.sync([pin], 0.05);
  assert(pin.vx === beforePhys.vx && pin.vy === beforePhys.vy, '扬尘：同步不得改速度');
  assert(pin.x === beforePhys.x && pin.y === beforePhys.y, '扬尘：同步不得改位置');
  assert(pin.facingY === fy0, '扬尘：同步不得改朝向');

  view.clear();
  const dead = body({ x: 5, y: 5, facingX: 1, facingY: 0, team: 'red' });
  dead.vx = -8;
  dead.vy = 0;
  view.sync([dead], 0.08);
  assert(countLive(view) > 0, '扬尘：存活高速反向应有尘');
  dead.inPlay = false;
  view.sync([dead], 0.08);
  assert(countLive(view) === 0, '扬尘：倒地应停止并清掉该单位尘');
  dead.inPlay = true;
  dead.vx = 0;
  dead.vy = 0;
  view.sync([dead], 0.08);
  assert(countLive(view) === 0, '扬尘：回场静止不应残留长尾');

  view.clear();
  const jumper = body({ x: 2, y: 2, facingX: 1, facingY: 0, team: 'red' });
  jumper.vx = -8;
  jumper.vy = 0;
  for (let i = 0; i < 6; i += 1) {
    view.sync([jumper], 0.05);
  }
  assert(countLive(view) > 0, '扬尘：瞬移前应有尘');
  jumper.x = 16;
  jumper.y = 16;
  view.sync([jumper], 0.016);
  assert(countLive(view) === 0, '扬尘：瞬移/重开/回场大位移应清长尾');

  view.clear();
  const crowd = [0, 1, 2, 3].map((i) => {
    const ball = body({ x: 3 + i, y: 8, facingX: 1, facingY: 0, team: i < 2 ? 'red' : 'blue' });
    ball.vx = -8;
    ball.vy = 0;
    return ball;
  });
  for (let i = 0; i < 40; i += 1) {
    view.sync(crowd, 0.05);
    assert(countLive(view) <= HOOF_DUST.cap, '扬尘：粒子数不得超过上限');
  }
  assert(countLive(view) > 8, '扬尘：满速反向应能复用到可见量');
  view.clear();
  assert(countLive(view) === 0, '扬尘：clear 应清空生命周期');
  assert(fillCount(gfx) === 0, '扬尘：clear 后不得留绘制');
}
