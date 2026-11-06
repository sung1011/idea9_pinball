/** iPhone 18 Pro Max 横屏逻辑像素；战场比例锁定此屏 */
export const IPHONE_LANDSCAPE_LOGICAL_WIDTH = 956;
export const IPHONE_LANDSCAPE_LOGICAL_HEIGHT = 440;
/** 物理像素 2868×1320，与逻辑 956:440 = 239:110 同比例 */
export const IPHONE_LANDSCAPE_PHYSICAL_WIDTH = 2868;
export const IPHONE_LANDSCAPE_PHYSICAL_HEIGHT = 1320;

/** 逻辑地图高度（格） */
export const MAP_HEIGHT = 20;

/** 逻辑地图宽度（格）；高仍 20，宽按 iPhone 18 Pro Max 横屏 956:440 */
export const MAP_WIDTH = (MAP_HEIGHT * IPHONE_LANDSCAPE_LOGICAL_WIDTH) / IPHONE_LANDSCAPE_LOGICAL_HEIGHT;

/** 玩家半径（格） */
export const BALL_RADIUS = 0.5;

/** 圆角矩形场地的角半径（格） */
export const ARENA_CORNER_RADIUS = 1.5;

/** 领地：圆心在地图中心，半径 2.5 格 */
export const CONTROL_POINT = {
  x: MAP_WIDTH / 2,
  y: MAP_HEIGHT / 2,
  radius: 2.5,
} as const;

/**
 * 矮柱尺寸：设计锁「1×2 格」，俯视长轴水平，与示意扁椭圆一致。
 */
export const PILLAR_WIDTH = 2;
export const PILLAR_HEIGHT = 1;

/** 左矮柱中心：左半场四分位、垂直居中，让开 Stall */
export const LEFT_PILLAR = {
  x: MAP_WIDTH * 0.25,
  y: MAP_HEIGHT / 2,
} as const;

/** 右矮柱中心：右半场四分位、垂直居中 */
export const RIGHT_PILLAR = {
  x: MAP_WIDTH * 0.75,
  y: MAP_HEIGHT / 2,
} as const;

/** 基础移速上限（格/秒） */
export const SPEED_CAP = 8;

/**
 * 粘滞摩擦：满速 8 约 2 秒滑到爬行 0.4。
 * v(t) = v0 * exp(-FRICTION * t)，ln(8/0.4)/2 ≈ 1.49786
 */
export const CRAWL_SPEED = 0.4;
export const FRICTION = Math.log(SPEED_CAP / CRAWL_SPEED) / 2;

/** 低于此速率视为静止。M3.5 保底冲不再归零；定锚等 M5 状态可再用。 */
export const REST_SPEED = 0.05;

/** 保底速（格/秒）：摩擦后低于此值拉回，非完全静止 */
export const FLOOR_SPEED = 2.5;

/** 全程弱拧（度/秒） */
export const WEAK_STEER_DEG_PER_SEC = 45;

/** 撞后强拧（度/秒）；替换原约 90°/s 微调 */
export const STRONG_STEER_DEG_PER_SEC = 120;

export const WEAK_STEER_RAD_PER_SEC = (WEAK_STEER_DEG_PER_SEC * Math.PI) / 180;
export const STRONG_STEER_RAD_PER_SEC = (STRONG_STEER_DEG_PER_SEC * Math.PI) / 180;

/** 墙/柱弹性系数；1 = 完全弹性反弹 */
export const WALL_RESTITUTION = 1;

/** 基础血量（共用 / 英雄；开局与回场满血基线） */
export const MAX_HP = 300;

/**
 * 擦伤刃等技能仍用的相对速度门槛（格/秒）。
 * 枪尖普攻不再用门槛挡掉血。
 */
export const COLLISION_SPEED_THRESHOLD = 4;

/** 主动撞窗口内，技能门槛降到此值（格/秒）；不影响枪尖普攻 */
export const ACTIVE_RAM_SPEED_THRESHOLD = 2.5;

/** 枪尖普攻伤害 = SCALE × 相对速度标量，再 cap；不乘朝向、无门槛 */
export const COLLISION_DAMAGE_SCALE = 6;
export const COLLISION_DAMAGE_CAP = 28;

/** 枪尖普攻 CD（秒）；仅成功掉血后进入 */
export const SPEAR_TIP_CD = 1;

/**
 * 枪尖距圆心（格），对齐 `ballView.drawTargetSpear` 的 tip（1.12）。
 * 有瞄准跟 aim，否则跟 facing。
 */
export const SPEAR_TIP_DIST = 1.12;
/** 枪尖相交检测小圆半径（格） */
export const SPEAR_TIP_RADIUS = 0.1;

/**
 * 掉血弹开初速 ≈ KNOCKBACK_SCALE × min(1, 相对速度/SPAN)
 * 单次感上限约 2.5 格当量；满额速度档实际顶在 SCALE=2
 */
