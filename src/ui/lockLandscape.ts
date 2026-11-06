type OrientationLockable = {
  lock?: (type: string) => Promise<void>;
};

/** 向系统申请锁横屏。失败（PC / 未授权 / 非 standalone）静默，不弹提示、不转画布。 */
export function lockLandscape(): void {
  try {
    const orientation = window.screen?.orientation as OrientationLockable | undefined;
    if (typeof orientation?.lock !== 'function') {
      return;
    }
    void orientation.lock('landscape').catch(() => {});
  } catch {
    /* 静默 */
  }
}

/** 启动时锁一次；首次点击或触摸后再锁一次（部分浏览器要用户手势）。 */
export function bindLandscapeLock(): void {
  lockLandscape();
  const retry = (): void => {
    lockLandscape();
  };
  window.addEventListener('pointerdown', retry, { once: true, capture: true });
  window.addEventListener('touchstart', retry, { once: true, capture: true, passive: true });
}
