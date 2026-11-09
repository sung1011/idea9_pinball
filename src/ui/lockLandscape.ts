type OrientationLockable = {
  type?: string;
  lock?: (type: string) => Promise<void>;
};

export type LandscapeLockType = 'landscape-primary' | 'landscape-secondary';

/** 已在某一侧横屏则锁这一侧；否则锁 landscape-primary。不锁 landscape（会允许 180° 对调）。 */
export function landscapeLockType(type?: string | null): LandscapeLockType {
  if (type === 'landscape-primary' || type === 'landscape-secondary') {
    return type;
  }
  return 'landscape-primary';
}

/** 向系统申请锁当前横屏侧。失败（PC / 未授权 / 非 standalone）静默，不弹提示；不靠 CSS 旋转补救，也不回退竖屏可玩布局。 */
export function lockLandscape(): Promise<void> {
  try {
    const orientation = window.screen?.orientation as OrientationLockable | undefined;
    if (typeof orientation?.lock !== 'function') {
      return Promise.resolve();
    }
    const lockType = landscapeLockType(orientation.type);
    return Promise.resolve(orientation.lock(lockType)).catch(() => {});
  } catch {
    return Promise.resolve();
  }
}

/** 独立窗启动：等 lock 结束或超时，再按可见区锁比例。网页不必等。 */
export function whenLandscapeLockSettled(timeoutMs = 400): Promise<void> {
  return Promise.race([
    lockLandscape(),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]).then(() => undefined);
}

/** 启动时锁一次；首次点击或触摸后再锁一次（部分浏览器要用户手势）；朝向变化再试。 */
export function bindLandscapeLock(): void {
  lockLandscape();
  const retry = (): void => {
    lockLandscape();
  };
  window.addEventListener('pointerdown', retry, { once: true, capture: true });
  window.addEventListener('touchstart', retry, { once: true, capture: true, passive: true });
  window.addEventListener('orientationchange', retry);
}
