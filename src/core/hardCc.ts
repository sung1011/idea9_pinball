import type { BallBody } from './ballBody';
import { HARD_CC_DIMINISH_WINDOW } from './constants';

export function scaleHardCc(duration: number, lastAt: number, now: number): number {
  if (now - lastAt < HARD_CC_DIMINISH_WINDOW && lastAt > -1e8) {
    return duration * 0.5;
  }
  return duration;
}

export function applyHardCc(target: BallBody, duration: number, now: number): number {
  const scaled = scaleHardCc(duration, target.lastHardCcAt, now);
  target.stunRemain = Math.max(target.stunRemain, scaled);
  target.lastHardCcAt = now;
  return scaled;
}
