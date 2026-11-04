import { createBallBody } from './ballBody';
import {
  FLOOR_SPEED,
  STRONG_STEER_DEG_PER_SEC,
  STRONG_STEER_RAD_PER_SEC,
  WEAK_STEER_DEG_PER_SEC,
  WEAK_STEER_RAD_PER_SEC,
} from './constants';
import { isAimUiTarget } from '../input/actionBus';
import { stepPhysics } from './physicsStep';
import { applyFloorSpeed, applySteerToward } from './skillStub';

const ANG_EPS = 1.5;
const SPEED_EPS = 0.05;

function angleDeg(x: number, y: number): number {
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** 保底冲、弱/强拧、Aim 不加速、技能键不抢 Aim。 */
export function verifyM35(): void {
  const fromRest = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applyFloorSpeed(fromRest);
  if (Math.abs(Math.hypot(fromRest.vx, fromRest.vy) - FLOOR_SPEED) > SPEED_EPS) {
    throw new Error('M3.5：静止应拉回保底 2.5');
  }

  const crawl = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: 1,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applyFloorSpeed(crawl);
  if (Math.abs(Math.hypot(crawl.vx, crawl.vy) - FLOOR_SPEED) > SPEED_EPS) {
    throw new Error('M3.5：低于保底应拉回 2.5');
  }

  const cruise = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: 6,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applyFloorSpeed(cruise);
  if (Math.abs(Math.hypot(cruise.vx, cruise.vy) - 6) > SPEED_EPS) {
    throw new Error('M3.5：高于保底不应被拉低');
  }

  const weak = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: FLOOR_SPEED,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applySteerToward(weak, 0, 1, 1, WEAK_STEER_RAD_PER_SEC);
  const weakAng = angleDeg(weak.vx, weak.vy);
  if (Math.abs(weakAng - WEAK_STEER_DEG_PER_SEC) > ANG_EPS) {
    throw new Error(`M3.5：弱拧 1s 应为 45°，实际 ${weakAng.toFixed(2)}`);
  }
  if (Math.abs(Math.hypot(weak.vx, weak.vy) - FLOOR_SPEED) > SPEED_EPS) {
    throw new Error('M3.5：拧向不得改变速率');
  }

  const strong = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: FLOOR_SPEED,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applySteerToward(strong, 0, 1, 0.3, STRONG_STEER_RAD_PER_SEC);
  const strongAng = angleDeg(strong.vx, strong.vy);
  if (Math.abs(strongAng - STRONG_STEER_DEG_PER_SEC * 0.3) > ANG_EPS) {
    throw new Error(`M3.5：强拧 0.3s 应为 36°，实际 ${strongAng.toFixed(2)}`);
  }

  const noGas = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: 6,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applySteerToward(noGas, 0, -1, 0.5, WEAK_STEER_RAD_PER_SEC);
  if (Math.abs(Math.hypot(noGas.vx, noGas.vy) - 6) > SPEED_EPS) {
    throw new Error('M3.5：Aim 不得加油门');
  }

  const stepped = createBallBody({
    x: 6,
    y: 6,
    color: 0xe24a4a,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  stepPhysics([stepped], 1 / 60);
  if (Math.abs(Math.hypot(stepped.vx, stepped.vy) - FLOOR_SPEED) > SPEED_EPS) {
    throw new Error('M3.5：积分后静止应变保底冲');
  }

  const hitA = createBallBody({
    x: 9.45,
    y: 6,
    color: 0xe24a4a,
    vx: 8,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const hitB = createBallBody({
    x: 10.55,
    y: 6,
    color: 0x3d7cf0,
    vx: -8,
    vy: 0,
    facingX: -1,
    facingY: 0,
  });
  stepPhysics([hitA, hitB], 1 / 60);
  if (hitA.fineTuneRemain <= 0 || hitB.fineTuneRemain <= 0) {
    throw new Error('M3.5：对撞应打开 0.3s 强拧窗');
  }

  const ui = document.createElement('button');
  ui.dataset.touchControl = 'skill';
  const child = document.createElement('span');
  ui.appendChild(child);
  if (!isAimUiTarget(ui) || !isAimUiTarget(child)) {
    throw new Error('M3.5：技能键应视为不抢 Aim 的 UI');
  }
  if (isAimUiTarget(document.createElement('div'))) {
    throw new Error('M3.5：非技能键不应挡住 Aim');
  }
}
