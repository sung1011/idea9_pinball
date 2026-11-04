import { isAimUiTarget } from '../input/actionBus';
import { createPlayerControl } from '../input/playerControl';
import type { ActionSample } from '../input/actionTypes';
import { HERO_IDS, heroZh, isHeroId, nextHero, type HeroId } from '../heroes/heroIds';
import { createMatchHud } from '../ui/matchHud';
import { createBallBody } from './ballBody';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
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

/** 左下角下拉指定英雄；H 循环后选中值跟随；换 kit 不清血量/位置。 */
export function verifyHeroPick(): void {
  assert(HERO_IDS.length === 7, '换英雄：池应为 7 人');
  assert(HERO_IDS.every((id) => isHeroId(id)), '换英雄：池内 id 应全部合法');
  assert(
    HERO_IDS.map((id) => heroZh(id)).join('/') === '钩刺/磁环/链生/钉壳/闪弧/井绳/镜卫',
    '换英雄：中文名应按钩刺/磁环/链生/钉壳/闪弧/井绳/镜卫',
  );

  const host = document.createElement('div');
  const state = { hero: 'hook' as HeroId };
  let picks = 0;
  const hud = createMatchHud(host, {
    hero: state.hero,
    onPickHero: (next) => {
      picks += 1;
      if (state.hero === next) {
        return;
      }
      state.hero = next;
    },
  });
  const pick = host.querySelector<HTMLSelectElement>('select.matchHudHero');
  if (!pick) {
    throw new Error('换英雄：战场应有英雄下拉');
  }
  assert(pick.getAttribute('data-touch-control') === 'hero', '换英雄：下拉应标 data-touch-control');
  assert(isAimUiTarget(pick), '换英雄：点下拉不应抢 Aim');
  assert(pick.options.length === 7, '换英雄：下拉应列出 7 人');
  assert(pick.value === 'hook', '换英雄：默认应选钩刺');

  pick.value = 'nail';
  pick.dispatchEvent(new Event('change', { bubbles: true }));
  assert(picks === 1 && state.hero === 'nail', '换英雄：改下拉应指定钉壳');
  assert(pick.value === 'nail', '换英雄：指定后选中应为钉壳');

  const before = picks;
  pick.value = 'nail';
  pick.dispatchEvent(new Event('change', { bubbles: true }));
  assert(state.hero === 'nail' && picks === before + 1, '换英雄：再选当前英雄应是空操作');

  state.hero = nextHero(state.hero);
  hud.setHero(state.hero);
  assert(state.hero === 'arc' && pick.value === 'arc', '换英雄：H 循环后下拉应跟到闪弧');

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
  control.setHero(ball, 'well');
  assert(ball.hero === 'well', '换英雄：setHero 应写成井绳');
  assert(ball.hp === 77 && ball.x === 4.2 && ball.y === 5.1, '换英雄：应保留血量与位置');
  assert(ball.vx === 1.4 && ball.vy === -0.6 && ball.team === 'red', '换英雄：应保留速度与队伍');
  assert(control.getAimingSlot() === 0, '换英雄：换 kit 应清掉旧瞄准');
  assert(control.getWindup() === null, '换英雄：换 kit 应清掉前摇');
}
