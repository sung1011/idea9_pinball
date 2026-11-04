import { Container, Text } from 'pixi.js';
import {
  COMBAT_FLOAT_LIFE,
  COMBAT_FLOAT_RISE,
  combatFloatColor,
  combatFloatStackOffset,
  formatCombatFloat,
  type CombatFloatEvent,
} from '../core/combatFloat';

export type CombatFloatView = {
  root: Container;
  spawn: (events: readonly CombatFloatEvent[]) => void;
  tick: (dt: number) => void;
  clear: () => void;
};

type FloatItem = {
  text: Text;
  age: number;
  x: number;
  y: number;
};

const TEXT_SCALE = 0.018;

function makeLabel(event: CombatFloatEvent, stack: number): Text {
  const label = new Text({
    text: formatCombatFloat(event.kind, event.amount),
    style: {
      fontFamily: 'ui-rounded, ui-sans-serif, system-ui, sans-serif',
      fontSize: 48,
      fontWeight: '800',
      fill: combatFloatColor(event.kind),
      stroke: { color: 0x140808, width: 6, join: 'round' },
    },
  });
  const off = combatFloatStackOffset(stack);
  label.anchor.set(0.5, 1);
  label.scale.set(TEXT_SCALE);
  label.position.set(event.x + off.dx, event.y - 0.62 + off.dy);
  label.eventMode = 'none';
  return label;
}

/** 结算点冒出：短上浮后淡出。世界坐标，不挡 HTML 技能键与顶中比分。 */
export function createCombatFloatView(): CombatFloatView {
  const root = new Container();
  root.eventMode = 'none';
  const items: FloatItem[] = [];

  const spawn = (events: readonly CombatFloatEvent[]): void => {
    const stacks = new Map<number, number>();
    for (const event of events) {
      if (event.amount <= 0) {
        continue;
      }
      const stack = stacks.get(event.unitId) ?? 0;
      stacks.set(event.unitId, stack + 1);
      const text = makeLabel(event, stack);
      root.addChild(text);
      items.push({ text, age: 0, x: text.x, y: text.y });
    }
  };

  const tick = (dt: number): void => {
    const step = Math.max(0, dt);
    for (let i = items.length - 1; i >= 0; i -= 1) {
      const item = items[i];
      item.age += step;
      const t = Math.min(1, item.age / COMBAT_FLOAT_LIFE);
      const rise = COMBAT_FLOAT_RISE * (1 - (1 - t) * (1 - t));
      item.text.position.set(item.x, item.y - rise);
      item.text.alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
      if (item.age >= COMBAT_FLOAT_LIFE) {
        item.text.destroy();
        items.splice(i, 1);
      }
    }
  };

  const clear = (): void => {
    for (const item of items) {
      item.text.destroy();
    }
    items.length = 0;
  };

  return { root, spawn, tick, clear };
}
