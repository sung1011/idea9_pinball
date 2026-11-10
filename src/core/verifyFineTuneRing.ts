import { Graphics, Texture } from 'pixi.js';
import {
  openFineTune,
  tickFineTune,
  createBallBody,
  type BallBody,
} from './ballBody';
import {
  BALL_RADIUS,
  FINE_TUNE_WINDOW,
  LEFT_PILLAR,
  MAP_HEIGHT,
  MAP_WIDTH,
  PILLAR_HEIGHT,
  SPEAR_TIP_DIST,
  STRONG_STEER_RAD_PER_SEC,
  WEAK_STEER_RAD_PER_SEC,
} from './constants';
import { stepPhysics } from './physicsStep';
import { placeStake, resetStakes } from './ropeStakes';
import { placeMirrorWall, resetMirrorWalls } from './mirrorWalls';
import { resetTrapZones } from './trapZones';
import { redBaselineStall } from './stallFences';
import { arenaPillarsEnabled, setArenaPillarsEnabled } from './wallBounce';
import { steerRateRad } from './skillStub';
import { createBallView, FINE_TUNE_RING, SELF_MARK } from '../render/ballView';
import { getHookRiderArt, setHookRiderArt } from '../render/hookRiderArt';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) < eps;
}

function bodyGfx(view: ReturnType<typeof createBallView>): Graphics {
  const graphics = view.root.children.filter((child): child is Graphics => child instanceof Graphics);
  const body = graphics[2];
  if (!body) {
    throw new Error('微调圈：应能拿到主体 Graphics');
  }
  return body;
}

