import { createBallBody, grantInvincible, type BallBody, type TeamId } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import {
  ASSIST_SCORE,
  ASSIST_WINDOW_SEC,
  BLUE_BOT_COUNT,
  BLUE_SPAWNS,
  CONTROL_POINT,
  DEBUG_CLOCK_SCALE,
  KNOCKOUT_SCORE,
  MATCH_COUNTDOWN_SEC,
  MATCH_OVERTIME_SEC,
  MATCH_PLAY_SEC,
  MATCH_SCORE_LIMIT,
  MIDPOINT_SCORE_PER_SEC,
  MIDPOINT_TICK_SEC,
  RED_SPAWNS,
  RESPAWN_SEC,
  SPAWN_INVINCIBLE_SEC,
} from './constants';

export type MatchPhase = 'countdown' | 'playing' | 'overtime' | 'result';
export type MidpointHold = 'red' | 'blue' | 'none';
export type MatchWinner = TeamId | null;

export type MatchConfig = {
  countdownSec?: number;
  playSec?: number;
  overtimeSec?: number;
  scoreLimit?: number;
  clockScale?: number;
};

export type MatchEvent = {
  kind: 'knockout' | 'assist' | 'midpoint' | 'phase' | 'score';
  text: string;
  team?: TeamId;
  points?: number;
};

