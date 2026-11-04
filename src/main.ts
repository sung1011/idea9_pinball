import { Application, Container } from 'pixi.js';
import { MAP_HEIGHT, MAP_WIDTH } from './core/constants';
import { createMatchRoster, createMatchSession } from './core/matchSession';
import { stepPhysics } from './core/physicsStep';
import { createSimpleBot } from './core/simpleBot';
import { verifyM2 } from './core/verifyM2';
import { verifyM3 } from './core/verifyM3';
import { verifyM35 } from './core/verifyM35';
import { verifyM4 } from './core/verifyM4';
import { verifyM5 } from './core/verifyM5';
import { bindDebugMatch } from './debug/debugMatch';
import { bindDebugVelocity } from './debug/debugVelocity';
import { createActionBus } from './input/actionBus';
import { bindPcInput } from './input/pcInput';
import { createPlayerControl } from './input/playerControl';
import { createTouchPad } from './input/touchPad';
import { createAimPreview } from './render/aimPreview';
import { createArenaView } from './render/arenaView';
import { createBallView } from './render/ballView';
import { applyWorldTransform, fitWorldToScreen, type WorldTransform } from './render/worldTransform';
import { createHelpCard } from './ui/helpCard';
import { createHpHud } from './ui/hpHud';
import { createMatchHud } from './ui/matchHud';
import { createResultPanel } from './ui/resultPanel';
import './style.css';

const VIEW_PADDING_PX = 32;

function mountDebugHint(host: HTMLElement): void {
  const hint = document.createElement('div');
  hint.className = 'debugHint';
  hint.textContent =
    '钩刺：1勾 2捅 3推 4急停 · 点地纠偏 · 同键/左键释放。R重开  F/G±10分  T跳30s  Y时钟1s  ·  Z背后×1.35  X侧面×0.7  C正面×1.0  V轻蹭';
  host.appendChild(hint);
}

async function boot(): Promise<void> {
  verifyM2();
  verifyM3();
  verifyM35();
  verifyM4();
  verifyM5();

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
  const arena = createArenaView();
  world.addChild(arena.root);

  const balls = createMatchRoster();
  const player = balls[0];
  const bots = balls.slice(1).map((ball) => createSimpleBot(ball));
  const match = createMatchSession(balls);
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
  const matchHud = createMatchHud(host);
  createHelpCard(host);
  hpHud.sync(balls);
  matchHud.sync(match.snapshot(), balls);

  const bus = createActionBus();
  const control = createPlayerControl();
  const touchPad = createTouchPad(host, bus);
  bindPcInput({
    canvas: app.canvas,
    getTransform: () => transform,
    bus,
  });

  const restart = (): void => {
    match.reset();
    control.reset();
    bus.reset();
    hpHud.resetLog();
    for (const bot of bots) {
      bot.reset();
    }
  };

  const resultPanel = createResultPanel(host, restart);
  resultPanel.sync(match.snapshot());

  bindDebugVelocity({
    balls,
    onReset: restart,
    onPairDebug: () => {
      control.reset();
      for (const bot of bots) {
        bot.reset();
      }
    },
  });
  bindDebugMatch(match);

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    const snap = match.snapshot();
    const sample = bus.sample(player.x, player.y);
    const skillHits = control.tick(player, sample, dt, balls);
    for (const bot of bots) {
      skillHits.push(...bot.tick(dt, balls, snap.phase));
    }
    const step = stepPhysics(balls, dt);
    skillHits.push(...control.afterPhysics(player, dt, balls, step.wallHitIds.includes(player.id)));
    for (let i = 0; i < bots.length; i += 1) {
      skillHits.push(
        ...bots[i].afterPhysics(dt, balls, step.wallHitIds.includes(balls[i + 1].id)),
      );
    }
    const frameHits = [...step.hits, ...skillHits];
    const events = match.tick(dt, frameHits);
    const next = match.snapshot();
    const aimingSlot = control.getAimingSlot();
    const skillCds = control.getSkillCds();
    const windup = control.getWindup();
    if (events.length > 0 || frameHits.length > 0) {
      hpHud.pushHits(frameHits);
    }
    hpHud.sync(balls, { aimingSlot, skillCds, windup, respawns: next.respawns });
    matchHud.sync(next, balls);
    resultPanel.sync(next);
    arena.syncHold(next.midpoint);
    touchPad.sync({
      aimingSlot,
      skillCds,
      windupSlot: windup?.slot ?? 0,
      fineTuneOn: player.fineTuneRemain > 0,
    });
    aimPreview.sync(player, aimingSlot, sample, windup);
    for (let i = 0; i < balls.length; i += 1) {
      views[i].sync(balls[i]);
    }
  });
}

boot().catch((err: unknown) => {
  console.error(err);
});
