import { createBallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import {
  ASSIST_SCORE,
  CONTROL_POINT,
  FLOOR_SPEED,
  KNOCKOUT_SCORE,
  MAP_HEIGHT,
  MAP_WIDTH,
  MATCH_COUNTDOWN_SEC,
  MATCH_SCORE_LIMIT,
  MAX_HP,
  MIDPOINT_SCORE_PER_SEC,
  OPENING_CHARGE_RAMP_SEC,
  OPENING_CHARGE_SEC,
  OPENING_CHARGE_SPEED,
  OPENING_CHARGE_START_SPEED,
  RESPAWN_SEC,
  SPAWN_INVINCIBLE_SEC,
  SPEED_CAP,
  STALL_DEPTH,
} from './constants';
import { applyOpeningCharge, chargeSpeedAt } from './openingCharge';
import {
  countTeamInPoint,
  createMatchRoster,
  createMatchSession,
  findAssistSource,
  inControlPoint,
  midpointHold,
} from './matchSession';
import { stepPhysics } from './physicsStep';
import { stallContains, stallForBall, stallsForBalls } from './stallFences';

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

/** 一局规则：击破/助攻、回场无敌、领地、加时与下次击破。 */
export function verifyM4(): void {
  assert(MAP_WIDTH === 20 && MAP_HEIGHT === 20, 'M4：地图应为 20×20');
  assert(CONTROL_POINT.radius === 2.5, 'M4：领地半径应为 2.5');
  assert(CONTROL_POINT.x === 10 && CONTROL_POINT.y === 10, 'M4：领地应在地图中心');
  assert(midpointHold(2, 1) === 'red' && midpointHold(1, 1) === 'none', 'M4：领地须严格多数');
  const roster = createMatchRoster();
  assert(roster.length === 4, 'M4：本机固定 2v2，场上应为 4 球');
  assert(roster[0].y < roster[1].y && roster[2].y < roster[3].y, 'M4：同队应上下两出生');
  for (const ball of roster) {
    const dx = CONTROL_POINT.x - ball.x;
    const dy = CONTROL_POINT.y - ball.y;
    const len = Math.hypot(dx, dy);
    const aligned = (ball.facingX * dx + ball.facingY * dy) / len;
    assert(aligned > 0.99, `M4：${ball.label} facing 应朝领地`);
  }
  assert(roster[0].team === 'red' && roster[0].teamSlot === 1 && roster[0].hero === 'hook', 'M4：红1 应为玩家钩刺');
  assert(roster[1].team === 'red' && roster[1].teamSlot === 2 && roster[1].hero === 'chain', 'M4：红2 默认链生');
  assert(roster[2].team === 'blue' && roster[2].teamSlot === 1 && roster[2].hero === 'ring', 'M4：蓝1 默认磁环');
  assert(roster[3].team === 'blue' && roster[3].teamSlot === 2 && roster[3].hero === 'hook', 'M4：蓝2 默认钩刺');
  assert(
    roster[0].label === '红1' && roster[1].label === '红2' && roster[2].label === '蓝1' && roster[3].label === '蓝2',
    'M4：编号标签应为 红1/红2/蓝1/蓝2',
  );

  const scored = createMatchRoster();
  const [scoreRed1, scoreRed2, scoreBlue1, scoreBlue2] = scored;
  const scoredMatch = createMatchSession(scored, { countdownSec: 0, playSec: 60 });
  for (const ball of scored) {
    ball.invincibleRemain = 0;
  }
  scoreBlue1.hp = 0;
  scoredMatch.tick(0, [hit(scoreBlue1, scoreRed2, 20), hit(scoreBlue1, scoreRed1, 8)]);
  assert(scoredMatch.snapshot().redScore === KNOCKOUT_SCORE + ASSIST_SCORE, 'M4：红2 击破应给分，红1 助攻认队友');
  assert(scoreRed2.teamSlot === 2 && scoreRed1.teamSlot === 1, 'M4：击破后编号仍为 红1/红2');
  scoreRed1.x = CONTROL_POINT.x;
  scoreRed1.y = CONTROL_POINT.y;
  scoreRed2.x = CONTROL_POINT.x + 0.4;
  scoreRed2.y = CONTROL_POINT.y;
  scoreBlue2.x = 2;
  scoreBlue2.y = 2;
  const holdBefore = scoredMatch.snapshot().redHoldScore;
  scoredMatch.tick(1, []);
  assert(scoredMatch.snapshot().redHoldScore === holdBefore + MIDPOINT_SCORE_PER_SEC, 'M4：红双人占优应刷领地分');

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
  assert(snap.redBreakScore === KNOCKOUT_SCORE + ASSIST_SCORE && snap.redHoldScore === 0, 'M4：击破分应与领地分拆开');
  assert(!blue.inPlay, 'M4：击破后应离场');
  assert(Math.abs((snap.respawns[blue.id] ?? 0) - RESPAWN_SEC) < 1e-6, 'M4：离场后回场应为 5s');

  assistMatch.tick(RESPAWN_SEC, []);
  snap = assistMatch.snapshot();
  assert(blue.inPlay, 'M4：5s 后应回场');
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
  assert(Math.abs((stray.snapshot().respawns[strayBlue.id] ?? 0) - RESPAWN_SEC) < 1e-6, 'M4：扫到 0 血后回场仍为 5s');
  stray.tick(RESPAWN_SEC, []);
  assert(strayBlue.inPlay && strayBlue.hp === strayBlue.maxHp, 'M4：5s 后回场应有血');
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
  assert(Math.abs(midMatch.snapshot().elapsedSec - 1) < 1e-6, 'M4：开战应用时应累加');
  assert(midMatch.snapshot().redScore === MIDPOINT_SCORE_PER_SEC, 'M4：区内人多一方每秒 +2');
  assert(midMatch.snapshot().redHoldScore === MIDPOINT_SCORE_PER_SEC, 'M4：领地分应计入分项');
  assert(midMatch.snapshot().redBreakScore === 0, 'M4：领地分不应记进击破');
  assert(midMatch.snapshot().midpoint === 'red', 'M4：HUD 领地归属应为红');

  midBlue.x = CONTROL_POINT.x;
  midBlue.y = CONTROL_POINT.y;
  midMatch.tick(1, []);
  assert(midMatch.snapshot().redScore === MIDPOINT_SCORE_PER_SEC, 'M4：人数相等领地不得分');

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
  assert(sameSnap.blueScore === KNOCKOUT_SCORE + MIDPOINT_SCORE_PER_SEC, 'M4：离场当帧不占领地点人');
  assert(sameSnap.blueBreakScore === KNOCKOUT_SCORE && sameSnap.blueHoldScore === MIDPOINT_SCORE_PER_SEC, 'M4：击破与领地分项应分开');

  const limitRed = createBallBody({ x: 4, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const limitBlue = createBallBody({ x: 16, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const limit = createMatchSession([limitRed, limitBlue], { countdownSec: 0, playSec: 240 });
  limit.debugAddScore('red', MATCH_SCORE_LIMIT);
  const limitSnap = limit.snapshot();
  assert(limitSnap.phase === 'result' && limitSnap.winner === 'red', 'M4：先到 100 应立即结束');
  assert(limitSnap.finishReason === '先到分', 'M4：结算应记下先到分');

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
  assert(ot.snapshot().redScore === MIDPOINT_SCORE_PER_SEC, 'M4：加时只计领地分');
  assert(ot.snapshot().redHoldScore === MIDPOINT_SCORE_PER_SEC && ot.snapshot().redBreakScore === 0, 'M4：加时领地分项应为 +2');
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
  assert(counted.snapshot().stallsOn && counted.snapshot().skillsLocked, 'M4：Stall 倒计时应锁栏并禁技能');
  counted.tick(0.6, []);
  assert(counted.snapshot().phase === 'playing', 'M4：倒计时后应为 Playing');
  assert(cdRed.invincibleRemain > 0, 'M4：开局应无敌');
  assert(counted.snapshot().openingChargeRemain > 0, 'M4：倒计时后应进入冲锋');
  assert(!counted.snapshot().stallsOn, 'M4：冲锋时围栏应消失');

  const preRed = createBallBody({ x: 4, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const preBlue = createBallBody({ x: 16, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  const pre = createMatchSession([preRed, preBlue], { countdownSec: 2, playSec: 10 });
  preBlue.hp = 0;
  pre.tick(0, [hit(preBlue, preRed)]);
  assert(preBlue.inPlay && preBlue.hp === preBlue.maxHp, 'M4：Countdown 内击破不离场');
  assert(pre.snapshot().redScore === 0, 'M4：Countdown 内不计击破分');

  assert(MATCH_COUNTDOWN_SEC === 5 && OPENING_CHARGE_SEC === 1, 'M4：Stall 应为 5s、冲锋 1s');
  assert(OPENING_CHARGE_SPEED === 7.5 && SPEED_CAP === 8, 'M4：冲锋峰值应为 7.5，上限仍 8');
  assert(OPENING_CHARGE_RAMP_SEC === 0.2, 'M4：冲锋前段拉升应为 0.2s');
  assert(Math.abs(chargeSpeedAt(OPENING_CHARGE_SEC) - OPENING_CHARGE_START_SPEED) < 1e-6, 'M4：栏开瞬间应为起步速');
  assert(Math.abs(chargeSpeedAt(OPENING_CHARGE_SEC - OPENING_CHARGE_RAMP_SEC) - OPENING_CHARGE_SPEED) < 1e-6, 'M4：0.2s 后应到峰值');

  const ritualRoster = createMatchRoster();
  const ritualRed = ritualRoster[0];
  const ritualAlly = ritualRoster[1];
  const ritualBlue = ritualRoster.find((ball) => ball.team === 'blue');
  if (!ritualBlue) {
    throw new Error('M4：2v2 roster 应有蓝方');
  }
  const ritual = createMatchSession(ritualRoster);
  const ritualSnap = ritual.snapshot();
  assert(ritualSnap.phase === 'countdown' && ritualSnap.stallsOn, 'M4：默认开局应在 Stall');
  assert(
    ritualRed.spawnX < STALL_DEPTH && ritualBlue.spawnX > MAP_WIDTH - STALL_DEPTH,
    'M4：出生应在各队半场底线',
  );
  const ritualStalls = stallsForBalls(ritualRoster);
  const redFence = stallForBall(ritualRed, ritualStalls);
  const blueFence = stallForBall(ritualBlue, ritualStalls);
  if (!redFence || !stallContains(redFence, ritualRed.x, ritualRed.y)) {
    throw new Error('M4：红应困在左底围栏');
  }
  if (!stallContains(redFence, ritualAlly.x, ritualAlly.y)) {
    throw new Error('M4：红2 也应困在左底围栏');
  }
  if (!blueFence || !stallContains(blueFence, ritualBlue.x, ritualBlue.y)) {
    throw new Error('M4：蓝应困在右底围栏');
  }
  assert(redFence.openToward === 1 && redFence.maxX <= STALL_DEPTH + 1e-6, 'M4：红栏应贴左底且开口朝右');
  assert(
    blueFence.openToward === -1 && blueFence.minX >= MAP_WIDTH - STALL_DEPTH - 1e-6,
    'M4：蓝栏应贴右底且开口朝左',
  );
  ritualRed.vx = -10;
  ritualRed.vy = 0;
  for (let i = 0; i < 24; i += 1) {
    stepPhysics(ritualRoster, 1 / 60, { stalls: ritualSnap.stalls });
  }
  assert(ritualRed.x >= redFence.minX + ritualRed.radius - 0.02, 'M4：栏内不可出');

  assert(ritual.skipOpening(), 'M4：应能跳过 Stall');
  const skipped = ritual.snapshot();
  assert(skipped.phase === 'playing' && !skipped.stallsOn, 'M4：跳过后应进 Playing 并清栏');
  assert(Math.abs(skipped.openingChargeRemain - OPENING_CHARGE_SEC) < 1e-6, 'M4：跳过后应进入 1s 冲锋');
  assert(Math.abs(ritualRed.invincibleRemain - OPENING_CHARGE_SEC) < 1e-6, 'M4：冲锋无敌应为 1s 而非叠成 4s');
  assert(
    skipped.events.every((event) => event.text !== '冲锋'),
    'M4：进入冲锋不应出说明 toast',
  );
  assert(Math.abs(Math.hypot(ritualRed.vx, ritualRed.vy) - OPENING_CHARGE_START_SPEED) < 0.08, 'M4：栏开瞬间应为起步速');
  assert(Math.abs(Math.hypot(ritualAlly.vx, ritualAlly.vy) - OPENING_CHARGE_START_SPEED) < 0.08, 'M4：红2 栏开也应起步');
  applyOpeningCharge(ritualRed, 0, OPENING_CHARGE_SEC - OPENING_CHARGE_RAMP_SEC);
  assert(Math.abs(Math.hypot(ritualRed.vx, ritualRed.vy) - OPENING_CHARGE_SPEED) < 0.08, 'M4：0.2s 后应拉到峰值 7.5');
  assert(Math.hypot(ritualRed.vx, ritualRed.vy) <= SPEED_CAP + 1e-6, 'M4：冲锋不得超过上限 8');

  for (let i = 0; i < 70; i += 1) {
    stepPhysics(ritualRoster, 1 / 60);
    ritual.tick(1 / 60, []);
  }
  assert(ritual.snapshot().openingChargeRemain === 0, 'M4：冲锋 1s 后应结束');
  assert(ritualRed.invincibleRemain < 0.08, 'M4：冲锋结束不应再叠一段开局无敌');
  assert(!ritual.snapshot().skillsLocked, 'M4：冲锋结束后技能应可用');
}
