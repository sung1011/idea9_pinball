import { Application, Container } from 'pixi.js';
import { createBallBody } from './core/ballBody';
import { MAP_HEIGHT, MAP_WIDTH } from './core/constants';
import { stepPhysics } from './core/physicsStep';
import { verifyM2 } from './core/verifyM2';
import { verifyM3 } from './core/verifyM3';
import { bindDebugVelocity } from './debug/debugVelocity';
import { createActionBus } from './input/actionBus';
import { bindPcInput } from './input/pcInput';
import { createPlayerControl } from './input/playerControl';
import { createTouchPad } from './input/touchPad';
import { createAimPreview } from './render/aimPreview';
import { createArenaView } from './render/arenaView';
import { createBallView } from './render/ballView';
import { applyWorldTransform, fitWorldToScreen, type WorldTransform } from './render/worldTransform';
import { createHpHud } from './ui/hpHud';
import './style.css';

const VIEW_PADDING_PX = 32;

function createPlaceholderBalls() {
  return [
    createBallBody({ x: 6, y: 3.5, color: 0xe24a4a, label: '红', facingX: 1, facingY: 0 }),
    createBallBody({ x: 14, y: 8.5, color: 0x3d7cf0, label: '蓝', facingX: -1, facingY: 0 }),
  ];
}

function mountDebugHint(host: HTMLElement): void {
  const hint = document.createElement('div');
  hint.className = 'debugHint';
  hint.textContent =
    '红球：1–4/QWE 瞄，再按同键或左键放，右键/Esc/点空白取消。调试 C正对 Z背后 X侧面 V轻蹭 R重置';
  host.appendChild(hint);
}

async function boot(): Promise<void> {
  verifyM2();
  verifyM3();

  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) {
    throw new Error('未找到 #app');
  }

  const app = new Application();
  await app.init({
    resizeTo: host,
    background: 0x082424,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  host.appendChild(app.canvas);
  mountDebugHint(host);

  const world = new Container();
  world.addChild(createArenaView());

  const balls = createPlaceholderBalls();
  const player = balls[0];
  const views = balls.map((ball) => createBallView(ball));
  for (const view of views) {
    world.addChild(view.root);
  }
  const aimPreview = createAimPreview();
  world.addChild(aimPreview.root);
  app.stage.addChild(world);

  let transform: WorldTransform = fitWorldToScreen(
    app.screen.width,
    app.screen.height,
    MAP_WIDTH,
    MAP_HEIGHT,
    VIEW_PADDING_PX,
  );

  const layout = (): void => {
    transform = fitWorldToScreen(
      app.screen.width,
      app.screen.height,
      MAP_WIDTH,
      MAP_HEIGHT,
      VIEW_PADDING_PX,
    );
    applyWorldTransform(world, transform);
  };

  layout();
  app.renderer.on('resize', layout);

  const hpHud = createHpHud(host);
  hpHud.sync(balls);

  const bus = createActionBus();
  const control = createPlayerControl();
  const touchPad = createTouchPad(host, bus);
  bindPcInput({
    canvas: app.canvas,
    getTransform: () => transform,
    bus,
  });
  bindDebugVelocity({
    balls,
    onReset: () => {
      control.reset();
      bus.reset();
      hpHud.resetLog();
    },
  });

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    const sample = bus.sample(player.x, player.y);
    control.tick(player, sample, dt);
    const step = stepPhysics(balls, dt);
    const aimingSlot = control.getAimingSlot();
    const skillCd = control.getSkillCd();
    hpHud.pushHits(step.hits);
    hpHud.sync(balls, { aimingSlot, skillCd });
    touchPad.sync({
      aimingSlot,
      skillCd,
      fineTuneOn: player.fineTuneRemain > 0,
    });
    aimPreview.sync(player, aimingSlot, sample);
    for (let i = 0; i < balls.length; i += 1) {
      views[i].sync(balls[i]);
    }
  });
}

boot().catch((err: unknown) => {
  console.error(err);
});
