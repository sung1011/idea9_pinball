import { createActionBus, isAimUiTarget } from '../input/actionBus';
import { bindPcInput } from '../input/pcInput';
import { createPlayerControl } from '../input/playerControl';
import { createTouchPad } from '../input/touchPad';
import type { ActionSample } from '../input/actionTypes';
import { HERO_IDS, heroZh, isHeroId, nextHero, pickRandomHero, type HeroId } from '../heroes/heroIds';
import { LAST_HERO_STORAGE_KEY, loadLastHeroId, saveLastHeroId } from '../heroes/lastHeroId';
import { skillNames } from '../heroes/kitLabels';
import { SKILL_ICON_FILES } from '../heroes/skillIcons';
import type { AppVersions } from '../ui/appVersion';
import { createMatchHud } from '../ui/matchHud';
import { createSettingsPanel } from '../ui/settingsPanel';
import { createBallBody } from './ballBody';
import { createMatchRoster, pickMatchRosterKits } from './matchSession';
import { createSimpleBot } from './simpleBot';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function dummyVersions(): AppVersions {
  return {
    getState: () => ({
      entries: [],
      grouped: [],
      history: [],
      installed: null,
      pending: [],
      flash: '',
    }),
    subscribe: () => () => {},
    refresh: async () => {},
    checkUpdate: async () => {},
    applyUpdate: async () => {},
    dispose: () => {},
  };
}

