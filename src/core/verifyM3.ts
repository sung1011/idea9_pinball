import { createBallBody } from './ballBody';
import { ACTIVE_RAM_WINDOW, MAX_HP, SKILL_IMPULSE, SPEED_CAP } from './constants';
import { createPlayerControl } from '../input/playerControl';
import { applyFineTune, applySkillRelease } from './skillStub';
import { stepPhysics } from './physicsStep';
import type { ActionSample } from '../input/actionTypes';

function sample(partial: Partial<ActionSample>): ActionSample {
  return {
    aimX: 1,
    aimY: 0,
    hasAim: true,
    steerAim: true,
    skillPress: 0,
    confirmRelease: false,
    cancelAim: false,
    ...partial,
  };
}

/** 释放 stub / 取消 / 强拧转向 / 轻蹭开窗。 */
export function verifyM3(): void {
  const rest = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    facingX: 0,
    facingY: 1,
  });
  if (!applySkillRelease(rest, 1, 0)) {
    throw new Error('M3：静止释放应成功');
  }
  if (Math.abs(rest.facingX - 1) > 1e-6 || Math.abs(rest.facingY) > 1e-6) {
    throw new Error('M3：释放后朝向应为瞄准方向');
  }
  const released = Math.hypot(rest.vx, rest.vy);
  if (Math.abs(released - SKILL_IMPULSE) > 1e-5) {
    throw new Error(`M3：静止释放冲量应为 ${SKILL_IMPULSE}，实得 ${released}`);
  }
  if (Math.abs(rest.activeRamRemain - ACTIVE_RAM_WINDOW) > 1e-9) {
    throw new Error('M3：释放应开启 0.25s 主动撞窗');
  }

  const fast = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    vx: 7,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applySkillRelease(fast, 1, 0);
  if (Math.hypot(fast.vx, fast.vy) - SPEED_CAP > 1e-6) {
    throw new Error('M3：释放后速度应盖帽 8');
  }

  const turn = createBallBody({
    x: 10,
    y: 6,
    color: 0xe24a4a,
    vx: 4,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  applyFineTune(turn, 0, 1, 0.3);
  const deg = (Math.atan2(turn.vy, turn.vx) * 180) / Math.PI;
  if (Math.abs(deg - 36) > 0.6) {
    throw new Error(`M3：0.3s 强拧约 36°，实得 ${deg.toFixed(2)}`);
  }
  if (Math.abs(Math.hypot(turn.vx, turn.vy) - 4) > 1e-5) {
    throw new Error('M3：微调应只改方向不改速率');
  }

  const control = createPlayerControl();
  const player = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    facingX: 1,
    facingY: 0,
  });
  control.tick(player, sample({ skillPress: 1 }), 0);
  if (control.getAimingSlot() !== 1) {
    throw new Error('M3：按技能应进入瞄准');
  }
  control.tick(player, sample({ cancelAim: true }), 0);
  if (control.getAimingSlot() !== 0 || Math.hypot(player.vx, player.vy) !== 0) {
    throw new Error('M3：取消瞄准不应施加冲量');
  }

  control.tick(player, sample({ skillPress: 2 }), 0);
  control.tick(player, sample({ skillPress: 2 }), 0);
  if (Math.abs(Math.hypot(player.vx, player.vy) - SKILL_IMPULSE) > 1e-5) {
    throw new Error('M3：同键二次应释放 stub');
  }
  if (player.activeRamRemain <= 0) {
    throw new Error('M3：同键释放应开主动撞窗');
  }

  const clicker = createBallBody({
    x: 8,
    y: 6,
    color: 0xe24a4a,
    facingX: 0,
    facingY: -1,
  });
  const clickCtl = createPlayerControl();
  clickCtl.tick(clicker, sample({ skillPress: 3, aimX: 0, aimY: 1 }), 0);
  clickCtl.tick(clicker, sample({ confirmRelease: true, aimX: 0, aimY: 1 }), 0);
  if (Math.abs(clicker.facingY - 1) > 1e-6 || Math.abs(clicker.vx) > 1e-6) {
    throw new Error('M3：左键释放应沿瞄准方向');
  }

  const after = Math.hypot(player.vx, player.vy);
  control.tick(player, sample({ skillPress: 1 }), 0.1);
  if (control.getAimingSlot() !== 0 || Math.abs(Math.hypot(player.vx, player.vy) - after) > 1e-6) {
    throw new Error('M3：短 CD 内不应再进瞄或连放');
  }

  const scrapeA = createBallBody({
    x: 9.5,
    y: 6,
    color: 0xe24a4a,
    vx: 2.5,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  const scrapeB = createBallBody({
    x: 10.35,
    y: 6.5,
    color: 0x3d7cf0,
    vx: 2.5,
    vy: 0,
    facingX: 1,
    facingY: 0,
  });
  let opened = false;
  for (let i = 0; i < 40; i += 1) {
    stepPhysics([scrapeA, scrapeB], 1 / 60);
    if (scrapeA.fineTuneRemain > 0 || scrapeB.fineTuneRemain > 0) {
      opened = true;
    }
  }
  if (!opened) {
    throw new Error('M3：轻蹭也应打开 0.3s 微调窗');
  }
  if (scrapeA.hp !== MAX_HP || scrapeB.hp !== MAX_HP) {
    throw new Error('M3：轻蹭仍不应掉血');
  }

  const wallBall = createBallBody({
    x: 0.6,
    y: 6,
    color: 0xe24a4a,
    vx: -8,
    vy: 0,
    facingX: -1,
    facingY: 0,
  });
  let wallTune = false;
  for (let i = 0; i < 8; i += 1) {
    stepPhysics([wallBall], 1 / 60);
    if (wallBall.fineTuneRemain > 0) {
      wallTune = true;
    }
  }
  if (!wallTune) {
    throw new Error('M3：撞墙应打开微调窗');
  }
}
