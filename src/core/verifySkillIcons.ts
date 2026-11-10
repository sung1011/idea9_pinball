import { createActionBus, isAimUiTarget } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import type { SkillSlot } from '../input/actionTypes';
import { HERO_IDS } from '../heroes/heroIds';
import { skillNames, skillShorts } from '../heroes/kitLabels';
import {
  CHAIN_ULT_ICON_BYTES,
  CHAIN_ULT_ICON_FILE,
  HOOK_ULT_ICON_BYTES,
  HOOK_ULT_ICON_FILE,
  RING_ULT_ICON_BYTES,
  RING_ULT_ICON_FILE,
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

/** 28 张普通技能图 + 钩刺/磁环/链生必杀全幅插画：映射、切英雄换图、缺图短名、必杀非 CD。钉壳/闪弧四键全幅，第五键仍空。 */
export function verifySkillIcons(): void {
  const files = Object.values(SKILL_ICON_FILES).flat();
  assert(files.length === SKILL_ICON_COUNT, '技能图标：应为 28 张');
  assert(new Set(files).size === SKILL_ICON_COUNT, '技能图标：文件名应互不重复');
  assert(SKILL_ICON_BYTES === 1857936, '技能图标：7×4 成品总量应为 1857936 字节');
  assert(HOOK_ULT_ICON_FILE === 'skill-hook-5-ult.webp', '技能图标：钩刺必杀文件名应对上');
  assert(HOOK_ULT_ICON_BYTES === 102152, '技能图标：钩刺必杀应为预览同一张 102152 字节');
  assert(skillIconFile('hook', 5) === HOOK_ULT_ICON_FILE, '技能图标：钩刺 5 应映射无畏冲锋图');
  assert(skillIconUrl('hook', 5).endsWith(HOOK_ULT_ICON_FILE), '技能图标：钩刺 5 URL 应走 Pages 资源路径');
  assert(RING_ULT_ICON_FILE === 'skill-ring-5-ult.webp', '技能图标：磁环必杀文件名应对上');
  assert(RING_ULT_ICON_BYTES === 87150, '技能图标：磁环必杀应为预览同一张 87150 字节');
  assert(skillIconFile('ring', 5) === RING_ULT_ICON_FILE, '技能图标：磁环 5 应映射沉磁井图');
  assert(skillIconUrl('ring', 5).endsWith(RING_ULT_ICON_FILE), '技能图标：磁环 5 URL 应走 Pages 资源路径');
  assert(CHAIN_ULT_ICON_FILE === 'skill-chain-5-ult.webp', '技能图标：链生必杀文件名应对上');
  assert(CHAIN_ULT_ICON_BYTES === 97352, '技能图标：链生必杀应为附件同一张 97352 字节');
  assert(skillIconFile('chain', 5) === CHAIN_ULT_ICON_FILE, '技能图标：链生 5 应映射均血图');
  assert(skillIconUrl('chain', 5).endsWith(CHAIN_ULT_ICON_FILE), '技能图标：链生 5 URL 应走 Pages 资源路径');
  assert(skillIconFile('nail', 5) === '', '技能图标：钉壳第五键仍不挂图');
  assert(skillIconFile('arc', 5) === '', '技能图标：闪弧第五键仍不挂图');
  assert(skillIconFile('well', 5) === '', '技能图标：井绳第五键仍不挂图');
  assert(skillIconFile('mirror', 5) === '', '技能图标：镜卫第五键仍不挂图');

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
  const ultRing = host.querySelector<HTMLElement>('.touchUltRing');
  assert(!!ultBtn, '技能图标：应有第五键');
  assert(!!ultRing, '技能图标：必杀能量环应仍在');
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'hook', energy: 100 });
  const ultImg = ultBtn?.querySelector<HTMLImageElement>('img.touchSkillIcon');
  assert(!!ultImg?.src.includes(HOOK_ULT_ICON_FILE), '技能图标：钩刺第五键应挂无畏冲锋图');
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：必杀不应走技能 CD');
  assert(!ultBtn?.querySelector('.touchSkillCdWipe'), '技能图标：必杀不应有 CD 径向遮罩');
  assert(ultRing?.style.getPropertyValue('--ult-energy') === '1.0000', '技能图标：满能量环应仍是能量不是 CD');
  pad.sync({ aimingSlot: 0, skillCds: [8, 6, 10, 12], fineTuneOn: false, hero: 'hook', energy: 42 });
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：未满能量时必杀仍不是 CD');
  assert(ultRing?.style.getPropertyValue('--ult-energy') === '0.4200', '技能图标：能量环应按能量比例');
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

  pad.sync({ aimingSlot: 2, skillCds: [8, 0, 0, 0], fineTuneOn: false, hero: 'ring', energy: 42 });
  const ringImgs = [...btns].map((btn) => btn.querySelector<HTMLImageElement>('img.touchSkillIcon'));
  assert(!!ringImgs[0]?.src.includes('skill-ring-1-glow.webp'), '技能图标：切英雄后 1 槽应换辉环图');
  assert(!!ringImgs[1]?.src.includes('skill-ring-2-repulse.webp'), '技能图标：切英雄后 2 槽应换斥波图');
  assert(!!ringImgs[2]?.src.includes('skill-ring-3-wallrun.webp'), '技能图标：切英雄后 3 槽应换壁行图');
  assert(!!ringImgs[3]?.src.includes('skill-ring-4-cage.webp'), '技能图标：切英雄后 4 槽应换囚环图');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '辉', '技能图标：切英雄短名应跟着换');
  assert(btns[0].classList.contains('isCd'), '技能图标：换图后 CD 遮罩仍在');
  assert(btns[1].classList.contains('isAiming'), '技能图标：瞄准高亮仍在');
  assert(!!ultImg?.src.includes(RING_ULT_ICON_FILE) && !ultImg.hidden, '技能图标：切到磁环后必杀应挂沉磁井图');
  assert(!ultImg?.src.includes(HOOK_ULT_ICON_FILE), '技能图标：切到磁环后必杀不应残留无畏冲锋图');
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：沉磁井不应走技能 CD');
  assert(!ultBtn?.querySelector('.touchSkillCdWipe'), '技能图标：沉磁井不应有 CD 径向遮罩');
  assert(ultRing?.style.getPropertyValue('--ult-energy') === '0.4200', '技能图标：磁环能量环应按能量比例');
  assert(ultBtn?.getAttribute('aria-label') === '沉磁井', '技能图标：磁环第五键无障碍名应为沉磁井');
  assert(!ringImgs[0]?.src.includes('skill-hook-1-spear.webp'), '技能图标：切英雄后 1 槽不应残留钩矛');
  assert(
    ringImgs.every((img) => img && !img.src.includes('skill-hook-')),
    '技能图标：磁环四键不应残留钩刺图',
  );
  const cancel = host.querySelector<HTMLButtonElement>('button.touchCancel');
  assert(!!cancel && !cancel.hidden, '技能图标：瞄准中取消键仍出现');

  firePointer(btns[1], 'pointerdown');
  assert(bus.sample(0, 0).skillPress === 2, '技能图标：点键仍应进技能按下');
  firePointer(btns[1], 'pointerup');

  pad.sync({ aimingSlot: 0, skillCds: [8, 6, 10, 12], fineTuneOn: false, hero: 'chain', energy: 42 });
  const chainImgs = [...btns].map((btn) => btn.querySelector<HTMLImageElement>('img.touchSkillIcon'));
  assert(!!chainImgs[0]?.src.includes('skill-chain-1-heal.webp'), '技能图标：切到链生后 1 槽应为愈链图');
  assert(!!chainImgs[1]?.src.includes('skill-chain-2-leech.webp'), '技能图标：切到链生后 2 槽应为盾脉图');
  assert(!!chainImgs[2]?.src.includes('skill-chain-3-yank.webp'), '技能图标：切到链生后 3 槽应为援勾图');
  assert(!!chainImgs[3]?.src.includes('skill-chain-4-silence.webp'), '技能图标：切到链生后 4 槽应为扰锋图');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '愈', '技能图标：链生 1 短名应为愈');
  assert(btns[0].classList.contains('isCd'), '技能图标：链生 1 应走真实 CD');
  assert(!!ultImg?.src.includes(CHAIN_ULT_ICON_FILE) && !ultImg.hidden, '技能图标：切到链生后必杀应挂均血图');
  assert(!ultImg?.src.includes(HOOK_ULT_ICON_FILE), '技能图标：链生必杀不应残留无畏冲锋图');
  assert(!ultImg?.src.includes(RING_ULT_ICON_FILE), '技能图标：链生必杀不应残留沉磁井图');
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：均血不应走技能 CD');
  assert(!ultBtn?.querySelector('.touchSkillCdWipe'), '技能图标：均血不应有 CD 径向遮罩');
  assert(ultRing?.style.getPropertyValue('--ult-energy') === '0.4200', '技能图标：链生能量环应按能量比例');
  assert(ultBtn?.getAttribute('aria-label') === '均血', '技能图标：链生第五键无障碍名应为均血');
  assert(
    chainImgs.every((img) => img && !img.src.includes('skill-hook-') && !img.src.includes('skill-ring-') && !img.src.includes('skill-nail-') && !img.src.includes('skill-arc-')),
    '技能图标：链生四键不应残留钩刺、磁环、钉壳或闪弧图',
  );

  pad.sync({ aimingSlot: 0, skillCds: [8, 6, 10, 12], fineTuneOn: false, hero: 'nail', energy: 42 });
  const nailImgs = [...btns].map((btn) => btn.querySelector<HTMLImageElement>('img.touchSkillIcon'));
  assert(!!nailImgs[0]?.src.includes('skill-nail-1-armor.webp'), '技能图标：切到钉壳后 1 槽应为甲垒图');
  assert(!!nailImgs[1]?.src.includes('skill-nail-2-thorn.webp'), '技能图标：切到钉壳后 2 槽应为刺盾图');
  assert(!!nailImgs[2]?.src.includes('skill-nail-3-ram.webp'), '技能图标：切到钉壳后 3 槽应为顶冲图');
  assert(!!nailImgs[3]?.src.includes('skill-nail-4-anchor.webp'), '技能图标：切到钉壳后 4 槽应为钉锚图');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '甲', '技能图标：钉壳 1 短名应为甲');
  assert(btns[0].classList.contains('isCd'), '技能图标：钉壳 1 应走真实 CD');
  assert(!!ultImg && (ultImg.hidden || ultImg.classList.contains('isMiss')), '技能图标：钉壳第五键仍不挂图');
  assert(!ultImg?.src.includes(HOOK_ULT_ICON_FILE) || ultImg.hidden, '技能图标：钉壳必杀不应显示无畏冲锋图');
  assert(!ultImg?.src.includes(RING_ULT_ICON_FILE) || ultImg.hidden, '技能图标：钉壳必杀不应显示沉磁井图');
  assert(!ultImg?.src.includes(CHAIN_ULT_ICON_FILE) || ultImg.hidden, '技能图标：钉壳必杀不应显示均血图');
  assert(!ultImg?.src.includes('skill-nail-'), '技能图标：钉壳第五键不应挂钉壳图');
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：钉壳必杀不应走技能 CD');
  assert(!ultBtn?.querySelector('.touchSkillCdWipe'), '技能图标：钉壳必杀不应有 CD 径向遮罩');
  assert(ultRing?.style.getPropertyValue('--ult-energy') === '0.4200', '技能图标：钉壳能量环应按能量比例');
  assert(ultBtn?.getAttribute('aria-label') === '必杀', '技能图标：钉壳第五键无障碍名应为必杀');
  assert(
    nailImgs.every(
      (img) =>
        img &&
        !img.src.includes('skill-hook-') &&
        !img.src.includes('skill-ring-') &&
        !img.src.includes('skill-chain-') &&
        !img.src.includes('skill-arc-'),
    ),
    '技能图标：钉壳四键不应残留钩刺、磁环、链生或闪弧图',
  );

  pad.sync({ aimingSlot: 0, skillCds: [8, 6, 10, 12], fineTuneOn: false, hero: 'arc', energy: 42 });
  const arcImgs = [...btns].map((btn) => btn.querySelector<HTMLImageElement>('img.touchSkillIcon'));
  assert(!!arcImgs[0]?.src.includes('skill-arc-1-blink.webp'), '技能图标：切到闪弧后 1 槽应为侧闪图');
  assert(!!arcImgs[1]?.src.includes('skill-arc-2-blade.webp'), '技能图标：切到闪弧后 2 槽应为掠刃图');
  assert(!!arcImgs[2]?.src.includes('skill-arc-3-mark.webp'), '技能图标：切到闪弧后 3 槽应为回印图');
  assert(!!arcImgs[3]?.src.includes('skill-arc-4-phase.webp'), '技能图标：切到闪弧后 4 槽应为虚影图');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '闪', '技能图标：闪弧 1 短名应为闪');
  assert(btns[0].classList.contains('isCd'), '技能图标：闪弧 1 应走真实 CD');
  assert(!!ultImg && (ultImg.hidden || ultImg.classList.contains('isMiss')), '技能图标：闪弧第五键仍不挂图');
  assert(!ultImg?.src.includes(HOOK_ULT_ICON_FILE) || ultImg.hidden, '技能图标：闪弧必杀不应显示无畏冲锋图');
  assert(!ultImg?.src.includes(RING_ULT_ICON_FILE) || ultImg.hidden, '技能图标：闪弧必杀不应显示沉磁井图');
  assert(!ultImg?.src.includes(CHAIN_ULT_ICON_FILE) || ultImg.hidden, '技能图标：闪弧必杀不应显示均血图');
  assert(!ultImg?.src.includes('skill-nail-') && !ultImg?.src.includes('skill-arc-'), '技能图标：闪弧第五键不应挂钉壳或闪弧图');
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：闪弧必杀不应走技能 CD');
  assert(!ultBtn?.querySelector('.touchSkillCdWipe'), '技能图标：闪弧必杀不应有 CD 径向遮罩');
  assert(ultRing?.style.getPropertyValue('--ult-energy') === '0.4200', '技能图标：闪弧能量环应按能量比例');
  assert(ultBtn?.getAttribute('aria-label') === '必杀', '技能图标：闪弧第五键无障碍名应为必杀');
  assert(
    arcImgs.every(
      (img) =>
        img &&
        !img.src.includes('skill-hook-') &&
        !img.src.includes('skill-ring-') &&
        !img.src.includes('skill-chain-') &&
        !img.src.includes('skill-nail-'),
    ),
    '技能图标：闪弧四键不应残留钩刺、磁环、链生或钉壳图',
  );

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
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-ring-'), '技能图标：切走磁环后 1 槽不应残留辉环');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-chain-'), '技能图标：切走链生后 1 槽不应残留愈链');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-nail-'), '技能图标：切走钉壳后 1 槽不应残留甲垒');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-arc-'), '技能图标：切走闪弧后 1 槽不应残留侧闪');
  assert(!!ultImg && (ultImg.hidden || ultImg.classList.contains('isMiss')), '技能图标：切到无挂图英雄后必杀图应藏');
  assert(!ultImg?.src.includes(RING_ULT_ICON_FILE) || ultImg.hidden, '技能图标：切走磁环后必杀不应仍显示沉磁井');
  assert(!ultImg?.src.includes(CHAIN_ULT_ICON_FILE) || ultImg.hidden, '技能图标：切走链生后必杀不应仍显示均血');
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'mirror' });
  assert(
    !!btns[3].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-mirror-4-wall.webp'),
    '技能图标：镜卫 4 应为镜壁图',
  );
  pad.sync({ aimingSlot: 0, skillCds: [0, 0, 0, 0], fineTuneOn: false, hero: 'hook', energy: 100 });
  assert(!!ultImg?.src.includes(HOOK_ULT_ICON_FILE) && !ultImg.hidden, '技能图标：切回钩刺后必杀图应回来');
  assert(!ultImg?.src.includes(RING_ULT_ICON_FILE), '技能图标：切回钩刺后必杀不应残留沉磁井图');
  assert(!ultImg?.src.includes(CHAIN_ULT_ICON_FILE), '技能图标：切回钩刺后必杀不应残留均血图');
  assert(!ultBtn?.classList.contains('isCd'), '技能图标：切回后必杀仍不是 CD');
  assert(!!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-hook-1-spear.webp'), '技能图标：切回钩刺后 1 槽应为钩矛');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-ring-'), '技能图标：切回钩刺后 1 槽不应残留磁环图');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-chain-'), '技能图标：切回钩刺后 1 槽不应残留链生图');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-nail-'), '技能图标：切回钩刺后 1 槽不应残留钉壳图');
  assert(!btns[0].querySelector<HTMLImageElement>('img.touchSkillIcon')?.src.includes('skill-arc-'), '技能图标：切回钩刺后 1 槽不应残留闪弧图');
  if (!ultBtn) {
    throw new Error('技能图标：应有第五键可点');
  }
  firePointer(ultBtn, 'pointerdown');
  assert(bus.sample(0, 0).skillPress === 5, '技能图标：点必杀键仍应进技能按下');
  firePointer(ultBtn, 'pointerup');
}
