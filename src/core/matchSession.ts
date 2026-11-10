import { clearKitAuras, clearPotionBuffs, createBallBody, grantInvincible, type BallBody, type TeamId } from './ballBody';
import { clearUltEnergy } from './ultEnergy';
import { pickRandomHero, type HeroId } from '../heroes/heroIds';
import type { CollisionHit } from './collisionDamage';
import {
  ASSIST_SCORE,
  ASSIST_WINDOW_SEC,
  BLUE_SPAWNS,
  CONTROL_POINT,
  DEBUG_CLOCK_SCALE,
  EIGHT_KILL_LIMIT,
  EIGHT_KILL_RIFT_ENABLED,
  facingTowardControl,
  KNOCKOUT_SCORE,
  MATCH_COUNTDOWN_SEC,
  MATCH_OVERTIME_SEC,
  MATCH_PLAY_SEC,
  MATCH_SCORE_LIMIT,
  MIDPOINT_SCORE_PER_SEC,
  MIDPOINT_TICK_SEC,
  OPENING_CHARGE_SEC,
  RED_SPAWNS,
  RESPAWN_SEC,
  SPAWN_INVINCIBLE_SEC,
} from './constants';
import { DEFAULT_MATCH_MODE, isEightKill, type MatchModeId } from './matchMode';
import type { HealPulse } from './combatFloat';
import { snapChargeFacing } from './openingCharge';
import { createPotionField, POTION_KIND_LABEL, type PotionPickup } from './potionField';
import { createRiftHazard, type RiftSnapshot } from './riftHazard';
import { stallsForBalls, type StallFence } from './stallFences';
import { clearHookBleeds } from './hookBleed';

export type MatchPhase = 'countdown' | 'playing' | 'overtime' | 'result';
export type MidpointHold = 'red' | 'blue' | 'none';
export type MatchWinner = TeamId | null;

export type MatchConfig = {
  countdownSec?: number;
  playSec?: number;
  overtimeSec?: number;
  scoreLimit?: number;
  clockScale?: number;
  mode?: MatchModeId;
  random?: () => number;
  practice?: boolean;
};

export type MatchEvent = {
  kind: 'knockout' | 'assist' | 'midpoint' | 'phase' | 'score' | 'potion';
  text: string;
  team?: TeamId;
  points?: number;
};

export type MatchSnapshot = {
  phase: MatchPhase;
  timeLeft: number;
  suddenDeath: boolean;
  mode: MatchModeId;
  redScore: number;
  blueScore: number;
  redKills: number;
  blueKills: number;
  redBreakScore: number;
  blueBreakScore: number;
  redHoldScore: number;
  blueHoldScore: number;
  elapsedSec: number;
  finishReason: string;
  midpoint: MidpointHold;
  winner: MatchWinner;
  events: MatchEvent[];
  respawns: Record<number, number>;
  stallsOn: boolean;
  stalls: StallFence[];
  openingChargeRemain: number;
  skillsLocked: boolean;
  potion: PotionPickup | null;
  rift: RiftSnapshot | null;
  matchId: string;
  practice: boolean;
};

type DamageMark = {
  victimId: number;
  sourceId: number;
  at: number;
};

export function inControlPoint(ball: BallBody): boolean {
  const dx = ball.x - CONTROL_POINT.x;
  const dy = ball.y - CONTROL_POINT.y;
  return Math.hypot(dx, dy) <= CONTROL_POINT.radius;
}

export function countTeamInPoint(balls: readonly BallBody[], team: TeamId): number {
  let n = 0;
  for (const ball of balls) {
    if (ball.inPlay && ball.team === team && inControlPoint(ball)) {
      n += 1;
    }
  }
  return n;
}

export function midpointHold(redCount: number, blueCount: number): MidpointHold {
  if (redCount > blueCount) {
    return 'red';
  }
  if (blueCount > redCount) {
    return 'blue';
  }
  return 'none';
}

