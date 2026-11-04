/** 逻辑地图长边（格） */
export const MAP_WIDTH = 20;

/** 逻辑地图短边（格） */
export const MAP_HEIGHT = 12;

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

/** 左矮柱中心：左半场、垂直居中 */
export const LEFT_PILLAR = {
  x: 2.5,
  y: MAP_HEIGHT / 2,
} as const;

/** 右矮柱中心：右半场、垂直居中 */
export const RIGHT_PILLAR = {
  x: MAP_WIDTH - 2.5,
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

/** 基础血量 */
export const MAX_HP = 100;

/** 碰撞掉血：相对速度阈值（格/秒） */
export const COLLISION_SPEED_THRESHOLD = 4;

/** 主动撞窗口内的相对速度阈值（格/秒） */
export const ACTIVE_RAM_SPEED_THRESHOLD = 2.5;

/** 碰撞伤害 = SCALE × (相对速度 − 阈值) × 朝向系数，先乘再 cap */
export const COLLISION_DAMAGE_SCALE = 6;
export const COLLISION_DAMAGE_CAP = 28;

/** 朝向乘区：相对撞入角相对受击方朝向 */
export const FACING_FRONT_DEG = 45;
export const FACING_SIDE_DEG = 135;
export const FACING_FRONT_COEFF = 1;
export const FACING_SIDE_COEFF = 0.7;
export const FACING_REAR_COEFF = 1.35;

/**
 * 掉血弹开初速 ≈ KNOCKBACK_SCALE × 朝向系数 × min(1, (相对速度−阈值)/SPAN)
 * 单次感上限约 2.5 格当量
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

/** 本机蓝方简 bot 数量；1～2，默认 2 */
export const BLUE_BOT_COUNT = 2;

/** 一局：Stall 倒计时 / 正赛 / 加时（秒） */
export const MATCH_COUNTDOWN_SEC = 5;
export const MATCH_PLAY_SEC = 240;
export const MATCH_OVERTIME_SEC = 30;

/** 开局冲锋（秒）：并入原「开局 2s 无敌」，不另叠一段 */
export const OPENING_CHARGE_SEC = 2;
/** 冲锋峰值速（格/秒）；全局上限仍 8 */
export const OPENING_CHARGE_SPEED = 7.5;
/** 栏开后前段 lerp 拉升（秒） */
export const OPENING_CHARGE_RAMP_SEC = 0.4;
/** 冲锋起步速，随后拉到峰值 */
export const OPENING_CHARGE_START_SPEED = 2.5;
/** 冲锋几乎锁拧（度/秒） */
export const OPENING_CHARGE_STEER_DEG_PER_SEC = 6;
export const OPENING_CHARGE_STEER_RAD_PER_SEC = (OPENING_CHARGE_STEER_DEG_PER_SEC * Math.PI) / 180;

/** 开局 stall：贴各队半场底线，从底线向内的深度（格） */
export const STALL_DEPTH = 2.4;
/** stall 上下留白，避开圆角死角 */
export const STALL_Y_PAD = 0.4;

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

/** 半场底线出生：红左底、蓝右底，上下错开避开矮柱 */
export const RED_SPAWNS = [{ x: 1.2, y: 3.4, facingX: 1, facingY: 0 }] as const;

export const BLUE_SPAWNS = [
  { x: 18.8, y: 3.4, facingX: -1, facingY: 0 },
  { x: 18.8, y: 8.6, facingX: -1, facingY: 0 },
] as const;

/** 简 bot：决策间隔（急停 / 靠近 / 偶勾） */
export const BOT_INTERVAL_SEC = 1.5;
export const BOT_INTERVAL_JITTER_SEC = 0.7;
export const BOT_AIM_JITTER_RAD = 0.5;
