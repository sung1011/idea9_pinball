import { HERO_IDS } from '../heroes/heroIds';
import { skillNames, skillTipCopy, skillTips } from '../heroes/kitLabels';
import { createActionBus } from '../input/actionBus';
import { createTouchPad } from '../input/touchPad';
import { SKILL_TIP_HOLD_MS } from '../ui/skillTip';
import type { SkillSlot } from '../input/actionTypes';

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

/** 技能键长按约 0.4s 出骑士对外名 + 一行效果；短按仍立刻进瞄。 */
export function verifySkillTip(): void {
  assert(SKILL_TIP_HOLD_MS === 400, '技能提示：长按阈值应为 0.4s');

  for (const hero of HERO_IDS) {
    const names = skillNames(hero);
    const tips = skillTips(hero);
    assert(names.length === 4 && tips.length === 4, `技能提示：${hero} 应有四槽文案`);
    for (let i = 0; i < 4; i += 1) {
      const slot = (i + 1) as SkillSlot;
      const copy = skillTipCopy(hero, slot);
      assert(copy.name === names[i] && copy.name.length > 0, `技能提示：${hero} ${slot} 应有对外名`);
      assert(copy.effect === tips[i] && copy.effect.length > 0, `技能提示：${hero} ${slot} 应有一行效果`);
      assert(!copy.effect.includes('\n'), `技能提示：${hero} ${slot} 效果应是一行`);
    }
  }

  assert(skillTipCopy('hook', 1).name === '钩矛', '技能提示：钩刺 1 对外名应为钩矛');
  assert(skillTipCopy('hook', 1).effect.includes('贴脸'), '技能提示：钩矛效果应来自设计表');
  assert(skillTipCopy('ring', 4).name === '囚环', '技能提示：磁环 4 对外名应为囚环');
  assert(skillTipCopy('ring', 4).effect.includes('物理关死出不去'), '技能提示：囚环应写物理关死出不去');
  assert(skillTipCopy('well', 1).name === '索爆', '技能提示：井绳 1 对外名应为索爆');
  assert(skillTipCopy('well', 1).effect.includes('爆炸'), '技能提示：索爆一行效果应为脉冲爆炸');
  assert(skillTipCopy('well', 4).name === '回索', '技能提示：井绳 4 对外名应为回索');
  assert(skillTipCopy('well', 4).effect.includes('2'), '技能提示：回索一行效果应为定身 2 秒');
  assert(skillTipCopy('chain', 4).name === '扰锋', '技能提示：链生 4 对外名应为扰锋');
  assert(skillTipCopy('chain', 4).effect.includes('沉默'), '技能提示：扰锋一行效果应为范围沉默');

  const delayedHost = document.createElement('div');
  const delayedBus = createActionBus();
  createTouchPad(delayedHost, delayedBus);
  const delayedBtn = delayedHost.querySelector<HTMLButtonElement>('button.touchSkillBtn');
  if (!delayedBtn) {
    throw new Error('技能提示：四键应存在');
  }
  firePointer(delayedBtn, 'pointerdown', 'touch');
  const press = delayedBus.sample(0, 0);
  assert(press.skillPress === 1, '技能提示：按下应立刻推进 ActionBus，不挡进瞄');
  assert(!delayedHost.querySelector('.skillTip.isOn'), '技能提示：未满 0.4s 不应出浮层');
  firePointer(delayedBtn, 'pointerup', 'touch');
  assert(!delayedHost.querySelector('.skillTip.isOn'), '技能提示：松开应收起');

  const instantHost = document.createElement('div');
  const instantBus = createActionBus();
  const pad = createTouchPad(instantHost, instantBus, { holdMs: 0 });
  const btns = instantHost.querySelectorAll<HTMLButtonElement>('button.touchSkillBtn');
  assert(btns.length === 4, '技能提示：应为右下四键');
  firePointer(btns[0], 'pointerdown', 'mouse');
  assert(instantBus.sample(0, 0).skillPress === 1, '技能提示：鼠标按住也应立刻进瞄');
  const tip = instantHost.querySelector<HTMLElement>('.skillTip.isOn');
  if (!tip) {
    throw new Error('技能提示：满阈值应出浮层');
  }
  const name = tip.querySelector('.skillTipName')?.textContent ?? '';
  const effect = tip.querySelector('.skillTipEffect')?.textContent ?? '';
  assert(name === '钩矛', '技能提示：浮层标题应为骑士对外名');
  assert(effect.length > 0 && !effect.includes('\n'), '技能提示：浮层应有一行效果');

  pad.sync({
    aimingSlot: 0,
    skillCds: [8, 0, 0, 0],
    fineTuneOn: false,
    hero: 'hook',
  });
  assert(btns[0].classList.contains('isCd'), '技能提示：CD 中键应标 isCd');
  firePointer(btns[0], 'pointerup', 'mouse');
  firePointer(btns[0], 'pointerdown', 'mouse');
  assert(instantBus.sample(0, 0).skillPress === 1, '技能提示：CD 中仍应能按下进总线');
  assert(!!instantHost.querySelector('.skillTip.isOn'), '技能提示：CD 中长按仍应出浮层');
  firePointer(btns[0], 'pointercancel', 'mouse');
  assert(!instantHost.querySelector('.skillTip.isOn'), '技能提示：取消应按下收起');
}