export function findAssistSource(
  marks: readonly DamageMark[],
  victimId: number,
  killerId: number,
  killerTeam: TeamId,
  now: number,
  balls: readonly BallBody[],
  windowSec = ASSIST_WINDOW_SEC,
): BallBody | null {
  let best: DamageMark | null = null;
  for (const mark of marks) {
    if (mark.victimId !== victimId || mark.sourceId === killerId) {
      continue;
    }
    if (now - mark.at > windowSec || now - mark.at < 0) {
      continue;
    }
    const source = balls.find((ball) => ball.id === mark.sourceId);
    if (!source || source.team !== killerTeam) {
      continue;
    }
    if (!best || mark.at > best.at) {
      best = mark;
    }
  }
  return best ? (balls.find((ball) => ball.id === best.sourceId) ?? null) : null;
}

export type MatchRosterKits = {
  player: HeroId;
  ally: HeroId;
  blue1: HeroId;
  blue2: HeroId;
};

export type MatchRosterKitOpts = Partial<MatchRosterKits>;

/** 红1 用玩家缺省；红2 / 蓝1 / 蓝2 从含镜卫全池均匀随机，允许同局重复。 */
export function pickMatchRosterKits(
  player: HeroId = 'hook',
  random: () => number = Math.random,
): MatchRosterKits {
  return {
    player,
    ally: pickRandomHero(random),
    blue1: pickRandomHero(random),
    blue2: pickRandomHero(random),
  };
}

/** 本机固定 2v2：红1 玩家 + 红2 简 bot vs 蓝1/蓝2 简 bot；未指定的 bot kit 开局随机。 */
export function createMatchRoster(
  kits: MatchRosterKitOpts = {},
  random: () => number = Math.random,
): BallBody[] {
  const resolved: MatchRosterKits = {
    player: kits.player ?? 'hook',
    ally: kits.ally ?? pickRandomHero(random),
    blue1: kits.blue1 ?? pickRandomHero(random),
    blue2: kits.blue2 ?? pickRandomHero(random),
  };
  const reds = RED_SPAWNS.map((spawn, i) =>
    createRosterBall({
      x: spawn.x,
      y: spawn.y,
      facingX: spawn.facingX,
      facingY: spawn.facingY,
      color: i === 0 ? 0xe24a4a : 0xc43d3d,
      label: `红${i + 1}`,
      team: 'red',
      teamSlot: i + 1,
      hero: i === 0 ? resolved.player : resolved.ally,
    }),
  );
  const blues = BLUE_SPAWNS.map((spawn, i) =>
    createRosterBall({
      x: spawn.x,
      y: spawn.y,
      facingX: spawn.facingX,
      facingY: spawn.facingY,
      color: i === 0 ? 0x3d7cf0 : 0x4f9bff,
      label: `蓝${i + 1}`,
      team: 'blue',
      teamSlot: i + 1,
      hero: i === 0 ? resolved.blue1 : resolved.blue2,
    }),
  );
  return [...reds, ...blues];
}

function createRosterBall(init: {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  color: number;
  label: string;
  team: TeamId;
  teamSlot: number;
  hero?: HeroId;
}): BallBody {
  return createBallBody({
    x: init.x,
    y: init.y,
    facingX: init.facingX,
    facingY: init.facingY,
    color: init.color,
    label: init.label,
    team: init.team,
    teamSlot: init.teamSlot,
    spawnX: init.x,
    spawnY: init.y,
    hero: init.hero,
  });
}

let nextMatchSeq = 1;

function allocMatchId(): string {
  const id = `m${nextMatchSeq}`;
  nextMatchSeq += 1;
  return id;
}

function resetBall(ball: BallBody, openingInvincible: number): void {
  ball.x = ball.spawnX;
  ball.y = ball.spawnY;
  ball.vx = 0;
  ball.vy = 0;
  ball.hp = ball.maxHp;
  ball.inPlay = true;
  ball.activeRamRemain = 0;
  ball.spearCdRemain = 0;
  ball.fineTuneRemain = 0;
  ball.invincibleRemain = openingInvincible;
  ball.stunRemain = 0;
  ball.lastHardCcAt = -1e9;
  ball.frictionMul = 1;
  ball.allowOverCap = false;
  ball.suppressCombat = false;
  ball.hasAim = false;
  clearKitAuras(ball);
  clearPotionBuffs(ball);
  clearUltEnergy(ball);
  const face = facingTowardControl(ball.x, ball.y);
  ball.facingX = face.facingX;
  ball.facingY = face.facingY;
  ball.aimX = face.facingX;
  ball.aimY = face.facingY;
}

