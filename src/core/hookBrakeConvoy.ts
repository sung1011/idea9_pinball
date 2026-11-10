import type { BallBody } from './ballBody';
import { ACTIVE_RAM_WINDOW, BALL_RADIUS } from './constants';
import type { HeroId } from '../heroes/heroIds';
import { arcIsDisplace } from '../heroes/arcKit';
import { chainIsDisplace } from '../heroes/chainKit';
import { hookIsDisplace } from '../heroes/hookKit';
import { mirrorIsDisplace } from '../heroes/mirrorKit';
import { nailIsDisplace } from '../heroes/nailKit';
import { ringIsDisplace } from '../heroes/ringKit';
import { wellIsDisplace } from '../heroes/wellKit';
import type { SkillSlot } from '../input/actionTypes';
import { pickMagnetWellFor } from './magnetWells';
import { segmentBlocked } from './skillQuery';

const EPS = 1e-8;
const TOUCH_PAD = 0.02;
const FOLLOW_GAP = 0.2;
const FOLLOW_FIRST = BALL_RADIUS * 2;
const CATCH_PAD = 0.12;
const FAR_SLACK = 1.25;

export function isValidTechEnemy(source: BallBody, victim: BallBody): boolean {
  if (!victim.inPlay || !source.inPlay) {
    return false;
  }
  if (victim.id === source.id) {
    return false;
  }
  if (victim.invincibleRemain > 0) {
    return false;
  }
  if (victim.team && source.team && victim.team === source.team) {
    return false;
  }
  return true;
}

export function heroIsDisplace(hero: HeroId, slot: SkillSlot): boolean {
  if (hero === 'ring') {
    return ringIsDisplace(slot);
  }
  if (hero === 'chain') {
    return chainIsDisplace(slot);
  }
  if (hero === 'nail') {
    return nailIsDisplace(slot);
  }
  if (hero === 'arc') {
    return arcIsDisplace(slot);
  }
  if (hero === 'well') {
    return wellIsDisplace(slot);
  }
  if (hero === 'mirror') {
    return mirrorIsDisplace(slot);
  }
  return hookIsDisplace(slot);
}

export function isBrakeConvoyLeader(ball: BallBody): boolean {
  return ball.hookBrakeConvoyRemain > EPS;
}

export function isBrakeConvoyPassenger(ball: BallBody): boolean {
  return ball.hookBrakeConvoyLeaderId > 0;
}

export function convoyBodiesLinked(a: BallBody, b: BallBody): boolean {
  if (a.hookBrakeConvoyLeaderId === b.id || b.hookBrakeConvoyLeaderId === a.id) {
    return true;
  }
  return a.hookBrakeConvoyLeaderId > 0 && a.hookBrakeConvoyLeaderId === b.hookBrakeConvoyLeaderId;
}

export function convoyBlocksSkillRelease(ball: BallBody, slot: SkillSlot): boolean {
  return isBrakeConvoyPassenger(ball) && heroIsDisplace(ball.hero, slot);
}

export function clearHookBrakeConvoySelf(ball: BallBody): void {
  ball.hookBrakeConvoyRemain = 0;
  ball.hookBrakeConvoyIds = [];
  ball.hookBrakeConvoyTouched = [];
  ball.hookBrakeConvoyLeaderId = 0;
  ball.hookBrakeConvoyFollowDist = 0;
}

function findById(roster: readonly BallBody[], id: number): BallBody | undefined {
  return roster.find((item) => item.id === id);
}

function chargeDir(leader: BallBody): { x: number; y: number } {
  const speed = Math.hypot(leader.vx, leader.vy);
  if (speed > 0.4) {
    return { x: leader.vx / speed, y: leader.vy / speed };
  }
  const face = Math.hypot(leader.facingX, leader.facingY);
  if (face > EPS) {
    return { x: leader.facingX / face, y: leader.facingY / face };
  }
  return { x: 1, y: 0 };
}

function passengerForced(ball: BallBody): boolean {
  if (!ball.inPlay || ball.hp <= 0) {
    return true;
  }
  if (ball.stunRemain > 0 || ball.pinRemain > 0) {
    return true;
  }
  if (ball.invincibleRemain > 0) {
    return true;
  }
  if (ball.frictionMul === 0 || ball.leechRemain > 0 || ball.phaseRemain > 0) {
    return true;
  }
  if (pickMagnetWellFor(ball)) {
    return true;
  }
  return false;
}

function leaderForced(ball: BallBody): boolean {
  if (!ball.inPlay || ball.hp <= 0) {
    return true;
  }
  if (ball.stunRemain > 0 || ball.pinRemain > 0) {
    return true;
  }
  if (ball.frictionMul === 0 || ball.leechRemain > 0 || ball.phaseRemain > 0) {
    return true;
  }
  if (pickMagnetWellFor(ball)) {
    return true;
  }
  return false;
}

