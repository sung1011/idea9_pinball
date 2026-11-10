import { Assets, Texture } from 'pixi.js';
import { SPEAR_TIP_DIST } from '../core/constants';

/**
 * 全局共用 A 骑装（原图像素裁切拆枪，未重绘、未拉伸人马）。
 * 七英雄红蓝同一套贴图与锚点；队色仍走 ball.color 描边，不新配色。
 * 身躯按马头前沿 1.82 格对齐，枪头贴片锚在真实枪尖 SPEAR_TIP_DIST=2.24。
 * 1920×1080 cover 下约 71.6×206.1 px，臀宽约 60 px；碰撞圆直径仍 108 px。
 */
export const HOOK_RIDER = {
  bodyWorldW: 1.326045,
  bodyWorldH: 3.815764,
  bodyAnchorX: 0.487055,
  bodyAnchorY: 0.484061,
  headFrontWorld: 1.82,
  spearWorldW: (38 / 126) * 0.42,
  spearWorldH: 0.42,
  spearAnchorX: 15.5 / 38,
  spearAnchorY: 2 / 126,
  bodyTexW: 89,
  bodyTexH: 256,
  spearTexW: 29,
  spearTexH: 96,
} as const;

export const HOOK_RIDER_BODY_FILE = 'hook-body.webp';
export const HOOK_RIDER_SPEAR_FILE = 'hook-spear.webp';
export const HOOK_RIDER_BODY_BYTES = 24810;
export const HOOK_RIDER_SPEAR_BYTES = 3828;
export const HOOK_RIDER_BYTES = HOOK_RIDER_BODY_BYTES + HOOK_RIDER_SPEAR_BYTES;

export type HookRiderArt = {
  body: Texture;
  spear: Texture;
};

let hookArt: HookRiderArt | null = null;

export function hookRiderArtUrl(file: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}rider/${file}`;
}

export function getHookRiderArt(): HookRiderArt | null {
  return hookArt;
}

/** 仅自检注入/清空；生产由 loadHookRiderArt 覆盖。 */
export function setHookRiderArt(art: HookRiderArt | null): void {
  hookArt = art;
}

export function hookRiderRotation(fx: number, fy: number): number {
  return Math.atan2(fy, fx) + Math.PI / 2;
}

export function hookRiderHeadFrontOk(): boolean {
  return Math.abs(HOOK_RIDER.headFrontWorld + HOOK_RIDER.spearWorldH - SPEAR_TIP_DIST) < 1e-9;
}

export async function loadHookRiderArt(): Promise<HookRiderArt | null> {
  const bodyUrl = hookRiderArtUrl(HOOK_RIDER_BODY_FILE);
  const spearUrl = hookRiderArtUrl(HOOK_RIDER_SPEAR_FILE);
  try {
    const [body, spear] = await Promise.all([Assets.load<Texture>(bodyUrl), Assets.load<Texture>(spearUrl)]);
    if (!body || !spear) {
      throw new Error('empty texture');
    }
    hookArt = { body, spear };
    return hookArt;
  } catch (err) {
    console.warn('骑装贴图加载失败，回退圆盾骑士', err);
    hookArt = null;
    return null;
  }
}