export function createMatchSession(balls: BallBody[], config: MatchConfig = {}) {
  const countdownSec = config.countdownSec ?? MATCH_COUNTDOWN_SEC;
  const playSec = config.playSec ?? MATCH_PLAY_SEC;
  const overtimeSec = config.overtimeSec ?? MATCH_OVERTIME_SEC;
  const scoreLimit = config.scoreLimit ?? MATCH_SCORE_LIMIT;
  const clockScale = config.clockScale ?? DEBUG_CLOCK_SCALE;
  let mode: MatchModeId = config.mode ?? DEFAULT_MATCH_MODE;
  let practice = !!config.practice;
  let matchId = allocMatchId();
  const rng = config.random ?? Math.random;
  const potions = createPotionField(rng);
  const rift = createRiftHazard(rng);

  let phase: MatchPhase = countdownSec > 0 ? 'countdown' : 'playing';
  let timeLeft = countdownSec > 0 ? countdownSec : playSec;
  let suddenDeath = false;
  let redScore = 0;
  let blueScore = 0;
  let redKills = 0;
  let blueKills = 0;
  let redBreakScore = 0;
  let blueBreakScore = 0;
  let redHoldScore = 0;
  let blueHoldScore = 0;
  let elapsedSec = 0;
  let finishReason = '';
  let hold: MidpointHold = 'none';
  let winner: MatchWinner = null;
  let now = 0;
  let midpointAcc = 0;
  const respawns: Record<number, number> = {};
  const marks: DamageMark[] = [];
  const recent: MatchEvent[] = [];
  const potionHeals: HealPulse[] = [];
  const extraHits: CollisionHit[] = [];
  const openingStalls = stallsForBalls(balls);
  let openingChargeRemain = 0;

  const openingInvincible =
    countdownSec > 0 ? countdownSec : SPAWN_INVINCIBLE_SEC;

  const pushEvent = (event: MatchEvent): void => {
    recent.unshift(event);
    if (recent.length > 6) {
      recent.length = 6;
    }
  };

  const addBreakdown = (team: TeamId, points: number, kind: MatchEvent['kind']): void => {
    if (kind === 'knockout' || kind === 'assist') {
      if (team === 'red') {
        redBreakScore += points;
      } else {
        blueBreakScore += points;
      }
      return;
    }
    if (kind === 'midpoint') {
      if (team === 'red') {
        redHoldScore += points;
      } else {
        blueHoldScore += points;
      }
    }
  };

  const addScore = (team: TeamId, points: number, event: MatchEvent): void => {
    if (points === 0) {
      return;
    }
    if (team === 'red') {
      redScore += points;
    } else {
      blueScore += points;
    }
    addBreakdown(team, points, event.kind);
    pushEvent(event);
  };

  const teamOf = (ball: BallBody | undefined): TeamId | null => ball?.team ?? null;

  const tryFinishByScore = (): boolean => {
    if (isEightKill(mode) || suddenDeath) {
      return false;
    }
    if (redScore === blueScore) {
      return false;
    }
    if (Math.max(redScore, blueScore) < scoreLimit) {
      return false;
    }
    finish(redScore > blueScore ? 'red' : 'blue', '先到分');
    return true;
  };

  const tryFinishByKills = (): boolean => {
    if (!isEightKill(mode) || phase !== 'playing') {
      return false;
    }
    if (redKills === blueKills) {
      return false;
    }
    if (Math.max(redKills, blueKills) < EIGHT_KILL_LIMIT) {
      return false;
    }
    finish(redKills > blueKills ? 'red' : 'blue', '先到8杀');
    return true;
  };

  const tryFinishOtKill = (): boolean => {
    if (!isEightKill(mode) || phase !== 'overtime') {
      return false;
    }
    if (redKills === blueKills) {
      return false;
    }
    finish(redKills > blueKills ? 'red' : 'blue', '加时超前');
    return true;
  };

  const teamHp = (team: TeamId): number => {
    let hp = 0;
    for (const ball of balls) {
      if (ball.team !== team) {
        continue;
      }
      hp += ball.inPlay ? Math.max(0, ball.hp) : 0;
    }
    return hp;
  };

  const finishByHp = (): void => {
    const redHp = teamHp('red');
    const blueHp = teamHp('blue');
    if (redHp > blueHp) {
      finish('red', '剩余血量');
      return;
    }
    if (blueHp > redHp) {
      finish('blue', '剩余血量');
      return;
    }
    phase = 'result';
    winner = null;
    finishReason = '加时血量仍平';
    timeLeft = 0;
    suddenDeath = false;
    for (const ball of balls) {
      if (ball.inPlay) {
        grantInvincible(ball, 60);
      }
    }
    pushEvent({ kind: 'phase', text: '平局 · 加时血量仍平' });
  };

  const finish = (team: TeamId, reason: string): void => {
    phase = 'result';
    winner = team;
    finishReason = reason;
    timeLeft = 0;
    suddenDeath = false;
    for (const ball of balls) {
      if (ball.inPlay) {
        grantInvincible(ball, 60);
      }
    }
    pushEvent({ kind: 'phase', text: `${team === 'red' ? '红' : '蓝'}方胜 · ${reason}`, team });
  };

  const finishByTime = (): void => {
    const redVal = isEightKill(mode) ? redKills : redScore;
    const blueVal = isEightKill(mode) ? blueKills : blueScore;
    if (redVal > blueVal) {
      finish('red', phase === 'overtime' ? '加时' : '时间到');
      return;
    }
    if (blueVal > redVal) {
      finish('blue', phase === 'overtime' ? '加时' : '时间到');
    }
  };

  const parkOut = (ball: BallBody): void => {
    ball.inPlay = false;
    ball.hp = 0;
    ball.vx = 0;
    ball.vy = 0;
    ball.activeRamRemain = 0;
    ball.spearCdRemain = 0;
    ball.fineTuneRemain = 0;
    ball.stunRemain = 0;
    ball.frictionMul = 1;
    ball.allowOverCap = false;
    ball.suppressCombat = false;
    ball.hasAim = false;
    clearKitAuras(ball);
    clearPotionBuffs(ball);
    respawns[ball.id] = RESPAWN_SEC;
  };

  const respawnBall = (ball: BallBody): void => {
    delete respawns[ball.id];
    ball.x = ball.spawnX;
    ball.y = ball.spawnY;
    ball.vx = 0;
    ball.vy = 0;
    ball.hp = ball.maxHp;
    ball.inPlay = true;
    ball.activeRamRemain = 0;
    ball.spearCdRemain = 0;
    ball.fineTuneRemain = 0;
    ball.stunRemain = 0;
    ball.frictionMul = 1;
    ball.allowOverCap = false;
    ball.suppressCombat = false;
    ball.hasAim = false;
    clearKitAuras(ball);
    clearPotionBuffs(ball);
    grantInvincible(ball, SPAWN_INVINCIBLE_SEC);
    if (ball.team === 'blue') {
      ball.facingX = -1;
      ball.facingY = 0;
    } else if (ball.team === 'red') {
      ball.facingX = 1;
      ball.facingY = 0;
    }
  };

  const latestMarkSource = (victimId: number): BallBody | null => {
    let best: DamageMark | null = null;
    for (const mark of marks) {
      if (mark.victimId !== victimId) {
        continue;
      }
      if (!best || mark.at > best.at) {
        best = mark;
      }
    }
    return best ? (balls.find((ball) => ball.id === best.sourceId) ?? null) : null;
  };

  const resolveKnockout = (victim: BallBody, source: BallBody | null, seen: Set<number>): void => {
    if (!victim.inPlay || victim.hp > 0 || seen.has(victim.id)) {
      return;
    }
    seen.add(victim.id);
    parkOut(victim);
    if (!source) {
      pushEvent({ kind: 'knockout', text: `${victim.label}被击破` });
      return;
    }
    const killerTeam = teamOf(source);
    const victimTeam = teamOf(victim);
    if (!killerTeam || !victimTeam || killerTeam === victimTeam) {
      pushEvent({ kind: 'knockout', text: `${source.label}击破${victim.label}` });
      return;
    }

    if (isEightKill(mode)) {
      if (killerTeam === 'red') {
        redKills += 1;
      } else {
        blueKills += 1;
      }
      pushEvent({
        kind: 'knockout',
        team: killerTeam,
        text: `${source.label}击破${victim.label} · ${killerTeam === 'red' ? '红' : '蓝'} ${killerTeam === 'red' ? redKills : blueKills}杀`,
      });
      if (phase === 'overtime') {
        tryFinishOtKill();
        return;
      }
      tryFinishByKills();
      return;
    }

    if (suddenDeath) {
      pushEvent({
        kind: 'knockout',
        text: `${source.label}击破${victim.label} · 加时定胜负`,
        team: killerTeam,
      });
      finish(killerTeam, '下次击破');
      return;
    }

    if (phase === 'playing') {
      addScore(killerTeam, KNOCKOUT_SCORE, {
        kind: 'knockout',
        team: killerTeam,
        points: KNOCKOUT_SCORE,
        text: `${source.label}击破${victim.label} +${KNOCKOUT_SCORE}`,
      });
      const assist = findAssistSource(marks, victim.id, source.id, killerTeam, now, balls);
      if (assist && assist.team === killerTeam) {
        addScore(killerTeam, ASSIST_SCORE, {
          kind: 'assist',
          team: killerTeam,
          points: ASSIST_SCORE,
          text: `${assist.label}助攻 +${ASSIST_SCORE}`,
        });
      }
      tryFinishByScore();
      return;
    }

    pushEvent({
      kind: 'knockout',
      team: killerTeam,
      text: `${source.label}击破${victim.label}（加时不计击破分）`,
    });
  };

  const processKnockouts = (hits: readonly CollisionHit[]): void => {
    for (const hit of hits) {
      if (hit.damage <= 0 || hit.environment) {
        continue;
      }
      marks.push({ victimId: hit.victimId, sourceId: hit.sourceId, at: now });
    }
    if (marks.length > 64) {
      marks.splice(0, marks.length - 64);
    }

    if (phase === 'countdown') {
      for (const ball of balls) {
        if (ball.hp <= 0) {
          ball.hp = ball.maxHp;
        }
      }
      return;
    }

    const seen = new Set<number>();
    for (const hit of hits) {
      const victim = balls.find((ball) => ball.id === hit.victimId);
      if (!victim) {
        continue;
      }
      if (hit.environment) {
        resolveKnockout(victim, null, seen);
        continue;
      }
      const source = balls.find((ball) => ball.id === hit.sourceId);
      resolveKnockout(victim, source ?? null, seen);
    }
    for (const ball of balls) {
      if (!ball.inPlay || ball.hp > 0) {
        continue;
      }
      resolveKnockout(ball, latestMarkSource(ball.id), seen);
    }
  };

  const tickRespawns = (dt: number): void => {
    for (const ball of balls) {
      if (ball.inPlay) {
        continue;
      }
      const remain = (respawns[ball.id] ?? 0) - dt;
      if (remain > 0) {
        respawns[ball.id] = remain;
        continue;
      }
      respawnBall(ball);
    }
  };

  const tickMidpoint = (dt: number): void => {
    if (isEightKill(mode)) {
      hold = 'none';
      midpointAcc = 0;
      return;
    }
    const redN = countTeamInPoint(balls, 'red');
    const blueN = countTeamInPoint(balls, 'blue');
    hold = midpointHold(redN, blueN);

    const scoring = phase === 'playing' || (phase === 'overtime' && !suddenDeath);
    if (!scoring) {
      midpointAcc = 0;
      return;
    }
    midpointAcc += dt;
    while (midpointAcc >= MIDPOINT_TICK_SEC) {
      midpointAcc -= MIDPOINT_TICK_SEC;
      const redNow = countTeamInPoint(balls, 'red');
      const blueNow = countTeamInPoint(balls, 'blue');
      hold = midpointHold(redNow, blueNow);
      if (hold === 'none') {
        continue;
      }
      addScore(hold, MIDPOINT_SCORE_PER_SEC, {
        kind: 'midpoint',
        team: hold,
        points: MIDPOINT_SCORE_PER_SEC,
        text: `领地 ${hold === 'red' ? '红' : '蓝'} +${MIDPOINT_SCORE_PER_SEC}`,
      });
      if (tryFinishByScore()) {
        return;
      }
    }
  };

  const beginCharge = (): void => {
    openingChargeRemain = OPENING_CHARGE_SEC;
    for (const ball of balls) {
      if (!ball.inPlay) {
        continue;
      }
      ball.invincibleRemain = OPENING_CHARGE_SEC;
      snapChargeFacing(ball);
    }
  };

  const enterPlaying = (): void => {
    phase = 'playing';
    timeLeft = playSec;
    suddenDeath = false;
    beginCharge();
  };

  const skipOpening = (): boolean => {
    if (phase !== 'countdown') {
      return false;
    }
    enterPlaying();
    return true;
  };

  const enterOvertime = (): void => {
    phase = 'overtime';
    timeLeft = overtimeSec;
    suddenDeath = false;
    midpointAcc = 0;
    pushEvent({
      kind: 'phase',
      text: isEightKill(mode) ? '加时 30 秒 · 先超前 1 杀' : '加时 30 秒 · 只计领地分',
    });
  };

  const enterSuddenDeath = (): void => {
    suddenDeath = true;
    timeLeft = 0;
    midpointAcc = 0;
    pushEvent({ kind: 'phase', text: '加时再平 · 下次击破方胜' });
  };

  const tickPhase = (dt: number): void => {
    if (phase === 'result') {
      return;
    }
    if (phase === 'overtime' && suddenDeath) {
      return;
    }
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft > 0) {
      return;
    }
    if (phase === 'countdown') {
      enterPlaying();
      return;
    }
    if (phase === 'playing') {
      if (isEightKill(mode)) {
        if (redKills !== blueKills) {
          finishByTime();
          return;
        }
        enterOvertime();
        return;
      }
      if (redScore !== blueScore) {
        finishByTime();
        return;
      }
      enterOvertime();
      return;
    }
    if (phase === 'overtime') {
      if (isEightKill(mode)) {
        if (redKills !== blueKills) {
          finishByTime();
          return;
        }
        finishByHp();
        return;
      }
      if (redScore !== blueScore) {
        finishByTime();
        return;
      }
      enterSuddenDeath();
    }
  };

  const applyReset = (): void => {
    matchId = allocMatchId();
    clearHookBleeds();
    phase = countdownSec > 0 ? 'countdown' : 'playing';
    timeLeft = countdownSec > 0 ? countdownSec : playSec;
    suddenDeath = false;
    redScore = 0;
    blueScore = 0;
    redKills = 0;
    blueKills = 0;
    redBreakScore = 0;
    blueBreakScore = 0;
    redHoldScore = 0;
    blueHoldScore = 0;
    potions.reset();
    rift.reset();
    elapsedSec = 0;
    finishReason = '';
    openingChargeRemain = 0;
    hold = 'none';
    winner = null;
    now = 0;
    midpointAcc = 0;
    marks.length = 0;
    recent.length = 0;
    potionHeals.length = 0;
    extraHits.length = 0;
    for (const key of Object.keys(respawns)) {
      delete respawns[Number(key)];
    }
    for (const ball of balls) {
      resetBall(ball, openingInvincible);
    }
  };

  applyReset();

  return {
    tick(dt: number, hits: readonly CollisionHit[]): MatchEvent[] {
      if (phase === 'result') {
        return [];
      }
      const clockDt = Math.max(0, dt) * Math.max(0, clockScale);
      const before = recent.length;
      now += clockDt;
      if (phase === 'playing' || phase === 'overtime') {
        elapsedSec += clockDt;
      }
      processKnockouts(hits);
      tickRespawns(clockDt);
      tickMidpoint(clockDt);
      const fieldOn =
        isEightKill(mode) && (phase === 'playing' || phase === 'overtime');
      const riftOn = fieldOn && EIGHT_KILL_RIFT_ENABLED;
      if (fieldOn) {
        for (const grab of potions.tick(balls, elapsedSec, true)) {
          const label = POTION_KIND_LABEL[grab.kind];
          if (grab.healed > 0) {
            potionHeals.push({
              unitId: grab.ball.id,
              amount: grab.healed,
              x: grab.ball.x,
              y: grab.ball.y,
            });
          }
          pushEvent({
            kind: 'potion',
            team: grab.ball.team,
            text:
              grab.kind === 'heal'
                ? `${grab.ball.label}捡到${label} +${Math.round(grab.healed)}`
                : `${grab.ball.label}捡到${label}`,
          });
        }
      } else {
        potions.tick(balls, elapsedSec, false);
      }
      const riftHits = rift.tick(clockDt, balls, elapsedSec, now, riftOn);
      extraHits.push(...riftHits);
      processKnockouts(riftHits);
      tickPhase(clockDt);
      if (phase === 'playing' && openingChargeRemain > 0) {
        openingChargeRemain = Math.max(0, openingChargeRemain - clockDt);
      }
      return recent.slice(0, Math.max(0, recent.length - before));
    },
    skipOpening,
    takePotionHeals(): HealPulse[] {
      const out = potionHeals.slice();
      potionHeals.length = 0;
      return out;
    },
    takeExtraHits(): CollisionHit[] {
      const out = extraHits.slice();
      extraHits.length = 0;
      return out;
    },
    setMode(next: MatchModeId): void {
      mode = next;
    },
    setPractice(next: boolean): void {
      practice = !!next;
    },
    reset(): void {
      applyReset();
    },
    snapshot(): MatchSnapshot {
      return {
        phase,
        timeLeft,
        suddenDeath,
        mode,
        redScore,
        blueScore,
        redKills,
        blueKills,
        redBreakScore,
        blueBreakScore,
        redHoldScore,
        blueHoldScore,
        elapsedSec,
        finishReason,
        midpoint: hold,
        winner,
        events: [...recent],
        respawns: { ...respawns },
        stallsOn: phase === 'countdown',
        stalls: phase === 'countdown' ? openingStalls.map((fence) => ({ ...fence })) : [],
        openingChargeRemain,
        skillsLocked: phase === 'countdown' || openingChargeRemain > 0,
        potion: potions.snapshot(),
        rift: rift.snapshot(),
        matchId,
        practice,
      };
    },
    debugAddScore(team: TeamId, points: number): void {
      if (phase === 'result') {
        return;
      }
      if (isEightKill(mode)) {
        if (points < 0) {
          const current = team === 'red' ? redKills : blueKills;
          points = Math.max(points, -current);
        }
        if (points === 0) {
          return;
        }
        if (team === 'red') {
          redKills += points;
        } else {
          blueKills += points;
        }
        pushEvent({
          kind: 'score',
          team,
          points,
          text: `调试 ${team === 'red' ? '红' : '蓝'} ${points > 0 ? '+' : ''}${points}杀`,
        });
        if (phase === 'overtime') {
          tryFinishOtKill();
          return;
        }
        tryFinishByKills();
        return;
      }
      if (points < 0) {
        const current = team === 'red' ? redScore : blueScore;
        points = Math.max(points, -current);
      }
      if (points === 0) {
        return;
      }
      addScore(team, points, {
        kind: 'score',
        team,
        points,
        text: `调试 ${team === 'red' ? '红' : '蓝'} ${points > 0 ? '+' : ''}${points}`,
      });
      tryFinishByScore();
    },
    debugAdvance(sec: number): void {
      let left = Math.max(0, sec);
      while (left > 0 && phase !== 'result') {
        const step = Math.min(0.25, left);
        this.tick(step, []);
        left -= step;
      }
    },
    debugJumpClock(sec: number): void {
      if (phase === 'result' || suddenDeath) {
        return;
      }
      timeLeft = Math.max(0.05, sec);
    },
    debugForceRespawn(): number {
      let n = 0;
      for (const ball of balls) {
        if (ball.inPlay) {
          continue;
        }
        respawnBall(ball);
        n += 1;
      }
      if (n > 0) {
        pushEvent({ kind: 'phase', text: `调试 立即回场 ×${n}` });
      }
      return n;
    },
  };
}

export type MatchSession = ReturnType<typeof createMatchSession>;
