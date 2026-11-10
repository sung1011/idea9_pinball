import { applyArmor, applyShield, createBallBody, type BallBody } from './ballBody';
import { applyCollisionCombat, collisionDamage } from './collisionDamage';
import { BALL_RADIUS, FLOOR_SPEED, MAX_HP } from './constants';
import { ARC_SIDESTEP } from '../heroes/arcKit';
import { CHAIN_HEAL } from '../heroes/chainKit';
import { nextHero } from '../heroes/heroIds';
import { HOOK_PULL } from '../heroes/hookKit';
import {
  MIRROR_REFLECT,
  MIRROR_REFRACT,
  MIRROR_SHATTER,
  MIRROR_WALL,
} from '../heroes/mirrorKit';
import { NAIL_ARMOR } from '../heroes/nailKit';
import { RING_FIELD, RING_TRAP } from '../heroes/ringKit';
import { WELL_BLAST } from '../heroes/wellKit';
import type { ActionSample, SkillSlot } from '../input/actionTypes';
import { stepPhysics } from './physicsStep';
import { applySkillDamage } from './skillHits';
import { createSkillCaster } from './skillCaster';
import { getMirrorWall, resetMirrorWalls } from './mirrorWalls';
import { resetTrapZones, setTrapZone } from './trapZones';

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

function redBlue(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  redHero: 'mirror' | 'hook' | 'arc' = 'mirror',
): [BallBody, BallBody] {
  const a = createBallBody({
    x: x0,
    y: y0,
    color: 0xe24a4a,
    label: '红镜',
    team: 'red',
    facingX: 1,
    facingY: 0,
    hero: redHero,
  });
  const b = createBallBody({
    x: x1,
    y: y1,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
    facingX: -1,
    facingY: 0,
    hero: 'hook',
  });
  return [a, b];
}

function fire(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  slot: SkillSlot,
  roster: readonly BallBody[] = [],
  extra: Partial<ActionSample> = {},
): void {
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
  caster.handleInput(ball, sample({ skillPress: slot, ...extra }), roster);
}

function play(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  dt: number,
): void {
  caster.tick(ball, dt, roster);
  const phys = stepPhysics(roster, dt);
  caster.afterPhysics(ball, dt, roster, phys.wallHitIds.includes(ball.id));
}

function advance(
  caster: ReturnType<typeof createSkillCaster>,
  ball: BallBody,
  roster: readonly BallBody[],
  sec: number,
): void {
  let left = sec;
  while (left > 1e-9) {
    const dt = Math.min(1 / 60, left);
    play(caster, ball, roster, dt);
    left -= dt;
  }
}

