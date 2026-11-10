import { FLOOR_SPEED, REST_SPEED, SPEED_CAP } from '../core/constants';

/** 分层四蹄：纯显示姿态。不改物理、碰撞、枪尖。 */
export type HookRiderRunState = {
  phase: number;
  amp: number;
};

export type HookRiderLegPose = {
  dx: number;
  dy: number;
  rot: number;
};

export type HookRiderGaitPose = {
  amp: number;
  freq: number;
  sideFade: number;
  reverse: boolean;
  bodyY: number;
  riderY: number;
  riderRot: number;
  tailRot: number;
  fl: HookRiderLegPose;
  fr: HookRiderLegPose;
  hl: HookRiderLegPose;
  hr: HookRiderLegPose;
};

export type HookRiderRunInput = {
  vx: number;
  vy: number;
  facingX: number;
  facingY: number;
  dt: number;
};

const TAU = Math.PI * 2;
/** 奔跑步态相位：后左 → 后右 → 前左 → 前右 */
const PHASE_HL = 0;
const PHASE_HR = 0.13;
const PHASE_FL = 0.5;
const PHASE_FR = 0.63;
const AMP_TAU = 0.14;
const EXTEND = 0.16;
const OUTWARD = 0.08;
const LEG_ROT = 0.32;
const BODY_BOB = 0.028;
const RIDER_BOB = 0.034;
const RIDER_ROT = 0.06;
const TAIL_ROT = 0.28;

export function createHookRiderRunState(): HookRiderRunState {
  return { phase: 0, amp: 0 };
}

export function hookRiderRunIdentity(): HookRiderGaitPose {
  const z = { dx: 0, dy: 0, rot: 0 };
  return {
    amp: 0,
    freq: 0,
    sideFade: 1,
    reverse: false,
    bodyY: 0,
    riderY: 0,
    riderRot: 0,
    tailRot: 0,
    fl: { ...z },
    fr: { ...z },
    hl: { ...z },
    hr: { ...z },
  };
}

function unit(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len < 1e-6) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / Math.max(1e-6, e1 - e0));
  return t * t * (3 - 2 * t);
}

function wave(phase: number, offset: number): number {
  return Math.sin((phase + offset) * TAU);
}

function stride(amp: number, waveVal: number, side: number): HookRiderLegPose {
  const lift = 0.5 * (1 + waveVal);
  return {
    dx: side * OUTWARD * amp * lift,
    dy: EXTEND * amp * waveVal,
    rot: LEG_ROT * amp * waveVal * -side,
  };
}

/**
 * 按滑行速度推进四蹄奔跑步态。
 * 侧滑/后滑减弱幅度，朝向仍用瞄准/facing，不把马头拧去追速度。
 */
export function stepHookRiderGait(state: HookRiderRunState, input: HookRiderRunInput): HookRiderGaitPose {
  const dt = Number.isFinite(input.dt) ? Math.max(0, input.dt) : 0;
  const speed = Math.hypot(input.vx, input.vy);
  const facing = unit(input.facingX, input.facingY);
  const vel = unit(input.vx, input.vy);
  const along = vel.x * facing.x + vel.y * facing.y;
  const align = Math.abs(along);
  const sideFade = 0.3 + 0.7 * align;
  const speedAmp = speed <= REST_SPEED ? 0 : smoothstep(REST_SPEED, FLOOR_SPEED, speed) * (0.62 + 0.38 * clamp01(speed / SPEED_CAP));
  const targetAmp = speedAmp * sideFade;
  const k = 1 - Math.exp(-dt / AMP_TAU);
  state.amp += (targetAmp - state.amp) * k;
  if (state.amp < 1e-4) {
    state.amp = 0;
  }
  const freq = state.amp <= 0 ? 0 : 1.05 + 2.35 * clamp01(speed / SPEED_CAP);
  const reverse = along < -0.12 && speed > REST_SPEED;
  if (freq > 0 && dt > 0) {
    state.phase += freq * dt * (reverse ? -1 : 1);
    state.phase -= Math.floor(state.phase);
  }
  if (state.amp <= 0) {
    const idle = hookRiderRunIdentity();
    idle.freq = freq;
    idle.sideFade = sideFade;
    idle.reverse = reverse;
    return idle;
  }

  const sHl = wave(state.phase, PHASE_HL);
  const sHr = wave(state.phase, PHASE_HR);
  const sFl = wave(state.phase, PHASE_FL);
  const sFr = wave(state.phase, PHASE_FR);
  const amp = state.amp;
  const bob = -BODY_BOB * amp * Math.sin(state.phase * TAU + 0.35);
  return {
    amp,
    freq,
    sideFade,
    reverse,
    bodyY: bob,
    riderY: -RIDER_BOB * amp * Math.sin(state.phase * TAU + 0.22),
    riderRot: RIDER_ROT * amp * Math.sin(state.phase * TAU),
    tailRot: TAIL_ROT * amp * (0.65 * Math.sin(state.phase * TAU + 0.5) + 0.35 * (sHl - sHr)),
    hl: stride(amp, sHl, -1),
    hr: stride(amp, sHr, 1),
    fl: {
      dx: -OUTWARD * amp * 0.5 * (1 + sFl),
      dy: -EXTEND * amp * 0.5 * (1 + sFl),
      rot: -LEG_ROT * amp * sFl,
    },
    fr: {
      dx: OUTWARD * amp * 0.5 * (1 + sFr),
      dy: -EXTEND * amp * 0.5 * (1 + sFr),
      rot: LEG_ROT * amp * sFr,
    },
  };
}
