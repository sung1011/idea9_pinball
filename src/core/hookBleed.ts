import type { BallBody } from './ballBody';
import type { CollisionHit } from './collisionDamage';
import { HOOK_STAB_TECH } from './hookTech';
import { applySkillDamage } from './skillHits';

type BleedDot = {
  targetId: number;
  sourceId: number;
  ticksLeft: number;
  nextIn: number;
};

const dots: BleedDot[] = [];

/** 同施法者同目标不叠层：重计 3 秒，旧剩余 tick 不补发。 */
export function applyHookBleed(target: BallBody, source: BallBody): void {
  if (!target.inPlay) {
    return;
  }
  const existing = dots.find((dot) => dot.targetId === target.id && dot.sourceId === source.id);
  if (existing) {
    existing.ticksLeft = HOOK_STAB_TECH.ticks;
    existing.nextIn = HOOK_STAB_TECH.interval;
    return;
  }
  dots.push({
    targetId: target.id,
    sourceId: source.id,
    ticksLeft: HOOK_STAB_TECH.ticks,
    nextIn: HOOK_STAB_TECH.interval,
  });
}

export function clearHookBleeds(): void {
  dots.length = 0;
}

export function clearHookBleedOnTarget(targetId: number): void {
  for (let i = dots.length - 1; i >= 0; i -= 1) {
    if (dots[i]?.targetId === targetId) {
      dots.splice(i, 1);
    }
  }
}

export function hookBleedCount(): number {
  return dots.length;
}

/**
 * 到点跳一次。无敌跳过该 tick 不延时（仍消耗次数）。
 * 施法者死亡不取消；目标离场/死亡清除，不跨复活。
 */
export function tickHookBleeds(dt: number, roster: readonly BallBody[]): CollisionHit[] {
  const step = Math.max(0, dt);
  if (step <= 0 || dots.length === 0) {
    return [];
  }
  const hits: CollisionHit[] = [];
  const byId = new Map(roster.map((ball) => [ball.id, ball]));
  for (let i = dots.length - 1; i >= 0; i -= 1) {
    const dot = dots[i];
    if (!dot) {
      continue;
    }
    const target = byId.get(dot.targetId);
    if (!target || !target.inPlay) {
      dots.splice(i, 1);
      continue;
    }
    const source = byId.get(dot.sourceId);
    dot.nextIn -= step;
    while (dot.nextIn <= 1e-9 && dot.ticksLeft > 0) {
      dot.ticksLeft -= 1;
      dot.nextIn += HOOK_STAB_TECH.interval;
      if (target.invincibleRemain > 0) {
        continue;
      }
      const hit = applySkillDamage(target, source ?? target, HOOK_STAB_TECH.damage, {
        allowOfflineSource: true,
      });
      if (hit) {
        hits.push(hit);
      }
      if (!target.inPlay) {
        break;
      }
    }
    if (dot.ticksLeft <= 0 || !target.inPlay) {
      dots.splice(i, 1);
    }
  }
  return hits;
}
