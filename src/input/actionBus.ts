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
  let stickHeld = false;
  let stickAim = false;
  let stickX = 0;
  let stickY = 0;

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

  const holdStick = (dirX?: number, dirY?: number): void => {
    stickHeld = true;
    if (dirX === undefined || dirY === undefined) {
      stickAim = false;
      return;
    }
    const len = Math.hypot(dirX, dirY);
    if (len <= POINTER_LIVE) {
      stickAim = false;
      return;
    }
    stickX = dirX / len;
    stickY = dirY / len;
    stickAim = true;
  };

  const releaseStick = (): void => {
    stickHeld = false;
    stickAim = false;
  };

  const sample = (playerX: number, playerY: number): ActionSample => {
    let aimX = 0;
    let aimY = 0;
    let hasAim = false;

    if (stickHeld && stickAim) {
      aimX = stickX;
      aimY = stickY;
      hasAim = true;
    } else if (!stickHeld && hasPointer) {
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
    releaseStick();
  };

  return {
    pushSkill,
    pushRelease,
    pushCancel,
    setPointerLogical,
    holdStick,
    releaseStick,
    sample,
    reset,
  };
}

export type ActionBus = ReturnType<typeof createActionBus>;
