import type { BallBody } from '../core/ballBody';
import { SKILL_STUB_CD } from '../core/constants';
import { applyFineTune, applySkillRelease } from '../core/skillStub';
import type { ActionSample, SkillSlot } from './actionTypes';

export type PlayerControl = {
  tick: (player: BallBody, sample: ActionSample, dt: number) => void;
  reset: () => void;
  getAimingSlot: () => SkillSlot | 0;
  getSkillCd: () => number;
};

function releaseAim(player: BallBody, sample: ActionSample): boolean {
  const aimX = sample.hasAim ? sample.aimX : player.facingX;
  const aimY = sample.hasAim ? sample.aimY : player.facingY;
  return applySkillRelease(player, aimX, aimY);
}

/** 红球瞄准态：同键或左键释放 stub；Cancel 清态；无最长瞄准时限。 */
export function createPlayerControl(): PlayerControl {
  let aimingSlot: SkillSlot | 0 = 0;
  let skillCd = 0;

  const tryRelease = (player: BallBody, sample: ActionSample): void => {
    if (skillCd > 0 || aimingSlot === 0) {
      return;
    }
    if (!releaseAim(player, sample)) {
      return;
    }
    skillCd = SKILL_STUB_CD;
    aimingSlot = 0;
  };

  return {
    tick: (player: BallBody, sample: ActionSample, dt: number) => {
      skillCd = Math.max(0, skillCd - Math.max(0, dt));

      if (sample.cancelAim) {
        aimingSlot = 0;
      } else {
        if (sample.skillPress) {
          if (aimingSlot === sample.skillPress) {
            tryRelease(player, sample);
          } else if (skillCd <= 0) {
            aimingSlot = sample.skillPress;
          }
        }
        if (sample.confirmRelease && aimingSlot !== 0) {
          tryRelease(player, sample);
        }
      }

      if (player.fineTuneRemain > 0 && sample.steerAim && sample.hasAim) {
        applyFineTune(player, sample.aimX, sample.aimY, dt);
      }
    },
    reset: () => {
      aimingSlot = 0;
      skillCd = 0;
    },
    getAimingSlot: () => aimingSlot,
    getSkillCd: () => skillCd,
  };
}