export const KNOCKBACK_SCALE = 2;
export const KNOCKBACK_SPEED_SPAN = 8;
export const KNOCKBACK_FEEL_CAP = 2.5;

/** 刚放位移 / 调试冲刺后的主动撞窗口（秒） */
export const ACTIVE_RAM_WINDOW = 0.25;

/** 技能释放 stub 冲量（格/秒）；受 SPEED_CAP 盖帽 */
export const SKILL_IMPULSE = 3;

/** 技能短 CD，防连点（秒）；M5 钩刺已按槽位 CD，此值仅留给 stub 工具 */
export const SKILL_STUB_CD = 0.4;

/** 同一目标 1.5s 内再吃硬控，时长与附加伤害减半 */
export const HARD_CC_DIMINISH_WINDOW = 1.5;

/** 任意碰撞（含轻蹭）后的强拧窗口（秒） */
export const FINE_TUNE_WINDOW = 0.3;

/** 本机固定 2v2：蓝方简 bot 数量 */
export const BLUE_BOT_COUNT = 2;

/** 一局：Stall 倒计时 / 正赛 / 加时（秒） */
export const MATCH_COUNTDOWN_SEC = 5;
export const MATCH_PLAY_SEC = 240;
export const MATCH_OVERTIME_SEC = 30;

/** 开局冲锋（秒）：并入开局无敌，不另叠一段 */
export const OPENING_CHARGE_SEC = 1;
/** 冲锋峰值速（格/秒）；全局上限仍 8 */
export const OPENING_CHARGE_SPEED = 7.5;
/** 栏开后前段 lerp 拉升（秒）；随冲锋窗同比缩短 */
export const OPENING_CHARGE_RAMP_SEC = 0.2;
/** 冲锋起步速，随后拉到峰值 */
export const OPENING_CHARGE_START_SPEED = 2.5;
/** 冲锋几乎锁拧（度/秒） */
export const OPENING_CHARGE_STEER_DEG_PER_SEC = 6;
export const OPENING_CHARGE_STEER_RAD_PER_SEC = (OPENING_CHARGE_STEER_DEG_PER_SEC * Math.PI) / 180;

/** 开局 stall：贴各队半场底线，从底线向内的深度（格） */
export const STALL_DEPTH = 2.4;
/** stall 上下留白，对齐圆角半径，避开死角 */
export const STALL_Y_PAD = ARENA_CORNER_RADIUS;

/** 先到此分立即结束 */
export const MATCH_SCORE_LIMIT = 100;

export const KNOCKOUT_SCORE = 15;
export const ASSIST_SCORE = 5;
export const ASSIST_WINDOW_SEC = 3;

/** 击破离场后回场等待（秒） */
export const RESPAWN_SEC = 5;
/** 回场无敌（秒）；开局无敌并入冲锋段，不另叠 */
export const SPAWN_INVINCIBLE_SEC = 2;

/** 领地每秒结算：人数严格更多一方 */
export const MIDPOINT_SCORE_PER_SEC = 2;
export const MIDPOINT_TICK_SEC = 1;

/** 调试：仅加速一局时钟（倒计时/回场/领地），物理仍按真实 dt。默认 1 */
export const DEBUG_CLOCK_SCALE = 1;

/** 出生距底线（格）；落在 Stall 内 */
export const SPAWN_X_INSET = 1.2;
/** 上出生：四分位，避开圆角与中线 */
export const SPAWN_Y_TOP = MAP_HEIGHT * 0.25;
/** 下出生：四分位 */
export const SPAWN_Y_BOT = MAP_HEIGHT * 0.75;

/** 朝领地圆心的单位朝向 */
export function facingTowardControl(x: number, y: number): { facingX: number; facingY: number } {
  const dx = CONTROL_POINT.x - x;
  const dy = CONTROL_POINT.y - y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-8) {
    return { facingX: x < CONTROL_POINT.x ? 1 : -1, facingY: 0 };
  }
  return { facingX: dx / len, facingY: dy / len };
}

function makeSpawn(x: number, y: number): { x: number; y: number; facingX: number; facingY: number } {
  return { x, y, ...facingTowardControl(x, y) };
}

/** 红左半场上下两出生、蓝右半场上下两出生；facing 朝领地；本机固定 2v2 */
export const RED_SPAWNS = [
  makeSpawn(SPAWN_X_INSET, SPAWN_Y_TOP),
  makeSpawn(SPAWN_X_INSET, SPAWN_Y_BOT),
];

export const BLUE_SPAWNS = [
  makeSpawn(MAP_WIDTH - SPAWN_X_INSET, SPAWN_Y_TOP),
  makeSpawn(MAP_WIDTH - SPAWN_X_INSET, SPAWN_Y_BOT),
];

/** 简 bot：决策间隔（急停 / 靠近 / 偶勾） */
export const BOT_INTERVAL_SEC = 1.5;
export const BOT_INTERVAL_JITTER_SEC = 0.7;
export const BOT_AIM_JITTER_RAD = 0.5;