function markLayer(view: ReturnType<typeof createBallView>): Graphics {
  const child = view.root.children[0];
  if (!(child instanceof Graphics)) {
    throw new Error('微调圈：身份圈应是最底层 Graphics');
  }
  return child;
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

function strokeColors(g: Graphics): number[] {
  const colors: number[] = [];
  for (const inst of g.context.instructions) {
    if (inst.action !== 'stroke' && inst.action !== 'fill') {
      continue;
    }
    const n = asColorNum(inst.data.style.color);
    if (n !== null) {
      colors.push(n);
    }
  }
  return colors;
}

function hasColor(g: Graphics, color: number): boolean {
  const want = color >>> 0;
  return strokeColors(g).some((item) => item === want);
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

function sample(partial: Partial<BallBody> & Pick<BallBody, 'x' | 'y' | 'color'>): BallBody {
  return createBallBody(partial);
}

function assertOpened(label: string, balls: BallBody[], extras?: Parameters<typeof stepPhysics>[2]): void {
  for (const ball of balls) {
    ball.fineTuneRemain = 0;
  }
  stepPhysics(balls, 1 / 60, extras);
  const opened = balls.some((ball) => ball.fineTuneRemain > 0);
  assert(opened, `微调圈：${label} 应打开 0.3s 微调窗`);
  const remain = balls.find((ball) => ball.fineTuneRemain > 0)?.fineTuneRemain ?? 0;
  assert(near(remain, FINE_TUNE_WINDOW), `微调圈：${label} 开窗时长应为 ${FINE_TUNE_WINDOW}`);
}

/** 撞后青圈不再绘制；微调开窗/时长/强拧与其他状态圈保留。 */
export function verifyFineTuneRing(): void {
  assert(FINE_TUNE_WINDOW === 0.3, '微调圈：窗口仍应为 0.3s');
  assert(FINE_TUNE_RING.draw === false, '微调圈：青圈绘制开关必须关掉');
  assert(FINE_TUNE_RING.color === 0x7ee8ff, '微调圈：旧青色仅作自检对照');
  assert(FINE_TUNE_RING.extraRadius === 0.16, '微调圈：旧半径偏移仅作自检对照');
  assert(SPEAR_TIP_DIST === 2.24, '微调圈：枪尖距仍应为 2.24');
  assert(BALL_RADIUS === 1, '微调圈：碰撞半径仍应为 1');
  assert(SELF_MARK.milk === 0xf6e7a3, '微调圈：本人奶黄身份圈应保留');

  const tuned = sample({ x: 8, y: 8, color: 0xe24a4a, vx: 4, vy: 0, facingX: 1, facingY: 0 });
  assert(steerRateRad(tuned) === WEAK_STEER_RAD_PER_SEC, '微调圈：未开窗应为弱拧');
  openFineTune(tuned);
  assert(near(tuned.fineTuneRemain, FINE_TUNE_WINDOW), '微调圈：openFineTune 应写入 0.3s');
  assert(steerRateRad(tuned) === STRONG_STEER_RAD_PER_SEC, '微调圈：开窗内应为强拧 120°/s');
  tickFineTune(tuned, 0.29);
  assert(tuned.fineTuneRemain > 0, '微调圈：0.29s 后窗口应仍在');
  assert(steerRateRad(tuned) === STRONG_STEER_RAD_PER_SEC, '微调圈：窗口内转向仍走强拧');
  tickFineTune(tuned, 0.02);
  assert(tuned.fineTuneRemain === 0, '微调圈：满 0.3s 后应关窗');
  assert(steerRateRad(tuned) === WEAK_STEER_RAD_PER_SEC, '微调圈：关窗后回到弱拧');

  const prevPillars = arenaPillarsEnabled();
  try {
    setArenaPillarsEnabled(true);
    resetStakes();
    resetMirrorWalls();
    resetTrapZones();

    const wall = sample({
      x: BALL_RADIUS + 0.1,
      y: 6,
      color: 0xe24a4a,
      vx: -8,
      vy: 0,
      facingX: -1,
      facingY: 0,
    });
    assertOpened('撞墙', [wall]);

    const pillar = sample({
      x: LEFT_PILLAR.x - (BALL_RADIUS + PILLAR_HEIGHT / 2) + 0.05,
      y: LEFT_PILLAR.y,
      color: 0xe24a4a,
      vx: 8,
      vy: 0,
      facingX: 1,
      facingY: 0,
    });
    assertOpened('撞柱', [pillar]);

    const fence = redBaselineStall();
    const stallBall = sample({
      x: fence.maxX - BALL_RADIUS - 0.05,
      y: 10,
      color: 0xe24a4a,
      vx: 8,
      vy: 0,
      facingX: 1,
      facingY: 0,
      team: 'red',
    });
    assertOpened('撞 Stall 栏', [stallBall], { stalls: [fence] });

    const allyA = sample({
      x: 10,
      y: 8,
      color: 0xe24a4a,
      vx: 8,
      vy: 0,
      facingX: 1,
      facingY: 0,
      team: 'red',
      teamSlot: 1,
    });
    const allyB = sample({
      x: 10 + BALL_RADIUS * 1.85,
      y: 8,
      color: 0xe24a4a,
      vx: -8,
      vy: 0,
      facingX: -1,
      facingY: 0,
      team: 'red',
      teamSlot: 2,
    });
    assertOpened('撞队友', [allyA, allyB]);

    const foeA = sample({
      x: 12,
      y: 8,
      color: 0xe24a4a,
      vx: 8,
      vy: 0,
      facingX: 1,
      facingY: 0,
      team: 'red',
    });
    const foeB = sample({
      x: 12 + BALL_RADIUS * 1.85,
      y: 8,
      color: 0x3d7cf0,
      vx: -8,
      vy: 0,
      facingX: -1,
      facingY: 0,
      team: 'blue',
    });
    assertOpened('撞敌', [foeA, foeB]);

    const stakeBall = sample({
      x: 16,
      y: 10,
      color: 0xe24a4a,
      vx: 8,
      vy: 0,
      facingX: 1,
      facingY: 0,
      team: 'red',
    });
    placeStake({ id: 91001, team: 'blue' }, 16 + BALL_RADIUS + 0.2, 10);
    assertOpened('撞桩', [stakeBall]);
    resetStakes();

    const mirrorBall = sample({
      x: 18,
      y: 10,
      color: 0xe24a4a,
      vx: 8,
      vy: 0,
      facingX: 1,
      facingY: 0,
      team: 'red',
    });
    placeMirrorWall({ id: 91002, team: 'blue' }, 19.1, 8, 19.1, 12);
    assertOpened('撞镜壁', [mirrorBall]);
    resetMirrorWalls();

    resetStakes();
    resetMirrorWalls();
    resetTrapZones();
    const timer = sample({
      x: MAP_WIDTH / 2,
      y: MAP_HEIGHT / 2,
      color: 0xe24a4a,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
    });
    openFineTune(timer);
    const before = timer.fineTuneRemain;
    stepPhysics([timer], 1 / 60);
    assert(
      timer.fineTuneRemain < before && timer.fineTuneRemain > 0,
      '微调圈：无再撞时 physics 应扣微调时间、不得重开窗',
    );
    for (let i = 0; i < 18; i += 1) {
      stepPhysics([timer], 1 / 60);
    }
    assert(timer.fineTuneRemain === 0, '微调圈：撞后 0.3s 无再撞应关窗，控制逻辑仍在走');
    assert(steerRateRad(timer) === WEAK_STEER_RAD_PER_SEC, '微调圈：关窗后 physics 路径也应回到弱拧');
  } finally {
    setArenaPillarsEnabled(prevPillars);
    resetStakes();
    resetMirrorWalls();
    resetTrapZones();
  }

  const idle = sample({ x: 6, y: 6, color: 0xe24a4a, team: 'red' });
  const fallback = createBallView(idle, { selfMark: true });
  idle.fineTuneRemain = FINE_TUNE_WINDOW;
  fallback.sync(idle, { selfMark: true });
  assert(markLayer(fallback).visible, '微调圈：本人身份圈在微调窗内仍在');
  assert(!hasColor(bodyGfx(fallback), FINE_TUNE_RING.color), '微调圈：缺图回退也不应画青圈');
  idle.fineTuneRemain = 0;
  idle.healRemain = 1;
  fallback.sync(idle, { selfMark: true });
  assert(hasColor(bodyGfx(fallback), 0x86efac), '微调圈：治疗绿圈应保留');

  const prevArt = getHookRiderArt();
  try {
    const stub = stubTexture();
    setHookRiderArt({ body: stub, bodyRed: stub, spear: stub });
    const rider = sample({ x: 7, y: 7, color: 0xe24a4a, team: 'red', hero: 'hook' });
    const other = sample({ x: 9, y: 7, color: 0x3d7cf0, team: 'blue', hero: 'ring' });
    const riderView = createBallView(rider, { selfMark: true });
    const otherView = createBallView(other, { selfMark: false });

    rider.fineTuneRemain = FINE_TUNE_WINDOW;
    other.fineTuneRemain = FINE_TUNE_WINDOW;
    riderView.sync(rider, { selfMark: true });
    otherView.sync(other, { selfMark: false });
    assert(emptyish(bodyGfx(riderView)), '微调圈：本人骑装撞后不应多画青圈');
    assert(emptyish(bodyGfx(otherView)), '微调圈：非本人撞后也不应多画青圈');
    assert(!hasColor(bodyGfx(riderView), FINE_TUNE_RING.color), '微调圈：本人主体不得含旧青色');
    assert(!hasColor(bodyGfx(otherView), FINE_TUNE_RING.color), '微调圈：非本人主体不得含旧青色');
    assert(markLayer(riderView).visible, '微调圈：本人单层身份圈应保留');
    assert(!markLayer(otherView).visible, '微调圈：非本人无常驻身份圈');

    const rings: Array<{ apply: (ball: BallBody) => void; color: number; label: string }> = [
      { apply: (ball) => { ball.invincibleRemain = 1.2; }, color: 0xffffff, label: '无敌白圈' },
      { apply: (ball) => { ball.activeRamRemain = 1.2; }, color: 0xffe08a, label: '主动撞金圈' },
      { apply: (ball) => { ball.fieldRemain = 1.2; }, color: 0x5eead4, label: '磁场圈' },
      { apply: (ball) => { ball.healRemain = 1.2; }, color: 0x86efac, label: '治疗绿圈' },
      { apply: (ball) => { ball.pinRemain = 1.2; }, color: 0xf59e0b, label: '受控钉圈' },
    ];
    for (const ring of rings) {
      other.fineTuneRemain = FINE_TUNE_WINDOW;
      other.invincibleRemain = 0;
      other.activeRamRemain = 0;
      other.fieldRemain = 0;
      other.healRemain = 0;
      other.pinRemain = 0;
      ring.apply(other);
      otherView.sync(other, { selfMark: false });
      assert(!emptyish(bodyGfx(otherView)), `微调圈：${ring.label} 应保留`);
      assert(hasColor(bodyGfx(otherView), ring.color), `微调圈：${ring.label} 色应仍在`);
      assert(!hasColor(bodyGfx(otherView), FINE_TUNE_RING.color), `微调圈：${ring.label} 不得夹带青圈`);
      other.invincibleRemain = 0;
      other.activeRamRemain = 0;
      other.fieldRemain = 0;
      other.healRemain = 0;
      other.pinRemain = 0;
    }
    other.fineTuneRemain = 0;
    otherView.sync(other, { selfMark: false });
    assert(emptyish(bodyGfx(otherView)), '微调圈：状态结束后非本人无额外圈');
  } finally {
    setHookRiderArt(prevArt);
  }
}
