import { Application, Container } from 'pixi.js';
import { takeShieldAbsorbs } from './core/hpLoss';
import { isControlPointMode, type MatchModeId } from './core/matchMode';
import { loadLastModeId, saveLastModeId } from './core/lastModeId';
import { createMatchRoster, createMatchSession, pickMatchRosterKits } from './core/matchSession';
import { setArenaPillarsEnabled } from './core/wallBounce';
import type { BallBody } from './core/ballBody';
import { stepPhysics } from './core/physicsStep';
import { createSimpleBot } from './core/simpleBot';
import { verifyM2 } from './core/verifyM2';
import { verifyM3 } from './core/verifyM3';
import { verifyM35 } from './core/verifyM35';
import { verifyM4 } from './core/verifyM4';
import { verifyEightKill } from './core/verifyEightKill';
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
import { verifySkillIcons } from './core/verifySkillIcons';
import { verifySkillTip } from './core/verifySkillTip';
import { verifyTouchAim } from './core/verifyTouchAim';
import { verifyUiTheme } from './core/verifyUiTheme';
import { verifyCombatFloat } from './core/verifyCombatFloat';
import { resetBoomFlashes } from './core/boomFlashes';
import { floatsFromHits, floatsFromShield, resetCombatFloatAcc, takeHealFloats } from './core/combatFloat';
import { createCombatStats } from './core/combatStats';
import { verifyCombatStats } from './core/verifyCombatStats';
import { verifySelfMark } from './core/verifySelfMark';
import { verifyFineTuneRing } from './core/verifyFineTuneRing';
import { verifyWorldViewLock } from './core/verifyWorldViewLock';
import { verifyRespawnHud } from './core/verifyRespawnHud';
import { verifyUlt } from './core/verifyUlt';
import { verifyRingUlt } from './core/verifyRingUlt';
import { verifyChainUlt } from './core/verifyChainUlt';
import { resetChainEqualize } from './core/chainEqualize';
import { verifyAimStick } from './core/verifyAimStick';
import { verifyHookRider } from './core/verifyHookRider';
import { verifyHookRiderRun } from './core/verifyHookRiderRun';
import { verifyTechTree } from './core/verifyTechTree';
import { verifyGm } from './core/verifyGm';
import { verifyHookBrakeConvoy } from './core/verifyHookBrakeConvoy';
import { creditUltCombat } from './core/ultEnergy';
import { resetMagnetWells } from './core/magnetWells';
import { resetMirrorWalls } from './core/mirrorWalls';
import { resetStakes } from './core/ropeStakes';
import { resetTrapZones } from './core/trapZones';
import { type HeroId } from './heroes/heroIds';
import { loadLastHeroId, saveLastHeroId } from './heroes/lastHeroId';
import { clearHookBleeds } from './core/hookBleed';
import { takeHookShieldGrants } from './core/hookShield';
import { EMPTY_COMBAT_TECHS, type CombatTechSnapshot } from './core/techIds';
import { createTechStore } from './core/techSave';
import { createTechPanel } from './ui/techPanel';
import type { ResultTechInfo } from './ui/resultPanel';
import { createFieldOverlay } from './render/fieldOverlay';
import { bindDebugVelocity } from './debug/debugVelocity';
import { applyOpeningCharge } from './core/openingCharge';
import { createActionBus, isAimUiTarget } from './input/actionBus';
import { bindPcInput } from './input/pcInput';
import { createPlayerControl } from './input/playerControl';
import { createTouchPad } from './input/touchPad';
import { createAimPreview } from './render/aimPreview';
import { createArenaView } from './render/arenaView';
import { createBallView } from './render/ballView';
import { loadHookRiderArt } from './render/hookRiderArt';
import { loadHookRiderRunArt } from './render/hookRiderRunArt';
import { createCombatFloatView } from './render/combatFloatView';
import { createVisibleLockGate, createWorldViewSession, shiftWorldViewLayout } from './render/worldViewLock';
import { applyWorldTransform, type WorldTransform } from './render/worldTransform';
import { createCombatStatsPanel } from './ui/combatStatsPanel';
import { createHelpCard } from './ui/helpCard';
import { createMatchHud } from './ui/matchHud';
import { createResultPanel } from './ui/resultPanel';
import { createAppVersions, hardReload } from './ui/appVersion';
import { createSettingsPanel } from './ui/settingsPanel';
import { createUpdatePrompt } from './ui/updatePrompt';
import { bindLandscapeLock, whenLandscapeLockSettled } from './ui/lockLandscape';
import { applyStageVars, isStandaloneDisplay, readSafeInsets, readVisibleViewBox } from './ui/stageLayout';
import { applyUiTheme } from './ui/uiTheme';
import './style.css';

