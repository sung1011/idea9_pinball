import { createBallBody } from './ballBody';
import { createActionBus } from '../input/actionBus';
import { bindPcInput, TOUCH_AIM_TAP_SLOP_PX } from '../input/pcInput';
import { createPlayerControl } from '../input/playerControl';
import { createTouchPad } from '../input/touchPad';
import type { SkillSlot } from '../input/actionTypes';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function fireOn(
  el: EventTarget,
  type: string,
  init: PointerEventInit,
): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      ...init,
    }),
  );
}

/** 触屏瞄准：点空白瞄向并释放；滑动只改向；技能键再点仍释放；鼠键路径不动。 */
export function verifyTouchAim(): void {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px';
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  canvas.style.cssText = 'width:200px;height:200px;display:block';
  host.appendChild(canvas);
  document.body.appendChild(host);

  const identity = { scale: 1, offsetX: 0, offsetY: 0 };
  const cleanups: Array<() => void> = [];
  const attach = (
    bus: ReturnType<typeof createActionBus>,
    getAimingSlot: () => SkillSlot | 0,
  ): (() => void) => {
    const unbind = bindPcInput({
      bus,
      canvas,
      getTransform: () => identity,
      getAimingSlot,
    });
    cleanups.push(unbind);
    return unbind;
  };

  const tapAt = (x: number, y: number, pointerType: string): void => {
    const common: PointerEventInit = {
      pointerType,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
    };
    fireOn(canvas, 'pointerdown', common);
    fireOn(canvas, 'pointerup', { ...common, buttons: 0 });
  };

  try {
    let aiming: SkillSlot | 0 = 1;
    const bus = createActionBus();
    const unbind = attach(bus, () => aiming);
    tapAt(10, 20, 'touch');
    const tap = bus.sample(10, 10);
    assert(tap.confirmRelease, '触屏瞄准：点空白应 confirm/release');
    assert(tap.hasAim, '触屏瞄准：点空白应先把 aim 对准触点');
    assert(Math.abs(tap.aimX) < 1e-6 && Math.abs(tap.aimY - 1) < 1e-6, '触屏瞄准：点空白 aim 应对准触点世界坐标');
    assert(Math.abs((tap.pointerY ?? 0) - 20) < 1e-6, '触屏瞄准：指针应为触点世界坐标');

    aiming = 1;
    fireOn(canvas, 'pointerdown', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
    });
    fireOn(canvas, 'pointermove', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10 + TOUCH_AIM_TAP_SLOP_PX + 8,
    });
    fireOn(canvas, 'pointerup', {
      pointerType: 'touch',
      button: 0,
      buttons: 0,
      clientX: 10,
      clientY: 10 + TOUCH_AIM_TAP_SLOP_PX + 8,
    });
    const drag = bus.sample(10, 10);
    assert(!drag.confirmRelease, '触屏瞄准：滑动抬手不应释放');
    assert(drag.hasAim, '触屏瞄准：滑动应只改瞄准方向');
    assert(drag.aimY > 0.9, '触屏瞄准：滑动 aim 应跟触点');

    aiming = 0;
    tapAt(40, 10, 'touch');
    const idle = bus.sample(10, 10);
    assert(!idle.confirmRelease, '触屏瞄准：未进瞄时点空白只纠偏、不释放');
    assert(idle.hasAim, '触屏瞄准：未进瞄点空白仍应改 aim');

    aiming = 1;
    fireOn(canvas, 'pointerdown', {
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      clientX: 30,
      clientY: 10,
    });
    const mouseDown = bus.sample(10, 10);
    assert(mouseDown.confirmRelease, '触屏瞄准：鼠标左键仍应在按下时释放');
    fireOn(canvas, 'pointerup', {
      pointerType: 'mouse',
      button: 0,
      buttons: 0,
      clientX: 30,
      clientY: 10,
    });
    const mouseUp = bus.sample(10, 10);
    assert(!mouseUp.confirmRelease, '触屏瞄准：鼠标抬起不应再推一次释放');

    const hud = document.createElement('button');
    hud.type = 'button';
    hud.setAttribute('data-touch-control', 'help');
    hud.style.cssText = 'position:absolute;left:0;top:0;width:24px;height:24px';
    host.appendChild(hud);
    aiming = 1;
    fireOn(hud, 'pointerdown', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 8,
      clientY: 8,
    });
    fireOn(hud, 'pointerup', {
      pointerType: 'touch',
      button: 0,
      buttons: 0,
      clientX: 8,
      clientY: 8,
    });
    const hudTap = bus.sample(10, 10);
    assert(!hudTap.confirmRelease, '触屏瞄准：点 HUD 控件不应当成点空白释放');

    unbind();

    const padBus = createActionBus();
    const padUnbind = attach(padBus, () => 1);
    createTouchPad(host, padBus);
    const skillBtn = host.querySelector<HTMLButtonElement>('button.touchSkillBtn');
    if (!skillBtn) {
      throw new Error('触屏瞄准：应有技能键');
    }
    fireOn(skillBtn, 'pointerdown', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 20,
      clientY: 180,
    });
    const skillTap = padBus.sample(10, 10);
    assert(skillTap.skillPress === 1, '触屏瞄准：再点同技能键仍应走技能按下');
    assert(!skillTap.confirmRelease, '触屏瞄准：点技能键不应抢成点空白释放');
    fireOn(skillBtn, 'pointerup', {
      pointerType: 'touch',
      button: 0,
      buttons: 0,
      clientX: 20,
      clientY: 180,
    });
    padUnbind();

    const player = createBallBody({
      x: 10,
      y: 10,
      color: 0xe24a4a,
      facingX: 1,
      facingY: 0,
    });
    const control = createPlayerControl();
    const playBus = createActionBus();
    const playUnbind = attach(playBus, () => control.getAimingSlot());
    control.tick(player, playBus.sample(player.x, player.y), 0);
    playBus.reset();
    control.tick(
      player,
      {
        aimX: 1,
        aimY: 0,
        hasAim: true,
        steerAim: true,
        skillPress: 1,
        confirmRelease: false,
        cancelAim: false,
      },
      0,
    );
    assert(control.getAimingSlot() === 1, '触屏瞄准：应按技能进入瞄准');
    tapAt(10, 20, 'touch');
    control.tick(player, playBus.sample(player.x, player.y), 0);
    assert(control.getAimingSlot() === 0, '触屏瞄准：点空白应释放当前瞄准技能');
    assert(control.getWindup()?.slot === 1, '触屏瞄准：点空白释放后应走现有前摇');
    assert(Math.abs(player.facingY - 1) < 1e-6, '触屏瞄准：释放朝向应对准触点');
    playUnbind();

    const dragPlayer = createBallBody({
      x: 10,
      y: 10,
      color: 0xe24a4a,
      facingX: 1,
      facingY: 0,
    });
    const dragCtl = createPlayerControl();
    const dragBus = createActionBus();
    const dragUnbind = attach(dragBus, () => dragCtl.getAimingSlot());
    dragCtl.tick(
      dragPlayer,
      {
        aimX: 1,
        aimY: 0,
        hasAim: true,
        steerAim: true,
        skillPress: 2,
        confirmRelease: false,
        cancelAim: false,
      },
      0,
    );
    fireOn(canvas, 'pointerdown', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
    });
    fireOn(canvas, 'pointermove', {
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10 + TOUCH_AIM_TAP_SLOP_PX + 8,
    });
    fireOn(canvas, 'pointerup', {
      pointerType: 'touch',
      button: 0,
      buttons: 0,
      clientX: 10,
      clientY: 10 + TOUCH_AIM_TAP_SLOP_PX + 8,
    });
    dragCtl.tick(dragPlayer, dragBus.sample(dragPlayer.x, dragPlayer.y), 0);
    assert(dragCtl.getAimingSlot() === 2, '触屏瞄准：滑动抬手应仍停在瞄准');
    assert(!dragCtl.getWindup(), '触屏瞄准：滑动不应进入前摇');
    dragUnbind();
  } finally {
    while (cleanups.length > 0) {
      cleanups.pop()?.();
    }
    host.remove();
  }
}