function assignedFollowDist(leader: BallBody, roster: readonly BallBody[]): number {
  let maxDist = 0;
  for (const id of leader.hookBrakeConvoyIds) {
    const member = findById(roster, id);
    if (member && member.hookBrakeConvoyFollowDist > maxDist) {
      maxDist = member.hookBrakeConvoyFollowDist;
    }
  }
  if (maxDist <= EPS) {
    return FOLLOW_FIRST;
  }
  return maxDist + FOLLOW_FIRST + FOLLOW_GAP;
}

function detachPassenger(passenger: BallBody, roster: readonly BallBody[]): void {
  const leaderId = passenger.hookBrakeConvoyLeaderId;
  passenger.hookBrakeConvoyLeaderId = 0;
  passenger.hookBrakeConvoyFollowDist = 0;
  if (leaderId <= 0) {
    return;
  }
  const leader = findById(roster, leaderId);
  if (!leader) {
    return;
  }
  leader.hookBrakeConvoyIds = leader.hookBrakeConvoyIds.filter((id) => id !== passenger.id);
}

function releaseAllPassengers(leader: BallBody, roster: readonly BallBody[]): void {
  const ids = [...leader.hookBrakeConvoyIds];
  leader.hookBrakeConvoyIds = [];
  leader.hookBrakeConvoyRemain = 0;
  for (const id of ids) {
    const member = findById(roster, id);
    if (!member) {
      continue;
    }
    member.hookBrakeConvoyLeaderId = 0;
    member.hookBrakeConvoyFollowDist = 0;
  }
}

export function beginHookBrakeConvoy(ball: BallBody, roster: readonly BallBody[] = []): void {
  if (roster.length > 0 && ball.hookBrakeConvoyLeaderId > 0) {
    detachPassenger(ball, roster);
  }
  if (roster.length > 0) {
    releaseAllPassengers(ball, roster);
  } else {
    ball.hookBrakeConvoyIds = [];
  }
  ball.hookBrakeConvoyRemain = ACTIVE_RAM_WINDOW;
  ball.hookBrakeConvoyTouched = [];
  ball.hookBrakeConvoyLeaderId = 0;
  ball.hookBrakeConvoyFollowDist = 0;
}

export function breakHookBrakeConvoyFor(ball: BallBody, roster: readonly BallBody[]): void {
  if (ball.hookBrakeConvoyRemain > EPS || ball.hookBrakeConvoyIds.length > 0) {
    releaseAllPassengers(ball, roster);
  }
  if (ball.hookBrakeConvoyLeaderId > 0) {
    detachPassenger(ball, roster);
  }
  clearHookBrakeConvoySelf(ball);
}

function canAttachAlly(leader: BallBody, other: BallBody): boolean {
  if (!isBrakeConvoyLeader(leader) || other.id === leader.id) {
    return false;
  }
  if (!other.inPlay || other.hp <= 0 || !leader.inPlay || leader.hp <= 0) {
    return false;
  }
  if (!other.team || !leader.team || other.team !== leader.team) {
    return false;
  }
  if (other.invincibleRemain > 0 || other.stunRemain > 0 || other.pinRemain > 0) {
    return false;
  }
  if (other.hookBrakeConvoyLeaderId > 0) {
    return false;
  }
  if (other.hookBrakeConvoyRemain > EPS) {
    return false;
  }
  if (leader.hookBrakeConvoyTouched.includes(other.id)) {
    return false;
  }
  if (segmentBlocked(leader.x, leader.y, other.x, other.y)) {
    return false;
  }
  return true;
}

function bodiesTouch(a: BallBody, b: BallBody): boolean {
  if (a.phaseRemain > 0 || b.phaseRemain > 0) {
    return false;
  }
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  return dist <= a.radius + b.radius + TOUCH_PAD;
}

function attachPassenger(leader: BallBody, other: BallBody, roster: readonly BallBody[]): boolean {
  if (!canAttachAlly(leader, other) || !bodiesTouch(leader, other)) {
    return false;
  }
  other.hookBrakeConvoyLeaderId = leader.id;
  other.hookBrakeConvoyFollowDist = assignedFollowDist(leader, roster);
  other.vx = leader.vx;
  other.vy = leader.vy;
  other.allowOverCap = true;
  leader.hookBrakeConvoyIds = [...leader.hookBrakeConvoyIds, other.id];
  if (!leader.hookBrakeConvoyTouched.includes(other.id)) {
    leader.hookBrakeConvoyTouched = [...leader.hookBrakeConvoyTouched, other.id];
  }
  return true;
}