async function boot(): Promise<void> {
  verifyM2();
  verifyM3();
  verifyM35();
  verifyM4();
  verifyEightKill();
  verifyM5();
  verifyRing();
  verifyRingUlt();
  verifyChain();
  verifyChainUlt();
  verifyNail();
  verifyArc();
  verifyWell();
  verifyMirror();
  verifyHeroPick();
  verifyHudLayout();
  verifySkillTip();
  verifySkillCd();
  verifySkillIcons();
  verifyTouchAim();
  verifyUiTheme();
  verifyCombatFloat();
  verifyCombatStats();
  verifySelfMark();
  verifyFineTuneRing();
  verifyWorldViewLock();
  verifyRespawnHud();
  verifyUlt();
  verifyAimStick();
  verifyHookRider();
  verifyTechTree();
  verifyGm();
  verifyHookBrakeConvoy();
  document.documentElement.dataset.verifyBoot = 'ok';

  const host = document.querySelector<HTMLDivElement>('#app');
  if (!host) {
    throw new Error('未找到 #app');
  }
  applyUiTheme(host);

  const app = new Application();
  await app.init({
    resizeTo: host,
    background: 0x071018,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  host.appendChild(app.canvas);
  await loadHookRiderArt();
  await loadHookRiderRunArt();
  verifyHookRiderRun();

  const world = new Container();
  const arena = createArenaView();
  world.addChild(arena.root);

  const techStore = createTechStore();
  let combatTechs: CombatTechSnapshot = EMPTY_COMBAT_TECHS;
  let techsFrozen = false;
  let practice = false;
  let settledMatchId = '';
  let lastTechReward: ResultTechInfo | null = null;
  const freezeCombatTechs = (): void => {
    if (techsFrozen) {
      return;
    }
    combatTechs = techStore.snapshot();
    techsFrozen = true;
  };
  const wantedHero = loadLastHeroId();
  const startHero = techStore.isHeroUnlocked(wantedHero) ? wantedHero : 'hook';
  const balls = createMatchRoster({ player: startHero });
  const player = balls.find((ball) => ball.team === 'red' && ball.teamSlot === 1) ?? balls[0];
  const ally = balls.find((ball) => ball.team === 'red' && ball.teamSlot === 2) ?? null;
  const botHandles = balls
    .filter((ball) => ball !== player)
    .map((ball) => ({ ball, ai: createSimpleBot(ball) }));
  let matchMode = loadLastModeId();
  const applyWorldRules = (mode: MatchModeId): void => {
    setArenaPillarsEnabled(isControlPointMode(mode));
    arena.syncMode(mode);
  };
  applyWorldRules(matchMode);
  const match = createMatchSession(balls, { mode: matchMode });
  const views = balls.map((ball) => createBallView(ball, { selfMark: ball.id === player.id }));
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

  const standalone = isStandaloneDisplay();
  if (standalone) {
    document.documentElement.classList.add('isStandalone');
  }
  const lockGate = createVisibleLockGate(standalone);
  const worldView = createWorldViewSession({ shouldLock: (viewW, viewH) => lockGate.shouldLock(viewW, viewH) });

  const syncHostCanvas = (): void => {
    const frameW = host.clientWidth || window.innerWidth;
    const frameH = host.clientHeight || window.innerHeight;
    if (Math.abs(app.screen.width - frameW) > 1 || Math.abs(app.screen.height - frameH) > 1) {
      app.renderer.resize(frameW, frameH);
    }
  };

  const applyViewLayout = (enter: boolean): void => {
    syncHostCanvas();
    const box = readVisibleViewBox(host);
    const insets = readSafeInsets();
    const raw = enter ? worldView.enter(box.width, box.height, insets) : worldView.follow(box.width, box.height, insets);
    const layout = shiftWorldViewLayout(raw, box.x, box.y);
    transform = layout.transform;
    host.dataset.worldScale = String(layout.lock.scale);
    host.dataset.worldLocked = worldView.getLock() ? '1' : '0';
    host.dataset.worldVisibleW = String(box.width);
    host.dataset.worldVisibleH = String(box.height);
    applyStageVars(host, layout.stage, box.width, box.height);
    applyWorldTransform(world, transform);
  };

  let transform!: WorldTransform;
  applyViewLayout(true);

  let settleRaf = 0;
  const followView = (): void => {
    applyViewLayout(false);
    if (standalone && !worldView.getLock() && !settleRaf) {
      let pumps = 0;
      const pump = (): void => {
        settleRaf = 0;
        applyViewLayout(false);
        pumps += 1;
        if (standalone && !worldView.getLock() && pumps < 120) {
          settleRaf = requestAnimationFrame(pump);
        }
      };
      settleRaf = requestAnimationFrame(pump);
    }
  };

  app.renderer.on('resize', followView);
  window.addEventListener('resize', followView);
  window.addEventListener('orientationchange', followView);
  window.visualViewport?.addEventListener('resize', followView);
  window.screen.orientation?.addEventListener('change', followView);
  bindLandscapeLock();
  if (standalone) {
    void whenLandscapeLockSettled().then(() => {
      lockGate.markOrientReady();
      followView();
    });
  } else {
    lockGate.markOrientReady();
  }

  const bus = createActionBus();
  const touchPad = createTouchPad(host, bus);
  const control = createPlayerControl(player.hero, {
    onUltTodo: () => touchPad.showTodo(),
    techs: () => combatTechs,
  });
  bindPcInput({
    canvas: app.canvas,
    getTransform: () => transform,
    bus,
    getAimingSlot: () => control.getAimingSlot(),
  });

  let syncHeroUi = (): void => {};

  const applyPlayerHero = (hero: HeroId): void => {
    if (!practice && !techStore.isHeroUnlocked(hero)) {
      syncHeroUi();
      return;
    }
    if (player.hero !== hero) {
      control.setHero(player, hero);
      bus.reset();
      if (!practice) {
        saveLastHeroId(player.hero);
      }
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

  let applyMatchMode = (_mode: MatchModeId): void => {};

  const combatStats = createCombatStats();
  const combatStatsPanel = createCombatStatsPanel(host, combatStats);
  combatStatsPanel.sync(balls, player.id);

  let settingsSetHero: (hero: HeroId) => void = () => {};
  let settingsSetMode: (mode: MatchModeId) => void = () => {};
  const matchHud = createMatchHud(host);
  matchHud.sync(match.snapshot(), balls, player.id);
  arena.syncStalls(match.snapshot().stalls);

  const restart = (): void => {
    techsFrozen = false;
    combatTechs = EMPTY_COMBAT_TECHS;
    settledMatchId = '';
    lastTechReward = null;
    if (!practice && !techStore.isHeroUnlocked(player.hero)) {
      control.setHero(player, 'hook');
      bus.reset();
    }
    rollOpeningBots();
    resetTrapZones();
    resetMagnetWells();
    resetChainEqualize();
    resetStakes();
    resetMirrorWalls();
    resetBoomFlashes();
    clearHookBleeds();
    resetCombatFloatAcc();
    combatFloats.clear();
    combatStats.reset();
    combatStatsPanel.sync(balls, player.id);
    match.setPractice(practice);
    match.reset();
    control.reset();
    bus.reset();
    touchPad.releaseStick();
    for (const { ai } of botHandles) {
      ai.reset();
    }
    syncHeroUi();
  };

  const resultPanel = createResultPanel(host, restart);
  resultPanel.sync(match.snapshot());

  let settingsClose = (): void => {};
  bindDebugVelocity({
    onReset: restart,
  });

  let techClose = (): void => {};
  let techOpen = (): void => {};
  let techIsOpen = (): boolean => false;
  const help = createHelpCard(host, { onOpen: () => { settingsClose(); techClose(); } });
  help.setMode(matchMode);
  applyMatchMode = (mode: MatchModeId): void => {
    if (mode === matchMode) {
      return;
    }
    matchMode = mode;
    saveLastModeId(mode);
    match.setMode(mode);
    applyWorldRules(mode);
    help.setMode(mode);
    settingsSetMode(mode);
    restart();
  };
  syncHeroUi = () => {
    help.setHero(player.hero);
    help.setMode(matchMode);
    settingsSetHero(player.hero);
    settingsSetMode(matchMode);
  };
  syncHeroUi();
  const appVersions = createAppVersions();
  createUpdatePrompt(host, appVersions);
  const settings = createSettingsPanel(host, {
    onOpen: () => {
      help.close();
      techClose();
    },
    onOpenHelp: () => help.open(),
    versions: appVersions,
    onRestart: () => {
      restart();
      settings.close();
    },
    onReload: hardReload,
    getHero: () => player.hero,
    onPickHero: applyPlayerHero,
    getMode: () => matchMode,
    onPickMode: (mode) => applyMatchMode(mode),
    getUnlockedHeroes: () => techStore.getState().unlockedHeroes,
    getPractice: () => practice,
    onPractice: () => {
      practice = true;
      restart();
    },
    onEndPractice: () => {
      practice = false;
      if (!techStore.isHeroUnlocked(player.hero)) {
        applyPlayerHero('hook');
      }
      restart();
    },
    onOpenTech: () => techOpen(),
    onGrantTechPoint: () => techStore.grantPoints(1).ok,
  });
  settingsClose = settings.close;
  settingsSetHero = (hero) => settings.setHero(hero);
  settingsSetMode = (mode) => settings.setMode(mode);
  const tech = createTechPanel(host, {
    store: techStore,
    getPhase: () => match.snapshot().phase,
    getPractice: () => practice,
    onChanged: () => settings.setHero(player.hero),
    onOpen: () => {
      help.close();
      settings.close();
    },
  });
  techOpen = () => tech.open();
  techClose = () => tech.close();
  techIsOpen = () => tech.isOpen();

  const trySkipOpening = (): void => {
    if (settings.isOpen() || help.isOpen() || techIsOpen()) {
      return;
    }
    match.skipOpening();
  };

  window.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') {
      return;
    }
    if (settings.isOpen() || help.isOpen() || techIsOpen()) {
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
    if (settings.isOpen() || help.isOpen() || techIsOpen()) {
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
    if (snap.phase === 'playing' || snap.phase === 'overtime') {
      freezeCombatTechs();
    }
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
      skillHits.push(
        ...ai.tick(dt, balls, snap.phase, snap.openingChargeRemain, isControlPointMode(matchMode)),
      );
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
    match.tick(dt, frameHits);
    const extraHits = match.takeExtraHits();
    const potionHeals = match.takePotionHeals();
    combatStats.applyHits(frameHits);
    combatStats.applyHits(extraHits);
    combatStats.applyHeals(step.heals);
    creditUltCombat(balls, [...frameHits, ...extraHits], step.heals);
    combatFloats.spawn([
      ...floatsFromHits([...frameHits, ...extraHits], balls),
      ...takeHealFloats([...step.heals, ...potionHeals]),
      ...floatsFromShield([...takeShieldAbsorbs(), ...takeHookShieldGrants()]),
    ]);
    combatFloats.tick(dt);
    combatStatsPanel.sync(balls, player.id);
    const next = match.snapshot();
    if (next.phase === 'playing' || next.phase === 'overtime') {
      freezeCombatTechs();
    }
    if (next.phase === 'result' && next.matchId && next.matchId !== settledMatchId) {
      const grant = techStore.grantMatchReward({
        mode: next.mode,
        winner: next.winner,
        playerTeam: 'red',
        practice: next.practice,
        matchId: next.matchId,
      });
      lastTechReward = {
        practice: next.practice,
        granted: grant.granted,
        amount: grant.amount,
        balance: grant.balance,
        note: grant.note,
      };
      if (grant.granted || grant.duplicate || grant.note.includes('练习') || grant.note.includes('已结算')) {
        settledMatchId = next.matchId;
      }
    }
    const aimingSlot = control.getAimingSlot();
    const skillCds = control.getSkillCds();
    const windup = control.getWindup();
    const aimHint = control.getAimHint();
    matchHud.sync(next, balls, player.id);
    resultPanel.sync(next, lastTechReward);
    arena.syncHold(next.midpoint);
    arena.syncStalls(next.stalls);
    arena.syncMode(next.mode);
    touchPad.sync({
      aimingSlot,
      skillCds,
      windupSlot: windup?.slot ?? 0,
      fineTuneOn: player.fineTuneRemain > 0,
      hero: player.hero,
      energy: player.ultEnergy,
      stickEnabled: player.inPlay && next.phase !== 'result',
    });
    fields.sync(balls, { potion: next.potion, rift: next.rift });
    aimPreview.sync(player, aimingSlot, sample, windup, aimHint);
    for (let i = 0; i < balls.length; i += 1) {
      views[i].sync(balls[i], {
        charging: next.openingChargeRemain > 0,
        selfMark: balls[i].id === player.id,
        runDt: dt,
      });
    }
  });
}

boot().catch((err: unknown) => {
  console.error(err);
});
