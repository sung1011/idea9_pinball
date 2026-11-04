import type { BallBody } from '../core/ballBody';
import type { CollisionHit } from '../core/collisionDamage';
import { createSkillCaster, type SkillCaster, type SkillCds, type WindupInfo } from '../core/skillCaster';
import { applyFloorSpeed, applySteerToward } from '../core/skillStub';
import type { ActionSample, SkillSlot } from './actionTypes';

export type PlayerTickOpts = {
  skills?: boolean;
  steer?: boolean;
};

export type PlayerControl = {
  tick: (
    player: BallBody,
    sample: ActionSample,
    dt: number,
    roster?: readonly BallBody[],
    opts?: PlayerTickOpts,
  ) => CollisionHit[];
  afterPhysics: (
    player: BallBody,
    dt: number,
    roster: readonly BallBody[],
    wallHit: boolean,
  ) => CollisionHit[];
  reset: () => void;
  getAimingSlot: () => SkillSlot | 0;
  getSkillCds: () => SkillCds;
  getWindup: () => WindupInfo | null;
  getCaster: () => SkillCaster;
};

/** 红球钩刺：同键或左键释放；点地只纠偏；前摇从释放后起算。 */
export function createPlayerControl(): PlayerControl {
  const caster = createSkillCaster();

  return {
    tick: (player, sample, dt, roster = [], opts = {}) => {
      const skillsOn = opts.skills !== false;
      const steerOn = opts.steer !== false;
      if (skillsOn) {
        caster.handleInput(player, sample);
      }
      const hits = caster.tick(player, dt, roster);
      if (!player.inPlay) {
        player.hasAim = false;
        return hits;
      }
      if (steerOn && sample.hasAim) {
        player.aimX = sample.aimX;
        player.aimY = sample.aimY;
        player.hasAim = true;
        if (
          dt > 0 &&
          player.stunRemain <= 0 &&
          !caster.isDisplacing() &&
          player.frictionMul === 1
        ) {
          applyFloorSpeed(player);
          applySteerToward(player, sample.aimX, sample.aimY, dt);
        }
      } else {
        player.hasAim = false;
      }
      return hits;
    },
    afterPhysics: (player, dt, roster, wallHit) => caster.afterPhysics(player, dt, roster, wallHit),
    reset: () => {
      caster.reset();
    },
    getAimingSlot: () => caster.getAimingSlot(),
    getSkillCds: () => caster.getCds(),
    getWindup: () => caster.getWindup(),
    getCaster: () => caster,
  };
}