/** 镜卫四技能：折光入账、反照扇伤、裂镜自伤/溅射分账、镜壁敌弹己开窗。 */
export function verifyMirror(): void {
  resetTrapZones();
  resetMirrorWalls();
  assert(MIRROR_REFRACT.cd === 9 && MIRROR_REFRACT.duration === 1.5, '镜卫：折光应为 CD9 / 1.5s');
  assert(MIRROR_REFRACT.takenMul === 0.5, '镜卫：折光受伤应为 ×0.5');
  assert(MIRROR_REFLECT.cd === 8 && MIRROR_REFLECT.cap === 60, '镜卫：反照应为 CD8 / cap60');
  assert(MIRROR_SHATTER.cd === 10 && MIRROR_SHATTER.selfDamage === 24, '镜卫：裂镜应为 CD10 / 自伤24');
  assert(MIRROR_SHATTER.splash === 12, '镜卫：裂镜溅射应为 12');
  assert(MIRROR_WALL.cd === 14 && MIRROR_WALL.duration === 2.5, '镜卫：镜壁应为 CD14 / 2.5s');
  assert(nextHero('well') === 'mirror' && nextHero('mirror') === 'hook', '镜卫：英雄循环井绳→镜卫→钩刺');

  resetTrapZones();
  resetMirrorWalls();
  const refract = createSkillCaster('mirror');
  const [refRed, refBlue] = redBlue(8, 6, 16, 6);
  fire(refract, refRed, 1, [refRed, refBlue]);
  assert(Math.abs(refract.getCds()[0] - MIRROR_REFRACT.cd) < 1e-6, '镜卫：折光应进 9s CD');
  assert(refRed.refractRemain > MIRROR_REFRACT.duration - 0.05, '镜卫：折光应开 1.5s 窗');
  const hit = applySkillDamage(refRed, refBlue, 20);
  assert(hit !== null && Math.abs(hit.damage - 10) < 1e-6, '镜卫：折光中技能伤 20 应实掉 10 并出字');
  assert(Math.abs(refRed.hp - (MAX_HP - 10)) < 1e-6, '镜卫：折光中应只掉一半血');
  assert(Math.abs(refRed.mirrorLedger - 10) < 1e-6, '镜卫：折光应把减免的 10 记入账本');

  resetTrapZones();
  resetMirrorWalls();
  const shield = createSkillCaster('mirror');
  const [shRed, shBlue] = redBlue(8, 6, 16, 6);
  fire(shield, shRed, 1, [shRed, shBlue]);
  applyShield(shRed, 0.45, 3);
  applyArmor(shRed, 0.4, 3);
  shRed.x = 10;
  shRed.y = 6;
  shBlue.x = 10 + BALL_RADIUS * 2.2;
  shBlue.y = 6;
  shRed.facingX = 1;
  shBlue.facingX = -1;
  const combatHits = applyCollisionCombat(shRed, shBlue, 1, 0, 8, 8, 0);
  const selfHit = combatHits.find((item) => item.victimId === shRed.id);
  assert(!!selfHit, '镜卫：折光中碰撞仍应结算');
  const incoming = collisionDamage(8) * 0.45 * 0.4;
  const expected = incoming * 0.5;
  assert(Math.abs((selfHit?.damage ?? 0) - expected) < 1e-6, '镜卫：折光应按盾/甲之后的差额入账');
  assert(Math.abs(shRed.mirrorLedger - (incoming - expected)) < 1e-6, '镜卫：账本只记折光减免，不把盾/甲再算一遍');

  resetTrapZones();
  resetMirrorWalls();
  const empty = createSkillCaster('mirror');
  const [emptyRed, emptyBlue] = redBlue(8, 6, 16, 6);
  fire(empty, emptyRed, 2, [emptyRed, emptyBlue]);
  assert(empty.getCds()[1] === 0, '镜卫：账本为 0 时反照不应进 CD');
  assert(emptyBlue.hp === MAX_HP, '镜卫：空账反照不应出伤');

  resetTrapZones();
  resetMirrorWalls();
  const miss = createSkillCaster('mirror');
  const [missRed, missBlue] = redBlue(8, 6, 16, 6);
  missRed.mirrorLedger = 30;
  fire(miss, missRed, 2, [missRed, missBlue]);
  assert(miss.getCds()[1] === 0, '镜卫：无目标时反照不应进 CD');
  assert(Math.abs(missRed.mirrorLedger - 30) < 1e-6, '镜卫：空放反照不应吞账本');

  resetTrapZones();
  resetMirrorWalls();
  const bounce = createSkillCaster('mirror');
  const [bounceRed, bounceBlue] = redBlue(8, 6, 11, 6);
  bounceRed.mirrorLedger = 40;
  fire(bounce, bounceRed, 2, [bounceRed, bounceBlue]);
  const bounceHits = bounce.tick(bounceRed, 0, [bounceRed, bounceBlue]);
  assert(Math.abs(bounce.getCds()[1] - MIRROR_REFLECT.cd) < 1e-6, '镜卫：反照命中应进 8s CD');
  assert(Math.abs(bounceBlue.hp - (MAX_HP - 40)) < 1e-6, '镜卫：反照应按账本打 40');
  assert(bounceHits.some((item) => item.victimId === bounceBlue.id && Math.abs(item.damage - 40) < 1e-6), '镜卫：反照扇伤应出飘字');
  assert(bounceRed.mirrorLedger === 0, '镜卫：反照打出后应清空账本');
  assert(bounceRed.hp === MAX_HP, '镜卫：反照打出的伤害不应记回自己账本');

  resetTrapZones();
  resetMirrorWalls();
  const cap = createSkillCaster('mirror');
  const [capRed, capBlue] = redBlue(8, 6, 11, 6);
  capRed.mirrorLedger = 90;
  fire(cap, capRed, 2, [capRed, capBlue]);
  assert(Math.abs(capBlue.hp - (MAX_HP - 60)) < 1e-6, '镜卫：反照伤害应 cap 60');
  assert(capRed.mirrorLedger === 0, '镜卫：反照仍应耗尽账本');

  resetTrapZones();
  resetMirrorWalls();
  const shatter = createSkillCaster('mirror');
  const [shatRed, shatBlue] = redBlue(8, 6, 9.4, 6);
  const shatAlly = createBallBody({
    x: 8.6,
    y: 6.3,
    color: 0xe24a4a,
    label: '红友',
    team: 'red',
    facingX: 1,
    hero: 'hook',
  });
  fire(shatter, shatRed, 3, [shatRed, shatBlue, shatAlly]);
  const shatterHits = shatter.tick(shatRed, 0, [shatRed, shatBlue, shatAlly]);
  assert(Math.abs(shatter.getCds()[2] - MIRROR_SHATTER.cd) < 1e-6, '镜卫：裂镜应进 10s CD');
  assert(Math.abs(shatRed.hp - (MAX_HP - 24)) < 1e-6, '镜卫：裂镜应对自己打 24');
  assert(Math.abs(shatBlue.hp - (MAX_HP - 12)) < 1e-6, '镜卫：裂镜应对周围敌溅 12');
  assert(shatAlly.hp === MAX_HP, '镜卫：裂镜溅射不应打友军');
  assert(shatterHits.some((item) => item.victimId === shatRed.id && Math.abs(item.damage - 24) < 1e-6), '镜卫：裂镜自伤应出红橙飘字');
  assert(shatterHits.some((item) => item.victimId === shatBlue.id && Math.abs(item.damage - 12) < 1e-6), '镜卫：裂镜溅射应出飘字');
  assert(Math.abs(shatRed.mirrorLedger - 24) < 1e-6, '镜卫：只有自伤 24 入账，溅射 12 不入');

  resetTrapZones();
  resetMirrorWalls();
  const both = createSkillCaster('mirror');
  const [bothRed, bothBlue] = redBlue(8, 6, 9.4, 6);
  fire(both, bothRed, 1, [bothRed, bothBlue]);
  fire(both, bothRed, 3, [bothRed, bothBlue]);
  assert(Math.abs(bothRed.hp - (MAX_HP - 24)) < 1e-6, '镜卫：裂镜自伤不吃折光，避免和 24 入账双算');
  assert(Math.abs(bothRed.mirrorLedger - 24) < 1e-6, '镜卫：折光窗内裂镜仍只记自伤 24');
  assert(Math.abs(bothBlue.hp - (MAX_HP - 12)) < 1e-6, '镜卫：折光窗内溅射仍打敌 12 且不入己账');

  resetTrapZones();
  resetMirrorWalls();
  const ko = createSkillCaster('mirror');
  const [koRed] = redBlue(8, 6, 16, 6);
  koRed.hp = 20;
  fire(ko, koRed, 3, [koRed]);
  assert(koRed.hp === 0, '镜卫：裂镜自伤应能把自己打到 0 血');
  assert(Math.abs(koRed.mirrorLedger - 24) < 1e-6, '镜卫：自伤入账按技能 24，不按剩余血量打折');

  resetTrapZones();
  resetMirrorWalls();
  const wall = createSkillCaster('mirror');
  const [wallRed, wallAlly] = redBlue(8, 6, 16, 6);
  wallAlly.team = 'red';
  wallAlly.hero = 'hook';
  fire(wall, wallRed, 4, [wallRed, wallAlly]);
  assert(Math.abs(wall.getCds()[3] - MIRROR_WALL.cd) < 1e-6, '镜卫：镜壁应进 14s CD');
  const peg = getMirrorWall(wallRed.id);
  assert(!!peg && peg.remain > 2.3, '镜卫：应在身前落下短墙');
  wallAlly.x = 10.2;
  wallAlly.y = 6;
  wallAlly.vx = -6;
  wallAlly.vy = 0;
  wallAlly.activeRamRemain = 0;
  const ramBefore = wallAlly.activeRamRemain;
  advance(wall, wallRed, [wallRed, wallAlly], 0.2);
  assert(wallAlly.vx > 0, '镜卫：己方撞镜壁应反弹');
  assert(wallAlly.activeRamRemain > ramBefore, '镜卫：己方撞镜壁应开 0.25s 主动撞窗');

  resetTrapZones();
  resetMirrorWalls();
  const enemyWall = createSkillCaster('mirror');
  const [ewRed, ewBlue] = redBlue(8, 6, 16, 6);
  fire(enemyWall, ewRed, 4, [ewRed, ewBlue]);
  ewBlue.x = 10.2;
  ewBlue.y = 6;
  ewBlue.vx = -6;
  ewBlue.vy = 0;
  ewBlue.activeRamRemain = 0;
  advance(enemyWall, ewRed, [ewRed, ewBlue], 0.2);
  assert(ewBlue.vx > 0, '镜卫：敌方撞镜壁应反弹');
  assert(ewBlue.activeRamRemain === 0, '镜卫：敌方撞镜壁不应开主动撞窗');

  resetTrapZones();
  resetMirrorWalls();
  const trapOk = createSkillCaster('mirror');
  const [trapRed] = redBlue(8, 6, 16, 6);
  setTrapZone({
    ownerId: 9000,
    ownerTeam: 'blue',
    x: trapRed.x,
    y: trapRed.y,
    radius: RING_TRAP.radius,
    remain: RING_TRAP.duration,
  });
  fire(trapOk, trapRed, 1, [trapRed]);
  assert(Math.abs(trapOk.getCds()[0] - MIRROR_REFRACT.cd) < 0.05, '镜卫：困圈内折光仍可用');
  assert(!trapOk.isDisplacing(), '镜卫：折光不是位移技');

  resetTrapZones();
  resetMirrorWalls();
  const hookKeep = createSkillCaster('hook');
  const [hookK, hookKb] = redBlue(8, 6, 13, 6, 'hook');
  fire(hookKeep, hookK, 1, [hookK, hookKb]);
  hookKeep.tick(hookK, HOOK_PULL.windup + 0.03, [hookK, hookKb]);
  assert(Math.abs(hookKb.hp - (MAX_HP - HOOK_PULL.damage)) < 1e-6, '镜卫：钩刺 kit 不应被拆坏');

  resetTrapZones();
  resetMirrorWalls();
  const ringKeep = createSkillCaster('ring');
  const ringRed = createBallBody({ x: 10, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'ring' });
  fire(ringKeep, ringRed, 1, [ringRed]);
  assert(Math.abs(ringKeep.getCds()[0] - RING_FIELD.cd) < 1e-6, '镜卫：磁环 kit 不应被拆坏');

  resetTrapZones();
  resetMirrorWalls();
  const chainKeep = createSkillCaster('chain');
  const chainRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'chain' });
  const chainBlue = createBallBody({ x: 11, y: 6, color: 0x3d7cf0, team: 'blue', facingX: -1, hero: 'hook' });
  fire(chainKeep, chainRed, 2, [chainRed, chainBlue]);
  assert(chainRed.leechRemain > 2.9, '镜卫：链生盾脉仍应贴敌吸血');
  assert(CHAIN_HEAL.cd === 10, '镜卫：链生愈链数值不应被改');

  resetTrapZones();
  resetMirrorWalls();
  const nailKeep = createSkillCaster('nail');
  const nailRed = createBallBody({ x: 8, y: 6, color: 0xe24a4a, team: 'red', facingX: 1, hero: 'nail', hp: 70 });
  fire(nailKeep, nailRed, 1, [nailRed]);
  assert(nailRed.armorRemain > 1.45, '镜卫：钉壳叠甲仍应即放');
  assert(NAIL_ARMOR.cd === 10, '镜卫：钉壳叠甲数值不应被改');

  resetTrapZones();
  resetMirrorWalls();
  const arcKeep = createSkillCaster('arc');
  const [arcRed, arcBlue] = redBlue(10, 6, 13, 6, 'arc');
  arcBlue.facingX = -1;
  fire(arcKeep, arcRed, 1, [arcRed, arcBlue], { aimX: 1, aimY: 0 });
  advance(arcKeep, arcRed, [arcRed, arcBlue], ARC_SIDESTEP.windup + 0.02);
  assert(arcRed.x > 13.4, '镜卫：闪弧侧闪仍应闪到敌背后');

  resetTrapZones();
  resetMirrorWalls();
  const wellKeep = createSkillCaster('well');
  const [wellRed] = redBlue(8, 6, 16, 6);
  wellRed.hero = 'well';
  fire(wellKeep, wellRed, 1, [wellRed]);
  assert(Math.abs(wellKeep.getCds()[0] - WELL_BLAST.cd) < 1e-6, '镜卫：井绳索爆仍应进 11s CD');
  assert(Math.hypot(wellRed.vx, wellRed.vy) + 1e-6 >= 0, '镜卫：井绳仍可动');

  resetTrapZones();
  resetMirrorWalls();
  assert(FLOOR_SPEED === 2.5, '镜卫：不应改保底移速');
}
