import { Application, Container } from 'pixi.js';
import { MAP_HEIGHT, MAP_WIDTH } from './core/constants';
import { createMatchRoster, createMatchSession, pickMatchRosterKits } from './core/matchSession';
import type { BallBody } from './core/ballBody';
import { stepPhysics } from './core/physicsStep';
import { createSimpleBot } from './core/simpleBot';
import { verifyM2 } from './core/verifyM2';
import { verifyM3 } from './core/verifyM3';
import { verifyM35 } from './core/verifyM35';
import { verifyM4 } from './core/verifyM4';
import { verifyM5 } from './core/verifyM5';
import { verifyChain } from './core/verifyChain';
import { verifyArc } from './core/verifyArc';
import { verifyNail } from './core/verifyNail';
import { verifyRing } from './core/verifyRing';
import { verifyWell } from './core/verifyWell';
import { verifyMirror } from './core/verifyMirror';
import { verifyHeroPick } from './core/verifyHeroPick';
import { verifyHudLayout } from './core/verifyHudLayout';
import { verifySkillCd } from './core/verifySkillCd';
import { verifySkillTip } from './core/verifySkillTip';
import { verifyCombatFloat } from './core/verifyCombatFloat';
import { resetBoomFlashes } from './core/boomFlashes';
import { floatsFromHits, resetCombatFloatAcc, takeHealFloats } from './core/combatFloat';
import { resetMirrorWalls } from './core/mirrorWalls';
import { resetStakes } from './core/ropeStakes';
import { resetTrapZones } from './core/trapZones';
import { nextHero, type HeroId } from './heroes/heroIds';
import { loadLastHeroId, saveLastHeroId } from './heroes/lastHeroId';
import { createFieldOverlay } from './render/fieldOverlay';
import { bindDebugMatch } from './debug/debugMatch';
import { bindDebugVelocity } from './debug/debugVelocity';
import { applyOpeningCharge } from './core/openingCharge';
import { createActionBus, isAimUiTarget } from './input/actionBus';
import { bindPcInput } from './input/pcInput';
import { createPlayerControl } from './input/playerControl';
import { createTouchPad } from './input/touchPad';
import { createAimPreview } from './render/aimPreview';
import { createArenaView } from './render/arenaView';
import { createBallView } from './render/ballView';
import { createCombatFloatView } from './render/combatFloatView';
import { applyWorldTransform, fitWorldToBox, type WorldTransform } from './render/worldTransform';
import { createHelpCard } from './ui/helpCard';
import { createMatchHud } from './ui/matchHud';
import { createResultPanel } from './ui/resultPanel';
import { createAppVersions } from './ui/appVersion';
import { createSettingsPanel } from './ui/settingsPanel';
import { createUpdatePrompt } from './ui/updatePrompt';
import { applyStageVars, computeLandscapeStage, readSafeInsets } from './ui/stageLayout';
import './style.css';

