export type BoomFlash = {
  ownerId: number;
  x: number;
  y: number;
  radius: number;
  remain: number;
  life: number;
};

const FLASH_LIFE = 0.22;
const flashes: BoomFlash[] = [];

export function spawnBoomFlash(ownerId: number, x: number, y: number, radius: number): void {
  flashes.push({
    ownerId,
    x,
    y,
    radius,
    remain: FLASH_LIFE,
    life: FLASH_LIFE,
  });
}

export function tickBoomFlashes(ownerId: number, dt: number): void {
  const step = Math.max(0, dt);
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    const flash = flashes[i];
    if (flash.ownerId !== ownerId) {
      continue;
    }
    flash.remain -= step;
    if (flash.remain <= 0) {
      flashes.splice(i, 1);
    }
  }
}

export function clearBoomFlashes(ownerId: number): void {
  for (let i = flashes.length - 1; i >= 0; i -= 1) {
    if (flashes[i].ownerId === ownerId) {
      flashes.splice(i, 1);
    }
  }
}

export function listBoomFlashes(): BoomFlash[] {
  return flashes.filter((flash) => flash.remain > 0);
}

export function resetBoomFlashes(): void {
  flashes.length = 0;
}
