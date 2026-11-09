import { BALL_RADIUS, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { createActionBus } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { canLockWorldView, createWorldViewSession, enterWorldView, followWorldView } from '../render/worldViewLock';
import { logicalToScreen, screenToLogical } from '../render/worldTransform';
import { applyStageVars, clientToHostLocal, computeLandscapeStage } from '../ui/stageLayout';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

const NONE = { top: 0, right: 0, bottom: 0, left: 0 };

function near(a: number, b: number, eps = 1e-4): boolean {
  return Math.abs(a - b) < eps;
}

/** 首次稳定横屏再 cover 锁比例：竖窗不锁死，横屏期内缩窗裁切、扩窗留背景，刷新才重新适配。 */
export function verifyWorldViewLock(): void {
  assert(MAP_HEIGHT === 20, '锁定视野：世界高度应仍为 20');
  assert(MAP_WIDTH === (20 * 956) / 440, '锁定视野：世界宽度应仍为 20×956/440');
  assert(BALL_RADIUS === 1, '锁定视野：英雄半径应仍为 1');

  const enter1920 = enterWorldView(1920, 1080);
  const cover1920 = computeLandscapeStage(1920, 1080, NONE);
  assert(near(enter1920.lock.scale, cover1920.height / MAP_HEIGHT), '锁定视野：1920 进入应按现有 cover 适配');
  assert(near(enter1920.lock.scale, 1080 / 20), '锁定视野：16:9 进入世界单位高度应对齐视口高');
  assert(near(enter1920.lock.pixelH, 1080) && enter1920.lock.pixelW > 1920, '锁定视野：1920 进入应左右略裁');
  const heroPx = BALL_RADIUS * enter1920.lock.scale;
  const unitPx = enter1920.lock.scale;

  const shrink = followWorldView(1280, 720, enter1920.lock);
  assert(shrink.lock.scale === enter1920.lock.scale, '锁定视野：缩窗不得改比例');
  assert(near(shrink.lock.pixelW, enter1920.lock.pixelW) && near(shrink.lock.pixelH, enter1920.lock.pixelH), '锁定视野：缩窗不得改战场像素尺寸');
  assert(BALL_RADIUS * shrink.lock.scale === heroPx, '锁定视野：缩窗后英雄显示大小应不变');
  assert(shrink.lock.scale === unitPx, '锁定视野：缩窗后世界单位像素应不变');
  assert(shrink.stage.x < -1 && shrink.stage.y < -1, '锁定视野：窗口小了应裁切');
  const shrinkMid = screenToLogical(640, 360, shrink.transform);
  assert(near(shrinkMid.x, MAP_WIDTH / 2, 0.05) && near(shrinkMid.y, MAP_HEIGHT / 2, 0.05), '锁定视野：缩窗后视口中点仍应对准世界中心');

  const expand = followWorldView(2560, 1080, enter1920.lock);
  assert(expand.lock.scale === enter1920.lock.scale, '锁定视野：扩窗不得改比例');
  assert(near(expand.lock.pixelW, enter1920.lock.pixelW) && near(expand.lock.pixelH, enter1920.lock.pixelH), '锁定视野：扩窗不得改战场像素尺寸');
  assert(BALL_RADIUS * expand.lock.scale === heroPx, '锁定视野：扩窗后英雄显示大小应不变');
  assert(expand.stage.x > 1 && near(expand.stage.y, 0, 1), '锁定视野：窗口大了应左右留空、不拉伸');
  assert(near(expand.stage.width / expand.stage.height, MAP_WIDTH / MAP_HEIGHT), '锁定视野：留空时仍保持世界比例');
  const expandMid = screenToLogical(1280, 540, expand.transform);
  assert(near(expandMid.x, MAP_WIDTH / 2, 0.05) && near(expandMid.y, MAP_HEIGHT / 2, 0.05), '锁定视野：扩窗后视口中点仍应对准世界中心');
  const expandBack = logicalToScreen(expandMid.x, expandMid.y, expand.transform);
  assert(near(expandBack.x, 1280, 0.5) && near(expandBack.y, 540, 0.5), '锁定视野：扩窗后屏幕↔世界应对得上');

  const enter2340 = enterWorldView(2340, 1080);
  const cover2340 = computeLandscapeStage(2340, 1080, NONE);
  assert(near(enter2340.lock.scale, cover2340.height / MAP_HEIGHT), '锁定视野：2340 进入应按当前窗 cover 适配');
  assert(near(enter2340.lock.scale, 1080 / 20), '锁定视野：2340 进入高度应对齐视口');
  assert(enter2340.lock.pixelW >= 2340 - 20, '锁定视野：2340 进入应接近看全宽');

  const refreshShrink = enterWorldView(1280, 720);
  assert(refreshShrink.lock.scale < enter1920.lock.scale, '锁定视野：刷新到更小窗应重新适配');
  assert(near(refreshShrink.lock.scale, 720 / 20), '锁定视野：刷新 1280×720 应按新窗 cover');

  const refreshWide = enterWorldView(2560, 1080);
  assert(refreshWide.lock.scale > enter1920.lock.scale, '锁定视野：刷新到超宽窗应重新适配');

  const session = createWorldViewSession();
  const first = session.enter(1920, 1080);
  const afterFollow = session.follow(1600, 900);
  assert(session.getLock()?.scale === first.lock.scale, '锁定视野：follow 不得解锁');
  assert(afterFollow.lock.scale === first.lock.scale, '锁定视野：会话缩窗应保持进入时比例');
  session.follow(1920, 1080);
  session.follow(2340, 1080);
  assert(session.getLock()?.scale === first.lock.scale, '锁定视野：多次窗口变化仍不得解锁');
  const reentered = session.enter(1280, 720);
  assert(reentered.lock.scale !== first.lock.scale, '锁定视野：再次 enter（刷新）才重新适配');

  assert(canLockWorldView(844, 390) && !canLockWorldView(390, 844), '锁定视野：宽≥高才算稳定横屏');
  assert(canLockWorldView(800, 800), '锁定视野：正方窗应按横屏锁');

  const phone = createWorldViewSession();
  const port = phone.enter(390, 844);
  assert(phone.getLock() === null, '锁定视野：竖窗 enter 不应按竖屏比例永久锁死');
  assert(near(port.lock.scale, 844 / 20), '锁定视野：竖窗仍可临时 cover，不留黑边逻辑');
  const stillPort = phone.follow(390, 800);
  assert(phone.getLock() === null, '锁定视野：竖窗期内 follow 仍不应锁死');
  assert(near(stillPort.lock.scale, 800 / 20), '锁定视野：未锁前竖窗可按当前窗临时 cover');
  const land = phone.follow(844, 390);
  const expectLand = enterWorldView(844, 390);
  assert(phone.getLock() !== null, '锁定视野：第一次稳定横屏应锁定');
  assert(near(land.lock.scale, expectLand.lock.scale), '锁定视野：竖→横不刷新后 scale 应落到横档');
  assert(near(land.lock.scale, 390 / 20), '锁定视野：844×390 应按横屏高 cover');
  assert(land.lock.scale < port.lock.scale - 10, '锁定视野：横档 scale 应明显低于竖档 42.2');
  const landNW = screenToLogical(0, 0, land.transform);
  const landSE = screenToLogical(844, 390, land.transform);
  assert(landNW.x < 0.2 && MAP_WIDTH - landSE.x < 0.2, '锁定视野：竖→横后可见宽应回到 cover 预期（约全图）');
  assert(near(landNW.y, 0, 0.05) && near(landSE.y, MAP_HEIGHT, 0.05), '锁定视野：竖→横后高度应看全');
  const landShrink = phone.follow(844, 334);
  assert(landShrink.lock.scale === land.lock.scale, '锁定视野：横屏期内变矮只 follow、不改比例');
  const landDirect = createWorldViewSession().enter(844, 390);
  assert(landDirect.lock.scale === land.lock.scale, '锁定视野：横屏直进应一次适配即锁到同一档');
  assert(createWorldViewSession().getLock() === null, '锁定视野：新会话刷新前不应带旧锁');

  const se = createWorldViewSession();
  se.enter(375, 667);
  assert(se.getLock() === null, '锁定视野：SE 竖窗不应锁死');
  const seLand = se.follow(667, 375);
  const seExpect = enterWorldView(667, 375);
  assert(near(seLand.lock.scale, seExpect.lock.scale), '锁定视野：SE 竖→横应锁到横屏 cover 档');
  const seNW = screenToLogical(0, 0, seLand.transform);
  const seSE = screenToLogical(667, 375, seLand.transform);
  assert(near(seNW.y, 0, 0.08) && near(seSE.y, MAP_HEIGHT, 0.08), '锁定视野：SE 竖→横高度应看全');
  assert(seNW.x > 3 && seNW.x < 5, '锁定视野：SE 横屏更方，左右裁切应为 cover 少量而非竖档');

  const lockedThenPort = createWorldViewSession();
  const pcLock = lockedThenPort.enter(1920, 1080);
  lockedThenPort.follow(390, 844);
  assert(lockedThenPort.getLock()?.scale === pcLock.lock.scale, '锁定视野：已锁横屏后再竖持只 follow');

  const refreshWait = createWorldViewSession();
  refreshWait.enter(390, 844);
  refreshWait.follow(844, 390);
  const phoneScale = refreshWait.getLock()?.scale ?? 0;
  refreshWait.enter(390, 844);
  assert(refreshWait.getLock() === null, '锁定视野：刷新到竖窗应清锁，等下次横屏');
  const refreshLand = refreshWait.follow(1280, 720);
  assert(near(refreshLand.lock.scale, 720 / 20), '锁定视野：刷新后第一次横屏应按新窗 cover');
  assert(refreshLand.lock.scale !== phoneScale, '锁定视野：刷新重适配不应沿用上一横屏锁');

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:400px';
  document.body.appendChild(host);
  try {
    applyStageVars(host, afterFollow.stage);
    assert(host.classList.contains('isShortHud'), '锁定视野：缩窗后 HUD 仍可按现有四角紧凑样式，不整层锁到窗外');
    host.style.width = '1920px';
    host.style.height = '1080px';
    applyStageVars(host, first.stage);
    assert(!host.classList.contains('isShortHud'), '锁定视野：大窗 HUD 不应误标矮窗');
  } finally {
    host.remove();
  }

  const aimHost = document.createElement('div');
  aimHost.style.cssText = 'position:fixed;left:0;top:0;width:2560px;height:1080px';
  const canvas = document.createElement('canvas');
  canvas.width = 2560;
  canvas.height = 1080;
  canvas.style.cssText = 'width:2560px;height:1080px;display:block';
  aimHost.appendChild(canvas);
  document.body.appendChild(aimHost);
  const bus = createActionBus();
  const unbind = bindPcInput({
    bus,
    canvas,
    getTransform: () => expand.transform,
    getAimingSlot: () => 1,
  });
  try {
    const center = logicalToScreen(MAP_WIDTH / 2, MAP_HEIGHT / 2, expand.transform);
    const rect = aimHost.getBoundingClientRect();
    canvas.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: rect.left + center.x,
        clientY: rect.top + center.y,
      }),
    );
    const sample = bus.sample(0, 0);
    const local = clientToHostLocal(aimHost, rect.left + center.x, rect.top + center.y);
    const world = screenToLogical(local.x, local.y, expand.transform);
    assert(near(world.x, MAP_WIDTH / 2, 0.08) && near(world.y, MAP_HEIGHT / 2, 0.08), '锁定视野：扩窗后点击应对准实际画面世界坐标');
    assert(sample.hasAim, '锁定视野：扩窗后鼠标仍应能瞄准');
    const touch = {
      bubbles: true,
      cancelable: true,
      pointerId: 9,
      pointerType: 'touch' as const,
      button: 0,
      clientX: rect.left + center.x,
      clientY: rect.top + center.y,
    };
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...touch, buttons: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...touch, buttons: 0 }));
    const released = bus.sample(0, 0);
    assert(released.confirmRelease, '锁定视野：扩窗后触屏点空白仍应释放');
  } finally {
    unbind();
    aimHost.remove();
  }
}
