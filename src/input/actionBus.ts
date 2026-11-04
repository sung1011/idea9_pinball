import type { ActionSample, SkillSlot } from './actionTypes';

const STICK_LIVE = 1e-6;
const MOUSE_LIVE = 1e-4;

export function createActionBus() {
  let skillPress: SkillSlot | 0 = 0;
  let confirmRelease = false;
  let cancelAim = false;
  let mouseX = 0;
  let mouseY = 0;
  let hasMouse = false;
  let stickX = 0;
  let stickY = 0;
  let stickActive = false;
  let lastStickX = 0;
  let lastStickY = 0;
  let hasLastStick = false;

  const pushSkill = (slot: SkillSlot): void => {
    skillPress = slot;
  };

  const pushRelease = (): void => {
    confirmRelease = true;
  };

  const pushCancel = (): void => {
    cancelAim = true;
  };

  const setMouseLogical = (x: number, y: number): void => {
    mouseX = x;
    mouseY = y;
    hasMouse = true;
  };

  const setStick = (x: number, y: number, active: boolean): void => {
    stickActive = active;
    const mag = Math.hypot(x, y);
    if (active && mag > STICK_LIVE) {
      stickX = x;
      stickY = y;
      lastStickX = x;
      lastStickY = y;
      hasLastStick = true;
      return;
    }
    stickX = 0;
    stickY = 0;
  };

  const sample = (playerX: number, playerY: number): ActionSample => {
    let aimX = 0;
    let aimY = 0;
    let hasAim = false;
    let steerAim = false;

    const stickMag = Math.hypot(stickX, stickY);
    if (stickActive && stickMag > STICK_LIVE) {
      aimX = stickX / stickMag;
      aimY = stickY / stickMag;
      hasAim = true;
      steerAim = true;
    } else if (hasMouse) {
      const dx = mouseX - playerX;
      const dy = mouseY - playerY;
      const len = Math.hypot(dx, dy);
      if (len > MOUSE_LIVE) {
        aimX = dx / len;
        aimY = dy / len;
        hasAim = true;
        steerAim = true;
      }
    } else if (hasLastStick) {
      const len = Math.hypot(lastStickX, lastStickY);
      aimX = lastStickX / len;
      aimY = lastStickY / len;
      hasAim = true;
    }

    const out: ActionSample = {
      aimX,
      aimY,
      hasAim,
      steerAim,
      skillPress,
      confirmRelease,
      cancelAim,
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
    setMouseLogical,
    setStick,
    sample,
    reset,
  };
}

export type ActionBus = ReturnType<typeof createActionBus>;