export function tryHookBrakeConvoyAttach(a: BallBody, b: BallBody, roster: readonly BallBody[]): boolean {
  if (attachPassenger(a, b, roster)) {
    return true;
  }
  return attachPassenger(b, a, roster);
}

function copyFollowVel(leader: BallBody, passenger: BallBody, dt: number): void {
  const dir = chargeDir(leader);
  const desiredX = leader.x - dir.x * passenger.hookBrakeConvoyFollowDist;
  const desiredY = leader.y - dir.y * passenger.hookBrakeConvoyFollowDist;
  const dx = desiredX - passenger.x;
  const dy = desiredY - passenger.y;
  const dist = Math.hypot(dx, dy);
  const leaderSpeed = Math.hypot(leader.vx, leader.vy);
  const maxStep = leaderSpeed * Math.max(dt, EPS) + CATCH_PAD;
  let catchVx = 0;
  let catchVy = 0;
  if (dist > EPS && dt > EPS) {
    const step = Math.min(dist, maxStep);
    catchVx = (dx / dist) * (step / dt);
    catchVy = (dy / dist) * (step / dt);
  }
  passenger.vx = leader.vx + catchVx;
  passenger.vy = leader.vy + catchVy;
  passenger.allowOverCap = true;
}

export function prepareHookBrakeConvoy(balls: readonly BallBody[], dt: number): void {
  void dt;
  for (const ball of balls) {
    if (isBrakeConvoyLeader(ball) && leaderForced(ball)) {
      releaseAllPassengers(ball, balls);
    }
    if (ball.hookBrakeConvoyIds.length > 0) {
      ball.hookBrakeConvoyIds = ball.hookBrakeConvoyIds.filter((id) => {
        const member = findById(balls, id);
        return !!member && member.hookBrakeConvoyLeaderId === ball.id;
      });
    }
  }
  for (const ball of balls) {
    if (!isBrakeConvoyPassenger(ball)) {
      continue;
    }
    const leader = findById(balls, ball.hookBrakeConvoyLeaderId);
    if (!leader || !isBrakeConvoyLeader(leader) || !leader.hookBrakeConvoyIds.includes(ball.id)) {
      detachPassenger(ball, balls);
      continue;
    }
    if (passengerForced(ball) || segmentBlocked(leader.x, leader.y, ball.x, ball.y)) {
      detachPassenger(ball, balls);
    }
  }
  for (const ball of balls) {
    if (!isBrakeConvoyPassenger(ball)) {
      continue;
    }
    const leader = findById(balls, ball.hookBrakeConvoyLeaderId);
    if (!leader) {
      continue;
    }
    copyFollowVel(leader, ball, dt);
  }
}

export function finishHookBrakeConvoy(
  balls: readonly BallBody[],
  dt: number,
  wallHitIds: ReadonlySet<number>,
): void {
  for (const ball of balls) {
    if (!isBrakeConvoyLeader(ball)) {
      continue;
    }
    if (wallHitIds.has(ball.id) || leaderForced(ball)) {
      releaseAllPassengers(ball, balls);
    }
  }
  for (const ball of balls) {
    if (!isBrakeConvoyPassenger(ball)) {
      continue;
    }
    const leader = findById(balls, ball.hookBrakeConvoyLeaderId);
    if (!leader || !isBrakeConvoyLeader(leader)) {
      detachPassenger(ball, balls);
      continue;
    }
    if (wallHitIds.has(ball.id) || passengerForced(ball)) {
      detachPassenger(ball, balls);
      continue;
    }
    if (segmentBlocked(leader.x, leader.y, ball.x, ball.y)) {
      detachPassenger(ball, balls);
      continue;
    }
    const spaced = FOLLOW_FIRST + FAR_SLACK + ball.hookBrakeConvoyFollowDist;
    const dist = Math.hypot(leader.x - ball.x, leader.y - ball.y);
    if (dist > spaced) {
      detachPassenger(ball, balls);
    }
  }
  const step = Math.max(0, dt);
  for (const ball of balls) {
    if (ball.hookBrakeConvoyRemain <= EPS) {
      if (ball.hookBrakeConvoyIds.length > 0) {
        releaseAllPassengers(ball, balls);
      }
      ball.hookBrakeConvoyRemain = 0;
      continue;
    }
    ball.hookBrakeConvoyRemain = Math.max(0, ball.hookBrakeConvoyRemain - step);
    if (ball.hookBrakeConvoyRemain <= EPS) {
      releaseAllPassengers(ball, balls);
    }
  }
}
