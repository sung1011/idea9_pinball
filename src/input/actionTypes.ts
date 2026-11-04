export type SkillSlot = 1 | 2 | 3 | 4;

export type ActionSample = {
  aimX: number;
  aimY: number;
  hasAim: boolean;
  /** 鼠标/点地相对己球：全程弱拧，撞后强拧 */
  steerAim: boolean;
  skillPress: SkillSlot | 0;
  confirmRelease: boolean;
  cancelAim: boolean;
};
