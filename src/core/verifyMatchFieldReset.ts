import { createBallBody } from './ballBody';
import { listBoomFlashes, spawnBoomFlash, tickBoomFlashes } from './boomFlashes';
import { applyChainEqualize, listEqualizeFlashes } from './chainEqualize';
import { MAX_HP } from './constants';
import { WELL_BLAST } from '../heroes/wellKit';
import { RING_TRAP } from '../heroes/ringKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { placeMagnetWell, listMagnetWells } from './magnetWells';
import { resetMatchFieldFx } from './matchFieldReset';
import { placeMirrorWall, listMirrorWalls } from './mirrorWalls';
import { placeStake, listStakes } from './ropeStakes';
import { createSkillCaster } from './skillCaster';
import { listTrapZones, setTrapZone } from './trapZones';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function sample(partial: Partial<ActionSample>): ActionSample {
  return {
    aimX: 1,
    aimY: 0,
    hasAim: true,
    steerAim: true,
    skillPress: 0,
    confirmRelease: false,
    cancelAim: false,
    ...partial,
  };
}

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: ReturnType<typeof createBallBody>,
  slot: SkillSlot,
  roster: readonly ReturnType<typeof createBallBody>[],
): void {
  caster.handleInput(ball, sample({ skillPress: slot }), roster);
  caster.handleInput(ball, sample({ skillPress: slot }), roster);
}

function emptyField(label: string): void {
  assert(listBoomFlashes().length === 0, `${label}：索爆闪光应空`);
  assert(listTrapZones().length === 0, `${label}：困圈应空`);
  assert(listMagnetWells().length === 0, `${label}：磁井应空`);
  assert(listStakes().length === 0, `${label}：索桩应空`);
  assert(listMirrorWalls().length === 0, `${label}：镜壁应空`);
  assert(listEqualizeFlashes().length === 0, `${label}：均血圈应空`);
}

/** 自测遗留与首局前清理：清掉测试场域，不改技能寿命/伤害，清理后仍可再放。 */
export function verifyMatchFieldReset(): void {
  spawnBoomFlash(9001, 8, 6, WELL_BLAST.radius);
  setTrapZone({
    ownerId: 9002,
    ownerTeam: 'blue',
    x: 10,
    y: 10,
    radius: RING_TRAP.radius,
    remain: RING_TRAP.duration,
  });
  placeMagnetWell({ ownerId: 9003, ownerTeam: 'red', x: 12, y: 10 });
  placeStake({ id: 9004, team: 'red' }, 14, 6);
  placeMirrorWall({ id: 9005, team: 'red' }, 8, 5, 10, 5);
  applyChainEqualize(
    createBallBody({
      x: 6,
      y: 6,
      color: 0xe24a4a,
      team: 'red',
      facingX: 1,
      hero: 'chain',
    }),
    [],
  );
  assert(listBoomFlashes().length >= 1, '场域清理：清理前应有索爆闪光');
  assert(listTrapZones().length >= 1, '场域清理：清理前应有困圈');
  assert(listMagnetWells().length >= 1, '场域清理：清理前应有磁井');
  assert(listStakes().length >= 1, '场域清理：清理前应有索桩');
  assert(listMirrorWalls().length >= 1, '场域清理：清理前应有镜壁');
  assert(listEqualizeFlashes().length >= 1, '场域清理：清理前应有均血圈');

  resetMatchFieldFx();
  emptyField('场域清理：resetMatchFieldFx 后');

  const caster = createSkillCaster('well');
  const red = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    team: 'red',
    facingX: 1,
    hero: 'well',
  });
  const blue = createBallBody({
    x: 9.5,
    y: 6,
    color: 0x3d7cf0,
    team: 'blue',
    facingX: -1,
    hero: 'hook',
  });
  red.vx = 0;
  red.vy = 0;
  blue.vx = 0;
  blue.vy = 0;
  const hpBefore = blue.hp;
  fire(caster, red, 1, [red, blue]);
  assert(blue.hp === MAX_HP, '场域清理：索爆前摇未结束不应出伤');
  caster.tick(red, WELL_BLAST.windup + 0.01, [red, blue]);
  assert(Math.abs(blue.hp - (hpBefore - WELL_BLAST.damage)) < 1e-6, '场域清理：清理后索爆第一脉冲仍应打 8');
  const live = listBoomFlashes();
  assert(live.length === 1, '场域清理：清理后真实索爆仍应出现短闪光');
  assert(Math.abs(live[0].x - 8) < 1e-6 && Math.abs(live[0].y - 6) < 1e-6, '场域清理：索爆闪光应在施法者 (8,6)');
  assert(Math.abs(live[0].radius - WELL_BLAST.radius) < 1e-6, '场域清理：索爆闪光半径仍为 2.2');
  assert(live[0].ownerId === red.id, '场域清理：闪光 owner 应为施法者');
  assert(live[0].remain > 0.2 && live[0].life === live[0].remain, '场域清理：闪光寿命仍约 0.22s');

  tickBoomFlashes(red.id + 99, 1);
  assert(listBoomFlashes().length === 1, '场域清理：非 owner tick 不应提前清闪光');
  tickBoomFlashes(red.id, 0.25);
  assert(listBoomFlashes().length === 0, '场域清理：owner tick 满寿命后闪光应消失');
  assert(Math.abs(blue.hp - (hpBefore - WELL_BLAST.damage)) < 1e-6, '场域清理：闪光衰减不应再扣血');

  setTrapZone({
    ownerId: red.id,
    ownerTeam: 'red',
    x: 11,
    y: 8,
    radius: RING_TRAP.radius,
    remain: RING_TRAP.duration,
  });
  placeMagnetWell({ ownerId: red.id, ownerTeam: 'red', x: 13, y: 8 });
  placeStake(red, 15, 6);
  placeMirrorWall(red, 7, 4, 9, 4);
  applyChainEqualize(
    createBallBody({
      x: 5,
      y: 5,
      color: 0xe24a4a,
      team: 'red',
      facingX: 1,
      hero: 'chain',
    }),
    [],
  );
  assert(listTrapZones().length === 1, '场域清理：清理后困圈仍可放下');
  assert(listMagnetWells().length === 1, '场域清理：清理后磁井仍可放下');
  assert(listStakes().length === 1, '场域清理：清理后索桩仍可放下');
  assert(listMirrorWalls().length === 1, '场域清理：清理后镜壁仍可放下');
  assert(listEqualizeFlashes().length === 1, '场域清理：清理后均血圈仍可结算');

  resetMatchFieldFx();
  emptyField('场域清理：收尾');
}
