/** 技能键 CD：12 点起顺时针径向遮罩，剩余秒一位小数。不改 kit 数值。 */

export type SkillCdFace = {
  icon: HTMLImageElement;
  name: HTMLElement;
  wipe: HTMLElement;
  time: HTMLElement;
};

export function formatSkillCd(remain: number): string {
  return remain.toFixed(1);
}

/** remain 变大视为新一轮 CD（含 miss / punish 短 CD），用该值当本轮总长。 */
export function nextSkillCdTotal(remain: number, prevTotal: number): number {
  if (remain <= 0) {
    return 0;
  }
  return remain > prevTotal ? remain : prevTotal;
}

export function skillCdRemainRatio(remain: number, total: number): number {
  if (remain <= 0 || total <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, remain / total));
}

export function createSkillCdFace(btn: HTMLButtonElement, label: string): SkillCdFace {
  const icon = document.createElement('img');
  icon.className = 'touchSkillIcon';
  icon.alt = '';
  icon.draggable = false;
  icon.decoding = 'async';
  icon.setAttribute('aria-hidden', 'true');
  icon.style.pointerEvents = 'none';
  const name = document.createElement('span');
  name.className = 'touchSkillName';
  name.textContent = label;
  const wipe = document.createElement('span');
  wipe.className = 'touchSkillCdWipe';
  wipe.setAttribute('aria-hidden', 'true');
  const time = document.createElement('span');
  time.className = 'touchSkillCdTime';
  time.setAttribute('aria-hidden', 'true');
  btn.replaceChildren(icon, name, wipe, time);
  return { icon, name, wipe, time };
}

/** 换图时只改 src；失败则藏图标，短名兜底。 */
export function bindSkillIcon(face: SkillCdFace, url: string): void {
  if (face.icon.dataset.iconUrl === url) {
    return;
  }
  face.icon.dataset.iconUrl = url;
  face.icon.classList.remove('isMiss');
  face.icon.hidden = false;
  face.icon.onload = () => {
    face.icon.hidden = false;
    face.icon.classList.remove('isMiss');
  };
  face.icon.onerror = () => {
    face.icon.hidden = true;
    face.icon.classList.add('isMiss');
  };
  face.icon.src = url;
}

export function syncSkillCdFace(
  btn: HTMLButtonElement,
  face: SkillCdFace,
  remain: number,
  total: number,
): void {
  const on = remain > 0;
  const ratio = skillCdRemainRatio(remain, total);
  btn.classList.toggle('isCd', on);
  face.wipe.style.setProperty('--cd-remain', ratio.toFixed(4));
  if (on) {
    face.time.textContent = formatSkillCd(remain);
    face.time.hidden = false;
  } else {
    face.time.textContent = '';
    face.time.hidden = true;
  }
}
