import { HERO_IDS, isHeroId, type HeroId } from '../heroes/heroIds';
import { HOOK_TECH_DEFS } from './hookTech';
import { planMatchTechReward, type MatchRewardInput } from './techReward';
import {
  copyCombatTechs,
  EMPTY_COMBAT_TECHS,
  heroUnlockCost,
  isHookTechId,
  TECH_SAVE_KEY,
  TECH_SAVE_VERSION,
  type CombatTechSnapshot,
  type HookTechId,
} from './techIds';

export type TechStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type TechSaveState = {
  version: number;
  points: number;
  unlockedHeroes: HeroId[];
  litTechs: HookTechId[];
  lastRewardMatchId: string | null;
};

export type TechBuyOk = {
  ok: true;
  state: TechSaveState;
  spent: number;
  kind: 'hero' | 'tech';
  id: string;
};

export type TechBuyFail = {
  ok: false;
  code: 'locked' | 'owned' | 'todo' | 'poor' | 'invalid' | 'readonly' | 'write';
  message: string;
};

export type TechBuyResult = TechBuyOk | TechBuyFail;

export type TechGrantResult = {
  granted: boolean;
  amount: number;
  balance: number;
  label: string;
  note: string;
  duplicate: boolean;
};

export type TechLoadStatus = {
  ok: boolean;
  writable: boolean;
  message: string;
  raw: string | null;
};

export type TechStore = {
  getState: () => TechSaveState;
  snapshot: () => CombatTechSnapshot;
  isHeroUnlocked: (hero: HeroId) => boolean;
  isTechLit: (id: HookTechId) => boolean;
  heroUnlockCost: () => number;
  techCost: (id: HookTechId) => number;
  buyHero: (hero: HeroId) => TechBuyResult;
  buyTech: (id: HookTechId) => TechBuyResult;
  grantMatchReward: (input: MatchRewardInput) => TechGrantResult;
  status: () => TechLoadStatus;
  subscribe: (listener: () => void) => () => void;
};

const MAX_POINTS = 1_000_000_000;

export function emptyTechSave(): TechSaveState {
  return {
    version: TECH_SAVE_VERSION,
    points: 0,
    unlockedHeroes: ['hook'],
    litTechs: [],
    lastRewardMatchId: null,
  };
}

function uniqueHeroes(list: readonly string[]): HeroId[] {
  const out: HeroId[] = [];
  const seen = new Set<HeroId>();
  for (const raw of list) {
    if (!isHeroId(raw) || seen.has(raw)) {
      continue;
    }
    seen.add(raw);
    out.push(raw);
  }
  if (!seen.has('hook')) {
    out.unshift('hook');
  }
  return out;
}

function uniqueTechs(list: readonly string[], unlocked: readonly HeroId[]): HookTechId[] {
  const allowHook = unlocked.includes('hook');
  const out: HookTechId[] = [];
  const seen = new Set<HookTechId>();
  for (const raw of list) {
    if (!isHookTechId(raw) || seen.has(raw)) {
      continue;
    }
    if (!allowHook) {
      continue;
    }
    seen.add(raw);
    out.push(raw);
  }
  return out;
}

function finiteNonNeg(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function parseTechSave(raw: unknown): TechSaveState | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const rec = raw as Record<string, unknown>;
  if (rec.version !== TECH_SAVE_VERSION) {
    return null;
  }
  const points = finiteNonNeg(rec.points);
  if (points == null || points > MAX_POINTS) {
    return null;
  }
  if (!Array.isArray(rec.unlockedHeroes) || !Array.isArray(rec.litTechs)) {
    return null;
  }
  for (const id of rec.unlockedHeroes) {
    if (typeof id !== 'string' || !isHeroId(id)) {
      return null;
    }
  }
  for (const id of rec.litTechs) {
    if (typeof id !== 'string' || !isHookTechId(id)) {
      return null;
    }
  }
  let lastRewardMatchId: string | null = null;
  if (rec.lastRewardMatchId != null) {
    if (typeof rec.lastRewardMatchId !== 'string' || rec.lastRewardMatchId.length > 128) {
      return null;
    }
    lastRewardMatchId = rec.lastRewardMatchId;
  }
  const unlockedHeroes = uniqueHeroes(rec.unlockedHeroes as string[]);
  return {
    version: TECH_SAVE_VERSION,
    points: Math.floor(points),
    unlockedHeroes,
    litTechs: uniqueTechs(rec.litTechs as string[], unlockedHeroes),
    lastRewardMatchId,
  };
}

