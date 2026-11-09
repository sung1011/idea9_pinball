import { clearKitAuras, type BallBody } from '../core/ballBody';
import type { CollisionHit } from '../core/collisionDamage';
import {
  createSkillCaster,
  type AimHint,
  type SkillCaster,
  type SkillCds,
  type WindupInfo,
} from '../core/skillCaster';
import { applyFloorSpeed, applySteerToward } from '../core/skillStub';
import { clearUltEnergy, tickUltEnergy } from '../core/ultEnergy';
import type { HeroId } from '../heroes/heroIds';
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
  getAimHint: () => AimHint | null;
  getCaster: () => SkillCaster;
  setHero: (ball: BallBody, hero: HeroId) => void;
};

export type PlayerControlOpts = {
  onUltTodo?: () => void;
};

/** 红球施放：同键或左键释放；触屏瞄准中点空白也可释放、滑动只改向；前摇从释放后起算。 */
export function createPlayerControl(initial: HeroId = 'hook', opts: PlayerControlOpts = {}): PlayerControl {
  let caster = createSkillCaster(initial);

  return {
    tick: (player, sample, dt, roster = [], tickOpts = {}) => {
      tickUltEnergy(player, dt);
      const skillsOn = tickOpts.skills !== false;
      const steerOn = tickOpts.steer !== false;
      let input = sample;
      if (sample.skillPress === 5 && caster.getHero() !== 'hook') {
        opts.onUltTodo?.();
        input = { ...sample, skillPress: 0 };
      }
      if (skillsOn) {
        caster.handleInput(player, input, roster);
      }
      if (player.inPlay) {
        if (steerOn && sample.hasAim) {
          player.aimX = sample.aimX;
          player.aimY = sample.aimY;
          player.hasAim = true;
        } else {
          player.hasAim = false;
        }
      }
      const hits = caster.tick(player, dt, roster);
      if (!player.inPlay) {
        player.hasAim = false;
        return hits;
      }
      if (
        steerOn &&
        sample.hasAim &&
        dt > 0 &&
        player.stunRemain <= 0 &&
        !caster.isDisplacing() &&
        player.frictionMul === 1
      ) {
        applyFloorSpeed(player);
        applySteerToward(player, sample.aimX, sample.aimY, dt);
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
    getAimHint: () => caster.getAimHint?.() ?? null,
    getCaster: () => caster,
    setHero: (ball, hero) => {
      caster.reset();
      clearKitAuras(ball);
      clearUltEnergy(ball);
      ball.hero = hero;
      caster = createSkillCaster(hero);
    },
  };
}
