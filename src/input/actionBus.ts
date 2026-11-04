import type { ActionSample, SkillSlot } from './actionTypes';

const POINTER_LIVE = 1e-4;

export function isAimUiTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-touch-control]');
}

export function createActionBus() {
  let skillPress: SkillSlot | 0 = 0;
  let confirmRelease = false;
  let cancelAim = false;
  let pointerX = 0;
  let pointerY = 0;
  let hasPointer = false;

  const pushSkill = (slot: SkillSlot): void => {
    skillPress = slot;
  };

  const pushRelease = (): void => {
    confirmRelease = true;
  };

  const pushCancel = (): void => {
    cancelAim = true;
  };

  const setPointerLogical = (x: number, y: number): void => {
    pointerX = x;
    pointerY = y;
    hasPointer = true;
  };

  const sample = (playerX: number, playerY: number): ActionSample => {
    let aimX = 0;
    let aimY = 0;
    let hasAim = false;

    if (hasPointer) {
      const dx = pointerX - playerX;
      const dy = pointerY - playerY;
      const len = Math.hypot(dx, dy);
      if (len > POINTER_LIVE) {
        aimX = dx / len;
        aimY = dy / len;
        hasAim = true;
      }
    }

    const out: ActionSample = {
      aimX,
      aimY,
      hasAim,
      steerAim: hasAim,
      skillPress,
      confirmRelease,
      cancelAim,
      pointerX,
      pointerY,
      hasPointer,
    };
    skillPress = 0;
    confirmRelease = false;
    cancelAim = false;
    return out;
  };

  const reset = (): void => {
    skillPress = 0;
    confirmRelease = false;
    cancelAim = false;
  };

  return {
    pushSkill,
    pushRelease,
    pushCancel,
    setPointerLogical,
    sample,
    reset,
  };
}

export type ActionBus = ReturnType<typeof createActionBus>;
