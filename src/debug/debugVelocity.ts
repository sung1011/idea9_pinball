/** `R` 只重开一局（正式可用）。旧 GM 碰撞测快捷键已移除。 */
export function bindDebugVelocity(opts: { onReset?: () => void }): () => void {
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.repeat) {
      return;
    }
    if (ev.key.toLowerCase() !== 'r') {
      return;
    }
    ev.preventDefault();
    opts.onReset?.();
  };

  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
