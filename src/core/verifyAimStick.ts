import { createBallBody } from './ballBody';
import { AIM_STICK_DEADZONE, AIM_STICK_SIZE_PX, AIM_STICK_SIZE_SHORT_PX, readStickOffset } from '../input/aimStick';
import { createActionBus } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { createPlayerControl } from '../input/playerControl';
import { createTouchPad } from '../input/touchPad';
import { applyStageVars, computeLandscapeStage } from '../ui/stageLayout';
import type { SkillSlot } from '../input/actionTypes';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function near(a: number, b: number, eps = 0.08): boolean {
  return Math.abs(a - b) < eps;
}

function fireOn(el: EventTarget, type: string, init: PointerEventInit): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      ...init,
    }),
  );
}

function localBox(el: HTMLElement, host: HTMLElement): {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
} {
  const a = el.getBoundingClientRect();
  const h = host.getBoundingClientRect();
  return {
    left: a.left - h.left,
    top: a.top - h.top,
    right: a.right - h.left,
    bottom: a.bottom - h.top,
    width: a.width,
    height: a.height,
  };
}

function overlaps(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
}

/** 左下瞄准摇杆：单位方向、死区、钳制、回中、移动中朝向不漂、多指、松手不放技能。 */
export function verifyAimStick(): void {
  const r = 50;
  const dead = readStickOffset(r * 0.05, 0, r);
  assert(!dead.active && near(dead.dirX, 0, 1e-6), '摇杆：12% 死区内不应输出朝向');
  const right = readStickOffset(40, 0, r);
  assert(right.active && near(right.dirX, 1, 1e-6) && near(right.dirY, 0, 1e-6), '摇杆：右推应输出单位 +X');
  const upLeft = readStickOffset(-30, -40, r);
  const n = Math.hypot(upLeft.dirX, upLeft.dirY);
  assert(upLeft.active && near(n, 1, 1e-6), '摇杆：斜向应归一化');
  const clamped = readStickOffset(400, 0, r);
  assert(near(clamped.knobX, r, 1e-6) && near(clamped.dirX, 1, 1e-6), '摇杆：超出外圈应钳在半径上');
  assert(AIM_STICK_DEADZONE === 0.12, '摇杆：死区应为约 12%');
  assert(AIM_STICK_SIZE_PX >= 96 && AIM_STICK_SIZE_PX <= 112, '摇杆：外径应在 96–112 CSS px');
  assert(AIM_STICK_SIZE_SHORT_PX >= 96 && AIM_STICK_SIZE_SHORT_PX <= 112, '摇杆：矮窗外径仍应在 96–112');

  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:0;top:0;width:800px;height:450px;--hud-pad:8px;--hud-safe-left:0px;--hud-safe-bottom:0px;--hud-safe-right:0px;--hud-safe-top:0px';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  host.appendChild(canvas);
  document.body.appendChild(host);
  const bus = createActionBus();
  const pad = createTouchPad(host, bus, { forceStick: true, holdMs: 0 });
  const stick = host.querySelector<HTMLDivElement>('.touchStick');
  const head = host.querySelector<HTMLDivElement>('.touchStickHead');
  const skillBtn = host.querySelector<HTMLButtonElement>('button.touchSkillBtn');
  if (!stick || !head || !skillBtn) {
    host.remove();
    throw new Error('摇杆：应有底座、摇杆头与技能键');
  }
  assert(stick.getAttribute('data-touch-control') === 'stick', '摇杆：应标 data-touch-control，不透传战场');

  const identity = { scale: 1, offsetX: 0, offsetY: 0 };
  let aiming: SkillSlot | 0 = 1;
  const unbind = bindPcInput({
    bus,
    canvas,
    getTransform: () => identity,
    getAimingSlot: () => aiming,
  });

  try {
    const box = stick.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    fireOn(stick, 'pointerdown', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 1,
      clientX: cx + 36,
      clientY: cy,
    });
    fireOn(stick, 'pointermove', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 1,
      clientX: cx + 36,
      clientY: cy,
    });
    const atA = bus.sample(10, 10);
    const atB = bus.sample(28, 14);
    assert(atA.hasAim && near(atA.aimX, 1, 0.08) && Math.abs(atA.aimY) < 0.12, '摇杆：右推应为 +X 单位方向');
    assert(atB.hasAim && near(atB.aimX, atA.aimX, 1e-6) && near(atB.aimY, atA.aimY, 1e-6), '摇杆：角色移动后朝向应仍跟摇杆，不漂向世界点');
    assert(!atA.confirmRelease && !atB.confirmRelease, '摇杆：拖动不应产生释放技能');
    assert(head.style.transform.includes('translate'), '摇杆：拖动时应挪动摇杆头');

    fireOn(skillBtn, 'pointerdown', {
      pointerType: 'touch',
      pointerId: 22,
      button: 0,
      buttons: 1,
      clientX: skillBtn.getBoundingClientRect().left + 8,
      clientY: skillBtn.getBoundingClientRect().top + 8,
    });
    const both = bus.sample(10, 10);
    assert(both.skillPress === 1, '摇杆：右手点技能应与左手拖动摇杆并行');
    assert(both.hasAim && near(both.aimX, 1, 0.08), '摇杆：点技能时左手朝向不应被覆盖');
    assert(!both.confirmRelease, '摇杆：点技能不应变成点空白释放');
    fireOn(skillBtn, 'pointerup', {
      pointerType: 'touch',
      pointerId: 22,
      button: 0,
      buttons: 0,
    });

    fireOn(stick, 'pointerup', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 0,
      clientX: cx + 36,
      clientY: cy,
    });
    const letGo = bus.sample(10, 10);
    assert(!letGo.confirmRelease, '摇杆：松手回中不应释放技能');
    assert(!letGo.hasAim, '摇杆：松手后应停止摇杆改向');
    assert(head.style.transform === 'translate(0px, 0px)' || head.style.transform === '', '摇杆：松手摇杆头应回中');

    fireOn(stick, 'pointerdown', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 1,
      clientX: cx + 4,
      clientY: cy,
    });
    const dz = bus.sample(10, 10);
    assert(!dz.hasAim, '摇杆：死区内按住不应改向');
    fireOn(stick, 'pointercancel', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 0,
    });
    const canceled = bus.sample(12, 12);
    assert(!canceled.hasAim && !canceled.confirmRelease, '摇杆：pointercancel 应清掉残留');

    fireOn(stick, 'pointerdown', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 1,
      clientX: cx,
      clientY: cy + 30,
    });
    window.dispatchEvent(new Event('blur'));
    const blurred = bus.sample(10, 10);
    assert(!blurred.hasAim, '摇杆：失焦应清掉残留');

    const player = createBallBody({ x: 10, y: 10, color: 1, facingX: 1, facingY: 0 });
    const control = createPlayerControl();
    fireOn(stick, 'pointerdown', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 1,
      clientX: cx,
      clientY: cy - 32,
    });
    control.tick(player, bus.sample(player.x, player.y), 0);
    const faceY = player.aimY;
    player.x = 18;
    player.y = 6;
    control.tick(player, bus.sample(player.x, player.y), 0);
    assert(player.hasAim && near(player.aimY, faceY, 1e-6) && player.aimY < -0.7, '摇杆：移动中枪尖朝向应保持摇杆方向');
    pad.sync({
      aimingSlot: 0,
      skillCds: [0, 0, 0, 0],
      fineTuneOn: false,
      stickEnabled: false,
    });
    assert(stick.classList.contains('isOff'), '摇杆：死亡/结算应隐藏');
    const dead = bus.sample(player.x, player.y);
    assert(!dead.hasAim, '摇杆：关闭后不应继续改向');
    pad.sync({
      aimingSlot: 0,
      skillCds: [0, 0, 0, 0],
      fineTuneOn: false,
      stickEnabled: true,
    });
    bus.reset();
    pad.releaseStick();
    const restarted = bus.sample(10, 10);
    assert(!restarted.hasAim && !restarted.confirmRelease, '摇杆：重开应清掉残留');

    aiming = 1;
    fireOn(canvas, 'pointerdown', {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: 400,
      clientY: 40,
    });
    const mouse = bus.sample(400, 200);
    assert(mouse.confirmRelease, '摇杆：鼠标左键仍应在按下时释放');
    assert(mouse.hasAim && mouse.aimY < -0.7, '摇杆：纯鼠标瞄准应保留，不经摇杆世界点');
    fireOn(canvas, 'pointerup', {
      pointerType: 'mouse',
      pointerId: 1,
      button: 0,
      buttons: 0,
      clientX: 400,
      clientY: 40,
    });

    aiming = 1;
    fireOn(stick, 'pointerdown', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 1,
      clientX: cx + 30,
      clientY: cy,
    });
    fireOn(stick, 'pointerup', {
      pointerType: 'touch',
      pointerId: 11,
      button: 0,
      buttons: 0,
      clientX: cx + 30,
      clientY: cy,
    });
    const noTapRelease = bus.sample(10, 10);
    assert(!noTapRelease.confirmRelease, '摇杆：点在摇杆上不应当成战场点空白释放');
  } finally {
    unbind();
    host.remove();
  }

  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const layoutAt = (w: number, h: number, safeLeft: number, safeBottom: number, label: string): void => {
    const box = document.createElement('div');
    box.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;--hud-pad:8px;--hud-safe-left:${safeLeft}px;--hud-safe-right:0px;--hud-safe-top:0px;--hud-safe-bottom:${safeBottom}px`;
    const pad = createTouchPad(box, createActionBus(), { forceStick: true });
    document.body.appendChild(box);
    applyStageVars(box, computeLandscapeStage(w, h, none));
    pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false });
    const stickEl = box.querySelector<HTMLElement>('.touchStick');
    const skills = box.querySelector<HTMLElement>('.touchSkills');
    if (!stickEl || !skills) {
      box.remove();
      throw new Error(`${label}：应有摇杆与技能行`);
    }
    const s = localBox(stickEl, box);
    const k = localBox(skills, box);
    assert(s.width >= 96 && s.width <= 112, `${label}：摇杆外径应约 96–112（实际 ${s.width}）`);
    assert(Math.abs(s.width - s.height) < 1, `${label}：摇杆应为圆`);
    assert(s.left + 1 >= safeLeft, `${label}：摇杆应避开左侧安全区`);
    assert(h - s.bottom + 1 >= safeBottom, `${label}：摇杆应避开底部安全区`);
    assert(s.left < 24 + safeLeft, `${label}：摇杆应贴左下`);
    assert(h - s.bottom < 24 + safeBottom, `${label}：摇杆应贴底`);
    assert(!overlaps(s, k), `${label}：摇杆不应叠到右下技能`);
    assert(getComputedStyle(box).transform === 'none' || getComputedStyle(box).transform === 'matrix(1, 0, 0, 1, 0, 0)', `${label}：不对 #app 旋转`);
    box.remove();
  };

  layoutAt(1920, 1080, 0, 0, '摇杆：1920×1080');
  layoutAt(2340, 1080, 0, 0, '摇杆：2340×1080');
  layoutAt(1920, 1080, 44, 21, '摇杆：触屏横屏安全区');
  layoutAt(667, 375, 0, 0, '摇杆：矮横窗');
}