async function boot(): Promise<void> {
  verifyM2();
  verifyM3();
  verifyM35();
  verifyM4();
  verifyM5();
  verifyRing();
  verifyChain();
  verifyNail();
  verifyArc();
  verifyWell();
  verifyMirror();
  verifyHeroPick();
  verifyHudLayout();
  verifySkillTip();
  verifySkillCd();
  verifyCombatFloat();

  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) {
    throw new Error('未找到 #app');
  }

  const app = new Application();
  await app.init({
    resizeTo: host,
    background: 0x071018,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  host.appendChild(app.canvas);

  const world = new Container();
  const arena = createArenaView();
  world.addChild(arena.root);

  const balls = createMatchRoster({ player: loadLastHeroId() });
  const player = balls.find((ball) => ball.team === 'red' && ball.teamSlot === 1) ?? balls[0];
  const ally = balls.find((ball) => ball.team === 'red' && ball.teamSlot === 2) ?? null;
  const botHandles = balls
    .filter((ball) => ball !== player)
    .map((ball) => ({ ball, ai: createSimpleBot(ball) }));
  const match = createMatchSession(balls);
  const views = balls.map((ball) => createBallView(ball));
  for (const view of views) {
    world.addChild(view.root);
  }
  const fields = createFieldOverlay();
  world.addChild(fields.root);
  const aimPreview = createAimPreview();
  world.addChild(aimPreview.root);
  const combatFloats = createCombatFloatView();
  world.addChild(combatFloats.root);
  app.stage.addChild(world);

  const layoutWorld = (): WorldTransform => {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const frame = { width: host.clientWidth || viewW, height: host.clientHeight || viewH };
    if (Math.abs(app.screen.width - frame.width) > 1 || Math.abs(app.screen.height - frame.height) > 1) {
      app.renderer.resize(frame.width, frame.height);
    }
    const stage = computeLandscapeStage(app.screen.width, app.screen.height, readSafeInsets());
    applyStageVars(host, stage);
    return fitWorldToBox(stage.x, stage.y, stage.width, stage.height, MAP_WIDTH, MAP_HEIGHT);
  };

  let transform: WorldTransform = layoutWorld();
  applyWorldTransform(world, transform);

  const layout = (): void => {
    transform = layoutWorld();
    applyWorldTransform(world, transform);
  };

  app.renderer.on('resize', layout);
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', layout);
  window.visualViewport?.addEventListener('resize', layout);
  window.screen.orientation?.addEventListener('change', layout);

  const bus = createActionBus();
  const control = createPlayerControl(player.hero);
  const touchPad = createTouchPad(host, bus);
  bindPcInput({
    canvas: app.canvas,
    getTransform: () => transform,
    bus,
  });

  let syncHeroUi = (): void => {};

  const applyPlayerHero = (hero: HeroId): void => {
    if (player.hero !== hero) {
      control.setHero(player, hero);
      bus.reset();
      saveLastHeroId(player.hero);
    }
    syncHeroUi();
  };

  const applyAllyHero = (hero: HeroId): void => {
    if (ally && ally.hero !== hero) {
      const handle = botHandles.find((item) => item.ball === ally);
      handle?.ai.setHero(ally, hero);
    }
    syncHeroUi();
  };

  const applyBotKit = (ball: BallBody | null | undefined, hero: HeroId): void => {
    if (!ball || ball.hero === hero) {
      return;
    }
    const handle = botHandles.find((item) => item.ball === ball);
    handle?.ai.setHero(ball, hero);
  };

  const rollOpeningBots = (): void => {
    const kits = pickMatchRosterKits(player.hero);
    applyBotKit(ally, kits.ally);
    applyBotKit(
      balls.find((ball) => ball.team === 'blue' && ball.teamSlot === 1),
      kits.blue1,
    );
    applyBotKit(
      balls.find((ball) => ball.team === 'blue' && ball.teamSlot === 2),
      kits.blue2,
    );
  };

  const swapPlayerHero = (): void => {
    applyPlayerHero(nextHero(player.hero));
  };

  const matchHud = createMatchHud(host, {
    hero: player.hero,
    allyHero: ally?.hero ?? 'chain',
    onPickHero: applyPlayerHero,
    onPickAllyHero: applyAllyHero,
  });
  matchHud.sync(match.snapshot(), balls);
  arena.syncStalls(match.snapshot().stalls);

  const restart = (): void => {
    rollOpeningBots();
    resetTrapZones();
    resetStakes();
    resetMirrorWalls();
    resetBoomFlashes();
    resetCombatFloatAcc();
    combatFloats.clear();
    match.reset();
    control.reset();
    bus.reset();
    for (const { ai } of botHandles) {
      ai.reset();
    }
    syncHeroUi();
  };

  const resultPanel = createResultPanel(host, restart);
  resultPanel.sync(match.snapshot());

  const onPairDebug = (): void => {
    resetTrapZones();
    resetStakes();
    resetMirrorWalls();
    resetBoomFlashes();
    resetCombatFloatAcc();
    combatFloats.clear();
    control.reset();
    for (const { ai } of botHandles) {
      ai.reset();
    }
  };

  let settingsIsGmOn = (): boolean => true;
  let settingsClose = (): void => {};
  const debug = bindDebugVelocity({
    balls,
    onReset: restart,
    onPairDebug,
    isGmOn: () => settingsIsGmOn(),
  });
  bindDebugMatch(match, { isGmOn: () => settingsIsGmOn(), onSwapHero: swapPlayerHero });

  const help = createHelpCard(host, { onOpen: () => settingsClose() });
  syncHeroUi = () => {
    help.setHero(player.hero);
    matchHud.setHero(player.hero);
    if (ally) {
      matchHud.setAllyHero(ally.hero);
    }
  };
  syncHeroUi();
  const appVersions = createAppVersions();
  createUpdatePrompt(host, appVersions);
  const settings = createSettingsPanel(host, {
    onOpen: () => help.close(),
    onOpenHelp: () => help.open(),
    versions: appVersions,
    onRestart: () => {
      restart();
      settings.close();
    },
    getHero: () => player.hero,
    onSwapHero: swapPlayerHero,
    onCollision: (kind) => {
      debug.runCollision(kind);
    },
    onScore: (team, points) => {
      match.debugAddScore(team, points);
    },
    onAdvance: (sec) => {
      match.debugAdvance(sec);
    },
    onJumpClock: (sec) => {
      match.debugJumpClock(sec);
    },
    onForceRespawn: () => {
      match.debugForceRespawn();
    },
  });
  settingsIsGmOn = () => settings.isGmOn();
  settingsClose = settings.close;

  const trySkipOpening = (): void => {
    if (settings.isOpen() || help.isOpen()) {
      return;
    }
    match.skipOpening();
  };

  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') {
      return;
    }
    if (settings.isOpen() || help.isOpen()) {
      return;
    }
    if (match.snapshot().phase !== 'countdown') {
      return;
    }
    ev.preventDefault();
    trySkipOpening();
  });
  window.addEventListener('pointerdown', (ev) => {
    if (isAimUiTarget(ev.target)) {
      return;
    }
    if (settings.isOpen() || help.isOpen()) {
      return;
    }
    if (ev.target !== app.canvas && ev.target !== host) {
      return;
    }
    if (match.snapshot().phase !== 'countdown') {
      return;
    }
    trySkipOpening();
  });

  app.ticker.add((ticker) => {
    const dt = ticker.deltaMS / 1000;
    const snap = match.snapshot();
    const sample = bus.sample(player.x, player.y);
    const charging = snap.openingChargeRemain > 0;
    const stalled = snap.phase === 'countdown';
    const skillHits = charging
      ? control.tick(player, sample, dt, balls, { skills: false, steer: false })
      : stalled
        ? control.tick(player, sample, dt, balls, { skills: false, steer: true })
        : control.tick(player, sample, dt, balls);
    if (charging) {
      applyOpeningCharge(player, dt, snap.openingChargeRemain);
    }
    for (const { ai } of botHandles) {
      skillHits.push(...ai.tick(dt, balls, snap.phase, snap.openingChargeRemain));
    }
    const step = stepPhysics(balls, dt, { stalls: snap.stallsOn ? snap.stalls : [] });
    if (charging) {
      applyOpeningCharge(player, 0, snap.openingChargeRemain);
      for (const ball of balls) {
        if (ball !== player) {
          applyOpeningCharge(ball, 0, snap.openingChargeRemain);
        }
      }
    }
    skillHits.push(...control.afterPhysics(player, dt, balls, step.wallHitIds.includes(player.id)));
    for (const { ball, ai } of botHandles) {
      skillHits.push(...ai.afterPhysics(dt, balls, step.wallHitIds.includes(ball.id)));
    }
    const frameHits = [...step.hits, ...skillHits];
    combatFloats.spawn([...floatsFromHits(frameHits, balls), ...takeHealFloats(step.heals)]);
    combatFloats.tick(dt);
    match.tick(dt, frameHits);
    const next = match.snapshot();
    const aimingSlot = control.getAimingSlot();
    const skillCds = control.getSkillCds();
    const windup = control.getWindup();
    const aimHint = control.getAimHint();
    matchHud.sync(next, balls);
    resultPanel.sync(next);
    arena.syncHold(next.midpoint);
    arena.syncStalls(next.stalls);
    touchPad.sync({
      aimingSlot,
      skillCds,
      windupSlot: windup?.slot ?? 0,
      fineTuneOn: player.fineTuneRemain > 0,
      hero: player.hero,
    });
    fields.sync(balls);
    aimPreview.sync(player, aimingSlot, sample, windup, aimHint);
    for (let i = 0; i < balls.length; i += 1) {
      views[i].sync(balls[i], { charging: next.openingChargeRemain > 0 });
    }
  });
}

boot().catch((err: unknown) => {
  console.error(err);
});
