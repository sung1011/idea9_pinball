import { applyHpLoss } from './hpLoss';
import { applySkillDamage } from './skillHits';
import { createBallBody } from './ballBody';
import { collisionDamage, type CollisionHit } from './collisionDamage';
import {
  EIGHT_KILL_LIMIT,
  EIGHT_KILL_RIFT_ENABLED,
  HARD_CC_DIMINISH_WINDOW,
  LEFT_PILLAR,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAX_HP,
  POTION_DAMAGE_MUL,
  POTION_FIRST_SEC,
  POTION_HEAL,
  POTION_INSET,
  POTION_INTERVAL_SEC,
  POTION_RADIUS,
  POTION_SHIELD,
  POTION_SPEED_CAP,
  RIFT_DAMAGE,
  RIFT_FIRST_SEC,
  RIFT_INTERVAL_SEC,
  RIFT_RADIUS,
  RIFT_STUN_SEC,
  RIFT_WARN_SEC,
  SPAWN_INVINCIBLE_SEC,
  SPEED_CAP,
} from './constants';
import { LAST_MODE_STORAGE_KEY, loadLastModeId, saveLastModeId } from './lastModeId';
import { DEFAULT_MATCH_MODE, isMatchModeId, MATCH_MODE_LABEL } from './matchMode';
import { createMatchSession } from './matchSession';
import { applyPotionToBall, createPotionField, potionCorners } from './potionField';
import { createRiftHazard } from './riftHazard';
import { createMatchHud } from '../ui/matchHud';
import { createHelpCard } from '../ui/helpCard';
import { arenaPillarsEnabled, resolveArenaObstacles, setArenaPillarsEnabled } from './wallBounce';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    throw new Error(message);
  }
}

function hit(
  victim: ReturnType<typeof createBallBody>,
  source: ReturnType<typeof createBallBody>,
  damage = 20,
): CollisionHit {
  return {
    victimId: victim.id,
    sourceId: source.id,
    victimLabel: victim.label,
    sourceLabel: source.label,
    damage,
    knockback: 0,
    relSpeed: 8,
    threshold: 0,
  };
}

function envHit(victim: ReturnType<typeof createBallBody>, damage = RIFT_DAMAGE): CollisionHit {
  return {
    victimId: victim.id,
    sourceId: -1,
    victimLabel: victim.label,
    sourceLabel: '地裂矛阵',
    damage,
    knockback: 0,
    relSpeed: 0,
    threshold: 0,
    environment: true,
  };
}

function pair() {
  const red = createBallBody({ x: 6, y: 6, color: 0xe24a4a, label: '红', team: 'red' });
  const blue = createBallBody({ x: 14, y: 6, color: 0x3d7cf0, label: '蓝', team: 'blue' });
  return [red, blue] as const;
}