function cloneState(state: TechSaveState): TechSaveState {
  return {
    version: TECH_SAVE_VERSION,
    points: state.points,
    unlockedHeroes: [...state.unlockedHeroes],
    litTechs: [...state.litTechs],
    lastRewardMatchId: state.lastRewardMatchId,
  };
}

function snapshotOf(state: TechSaveState): CombatTechSnapshot {
  const lit = new Set(state.litTechs);
  return {
    pull: lit.has('hookPull'),
    stab: lit.has('hookStab'),
    shove: lit.has('hookShove'),
    brake: lit.has('hookBrake'),
  };
}

export function browserTechStorage(): TechStorage {
  return {
    getItem(key) {
      return localStorage.getItem(key);
    },
    setItem(key, value) {
      localStorage.setItem(key, value);
    },
  };
}

export function memoryTechStorage(init: Record<string, string> = {}): TechStorage {
  const map = new Map(Object.entries(init));
  return {
    getItem(key) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key, value) {
      map.set(key, value);
    },
  };
}

function readRaw(storage: TechStorage, key: string): { ok: true; raw: string | null } | { ok: false; error: string } {
  try {
    return { ok: true, raw: storage.getItem(key) };
  } catch {
    return { ok: false, error: '科技存档无法读取，已保护原始记录。本次先按新档处理，不覆盖。' };
  }
}

function writeRaw(storage: TechStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    const check = storage.getItem(key);
    return check === value;
  } catch {
    return false;
  }
}