function sample(partial: Partial<ActionSample> = {}): ActionSample {
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

/** 设置常规页只换自己英雄；无队友入口；H 循环只跟自己；换 kit 不清血量/位置/编号。 */
export function verifyHeroPick(): void {
  assert(HERO_IDS.length === 7, '换英雄：池应为 7 人');
  assert(HERO_IDS.every((id) => isHeroId(id)), '换英雄：池内 id 应全部合法');
  assert(
    HERO_IDS.map((id) => heroZh(id)).join('/') === '钩刺/磁环/链生/钉壳/闪弧/井绳/镜卫',
    '换英雄：中文名应按钩刺/磁环/链生/钉壳/闪弧/井绳/镜卫',
  );

  const host = document.createElement('div');
  document.body.appendChild(host);
  const state = { hero: 'hook' as HeroId, ally: 'chain' as HeroId };
  let picks = 0;
  const unlocked: HeroId[] = ['hook'];
  createMatchHud(host);
  const pad = createTouchPad(host, createActionBus());
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: state.hero });
  const settings = createSettingsPanel(host, {
    onRestart: () => {},
    onReload: () => {},
    onCollision: () => {},
    onScore: () => {},
    onAdvance: () => {},
    onJumpClock: () => {},
    onForceRespawn: () => {},
    getHero: () => state.hero,
    getUnlockedHeroes: () => unlocked,
    onPickHero: (next) => {
      picks += 1;
      if (state.hero === next) {
        return;
      }
      state.hero = next;
    },
    versions: dummyVersions(),
  });
  assert(!host.querySelector('.matchHudHeroRow'), '换英雄：左上不应再有我/队友下拉');
  assert(!host.querySelector('select.matchHudAllyHero'), '换英雄：不应再有队友选择入口');
  assert(!host.querySelector('select.matchHudHero'), '换英雄：局内不应再有自己英雄下拉');
  assert(!host.querySelector('select.matchHudMode'), '换英雄：左上不应再有玩法下拉');
  assert(!host.querySelector('.matchHudLeft'), '换英雄：左上不应残留玩法入口层');

  settings.open();
  const overlay = host.querySelector<HTMLElement>('.settingsOverlay');
  const pick = host.querySelector<HTMLSelectElement>('select.settingsHeroPick');
  if (!overlay || !pick) {
    host.remove();
    throw new Error('换英雄：常规页应有我的英雄选择');
  }
  assert(pick.getAttribute('data-touch-control') === 'hero', '换英雄：下拉应标 data-touch-control');
  assert(isAimUiTarget(pick) && isAimUiTarget(overlay), '换英雄：点设置选择不应抢 Aim');
  assert(pick.options.length === 7, '换英雄：下拉应列出 7 人');
  assert(
    [...pick.options].map((opt) => opt.value).join('/') === 'hook/ring/chain/nail/arc/well/mirror',
    '换英雄：选项应为七英雄 id',
  );
  assert(pick.value === 'hook', '换英雄：自己默认应选钩刺');
  const lockedRing = [...pick.options].find((opt) => opt.value === 'ring');
  assert(!!lockedRing?.disabled && (lockedRing.textContent ?? '').includes('未解锁'), '换英雄：未解锁应禁用');
  pick.value = 'ring';
  pick.dispatchEvent(new Event('change', { bubbles: true }));
  assert(state.hero === 'hook' && picks === 0, '换英雄：正式路径不能选未解锁英雄');
  unlocked.splice(0, unlocked.length, ...HERO_IDS);
  settings.setHero('hook');
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const bus = createActionBus();
  const unbind = bindPcInput({
    bus,
    canvas,
    getTransform: () => ({ scale: 1, offsetX: 0, offsetY: 0 }),
    getAimingSlot: () => 0,
  });
  pick.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
      buttons: 1,
      clientX: 40,
      clientY: 40,
    }),
  );
  const blocked = bus.sample(0, 0);
  assert(!blocked.confirmRelease && blocked.skillPress === 0, '换英雄：点设置选择不应误触技能');
  unbind();

  const skillBtns = [...host.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn')];
  assert(skillBtns.length === 4, '换英雄：四技能键应仍在');
  for (const id of HERO_IDS) {
    const livePick = host.querySelector<HTMLSelectElement>('select.settingsHeroPick');
    if (!livePick) {
      host.remove();
      throw new Error('换英雄：切换中应保持我的英雄选择');
    }
    livePick.value = id;
    livePick.dispatchEvent(new Event('change', { bubbles: true }));
    assert(state.hero === id, `换英雄：选 ${heroZh(id)} 应只改自己`);
    assert(state.ally === 'chain', `换英雄：选 ${heroZh(id)} 不应改队友`);
    pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: state.hero });
    const names = skillNames(state.hero);
    for (let i = 0; i < 4; i += 1) {
      const btn = skillBtns[i];
      if (!btn) {
        host.remove();
        throw new Error(`换英雄：缺技能键 ${i + 1}`);
      }
      const img = btn.querySelector<HTMLImageElement>('img.touchSkillIcon');
      assert(!!img?.src.includes(SKILL_ICON_FILES[state.hero][i]), `换英雄：${heroZh(id)} 技能图应跟着换`);
      assert(btn.getAttribute('aria-label') === names[i], `换英雄：${heroZh(id)} 技能名应跟着换`);
    }
  }
  assert(picks === HERO_IDS.length, '换英雄：七英雄都应能切换');

  const before = picks;
  const samePick = host.querySelector<HTMLSelectElement>('select.settingsHeroPick');
  if (!samePick) {
    host.remove();
    throw new Error('换英雄：再选当前英雄时选择应仍在');
  }
  samePick.value = 'mirror';
  samePick.dispatchEvent(new Event('change', { bubbles: true }));
  assert(state.hero === 'mirror' && picks === before + 1, '换英雄：再选当前英雄应是空操作');
  assert(state.ally === 'chain', '换英雄：再选自己仍不应改队友');

  state.hero = nextHero(state.hero);
  settings.setHero(state.hero);
  const afterSwap = host.querySelector<HTMLSelectElement>('select.settingsHeroPick');
  assert(state.hero === 'hook' && afterSwap?.value === 'hook', '换英雄：H 循环后选择应跟到钩刺');
  assert(state.ally === 'chain', '换英雄：H 循环只跟自己');
  assert(!host.querySelector('[aria-label="切换队友英雄"]'), '换英雄：不应提供队友选择');
  host.remove();

  const ball = createBallBody({
    x: 4.2,
    y: 5.1,
    color: 0xe24a4a,
    vx: 1.4,
    vy: -0.6,
    hp: 77,
    team: 'red',
    hero: 'hook',
  });
  const control = createPlayerControl('hook');
  control.tick(ball, sample({ skillPress: 1 }), 0);
  assert(control.getAimingSlot() === 1, '换英雄：换前应能进瞄');
  ball.teamSlot = 2;
  control.setHero(ball, 'well');
  assert(ball.hero === 'well', '换英雄：setHero 应写成井绳');
  assert(ball.hp === 77 && ball.x === 4.2 && ball.y === 5.1, '换英雄：应保留血量与位置');
  assert(ball.vx === 1.4 && ball.vy === -0.6 && ball.team === 'red', '换英雄：应保留速度与队伍');
  assert(ball.teamSlot === 2, '换英雄：不换队内编号');
  assert(control.getAimingSlot() === 0, '换英雄：换 kit 应清掉旧瞄准');
  assert(control.getWindup() === null, '换英雄：换 kit 应清掉前摇');

  const ally = createBallBody({
    x: 1.2,
    y: 8.6,
    color: 0xc43d3d,
    vx: 2.1,
    vy: 0.4,
    hp: 188,
    team: 'red',
    teamSlot: 2,
    hero: 'chain',
  });
  const bot = createSimpleBot(ally);
  bot.setHero(ally, 'nail');
  assert(ally.hero === 'nail', '换英雄：队友 setHero 应写成钉壳');
  assert(ally.teamSlot === 2 && ally.team === 'red', '换英雄：换队友不换号');
  assert(ally.hp === 188 && ally.x === 1.2 && ally.y === 8.6, '换英雄：换队友应保留血量与位置');
  assert(ally.vx === 2.1 && ally.vy === 0.4, '换英雄：换队友应保留速度');

  const seen = new Set<HeroId>();
  for (let i = 0; i < HERO_IDS.length; i += 1) {
    seen.add(pickRandomHero(() => (i + 0.5) / HERO_IDS.length));
  }
  assert(seen.size === 7 && seen.has('mirror'), '开局：随机应覆盖含镜卫全池');

  const dup = pickMatchRosterKits('hook', () => 0.99);
  assert(dup.player === 'hook', '开局：玩家 kit 不随 bot 随机');
  assert(
    dup.ally === 'mirror' && dup.blue1 === 'mirror' && dup.blue2 === 'mirror',
    '开局：允许同局重复镜卫',
  );

  const rolled = createMatchRoster({ player: 'well' }, () => 0);
  assert(rolled[0].hero === 'well', '开局：红1 应用玩家缺省');
  assert(
    rolled[1].hero === 'hook' && rolled[2].hero === 'hook' && rolled[3].hero === 'hook',
    '开局：未指定 bot 应从全池随机',
  );
  assert(rolled.length === 4 && rolled[0].teamSlot === 1 && rolled[1].teamSlot === 2, '开局：仍是固定 2v2');

  const locked = createMatchRoster(
    { player: 'arc', ally: 'mirror', blue1: 'well', blue2: 'nail' },
    () => {
      throw new Error('指定 kit 不应再随机');
    },
  );
  assert(
    locked[0].hero === 'arc' && locked[1].hero === 'mirror' && locked[2].hero === 'well' && locked[3].hero === 'nail',
    '开局：指定 kit 应原样采用',
  );

  let prevLast: string | null = null;
  let hadPrev = false;
  try {
    prevLast = localStorage.getItem(LAST_HERO_STORAGE_KEY);
    hadPrev = true;
    localStorage.removeItem(LAST_HERO_STORAGE_KEY);
    assert(loadLastHeroId() === 'hook', '换英雄：无记录时玩家缺省应为钩刺');
    saveLastHeroId('mirror');
    assert(loadLastHeroId() === 'mirror', '换英雄：应记住上次所选含镜卫');
    localStorage.setItem(LAST_HERO_STORAGE_KEY, 'nope');
    assert(loadLastHeroId() === 'hook', '换英雄：非法记录应回钩刺');

    saveLastHeroId('well');
    assert(loadLastHeroId() === 'well', '换英雄：局中换自己应立刻写入缺省');
    saveLastHeroId('well');
    assert(loadLastHeroId() === 'well', '换英雄：再选当前英雄缺省仍是自己');
    assert(loadLastHeroId() === 'well', '换英雄：换队友不应写入玩家缺省');
  } finally {
    if (hadPrev) {
      if (prevLast === null) {
        localStorage.removeItem(LAST_HERO_STORAGE_KEY);
      } else {
        localStorage.setItem(LAST_HERO_STORAGE_KEY, prevLast);
      }
    }
  }
}
