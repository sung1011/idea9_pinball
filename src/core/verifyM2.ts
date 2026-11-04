import { createBallBody, openActiveRam } from './ballBody';
import { selfCheckCollisionDamage } from './collisionDamage';
import { MAX_HP } from './constants';
import { stepPhysics } from './physicsStep';

function stepUntilHit(
  balls: ReturnType<typeof createBallBody>[],
  frames = 40,
): number {
  let count = 0;
  for (let i = 0; i < frames; i += 1) {
    count += stepPhysics(balls, 1 / 60).hits.length;
  }
  return count;
}

/** 公式 + 对撞/轻蹭/主动撞窗积分自检。 */
export function verifyM2(): void {
  selfCheckCollisionDamage();

  const headA = createBallBody({
    x: 9.45,
    y: 6,
    color: 0xe24a4a,
    label: 'A',
    vx: 8,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const headB = createBallBody({
    x: 10.55,
    y: 6,
    color: 0x3d7cf0,
    label: 'B',
    vx: -8,
    vy: 0,
    facingX: -1,
    facingY: 0,
  });
  const headHits = stepUntilHit([headA, headB]);
  if (headHits === 0 || headA.hp >= MAX_HP || headB.hp >= MAX_HP) {
    throw new Error('M2：对撞应对双方掉血');
  }

  const scrapeA = createBallBody({
    x: 9.5,
    y: 4,
    color: 0xe24a4a,
    label: 'C',
    vx: 2.5,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const scrapeB = createBallBody({
    x: 10.35,
    y: 4.5,
    color: 0x3d7cf0,
    label: 'D',
    vx: 2.5,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  stepUntilHit([scrapeA, scrapeB]);
  if (scrapeA.hp !== MAX_HP || scrapeB.hp !== MAX_HP) {
    throw new Error('M2：轻蹭（相对速度 < 4）不应掉血');
  }

  const ramA = createBallBody({
    x: 9.45,
    y: 8,
    color: 0xe24a4a,
    label: 'E',
    vx: 1.6,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const ramB = createBallBody({
    x: 10.55,
    y: 8,
    color: 0x3d7cf0,
    label: 'F',
    vx: -1.6,
    vy: 0,
    facingX: -1,
    facingY: 0,
  });
  openActiveRam(ramA);
  const ramHits = stepUntilHit([ramA, ramB]);
  if (ramHits === 0 || (ramA.hp >= MAX_HP && ramB.hp >= MAX_HP)) {
    throw new Error('M2：主动撞窗内相对速度 3.2 应掉血');
  }
}