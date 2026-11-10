import { Assets, Texture } from 'pixi.js';
import { HOOK_RIDER, hookRiderArtUrl } from './hookRiderArt';

/** 正式四蹄分层：与离线预览同一套 89×256 WebP，锚点与整图身躯相同。 */
export const HOOK_RIDER_RUN_FILES = {
  body: 'hookRunBody.webp',
  bodyRed: 'hookRunBodyRed.webp',
  rider: 'hookRunRider.webp',
  riderRed: 'hookRunRiderRed.webp',
  tail: 'hookRunTail.webp',
  fl: 'hookRunLegFl.webp',
  fr: 'hookRunLegFr.webp',
  hl: 'hookRunLegHl.webp',
  hr: 'hookRunLegHr.webp',
} as const;

export const HOOK_RIDER_RUN_LAYER_COUNT = 7;

export const HOOK_RIDER_RUN_BODY_BYTES = 15384;
export const HOOK_RIDER_RUN_BODY_RED_BYTES = 15564;
export const HOOK_RIDER_RUN_RIDER_BYTES = 8424;
export const HOOK_RIDER_RUN_RIDER_RED_BYTES = 8398;
export const HOOK_RIDER_RUN_TAIL_BYTES = 1814;
export const HOOK_RIDER_RUN_FL_BYTES = 1016;
export const HOOK_RIDER_RUN_FR_BYTES = 1258;
export const HOOK_RIDER_RUN_HL_BYTES = 1020;
export const HOOK_RIDER_RUN_HR_BYTES = 1238;
/** 9 张分层 WebP 合计；不含原静态整图。 */
export const HOOK_RIDER_RUN_BYTES = 54116;

/** 贴图像素关节；前蹄为后蹄补绘后的收腿位置。 */
export const HOOK_RIDER_RUN_JOINTS = {
  tail: { x: 47.86, y: 199 },
  hl: { x: 23.696, y: 153 },
  hr: { x: 74.886, y: 151 },
  fl: { x: 40.481, y: 109 },
  fr: { x: 47.86, y: 109 },
} as const;

export type HookRiderRunArt = {
  body: Texture;
  bodyRed: Texture;
  rider: Texture;
  riderRed: Texture;
  tail: Texture;
  fl: Texture;
  fr: Texture;
  hl: Texture;
  hr: Texture;
};

let runArt: HookRiderRunArt | null = null;

export function getHookRiderRunArt(): HookRiderRunArt | null {
  return runArt;
}

/** 自检注入；生产 boot 走 loadHookRiderRunArt。 */
export function setHookRiderRunArt(art: HookRiderRunArt | null): void {
  runArt = art;
}

export function hookRiderJointLocal(tx: number, ty: number): { x: number; y: number } {
  return {
    x: (tx / HOOK_RIDER.bodyTexW - HOOK_RIDER.bodyAnchorX) * HOOK_RIDER.bodyWorldW,
    y: (ty / HOOK_RIDER.bodyTexH - HOOK_RIDER.bodyAnchorY) * HOOK_RIDER.bodyWorldH,
  };
}

export async function loadHookRiderRunArt(): Promise<HookRiderRunArt | null> {
  const urls = {
    body: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.body),
    bodyRed: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.bodyRed),
    rider: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.rider),
    riderRed: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.riderRed),
    tail: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.tail),
    fl: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.fl),
    fr: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.fr),
    hl: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.hl),
    hr: hookRiderArtUrl(HOOK_RIDER_RUN_FILES.hr),
  };
  try {
    const loaded = await Promise.all([
      Assets.load<Texture>(urls.body),
      Assets.load<Texture>(urls.bodyRed),
      Assets.load<Texture>(urls.rider),
      Assets.load<Texture>(urls.riderRed),
      Assets.load<Texture>(urls.tail),
      Assets.load<Texture>(urls.fl),
      Assets.load<Texture>(urls.fr),
      Assets.load<Texture>(urls.hl),
      Assets.load<Texture>(urls.hr),
    ]);
    if (loaded.some((tex) => !tex)) {
      throw new Error('empty run texture');
    }
    const [body, bodyRed, rider, riderRed, tail, fl, fr, hl, hr] = loaded;
    runArt = { body, bodyRed, rider, riderRed, tail, fl, fr, hl, hr };
    return runArt;
  } catch (err) {
    console.warn('四蹄分层贴图加载失败，回退静态骑装整图', err);
    runArt = null;
    return null;
  }
}
