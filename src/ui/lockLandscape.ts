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
export function lockLandscape(): void {
  try {
    const orientation = window.screen?.orientation as OrientationLockable | undefined;
    if (typeof orientation?.lock !== 'function') {
      return;
    }
    const lockType = landscapeLockType(orientation.type);
    void orientation.lock(lockType).catch(() => {});
  } catch {
    /* 静默 */
  }
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
