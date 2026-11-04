import { createBallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import {
  ASSIST_SCORE,
  CONTROL_POINT,
  FLOOR_SPEED,
  KNOCKOUT_SCORE,
  MATCH_SCORE_LIMIT,
  MAX_HP,
  MIDPOINT_SCORE_PER_SEC,
  RESPAWN_SEC,
  SPAWN_INVINCIBLE_SEC,
} from './constants';
import {
  countTeamInPoint,
  createMatchRoster,
  createMatchSession,
  findAssistSource,
  inControlPoint,
  midpointHold,
} from './matchSession';
import { stepPhysics } from './physicsStep';

function hit(
  victim: ReturnType<typeof createBallBody>,
  source: ReturnType<typeof createBallBody>,
  damage = 20,
): CollisionHit {
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage,
    zone: 'front',
    coeff: 1,
    knockback: 0,
    relSpeed: 8,
    threshold: 4,
  };
}

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

/** 一局规则：击破/助攻、回场无敌、中点、加时与下次击破。 */
export function verifyM4(): void {
  assert(CONTROL_POINT.radius === 2.5, 'M4：中点半径应为 2.5');
  assert(CONTROL_POINT.x === 10 && CONTROL_POINT.y === 6, 'M4：中点应在地图中心');
  assert(midpointHold(2, 1) === 'red' && midpointHold(1, 1) === 'none', 'M4：中点须严格多数');
  const roster = createMatchRoster();
  assert(roster.length === 3 && roster[0].team === 'red' && roster[2].team === 'blue', 'M4：默认 1 红 vs 2 蓝 bot');

  const redA = createBallBody({
    x: 9,
    y: 6,
    color: 0xe24a4a,
    label: '红A',
    team: 'red',
  });
  const redB = createBallBody({
    x: 8,
    y: 6,
    color: 0xc43d3d,
    label: '红B',
    team: 'red',
  });
  const blue = createBallBody({
    x: 11,
    y: 6,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
  });
  const assistNow = 10;
  const marks = [
    { victimId: blue.id, sourceId: redA.id, at: assistNow - 1.2 },
    { victimId: blue.id, sourceId: redB.id, at: assistNow },
  ];
  const assist = findAssistSource(marks, blue.id, redB.id, 'red', assistNow, [redA, redB, blue]);
  assert(assist?.id === redA.id, 'M4：助攻应取击杀前 3s 内最近队友');
  const expired = findAssistSource(
    [{ victimId: blue.id, sourceId: redA.id, at: assistNow - 3.01 }],
    blue.id,
    redB.id,
    'red',
    assistNow,
    [redA, redB, blue],
  );
  assert(expired === null, 'M4：超过 3s 的碰撞伤不应助攻');

  const duo = [redA, redB, blue];
  for (const ball of duo) {
    ball.invincibleRemain = 0;
  }
  const assistMatch = createMatchSession(duo, { countdownSec: 0, playSec: 60 });
  for (const ball of duo) {
    ball.invincibleRemain = 0;
  }
  blue.hp = 0;
  assistMatch.tick(0, [hit(blue, redA, 8), hit(blue, redB, 20)]);
  let snap = assistMatch.snapshot();
  assert(snap.redScore === KNOCKOUT_SCORE + ASSIST_SCORE, `M4：击破+助攻应为 20，实得 ${snap.redScore}`);
  assert(!blue.inPlay, 'M4：击破后应离场');
  assert(Math.abs((snap.respawns[blue.id] ?? 0) - RESPAWN_SEC) < 1e-6, 'M4：离场后回场应为 8s');

  assistMatch.tick(RESPAWN_SEC, []);
  snap = assistMatch.snapshot();
  assert(blue.inPlay, 'M4：8s 后应回场');
  assert(blue.hp === blue.maxHp, 'M4：回场应满血');
  assert(Math.abs(blue.invincibleRemain - SPAWN_INVINCIBLE_SEC) < 1e-6, 'M4：回场应 2s 无敌');
  assert(Math.hypot(blue.x - blue.spawnX, blue.y - blue.spawnY) < 1e-6, 'M4：应在己方出生点回场');
  stepPhysics([blue], 1 / 60);
  assert(Math.hypot(blue.vx, blue.vy) + 1e-6 >= FLOOR_SPEED - 0.1, 'M4：回场后应能保底移动');

  const strayRed = createBallBody({ x: 5, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const strayBlue = createBallBody({ x: 15, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const stray = createMatchSession([strayRed, strayBlue], { countdownSec: 0, playSec: 30 });
  strayRed.invincibleRemain = 0;
  strayBlue.invincibleRemain = 0;
  strayBlue.hp = 0;
  stray.tick(0, []);
  assert(!strayBlue.inPlay, 'M4：0 血无当帧 hit 也应离场进回场');
  assert(Math.abs((stray.snapshot().respawns[strayBlue.id] ?? 0) - RESPAWN_SEC) < 1e-6, 'M4：扫到 0 血后回场仍为 8s');
  stray.tick(RESPAWN_SEC, []);
  assert(strayBlue.inPlay && strayBlue.hp === strayBlue.maxHp, 'M4：8s 后回场应有血');
  assert(strayBlue.invincibleRemain >= SPAWN_INVINCIBLE_SEC - 1e-6, 'M4：回场应 2s 无敌');
  stepPhysics([strayBlue], 1 / 60);
  assert(Math.hypot(strayBlue.vx, strayBlue.vy) + 1e-6 >= FLOOR_SPEED - 0.1, 'M4：回场后应可动');

  const soloRed = createBallBody({ x: 6, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const soloBlue = createBallBody({ x: 14, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const solo = createMatchSession([soloRed, soloBlue], { countdownSec: 0, playSec: 60 });
  soloRed.invincibleRemain = 0;
  soloBlue.invincibleRemain = 0;
  soloBlue.hp = 0;
  solo.tick(0, [hit(soloBlue, soloRed)]);
  assert(solo.snapshot().redScore === KNOCKOUT_SCORE, 'M4：无队友时只加击破 15');

  const invA = createBallBody({
    x: 9.45,
    y: 6,
    color: 0xe24a4a,
    label: '甲',
    team: 'red',
    vx: 8,
    facingX: 1,
  });
  const invB = createBallBody({
    x: 10.55,
    y: 6,
    color: 0x3d7cf0,
    label: '乙',
    team: 'blue',
    vx: -8,
    facingX: -1,
  });
  invA.invincibleRemain = 2;
  let invHits = 0;
  for (let i = 0; i < 20; i += 1) {
    invHits += stepPhysics([invA, invB], 1 / 60).hits.length;
  }
  assert(invHits === 0 && invA.hp === MAX_HP && invB.hp === MAX_HP, 'M4：无敌碰撞不应掉血');

  const midRed = createBallBody({
    x: CONTROL_POINT.x,
    y: CONTROL_POINT.y,
    color: 0xe24a4a,
    label: '红',
    team: 'red',
  });
  const midBlue = createBallBody({
    x: 2,
    y: 2,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
  });
  assert(inControlPoint(midRed) && !inControlPoint(midBlue), 'M4：区内判定应按圆心距');
  assert(countTeamInPoint([midRed, midBlue], 'red') === 1, 'M4：活人数应按在场且在圈');
  const midMatch = createMatchSession([midRed, midBlue], { countdownSec: 0, playSec: 30 });
  midRed.invincibleRemain = 0;
  midBlue.invincibleRemain = 0;
  midMatch.tick(1, []);
  assert(midMatch.snapshot().redScore === MIDPOINT_SCORE_PER_SEC, 'M4：区内人多一方每秒 +2');
  assert(midMatch.snapshot().midpoint === 'red', 'M4：HUD 中点归属应为红');

  midBlue.x = CONTROL_POINT.x;
  midBlue.y = CONTROL_POINT.y;
  midMatch.tick(1, []);
  assert(midMatch.snapshot().redScore === MIDPOINT_SCORE_PER_SEC, 'M4：人数相等中点不得分');

  const deadRed = createBallBody({
    x: CONTROL_POINT.x,
    y: CONTROL_POINT.y,
    color: 0xe24a4a,
    label: '红',
    team: 'red',
  });
  const liveBlue = createBallBody({
    x: CONTROL_POINT.x + 0.4,
    y: CONTROL_POINT.y,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
  });
  const sameFrame = createMatchSession([deadRed, liveBlue], { countdownSec: 0, playSec: 10 });
  deadRed.invincibleRemain = 0;
  liveBlue.invincibleRemain = 0;
  deadRed.hp = 0;
  sameFrame.tick(1, [hit(deadRed, liveBlue)]);
  const sameSnap = sameFrame.snapshot();
  assert(!deadRed.inPlay, 'M4：当帧击破应离场');
  assert(sameSnap.blueScore === KNOCKOUT_SCORE + MIDPOINT_SCORE_PER_SEC, 'M4：离场当帧不占中点人');

  const limitRed = createBallBody({ x: 4, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const limitBlue = createBallBody({ x: 16, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const limit = createMatchSession([limitRed, limitBlue], { countdownSec: 0, playSec: 240 });
  limit.debugAddScore('red', MATCH_SCORE_LIMIT);
  assert(limit.snapshot().phase === 'result' && limit.snapshot().winner === 'red', 'M4：先到 100 应立即结束');

  const timeRed = createBallBody({ x: 4, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const timeBlue = createBallBody({ x: 16, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const timed = createMatchSession([timeRed, timeBlue], { countdownSec: 0, playSec: 1.2 });
  timed.debugAddScore('blue', 6);
  timed.tick(1.3, []);
  assert(timed.snapshot().phase === 'result' && timed.snapshot().winner === 'blue', 'M4：到点应比总分');

  const otRed = createBallBody({
    x: CONTROL_POINT.x,
    y: CONTROL_POINT.y,
    color: 0xe24a4a,
    label: '红',
    team: 'red',
  });
  const otBlue = createBallBody({
    x: 16,
    y: 2,
    color: 0x3d7cf0,
    label: '蓝',
    team: 'blue',
  });
  const ot = createMatchSession([otRed, otBlue], { countdownSec: 0, playSec: 0.6, overtimeSec: 0.95 });
  otRed.invincibleRemain = 0;
  otBlue.invincibleRemain = 0;
  ot.tick(0.7, []);
  assert(ot.snapshot().phase === 'overtime', 'M4：到点平分应进加时');
  otBlue.hp = 0;
  ot.tick(0, [hit(otBlue, otRed)]);
  assert(ot.snapshot().redScore === 0, 'M4：加时击破不应加分');
  assert(!otBlue.inPlay, 'M4：加时击破仍离场');
  ot.tick(1, []);
  assert(ot.snapshot().redScore === MIDPOINT_SCORE_PER_SEC, 'M4：加时只计中点分');
  assert(ot.snapshot().phase === 'result' && ot.snapshot().winner === 'red', 'M4：加时分高者胜');

  const sdRed = createBallBody({ x: 6, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const sdBlue = createBallBody({ x: 14, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const sudden = createMatchSession([sdRed, sdBlue], {
    countdownSec: 0,
    playSec: 0.4,
    overtimeSec: 0.4,
  });
  sdRed.invincibleRemain = 0;
  sdBlue.invincibleRemain = 0;
  sudden.tick(0.5, []);
  sudden.tick(0.5, []);
  assert(sudden.snapshot().phase === 'overtime' && sudden.snapshot().suddenDeath, 'M4：加时再平应进下次击破');
  sdBlue.hp = 0;
  sudden.tick(0, [hit(sdBlue, sdRed)]);
  assert(sudden.snapshot().phase === 'result' && sudden.snapshot().winner === 'red', 'M4：再平后下次击破方胜');

  const cdRed = createBallBody({ x: 4, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const cdBlue = createBallBody({ x: 16, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const counted = createMatchSession([cdRed, cdBlue], { countdownSec: 0.5, playSec: 10 });
  assert(counted.snapshot().phase === 'countdown', 'M4：开局应为 Countdown');
  counted.tick(0.6, []);
  assert(counted.snapshot().phase === 'playing', 'M4：倒计时后应为 Playing');
  assert(cdRed.invincibleRemain > 0, 'M4：开局应无敌');

  const preRed = createBallBody({ x: 4, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const preBlue = createBallBody({ x: 16, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const pre = createMatchSession([preRed, preBlue], { countdownSec: 2, playSec: 10 });
  preBlue.hp = 0;
  pre.tick(0, [hit(preBlue, preRed)]);
  assert(preBlue.inPlay && preBlue.hp === preBlue.maxHp, 'M4：Countdown 内击破不离场');
  assert(pre.snapshot().redScore === 0, 'M4：Countdown 内不计击破分');
}
