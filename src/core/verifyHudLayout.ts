import { computeLandscapeStage, isPortraitViewport, shouldShowRotateHint, wantsRotateHint } from '../ui/stageLayout';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

/** Layout B：横构图舞台、竖窗 letterbox、触屏竖持才转横提示。 */
export function verifyHudLayout(): void {
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const landscape = computeLandscapeStage(1600, 900, none);
  assert(landscape.width > landscape.height, 'HUD：横屏舞台应为横构图');
  assert(Math.abs(landscape.width / landscape.height - 20 / 12) < 1e-6, 'HUD：舞台比例应为 20×12');

  const portrait = computeLandscapeStage(800, 1200, none);
  assert(portrait.width > portrait.height, 'HUD：竖窗仍保持横构图');
  assert(portrait.x + portrait.width <= 800 + 1e-6, 'HUD：竖窗舞台不应超出宽度');
  assert(portrait.y > 10, 'HUD：竖窗应上下留 letterbox');

  const notch = computeLandscapeStage(1600, 900, { top: 0, right: 44, bottom: 0, left: 44 });
  assert(notch.x >= 44, 'HUD：舞台应避开左侧安全区');
  assert(notch.x + notch.width <= 1600 - 44 + 1e-6, 'HUD：舞台应避开右侧安全区');

  assert(isPortraitViewport(800, 1200) && !isPortraitViewport(1600, 900), 'HUD：竖/横判定');
  assert(!wantsRotateHint(1600, 900), 'HUD：横屏窗口不应出转横提示');
  assert(
    !shouldShowRotateHint({
      viewW: 800,
      viewH: 1200,
      screenPortrait: false,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：PC 竖窗（屏幕仍横）不应出转横提示',
  );
  assert(
    shouldShowRotateHint({
      viewW: 375,
      viewH: 667,
      screenPortrait: true,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：手机竖持应出转横提示',
  );
  assert(
    !shouldShowRotateHint({
      viewW: 667,
      viewH: 375,
      screenPortrait: false,
      hoverNone: true,
      coarsePointer: true,
    }),
    'HUD：手机横持不应出转横提示',
  );
}