export type MatchSnapshot = {
  phase: MatchPhase;
  timeLeft: number;
  suddenDeath: boolean;
  redScore: number;
  blueScore: number;
  midpoint: MidpointHold;
  winner: MatchWinner;
  events: MatchEvent[];
  respawns: Record<number, number>;
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

function clampBotCount(n: number): number {
  return Math.max(1, Math.min(2, Math.floor(n)));
}

export function createMatchRoster(botCount = BLUE_BOT_COUNT): BallBody[] {
  const redSpawn = RED_SPAWNS[0];
  const red = createRosterBall({
    x: redSpawn.x,
    y: redSpawn.y,
    facingX: redSpawn.facingX,
    facingY: redSpawn.facingY,
    color: 0xe24a4a,
    label: '红',
    team: 'red',
  });
  const blues: BallBody[] = [];
  const n = clampBotCount(botCount);
  for (let i = 0; i < n; i += 1) {
    const spawn = BLUE_SPAWNS[i] ?? BLUE_SPAWNS[0];
    blues.push(
      createRosterBall({
        x: spawn.x,
        y: spawn.y,
        facingX: spawn.facingX,
        facingY: spawn.facingY,
        color: i === 0 ? 0x3d7cf0 : 0x4f9bff,
        label: n === 1 ? '蓝' : `蓝${i + 1}`,
        team: 'blue',
      }),
    );
  }
  return [red, ...blues];
}

function createRosterBall(init: {
  x: number;
  y: number;
  facingX: number;
  facingY: number;
  color: number;
  label: string;
  team: TeamId;
}): BallBody {
  return createBallBody({
    x: init.x,
    y: init.y,
    facingX: init.facingX,
    facingY: init.facingY,
    color: init.color,
    label: init.label,
    team: init.team,
    spawnX: init.x,
    spawnY: init.y,
  });
}

function resetBall(ball: BallBody, openingInvincible: number): void {
  ball.x = ball.spawnX;
  ball.y = ball.spawnY;
  ball.vx = 0;
  ball.vy = 0;
  ball.hp = ball.maxHp;
  ball.inPlay = true;
  ball.activeRamRemain = 0;
  ball.fineTuneRemain = 0;
  ball.invincibleRemain = openingInvincible;
  if (ball.team === 'blue') {
    ball.facingX = -1;
    ball.facingY = 0;
  } else if (ball.team === 'red') {
    ball.facingX = 1;
    ball.facingY = 0;
  }
}

export function createMatchSession(balls: BallBody[], config: MatchConfig = {}) {
  const countdownSec = config.countdownSec ?? MATCH_COUNTDOWN_SEC;
  const playSec = config.playSec ?? MATCH_PLAY_SEC;
  const overtimeSec = config.overtimeSec ?? MATCH_OVERTIME_SEC;
  const scoreLimit = config.scoreLimit ?? MATCH_SCORE_LIMIT;
  const clockScale = config.clockScale ?? DEBUG_CLOCK_SCALE;

  let phase: MatchPhase = countdownSec > 0 ? 'countdown' : 'playing';
  let timeLeft = countdownSec > 0 ? countdownSec : playSec;
  let suddenDeath = false;
  let redScore = 0;
  let blueScore = 0;
  let hold: MidpointHold = 'none';
  let winner: MatchWinner = null;
  let now = 0;
  let midpointAcc = 0;
  const respawns: Record<number, number> = {};
  const marks: DamageMark[] = [];
  const recent: MatchEvent[] = [];

  const openingInvincible = (countdownSec > 0 ? countdownSec : 0) + SPAWN_INVINCIBLE_SEC;

  const pushEvent = (event: MatchEvent): void => {
    recent.unshift(event);
    if (recent.length > 6) {
      recent.length = 6;
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
    pushEvent(event);
  };

  const teamOf = (ball: BallBody | undefined): TeamId | null => ball?.team ?? null;

  const tryFinishByScore = (): boolean => {
    if (suddenDeath) {
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

  const finish = (team: TeamId, reason: string): void => {
    phase = 'result';
    winner = team;
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
    if (redScore > blueScore) {
      finish('red', phase === 'overtime' ? '加时' : '时间到');
      return;
    }
    if (blueScore > redScore) {
      finish('blue', phase === 'overtime' ? '加时' : '时间到');
    }
  };

  const parkOut = (ball: BallBody): void => {
    ball.inPlay = false;
    ball.hp = 0;
    ball.vx = 0;
    ball.vy = 0;
    ball.activeRamRemain = 0;
    ball.fineTuneRemain = 0;
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
    ball.fineTuneRemain = 0;
    grantInvincible(ball, SPAWN_INVINCIBLE_SEC);
    if (ball.team === 'blue') {
      ball.facingX = -1;
      ball.facingY = 0;
    } else if (ball.team === 'red') {
      ball.facingX = 1;
      ball.facingY = 0;
    }
  };

  const processKnockouts = (hits: readonly CollisionHit[]): void => {
    for (const hit of hits) {
      if (hit.damage <= 0) {
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
      const source = balls.find((ball) => ball.id === hit.sourceId);
      if (!victim || !source || !victim.inPlay || victim.hp > 0 || seen.has(victim.id)) {
        continue;
      }
      seen.add(victim.id);
      parkOut(victim);
      const killerTeam = teamOf(source);
      const victimTeam = teamOf(victim);
      if (!killerTeam || !victimTeam || killerTeam === victimTeam) {
        pushEvent({ kind: 'knockout', text: `${source.label}击破${victim.label}` });
        continue;
      }

      if (suddenDeath) {
        pushEvent({
          kind: 'knockout',
          text: `${source.label}击破${victim.label} · 加时定胜负`,
          team: killerTeam,
        });
        finish(killerTeam, '下次击破');
        continue;
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
        continue;
      }

      pushEvent({
        kind: 'knockout',
        team: killerTeam,
        text: `${source.label}击破${victim.label}（加时不计击破分）`,
      });
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
        text: `中点 ${hold === 'red' ? '红' : '蓝'} +${MIDPOINT_SCORE_PER_SEC}`,
      });
      if (tryFinishByScore()) {
        return;
      }
    }
  };

  const enterPlaying = (): void => {
    phase = 'playing';
    timeLeft = playSec;
    suddenDeath = false;
    for (const ball of balls) {
      if (ball.inPlay) {
        grantInvincible(ball, SPAWN_INVINCIBLE_SEC);
      }
    }
    pushEvent({ kind: 'phase', text: '开战' });
  };

  const enterOvertime = (): void => {
    phase = 'overtime';
    timeLeft = overtimeSec;
    suddenDeath = false;
    midpointAcc = 0;
    pushEvent({ kind: 'phase', text: '加时 30 秒 · 只计中点分' });
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
      if (redScore !== blueScore) {
        finishByTime();
        return;
      }
      enterOvertime();
      return;
    }
    if (phase === 'overtime') {
      if (redScore !== blueScore) {
        finishByTime();
        return;
      }
      enterSuddenDeath();
    }
  };

  const applyReset = (): void => {
    phase = countdownSec > 0 ? 'countdown' : 'playing';
    timeLeft = countdownSec > 0 ? countdownSec : playSec;
    suddenDeath = false;
    redScore = 0;
    blueScore = 0;
    hold = 'none';
    winner = null;
    now = 0;
    midpointAcc = 0;
    marks.length = 0;
    recent.length = 0;
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
      processKnockouts(hits);
      tickRespawns(clockDt);
      tickMidpoint(clockDt);
      tickPhase(clockDt);
      return recent.slice(0, Math.max(0, recent.length - before));
    },
    reset(): void {
      applyReset();
    },
    snapshot(): MatchSnapshot {
      return {
        phase,
        timeLeft,
        suddenDeath,
        redScore,
        blueScore,
        midpoint: hold,
        winner,
        events: [...recent],
        respawns: { ...respawns },
      };
    },
    debugAddScore(team: TeamId, points: number): void {
      if (phase === 'result') {
        return;
      }
      addScore(team, points, {
        kind: 'score',
        team,
        points,
        text: `调试 ${team === 'red' ? '红' : '蓝'} +${points}`,
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
  };
}

export type MatchSession = ReturnType<typeof createMatchSession>;
