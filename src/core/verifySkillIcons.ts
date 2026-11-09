import { createActionBus, isAimUiTarget } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import type { SkillSlot } from '../input/actionTypes';
import { HERO_IDS } from '../heroes/heroIds';
import { skillNames, skillShorts } from '../heroes/kitLabels';
import {
  SKILL_ICON_BYTES,
  SKILL_ICON_COUNT,
  SKILL_ICON_FILES,
  SKILL_ICON_LABELS,
  skillIconFile,
  skillIconUrl,
} from '../heroes/skillIcons';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function firePointer(el: Element, type: string): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'touch',
      button: 0,
    }),
  );
}

/** 28 张技能图标：7 英雄×4 槽映射、切英雄换图、缺图短名兜底、不挡点击。 */
export function verifySkillIcons(): void {
  const files = Object.values(SKILL_ICON_FILES).flat();
  assert(files.length === SKILL_ICON_COUNT, '技能图标：应为 28 张');
  assert(new Set(files).size === SKILL_ICON_COUNT, '技能图标：文件名应互不重复');
  assert(SKILL_ICON_BYTES === 96134, '技能图标：圆形 v1 成品总量应为 96134 字节');

  for (const hero of HERO_IDS) {
    const names = skillNames(hero);
    const labels = SKILL_ICON_LABELS[hero];
    for (let i = 0; i < 4; i += 1) {
      const slot = (i + 1) as SkillSlot;
      const file = skillIconFile(hero, slot);
      assert(file === SKILL_ICON_FILES[hero][i], `技能图标：${hero} ${slot} 映射应显式`);
      assert(file.startsWith(`skill-${hero}-${slot}-`), `技能图标：${hero} ${slot} 文件名前缀应对上`);
      assert(file.endsWith('.webp'), `技能图标：${hero} ${slot} 应为 webp`);
      assert(labels[i] === names[i], `技能图标：${hero} ${slot} 应对 ${names[i]}`);
      const url = skillIconUrl(hero, slot);
      assert(url.includes('/skillIcons/') && url.endsWith(file), `技能图标：${hero} ${slot} URL 应走 Pages 资源路径`);
    }
  }
  assert(SKILL_ICON_LABELS.hook[0] === '钩矛' && SKILL_ICON_LABELS.hook[3] === '蓄势', '技能图标：钩刺 1/4 应为钩矛/蓄势');
  assert(SKILL_ICON_LABELS.ring[3] === '囚环', '技能图标：磁环 4 应为囚环');
  assert(SKILL_ICON_LABELS.chain[2] === '援勾', '技能图标：链生 3 应为援勾');
  assert(SKILL_ICON_LABELS.nail[0] === '甲垒', '技能图标：钉壳 1 应为甲垒');
  assert(SKILL_ICON_LABELS.arc[1] === '掠刃', '技能图标：闪弧 2 应为掠刃');
  assert(SKILL_ICON_LABELS.well[0] === '索爆', '技能图标：井绳 1 应为索爆');
  assert(SKILL_ICON_LABELS.mirror[3] === '镜壁', '技能图标：镜卫 4 应为镜壁');

  const host = document.createElement('div');
  const bus = createActionBus();
  const pad = createTouchPad(host, bus, { holdMs: 0 });
  const btns = host.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn');
  assert(btns.length === 4, '技能图标：仍为四键');
  const ultBtn = host.querySelector<HTMLButtonElement>('button.touchUltBtn');
  assert(!!ultBtn && !ultBtn.querySelector('img.touchSkillIcon'), '技能图标：第五键必杀不接头像包、不改能量键');
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'hook' });
  const hookImgs = [...btns].map((btn) => btn.querySelector<HTMLImageElement>('img.touchSkillIcon'));
  assert(hookImgs.every((img) => !!img), '技能图标：每键应有 img');
  assert(
    hookImgs.every((img) => img && (img.style.pointerEvents === 'none' || getComputedStyle(img).pointerEvents === 'none')),
    '技能图标：图不能抢点击',
  );
  assert(hookImgs.every((img) => img && isAimUiTarget(img)), '技能图标：点在图上仍应算技能键');
  for (const hero of HERO_IDS) {
    pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero });
    const names = skillNames(hero);
    const shorts = skillShorts(hero);
    for (let i = 0; i < 4; i += 1) {
      const img = btns[i].querySelector<HTMLImageElement>('img.touchSkillIcon');
      assert(!!img?.src.includes(SKILL_ICON_FILES[hero][i]), `技能图标：${hero} ${i + 1} 应对 ${names[i]}`);
      assert(btns[i].querySelector('.touchSkillName')?.textContent === shorts[i], `技能图标：${hero} ${i + 1} 短名应保留`);
      assert(btns[i].getAttribute('aria-label') === names[i], `技能图标：${hero} ${i + 1} 无障碍名应对 ${names[i]}`);
    }
  }
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'hook' });
  assert(!!hookImgs[0]?.src.includes('skill-hook-1-spear.webp'), '技能图标：钩刺 1 应为钩矛图');
  assert(!!hookImgs[3]?.src.includes('skill-hook-4-store.webp'), '技能图标：钩刺 4 应为蓄势图');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '钩', '技能图标：短名兜底仍在');
  assert(btns[0].getAttribute('aria-label') === '钩矛', '技能图标：无障碍名应为钩矛');

  pad.sync({ aimingSlot: 2, skillCds: [8, 0, 0, 0], fineTuneOn: false, hero: 'ring' });
  const ringImgs = [...btns].map((btn) => btn.querySelector<HTMLImageElement>('img.touchSkillIcon'));
  assert(!!ringImgs[0]?.src.includes('skill-ring-1-glow.webp'), '技能图标：切英雄后 1 槽应换辉环图');
  assert(!!ringImgs[3]?.src.includes('skill-ring-4-cage.webp'), '技能图标：切英雄后 4 槽应换囚环图');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '辉', '技能图标：切英雄短名应跟着换');
  assert(btns[0].classList.contains('isCd'), '技能图标：换图后 CD 遮罩仍在');
  assert(btns[1].classList.contains('isAiming'), '技能图标：瞄准高亮仍在');
  const cancel = host.querySelector<HTMLButtonElement>('button.touchCancel');
  assert(!!cancel && !cancel.hidden, '技能图标：瞄准中取消键仍出现');

  firePointer(btns[1], 'pointerdown');
  assert(bus.sample(0, 0).skillPress === 2, '技能图标：点键仍应进技能按下');
  firePointer(btns[1], 'pointerup');

  const miss = hookImgs[0];
  if (!miss) {
    throw new Error('技能图标：应有可测缺图 img');
  }
  miss.dispatchEvent(new Event('error'));
  assert(miss.hidden || miss.classList.contains('isMiss'), '技能图标：缺图应藏图标');
  assert(!!btns[0].querySelector('.touchSkillName')?.textContent, '技能图标：缺图时短名应留下');

  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'well' });
  assert(
    !!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-well-1-burst.webp'),
    '技能图标：井绳 1 应为索爆图',
  );
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'mirror' });
  assert(
    !!btns[3].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-mirror-4-wall.webp'),
    '技能图标：镜卫 4 应为镜壁图',
  );
}
