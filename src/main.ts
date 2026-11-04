import { Application, Container } from 'pixi.js';
import { MAP_HEIGHT, MAP_WIDTH } from './core/constants';
import { createArenaView } from './render/arenaView';
import { applyWorldTransform, fitWorldToScreen } from './render/worldTransform';
import './style.css';

const VIEW_PADDING_PX = 32;

async function boot(): Promise<void> {
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

  const world = new Container();
  world.addChild(createArenaView());
  app.stage.addChild(world);

  const layout = (): void => {
    const transform = fitWorldToScreen(
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
}

boot().catch((err: unknown) => {
  console.error(err);
});
