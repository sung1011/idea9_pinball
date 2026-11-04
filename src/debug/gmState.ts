const STORAGE_KEY = 'idea9PinballGm';

export function loadGmEnabled(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

export function saveGmEnabled(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}