export function createTechStore(storage: TechStorage = browserTechStorage(), key = TECH_SAVE_KEY): TechStore {
  let state = emptyTechSave();
  let writable = true;
  let message = '';
  let raw: string | null = null;
  const listeners = new Set<() => void>();

  const emit = (): void => {
    for (const fn of listeners) {
      fn();
    }
  };

  const load = (): void => {
    const read = readRaw(storage, key);
    if (!read.ok) {
      writable = false;
      message = read.error;
      raw = null;
      state = emptyTechSave();
      return;
    }
    raw = read.raw;
    if (raw == null || raw === '') {
      writable = true;
      message = '';
      state = emptyTechSave();
      return;
    }
    try {
      const parsed = parseTechSave(JSON.parse(raw) as unknown);
      if (!parsed) {
        writable = false;
        message = '科技存档损坏，已保护原始记录。本次先按新档处理，不覆盖。';
        state = emptyTechSave();
        return;
      }
      writable = true;
      message = '';
      state = parsed;
    } catch {
      writable = false;
      message = '科技存档损坏，已保护原始记录。本次先按新档处理，不覆盖。';
      state = emptyTechSave();
    }
  };

  const persist = (next: TechSaveState): boolean => {
    if (!writable) {
      return false;
    }
    const encoded = JSON.stringify(next);
    if (!writeRaw(storage, key, encoded)) {
      return false;
    }
    raw = encoded;
    state = next;
    emit();
    return true;
  };

  load();

  const fail = (code: TechBuyFail['code'], msg: string): TechBuyFail => ({
    ok: false,
    code,
    message: msg,
  });

  return {
    getState: () => cloneState(state),
    snapshot: () => copyCombatTechs(snapshotOf(state)),
    isHeroUnlocked(hero) {
      return hero === 'hook' || state.unlockedHeroes.includes(hero);
    },
    isTechLit(id) {
      return state.litTechs.includes(id);
    },
    heroUnlockCost: () => heroUnlockCost(state.unlockedHeroes),
    techCost(id) {
      return HOOK_TECH_DEFS.find((item) => item.id === id)?.cost ?? 0;
    },
    buyHero(hero) {
      if (!isHeroId(hero) || !HERO_IDS.includes(hero)) {
        return fail('invalid', '非法英雄');
      }
      if (hero === 'hook' || state.unlockedHeroes.includes(hero)) {
        return fail('owned', '已解锁，不重复扣点');
      }
      if (!writable) {
        return fail('readonly', message || '存档不可写入');
      }
      const cost = heroUnlockCost(state.unlockedHeroes);
      if (state.points < cost) {
        return fail('poor', `资源不足，需要 ${cost} 点`);
      }
      const next = cloneState(state);
      next.points -= cost;
      next.unlockedHeroes = uniqueHeroes([...next.unlockedHeroes, hero]);
      if (!persist(next)) {
        return fail('write', '写入失败，未扣点也未解锁');
      }
      return { ok: true, state: cloneState(state), spent: cost, kind: 'hero', id: hero };
    },
    buyTech(id) {
      if (!isHookTechId(id)) {
        return fail('todo', '该英雄强化仍是 todo，不可购买');
      }
      if (!state.unlockedHeroes.includes('hook')) {
        return fail('locked', '需先解锁英雄');
      }
      if (state.litTechs.includes(id)) {
        return fail('owned', '已点亮，不重复扣点');
      }
      if (!writable) {
        return fail('readonly', message || '存档不可写入');
      }
      const def = HOOK_TECH_DEFS.find((item) => item.id === id);
      if (!def) {
        return fail('invalid', '非法科技');
      }
      if (state.points < def.cost) {
        return fail('poor', `资源不足，需要 ${def.cost} 点`);
      }
      const next = cloneState(state);
      next.points -= def.cost;
      next.litTechs = uniqueTechs([...next.litTechs, id], next.unlockedHeroes);
      if (!persist(next)) {
        return fail('write', '写入失败，未扣点也未点亮');
      }
      return { ok: true, state: cloneState(state), spent: def.cost, kind: 'tech', id };
    },
    grantMatchReward(input) {
      const plan = planMatchTechReward(input);
      if (plan.skip) {
        return {
          granted: false,
          amount: 0,
          balance: state.points,
          label: plan.label,
          note: plan.reason,
          duplicate: false,
        };
      }
      const matchId = input.matchId ?? '';
      if (matchId && state.lastRewardMatchId === matchId) {
        return {
          granted: false,
          amount: 0,
          balance: state.points,
          label: plan.label,
          note: '本场已结算过科技点',
          duplicate: true,
        };
      }
      if (!writable) {
        return {
          granted: false,
          amount: 0,
          balance: state.points,
          label: plan.label,
          note: message || '存档不可写入，未发点',
          duplicate: false,
        };
      }
      const next = cloneState(state);
      next.points = Math.min(MAX_POINTS, next.points + plan.amount);
      next.lastRewardMatchId = matchId || next.lastRewardMatchId;
      if (!persist(next)) {
        return {
          granted: false,
          amount: 0,
          balance: state.points,
          label: plan.label,
          note: '写入失败，未发点',
          duplicate: false,
        };
      }
      return {
        granted: true,
        amount: plan.amount,
        balance: state.points,
        label: plan.label,
        note: `${plan.label} +${plan.amount}`,
        duplicate: false,
      };
    },
    status: () => ({
      ok: writable && !message,
      writable,
      message,
      raw,
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { EMPTY_COMBAT_TECHS, copyCombatTechs, TECH_SAVE_KEY, TECH_SAVE_VERSION };
