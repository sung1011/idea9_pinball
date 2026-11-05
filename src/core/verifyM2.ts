import { createBallBody, openActiveRam } from './ballBody';
import {
  applyCollisionCombat,
  collisionDamage,
  collisionThreshold,
  selfCheckCollisionDamage,
} from './collisionDamage';
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

/** 公式 + 枪尖门闩 / 对撞 / 侧蹭 / 主动撞窗积分自检。 */
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
    throw new Error('M2：枪尖对戳应对双方掉血');
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

  const sideA = createBallBody({
    x: 8.6,
    y: 5.45,
    color: 0xe24a4a,
    label: '侧A',
    vx: 8,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const sideB = createBallBody({
    x: 10.3,
    y: 6.2,
    color: 0x3d7cf0,
    label: '侧B',
    vx: 2,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  let sideCollided = false;
  for (let i = 0; i < 40; i += 1) {
    const step = stepPhysics([sideA, sideB], 1 / 60);
    if (step.collidedIds.includes(sideA.id) && step.collidedIds.includes(sideB.id)) {
      sideCollided = true;
    }
  }
  if (!sideCollided) {
    throw new Error('M2：侧身圆蹭应发生身体碰撞');
  }
  if (sideA.hp !== MAX_HP || sideB.hp !== MAX_HP) {
    throw new Error('M2：侧身圆蹭无枪尖命中不应掉血');
  }

  const rubA = createBallBody({
    x: 10,
    y: 5.2,
    color: 0xe24a4a,
    vx: 0,
    vy: 8,
    facingX: 1,
    facingY: 0,
  });
  const rubB = createBallBody({
    x: 10,
    y: 6.2,
    color: 0x3d7cf0,
    vx: 0,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const rubHits = applyCollisionCombat(rubA, rubB, 0, 1, 8);
  if (rubHits.length !== 0 || rubA.hp !== MAX_HP || rubB.hp !== MAX_HP) {
    throw new Error('M2：身子相撞但枪尖未中不应掉血');
  }

  const stabA = createBallBody({
    x: 9.2,
    y: 5,
    color: 0xe24a4a,
    label: '戳A',
    vx: 4,
    facingX: 1,
  });
  const stabB = createBallBody({
    x: 10.3,
    y: 5,
    color: 0x3d7cf0,
    label: '戳B',
    vx: -4,
    facingX: 1,
  });
  const stabHits = applyCollisionCombat(stabA, stabB, 1, 0, 8);
  const stabbed = stabHits.find((hit) => hit.victimId === stabB.id);
  const reverse = stabHits.find((hit) => hit.victimId === stabA.id);
  if (!stabbed || reverse) {
    throw new Error('M2：仅被枪尖戳到的一方掉血');
  }
  if (stabA.hp !== MAX_HP || stabB.hp >= MAX_HP) {
    throw new Error('M2：单向枪尖命中只应扣受击方');
  }

  const frontA = createBallBody({
    x: 9.2,
    y: 3,
    color: 0xe24a4a,
    vx: 4,
    facingX: 1,
  });
  const frontB = createBallBody({
    x: 10.3,
    y: 3,
    color: 0x3d7cf0,
    vx: -4,
    facingX: -1,
  });
  const rearA = createBallBody({
    x: 9.2,
    y: 2,
    color: 0xe24a4a,
    vx: 4,
    facingX: 1,
  });
  const rearB = createBallBody({
    x: 10.3,
    y: 2,
    color: 0x3d7cf0,
    vx: -4,
    facingX: 1,
  });
  const frontHit = applyCollisionCombat(frontA, frontB, 1, 0, 8).find((hit) => hit.victimId === frontB.id);
  const rearHit = applyCollisionCombat(rearA, rearB, 1, 0, 8).find((hit) => hit.victimId === rearB.id);
  const expected = collisionDamage(8, collisionThreshold(false));
  if (!frontHit || !rearHit || Math.abs(frontHit.damage - rearHit.damage) > 1e-6) {
    throw new Error('M2：背刺伤害应与正戳相同，不再乘朝向');
  }
  if (Math.abs(frontHit.damage - expected) > 1e-6 || expected !== 24) {
    throw new Error('M2：碰撞伤害应为 6×(相对速度−阈值)');
  }
}
