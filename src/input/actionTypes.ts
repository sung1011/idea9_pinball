export type SkillSlot = 1 | 2 | 3 | 4;

export type ActionSample = {
  aimX: number;
  aimY: number;
  hasAim: boolean;
  /** 鼠标相对己球，或摇杆离死区：窗内用来拧速度 */
  steerAim: boolean;
  skillPress: SkillSlot | 0;
  confirmRelease: boolean;
  cancelAim: boolean;
};