/** 八杀模式：击杀计数、药水第 10 秒首刷、无随机环境伤害圈、无领地/矮柱。 */
export function verifyEightKill(): void {
  assert(DEFAULT_MATCH_MODE === 'eightKill', '八杀：缺省模式应为八杀');
  assert(MATCH_MODE_LABEL.eightKill === '八杀' && MATCH_MODE_LABEL.controlPoint === '占点', '八杀：下拉文案应为八杀/占点');
  assert(isMatchModeId('eightKill') && isMatchModeId('controlPoint') && !isMatchModeId('other'), '八杀：模式 id 应只认两个');
  assert(EIGHT_KILL_LIMIT === 8, '八杀：先到 8 杀');
  assert(POTION_FIRST_SEC === 10 && POTION_INTERVAL_SEC === 45, '八杀：药水正式开战 10s 起每 45s');
  assert(EIGHT_KILL_RIFT_ENABLED === false, '八杀：随机环境伤害圈应关闭');
  assert(RIFT_FIRST_SEC === 12 && RIFT_INTERVAL_SEC === 18 && RIFT_WARN_SEC === 2, '地裂模块：时序常量保留但不启用');
  assert(RIFT_RADIUS === 3.2 && RIFT_DAMAGE === 36 && RIFT_STUN_SEC === 0.6, '地裂模块：半径/伤/硬直常量保留');
  assert(POTION_INSET === 3 && POTION_RADIUS === 0.45, '八杀：药水内缩 3、体积可读');
  assert(HARD_CC_DIMINISH_WINDOW === 1.5, '八杀：硬控 1.5s 衰减窗不动');

  const corners = potionCorners();
  assert(corners.length === 4, '八杀：药水四角');
  assert(
    corners.every(
      (c) => Math.abs(c.x - POTION_INSET) < 1e-6 || Math.abs(c.x - (MAP_WIDTH - POTION_INSET)) < 1e-6,
    ),
    '八杀：药水应贴左右内缩 3',
  );
  assert(
    corners.every(
      (c) => Math.abs(c.y - POTION_INSET) < 1e-6 || Math.abs(c.y - (MAP_HEIGHT - POTION_INSET)) < 1e-6,
    ),
    '八杀：药水应贴上下内缩 3',
  );

  let prevMode: string | null = null;
  let hadMode = false;
  try {
    prevMode = localStorage.getItem(LAST_MODE_STORAGE_KEY);
    hadMode = true;
    localStorage.removeItem(LAST_MODE_STORAGE_KEY);
    assert(loadLastModeId() === 'eightKill', '八杀：无记录时应默认八杀');
    saveLastModeId('controlPoint');
    assert(loadLastModeId() === 'controlPoint', '八杀：应记住占点');
    localStorage.setItem(LAST_MODE_STORAGE_KEY, 'nope');
    assert(loadLastModeId() === 'eightKill', '八杀：非法记录应回八杀');
    saveLastModeId('eightKill');
    assert(loadLastModeId() === 'eightKill', '八杀：应能写回八杀');
  } finally {
    if (hadMode) {
      if (prevMode === null) {
        localStorage.removeItem(LAST_MODE_STORAGE_KEY);
      } else {
        localStorage.setItem(LAST_MODE_STORAGE_KEY, prevMode);
      }
    }
  }

  const [red, blue] = pair();
  const match = createMatchSession([red, blue], { countdownSec: 0, playSec: 60 });
  assert(match.snapshot().mode === 'eightKill', '八杀：会话缺省应为八杀');
  red.invincibleRemain = 0;
  blue.invincibleRemain = 0;
  blue.hp = 0;
  match.tick(0, [hit(blue, red), hit(blue, red, 8)]);
  let snap = match.snapshot();
  assert(snap.redKills === 1 && snap.blueKills === 0, '八杀：击破记 1 杀');
  assert(snap.redScore === 0, '八杀：助攻与击破分不应进点分');
  assert(!blue.inPlay, '八杀：击破仍离场');

  const [midRed, midBlue] = pair();
  midRed.x = MAP_WIDTH / 2;
  midRed.y = MAP_HEIGHT / 2;
  const mid = createMatchSession([midRed, midBlue], { countdownSec: 0, playSec: 10 });
  midRed.invincibleRemain = 0;
  midBlue.invincibleRemain = 0;
  mid.tick(1, []);
  assert(mid.snapshot().redScore === 0 && mid.snapshot().redHoldScore === 0, '八杀：领地不应计分');
  assert(mid.snapshot().midpoint === 'none', '八杀：中圈归属应关');

  const [limRed, limBlue] = pair();
  const limit = createMatchSession([limRed, limBlue], { countdownSec: 0, playSec: 240 });
  limit.debugAddScore('red', EIGHT_KILL_LIMIT);
  assert(limit.snapshot().phase === 'result' && limit.snapshot().winner === 'red', '八杀：先到 8 杀应立即结束');
  assert(limit.snapshot().finishReason === '先到8杀', '八杀：结算原因应为先到8杀');

  const [tRed, tBlue] = pair();
  const timed = createMatchSession([tRed, tBlue], { countdownSec: 0, playSec: 1.2 });
  timed.debugAddScore('blue', 3);
  timed.tick(1.3, []);
  assert(timed.snapshot().phase === 'result' && timed.snapshot().winner === 'blue', '八杀：到点应比杀数');

  const [otRed, otBlue] = pair();
  const ot = createMatchSession([otRed, otBlue], { countdownSec: 0, playSec: 0.5, overtimeSec: 8 });
  otRed.invincibleRemain = 0;
  otBlue.invincibleRemain = 0;
  ot.tick(0.6, []);
  assert(ot.snapshot().phase === 'overtime', '八杀：杀数平应进加时');
  otBlue.hp = 0;
  ot.tick(0, [hit(otBlue, otRed)]);
  assert(ot.snapshot().phase === 'result' && ot.snapshot().winner === 'red', '八杀：加时应先超前 1 杀者胜');
  assert(ot.snapshot().finishReason === '加时超前', '八杀：加时原因应为超前');

  const [hpRed, hpBlue] = pair();
  const hpMatch = createMatchSession([hpRed, hpBlue], { countdownSec: 0, playSec: 0.4, overtimeSec: 0.4 });
  hpRed.hp = 120;
  hpBlue.hp = 40;
  hpMatch.tick(0.5, []);
  hpMatch.tick(0.5, []);
  assert(hpMatch.snapshot().phase === 'result' && hpMatch.snapshot().winner === 'red', '八杀：加时仍平应比剩余血');
  assert(hpMatch.snapshot().finishReason === '剩余血量', '八杀：血量结算原因');

  const [envRed, envBlue] = pair();
  const env = createMatchSession([envRed, envBlue], { countdownSec: 0, playSec: 30 });
  envRed.invincibleRemain = 0;
  envBlue.invincibleRemain = 0;
  env.tick(0, [hit(envBlue, envRed, 4)]);
  envBlue.hp = 0;
  env.tick(0, [envHit(envBlue)]);
  assert(!envBlue.inPlay, '八杀：环境击破仍离场');
  assert(env.snapshot().redKills === 0 && env.snapshot().blueKills === 0, '八杀：地裂击破不计杀');

  const [skRed, skBlue] = pair();
  const skillKo = createMatchSession([skRed, skBlue], { countdownSec: 0, playSec: 30 });
  skRed.invincibleRemain = 0;
  skBlue.invincibleRemain = 0;
  skBlue.hp = 10;
  const skillHit = applySkillDamage(skBlue, skRed, 10);
  skillKo.tick(0, skillHit ? [skillHit] : []);
  assert(skillKo.snapshot().redKills === 1, '八杀：技能击破应记杀');

  let roll = 0;
  const potions = createPotionField(() => {
    const v = roll;
    roll += 1;
    return (v * 0.31) % 1;
  });
  const dummy = createBallBody({ x: 1, y: 1, color: 0xe24a4a, team: 'red' });
  potions.tick([dummy], POTION_FIRST_SEC - 0.01, true);
  assert(potions.snapshot() === null, '八杀：开战 10s 前不应出药水');
  potions.tick([dummy], POTION_FIRST_SEC, true);
  const first = potions.snapshot();
  assert(!!first, '八杀：正式开战 10s 应出药水');
  potions.tick([dummy], POTION_FIRST_SEC + POTION_INTERVAL_SEC - 0.01, true);
  assert(
    potions.snapshot()?.kind === first!.kind &&
      potions.snapshot()?.x === first!.x &&
      potions.snapshot()?.y === first!.y,
    '八杀：未到 45s 间隔不应换瓶',
  );
  potions.tick([dummy], POTION_FIRST_SEC + POTION_INTERVAL_SEC, true);
  const second = potions.snapshot();
  assert(!!second, '八杀：45s 后应刷新药水');
  assert(
    second!.kind !== first!.kind || second!.x !== first!.x || second!.y !== first!.y,
    '八杀：刷新应换角或换种类',
  );

  const picker = createBallBody({
    x: POTION_INSET,
    y: POTION_INSET,
    color: 0xe24a4a,
    team: 'red',
    hp: 100,
  });
  const field = createPotionField(() => 0);
  field.tick([], POTION_FIRST_SEC, true);
  const grabbed = field.tick([picker], POTION_FIRST_SEC, true);
  assert(grabbed.length === 1, '八杀：身体重叠应捡到药水');
  assert(field.snapshot() === null, '八杀：捡走后场上应无药');

  const dmgBall = createBallBody({ x: 4, y: 4, color: 0xe24a4a, team: 'red' });
  applyPotionToBall(dmgBall, 'damage');
  const vic = createBallBody({ x: 8, y: 4, color: 0x3d7cf0, team: 'blue' });
  const raw = collisionDamage(3);
  const buffed = applySkillDamage(vic, dmgBall, raw);
  assert(buffed !== null && Math.abs(buffed.damage - raw * POTION_DAMAGE_MUL) < 1e-6, '八杀：伤害药应 ×1.5 技能伤');

  const spd = createBallBody({ x: 4, y: 4, color: 0xe24a4a, vx: SPEED_CAP, vy: 0 });
  applyPotionToBall(spd, 'speed');
  assert(Math.abs(Math.hypot(spd.vx, spd.vy) - POTION_SPEED_CAP) < 1e-6, '八杀：加速应把满速 8 拉到 10');
  assert(spd.potionSpeedRemain > 7.9, '八杀：加速持续约 8s');

  const heal = createBallBody({ x: 4, y: 4, color: 0xe24a4a, hp: 200 });
  applyPotionToBall(heal, 'heal');
  assert(heal.hp === 200 + POTION_HEAL, '八杀：加血 80');
  applyPotionToBall(heal, 'heal');
  assert(heal.hp === MAX_HP, '八杀：加血不超过 300');
  assert(heal.potionDamageRemain === 0 && heal.potionSpeedRemain === 0, '八杀：加血不占增益栏');

  const sh = createBallBody({ x: 4, y: 4, color: 0xe24a4a, hp: MAX_HP });
  applyPotionToBall(sh, 'shield');
  const lost = applyHpLoss(sh, 50);
  assert(lost === 0 && sh.hp === MAX_HP, '八杀：护盾应吸收伤害');
  assert(Math.abs(sh.potionShieldHp - (POTION_SHIELD - 50)) < 1e-6, '八杀：护盾吸收 50 后剩 30');
  applyPotionToBall(sh, 'shield');
  assert(sh.potionShieldHp === POTION_SHIELD && sh.potionShieldRemain > 9, '八杀：再捡护盾应刷新吸收量');

  applyPotionToBall(sh, 'damage');
  applyPotionToBall(sh, 'speed');
  assert(sh.potionDamageRemain > 0 && sh.potionSpeedRemain > 0 && sh.potionShieldHp === POTION_SHIELD, '八杀：三种增益可共存');

  const [sessRed, sessBlue] = pair();
  sessRed.x = MAP_WIDTH / 2;
  sessRed.y = MAP_HEIGHT / 2;
  sessBlue.x = MAP_WIDTH / 2;
  sessBlue.y = MAP_HEIGHT / 2 + 4;
  sessRed.invincibleRemain = 0;
  sessBlue.invincibleRemain = 0;
  let sessRoll = 0;
  const potionMatch = createMatchSession([sessRed, sessBlue], {
    countdownSec: 0,
    playSec: 240,
    random: () => {
      const v = sessRoll;
      sessRoll += 1;
      return (v * 0.31) % 1;
    },
  });
  potionMatch.tick(POTION_FIRST_SEC - 0.01, []);
  assert(potionMatch.snapshot().elapsedSec < POTION_FIRST_SEC, '八杀：playing 计时未到 10s');
  assert(potionMatch.snapshot().potion === null, '八杀：会话 10s 前不应出药水');
  assert(potionMatch.snapshot().rift === null, '八杀：会话不应生成环境伤害圈');
  assert(potionMatch.takeExtraHits().length === 0, '八杀：10s 前环境圈不应造成伤害');
  potionMatch.tick(0.02, []);
  assert(potionMatch.snapshot().elapsedSec >= POTION_FIRST_SEC, '八杀：应跨过正式开战 10s');
  const sessFirst = potionMatch.snapshot().potion;
  assert(!!sessFirst, '八杀：会话跨过 10s 应出首瓶');
  assert(potionMatch.snapshot().rift === null, '八杀：首瓶时仍无环境伤害圈');
  potionMatch.tick(POTION_INTERVAL_SEC - 0.02, []);
  assert(
    potionMatch.snapshot().potion?.kind === sessFirst!.kind &&
      potionMatch.snapshot().potion?.x === sessFirst!.x &&
      potionMatch.snapshot().potion?.y === sessFirst!.y,
    '八杀：会话未到后刷点不应换瓶',
  );
  potionMatch.tick(0.03, []);
  const sessSecond = potionMatch.snapshot().potion;
  assert(!!sessSecond, '八杀：会话 10+45s 应后刷');
  assert(
    sessSecond!.kind !== sessFirst!.kind || sessSecond!.x !== sessFirst!.x || sessSecond!.y !== sessFirst!.y,
    '八杀：后刷应换角或换种类',
  );

  const [cdRed, cdBlue] = pair();
  const counted = createMatchSession([cdRed, cdBlue], { countdownSec: 5, playSec: 240 });
  counted.tick(5, []);
  assert(counted.snapshot().phase === 'playing', '八杀：5s 倒计时应进入 playing');
  assert(Math.abs(counted.snapshot().elapsedSec) < 1e-6, '八杀：倒计时结束 elapsedSec 仍为 0');
  assert(counted.snapshot().potion === null, '八杀：倒计时结束瞬间不应出药水');
  counted.tick(POTION_FIRST_SEC - 0.01, []);
  assert(counted.snapshot().potion === null, '八杀：倒计时后未满 10s 不应出药水');
  counted.tick(0.02, []);
  assert(!!counted.snapshot().potion, '八杀：倒计时后正式开战 10s 应出首瓶');

  const [skipRed, skipBlue] = pair();
  const skipped = createMatchSession([skipRed, skipBlue], { countdownSec: 5, playSec: 240 });
  assert(skipped.skipOpening(), '八杀：应能跳过倒计时');
  assert(skipped.snapshot().phase === 'playing' && skipped.snapshot().elapsedSec === 0, '八杀：跳过倒计时 elapsedSec 从 0 起');
  skipped.tick(POTION_FIRST_SEC - 0.01, []);
  assert(skipped.snapshot().potion === null, '八杀：跳过倒计时后未满 10s 不应出药水');
  skipped.tick(0.02, []);
  assert(!!skipped.snapshot().potion, '八杀：跳过倒计时后正式开战 10s 应出首瓶');

  const [rstRed, rstBlue] = pair();
  const restarted = createMatchSession([rstRed, rstBlue], { countdownSec: 0, playSec: 240 });
  restarted.tick(POTION_FIRST_SEC + 1, []);
  assert(!!restarted.snapshot().potion, '八杀：重开前应已有药水');
  restarted.reset();
  assert(restarted.snapshot().elapsedSec === 0 && restarted.snapshot().potion === null, '八杀：重开应清计时与场上药水');
  restarted.tick(POTION_FIRST_SEC - 0.01, []);
  assert(restarted.snapshot().potion === null, '八杀：重开后未满 10s 不应沿用旧计时出药');
  restarted.tick(0.02, []);
  assert(!!restarted.snapshot().potion, '八杀：重开后正式开战 10s 应出新首瓶');

  const [pauseRed, pauseBlue] = pair();
  const paused = createMatchSession([pauseRed, pauseBlue], {
    countdownSec: 0,
    playSec: 240,
    clockScale: 0,
  });
  paused.tick(20, []);
  assert(paused.snapshot().elapsedSec === 0 && paused.snapshot().potion === null, '八杀：时钟暂停时不应推进药剂');
  assert(paused.snapshot().rift === null && paused.takeExtraHits().length === 0, '八杀：时钟暂停时不应生成环境圈');

  const [cpRed, cpBlue] = pair();
  const point = createMatchSession([cpRed, cpBlue], { mode: 'controlPoint', countdownSec: 0, playSec: 80 });
  point.tick(POTION_FIRST_SEC, []);
  point.tick(RIFT_FIRST_SEC, []);
  point.tick(POTION_INTERVAL_SEC, []);
  assert(point.snapshot().potion === null, '占点：不应出药水');
  assert(point.snapshot().rift === null, '占点：不应出环境伤害圈');
  assert(point.takeExtraHits().length === 0, '占点：环境圈不应造成伤害');

  const [liveRed, liveBlue] = pair();
  liveRed.x = RIFT_RADIUS;
  liveRed.y = RIFT_RADIUS;
  liveBlue.x = MAP_WIDTH - 1;
  liveBlue.y = MAP_HEIGHT - 1;
  liveRed.invincibleRemain = 0;
  liveBlue.invincibleRemain = 0;
  const liveHp = liveRed.hp;
  const live = createMatchSession([liveRed, liveBlue], { countdownSec: 0, playSec: 80 });
  live.tick(RIFT_FIRST_SEC, []);
  assert(live.snapshot().rift === null, '八杀：12s 不应预警环境圈');
  live.tick(RIFT_WARN_SEC, []);
  assert(live.snapshot().rift === null, '八杀：预警时长后仍无环境圈');
  assert(live.takeExtraHits().length === 0, '八杀：环境圈关闭后不应出伤害');
  assert(liveRed.hp === liveHp && liveRed.stunRemain === 0, '八杀：关闭后圈内单位不应受伤或硬直');
  live.tick(RIFT_INTERVAL_SEC, []);
  live.tick(RIFT_WARN_SEC, []);
  assert(live.snapshot().rift === null && live.takeExtraHits().length === 0, '八杀：后续间隔仍不生成环境圈');

  const rift = createRiftHazard(() => 0);
  const [rRed, rBlue] = pair();
  rRed.x = RIFT_RADIUS;
  rRed.y = RIFT_RADIUS;
  rBlue.x = MAP_WIDTH - 1;
  rBlue.y = MAP_HEIGHT - 1;
  rRed.invincibleRemain = 0;
  rBlue.invincibleRemain = 0;
  const warnHits = rift.tick(0, [rRed, rBlue], RIFT_FIRST_SEC, 0, true);
  assert(warnHits.length === 0 && rift.snapshot()?.phase === 'warn', '地裂模块：enabled 时 12s 应先预警');
  const burstHits = rift.tick(RIFT_WARN_SEC, [rRed, rBlue], RIFT_FIRST_SEC + RIFT_WARN_SEC, RIFT_WARN_SEC, true);
  assert(burstHits.some((h) => h.victimId === rRed.id && h.environment), '地裂模块：爆出应对圈内环境伤害');
  assert(!burstHits.some((h) => h.victimId === rBlue.id), '地裂模块：圈外不应受伤');
  assert(Math.abs(rRed.hp - (MAX_HP - RIFT_DAMAGE)) < 1e-6, '地裂模块：地裂伤 36');
  assert(rRed.stunRemain > 0.55, '地裂模块：地裂应上 0.6s 硬直');
  const disabled = createRiftHazard(() => 0);
  const [offRed] = pair();
  offRed.x = RIFT_RADIUS;
  offRed.y = RIFT_RADIUS;
  offRed.invincibleRemain = 0;
  const offHp = offRed.hp;
  const offHits = disabled.tick(RIFT_WARN_SEC, [offRed], RIFT_FIRST_SEC + RIFT_WARN_SEC, RIFT_WARN_SEC, false);
  assert(offHits.length === 0 && disabled.snapshot() === null, '地裂模块：enabled=false 不生成');
  assert(offRed.hp === offHp && offRed.stunRemain === 0, '地裂模块：关闭时不应伤害');

  const [invRed] = pair();
  invRed.x = RIFT_RADIUS;
  invRed.y = RIFT_RADIUS;
  invRed.invincibleRemain = SPAWN_INVINCIBLE_SEC;
  const invRift = createRiftHazard(() => 0);
  invRift.tick(0, [invRed], RIFT_FIRST_SEC, 0, true);
  const invHits = invRift.tick(RIFT_WARN_SEC, [invRed], RIFT_FIRST_SEC + 2, 2, true);
  assert(invHits.length === 0 && invRed.hp === MAX_HP && invRed.stunRemain === 0, '地裂模块：回场无敌应免疫地裂');

  const dim = createBallBody({ x: RIFT_RADIUS, y: RIFT_RADIUS, color: 0xe24a4a, team: 'red' });
  const dimRift = createRiftHazard(() => 0);
  dimRift.tick(0, [dim], RIFT_FIRST_SEC, 10, true);
  dimRift.tick(RIFT_WARN_SEC, [dim], RIFT_FIRST_SEC + 2, 10, true);
  const firstStun = dim.stunRemain;
  dim.stunRemain = 0;
  const dimRift2 = createRiftHazard(() => 0);
  dimRift2.tick(0, [dim], RIFT_FIRST_SEC, 10.3, true);
  dimRift2.tick(RIFT_WARN_SEC, [dim], RIFT_FIRST_SEC + 2, 10.3, true);
  assert(dim.stunRemain < firstStun * 0.6 && dim.stunRemain > 0.2, '地裂模块：1.5s 内二次地裂硬直应减半');

  const prevPillars = arenaPillarsEnabled();
  try {
    setArenaPillarsEnabled(false);
    const ghost = createBallBody({ x: LEFT_PILLAR.x, y: LEFT_PILLAR.y, color: 0xe24a4a, vx: 4 });
    const blocked = resolveArenaObstacles(ghost);
    assert(!blocked || Math.abs(ghost.x - LEFT_PILLAR.x) < 0.2, '八杀：关柱后中柱不应把人弹开');
  } finally {
    setArenaPillarsEnabled(prevPillars);
  }

  const host = document.createElement('div');
  const hud = createMatchHud(host, { mode: 'eightKill' });
  const modePick = host.querySelector<HTMLSelectElement>('select.matchHudMode');
  const left = host.querySelector<HTMLElement>('.matchHudLeft');
  const redVal = host.querySelector<HTMLElement>('.matchHudRed .matchHudScoreVal');
  const blueVal = host.querySelector<HTMLElement>('.matchHudBlue .matchHudScoreVal');
  if (!modePick || !left || !redVal || !blueVal) {
    throw new Error('八杀：左上应有模式下拉');
  }
  assert(
    [...modePick.options].map((opt) => opt.textContent).join('/') === '八杀/占点',
    '八杀：模式下拉文案应为八杀/占点',
  );
  assert(modePick.value === 'eightKill', '八杀：模式下拉缺省应为八杀');
  assert(left.firstElementChild === modePick.parentElement, '八杀：左上首位应为模式下拉');
  assert(!host.querySelector('.matchHudHeroRow'), '八杀：左上不应再有我/队友下拉');
  hud.sync(
    {
      phase: 'playing',
      timeLeft: 100,
      suddenDeath: false,
      mode: 'eightKill',
      redScore: 40,
      blueScore: 20,
      redKills: 3,
      blueKills: 1,
      redBreakScore: 0,
      blueBreakScore: 0,
      redHoldScore: 0,
      blueHoldScore: 0,
      elapsedSec: 20,
      finishReason: '',
      midpoint: 'red',
      winner: null,
      events: [],
      respawns: {},
      stallsOn: false,
      stalls: [],
      openingChargeRemain: 0,
      skillsLocked: false,
      potion: null,
      rift: null,
    },
    [],
  );
  assert(redVal.textContent === '3' && blueVal.textContent === '1', '八杀：顶中应显示击杀数不是点分');

  const helpHost = document.createElement('div');
  const help = createHelpCard(helpHost);
  help.setMode('eightKill');
  help.open();
  const eightCopy = helpHost.querySelector('.helpCardBody')?.textContent ?? '';
  assert(eightCopy.includes('先到 8 杀') && eightCopy.includes('正式开战第 10 秒'), '八杀：说明卡应写八杀规则与 10s 首瓶');
  assert(eightCopy.includes('无随机环境伤害圈'), '八杀：说明卡应写无随机环境伤害圈');
  assert(!eightCopy.includes('地裂矛阵'), '八杀：说明卡不应再写地裂矛阵');
  assert(!eightCopy.includes('先到 100 分'), '八杀：说明卡不应写占点百分');
  help.setMode('controlPoint');
  const pointCopy = helpHost.querySelector('.helpCardBody')?.textContent ?? '';
  assert(pointCopy.includes('先到 100 分') && pointCopy.includes('领地'), '占点：说明卡应写占点规则');
  assert(pointCopy.includes('无药水'), '占点：说明卡应写无药水');
  help.close();
}
