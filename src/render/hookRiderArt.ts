import { Assets, Texture } from 'pixi.js';
import { SPEAR_TIP_DIST } from '../core/constants';

/**
 * 全局共用 A 骑装（原图像素裁切拆枪，未重绘、未拉伸人马）。
 * 蓝方用原图；红方仅盔甲+盾牌局部换红，白马/皮肤/长枪/羽冠/马具不染。
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
export const HOOK_RIDER_BODY_RED_FILE = 'hook-body-red.webp';
export const HOOK_RIDER_SPEAR_FILE = 'hook-spear.webp';
export const HOOK_RIDER_BODY_BYTES = 24810;
export const HOOK_RIDER_BODY_RED_BYTES = 25256;
export const HOOK_RIDER_SPEAR_BYTES = 3828;
export const HOOK_RIDER_BYTES = HOOK_RIDER_BODY_BYTES + HOOK_RIDER_SPEAR_BYTES;
export const HOOK_RIDER_TEAM_BYTES = HOOK_RIDER_BYTES + HOOK_RIDER_BODY_RED_BYTES;

export type HookRiderArt = {
  body: Texture;
  bodyRed: Texture;
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

export function hookRiderBodyTexture(team: 'red' | 'blue' | string | undefined): Texture | null {
  if (!hookArt) {
    return null;
  }
  return team === 'red' ? hookArt.bodyRed : hookArt.body;
}

export async function loadHookRiderArt(): Promise<HookRiderArt | null> {
  const bodyUrl = hookRiderArtUrl(HOOK_RIDER_BODY_FILE);
  const bodyRedUrl = hookRiderArtUrl(HOOK_RIDER_BODY_RED_FILE);
  const spearUrl = hookRiderArtUrl(HOOK_RIDER_SPEAR_FILE);
  try {
    const [body, spear] = await Promise.all([Assets.load<Texture>(bodyUrl), Assets.load<Texture>(spearUrl)]);
    if (!body || !spear) {
      throw new Error('empty texture');
    }
    let bodyRed = body;
    try {
      const loadedRed = await Assets.load<Texture>(bodyRedUrl);
      if (loadedRed) {
        bodyRed = loadedRed;
      }
    } catch (redErr) {
      console.warn('红方骑装贴图加载失败，红蓝暂共用蓝方原图', redErr);
    }
    hookArt = { body, bodyRed, spear };
    return hookArt;
  } catch (err) {
    console.warn('骑装贴图加载失败，回退圆盾骑士', err);
    hookArt = null;
    return null;
  }
}
