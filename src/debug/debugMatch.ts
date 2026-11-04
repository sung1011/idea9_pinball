import type { MatchSession } from '../core/matchSession';

/** 调试加分 / 跳时钟；不改默认锁点数值。键盘仅 GM 开时生效。 */
export function bindDebugMatch(
  session: MatchSession,
  opts?: { isGmOn?: () => boolean; onSwapHero?: () => void },
): () => void {
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) {
      return;
    }
    if (!(opts?.isGmOn?.() ?? true)) {
      return;
    }
    const key = ev.key.toLowerCase();
    if (key === 'f') {
      ev.preventDefault();
      session.debugAddScore('red', 10);
      return;
    }
    if (key === 'g') {
      ev.preventDefault();
      session.debugAddScore('blue', 10);
      return;
    }
    if (key === 't') {
      ev.preventDefault();
      session.debugAdvance(30);
      return;
    }
    if (key === 'y') {
      ev.preventDefault();
      session.debugJumpClock(1);
      return;
    }
    if (key === 'h') {
      ev.preventDefault();
      opts?.onSwapHero?.();
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
