/** 逻辑地图长边（格） */
export const MAP_WIDTH = 20;

/** 逻辑地图短边（格） */
export const MAP_HEIGHT = 12;

/** 玩家半径（格） */
export const BALL_RADIUS = 0.5;

/** 圆角矩形场地的角半径（格） */
export const ARENA_CORNER_RADIUS = 1.5;

/** 中区控点：圆心在地图中心，直径 4 格 */
export const CONTROL_POINT = {
  x: MAP_WIDTH / 2,
  y: MAP_HEIGHT / 2,
  radius: 2,
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

/** 低于此速率视为静止，避免无限微滑 */
export const REST_SPEED = 0.05;

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
