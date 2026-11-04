import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import {
  formatSkillCd,
  nextSkillCdTotal,
  skillCdRemainRatio,
} from '../ui/skillCdMask';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function firePointer(el: Element, type: string, pointerType: string): void {
  el.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType,
      button: 0,
    }),
  );
}

function wipeRemain(btn: HTMLElement): number {
  const wipe = btn.querySelector<HTMLElement>('.touchSkillCdWipe');
  if (!wipe) {
    throw new Error('技能 CD：键上应有径向遮罩');
  }
  return Number.parseFloat(wipe.style.getPropertyValue('--cd-remain') || '0');
}

function cdTime(btn: HTMLElement): string {
  return btn.querySelector('.touchSkillCdTime')?.textContent ?? '';
}

/** Layout B 技能键：12 点起顺时针遮罩 + 一位小数；长按 CD 中仍可用。 */
export function verifySkillCd(): void {
  assert(formatSkillCd(3.24) === '3.2', '技能 CD：剩余秒应一位小数（3.2）');
  assert(formatSkillCd(8) === '8.0', '技能 CD：整秒也应带一位小数');
  assert(nextSkillCdTotal(8, 0) === 8, '技能 CD：新一轮应用当前剩余当总长');
  assert(nextSkillCdTotal(4, 8) === 8, '技能 CD：倒数中应保持本轮总长');
  assert(nextSkillCdTotal(4, 0) === 4, '技能 CD：短 CD（未中/惩罚）应从 4 起算');
  assert(nextSkillCdTotal(0, 8) === 0, '技能 CD：就绪应清总长');
  assert(Math.abs(skillCdRemainRatio(4, 8) - 0.5) < 1e-6, '技能 CD：一半剩余应为半圈');
  assert(skillCdRemainRatio(0, 8) === 0, '技能 CD：就绪遮罩比例为 0');

  const host = document.createElement('div');
  const bus = createActionBus();
  const pad = createTouchPad(host, bus, { holdMs: 0 });
  const btns = host.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn');
  assert(btns.length === 4, '技能 CD：应为右下 2×2 四键');
  assert(!!btns[0].querySelector('.touchSkillCdWipe'), '技能 CD：每键应有遮罩层');
  assert(btns[0].querySelector('.touchSkillName')?.textContent === '钩', '技能 CD：默认应显示短名');

  pad.sync({
    aimingSlot: 0,
    skillCds: [8, 0, 0, 0],
    fineTuneOn: false,
    hero: 'hook',
  });
  assert(btns[0].classList.contains('isCd'), '技能 CD：有剩余应标 isCd');
  assert(!btns[1].classList.contains('isCd'), '技能 CD：就绪键不应标 isCd');
  assert(cdTime(btns[0]) === '8.0', '技能 CD：整秒应显示 8.0');
  assert(cdTime(btns[1]) === '', '技能 CD：就绪键不应显示剩余');
  assert(Math.abs(wipeRemain(btns[0]) - 1) < 1e-4, '技能 CD：新一轮应从满圈起抹');

  pad.sync({
    aimingSlot: 0,
    skillCds: [3.24, 0, 0, 0],
    fineTuneOn: false,
    hero: 'hook',
  });
  assert(cdTime(btns[0]) === '3.2', '技能 CD：键上应显示 3.2');
  assert(Math.abs(wipeRemain(btns[0]) - 3.24 / 8) < 1e-3, '技能 CD：遮罩应按本轮剩余比例收缩');

  const missHost = document.createElement('div');
  const missPad = createTouchPad(missHost, createActionBus(), { holdMs: 0 });
  const missBtn = missHost.querySelector<HTMLButtonElement>('button.touchSkillBtn');
  if (!missBtn) {
    throw new Error('技能 CD：短 CD 键应存在');
  }
  missPad.sync({
    aimingSlot: 0,
    skillCds: [0, 0, 0, 0],
    fineTuneOn: false,
    hero: 'hook',
  });
  missPad.sync({
    aimingSlot: 0,
    skillCds: [4, 0, 0, 0],
    fineTuneOn: false,
    hero: 'hook',
  });
  assert(Math.abs(wipeRemain(missBtn) - 1) < 1e-4, '技能 CD：短 CD 新开也应从满圈起抹');
  assert(cdTime(missBtn) === '4.0', '技能 CD：短 CD 应显示 4.0');

  firePointer(btns[0], 'pointerdown', 'touch');
  assert(bus.sample(0, 0).skillPress === 1, '技能 CD：CD 中按下仍应进总线');
  assert(!!host.querySelector('.skillTip.isOn'), '技能 CD：CD 中长按仍应出浮层');
  firePointer(btns[0], 'pointerup', 'touch');
  assert(!host.querySelector('.skillTip.isOn'), '技能 CD：松开应收起浮层');

  pad.sync({
    aimingSlot: 0,
    skillCds: [0, 0, 0, 0],
    fineTuneOn: false,
    hero: 'hook',
  });
  assert(!btns[0].classList.contains('isCd'), '技能 CD：就绪后应去掉 isCd');
  assert(cdTime(btns[0]) === '', '技能 CD：就绪后应去掉剩余秒');
  assert(wipeRemain(btns[0]) === 0, '技能 CD：就绪后遮罩比例为 0');
}
