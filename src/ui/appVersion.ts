export type ChangeLogItem = {
  title: string;
};

export const APP_VERSION = {
  version: __APP_VERSION__,
  sha: __GIT_SHA__,
};

export const CHANGE_LOG: readonly ChangeLogItem[] = [
  { title: '站点图标：红蓝对撞金矛 favicon / 触屏图标' },
  { title: '对局顶栏可随时换英雄：比分旁下拉指定 6 人；只换 kit，血量/位置/对局不变；GM · H 仍循环' },
  { title: '井绳四技能落地：双索 / 易位 / 索桩 / 回索；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳 / 闪弧 / 井绳' },
  { title: '闪弧四技能落地：侧闪 / 掠刃 / 回印 / 虚影；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳 / 闪弧' },
  { title: '钉壳四技能落地：甲垒 / 刺盾 / 顶冲 / 钉锚；GM · H 循环钩刺 / 磁环 / 链生 / 钉壳' },
  { title: '链生四技能落地：愈链 / 盾脉 / 援勾 / 扰锋；GM · H 循环钩刺 / 磁环 / 链生' },
  { title: '磁环四技能落地：辉环 / 斥波 / 壁行 / 囚环；蓝1 默认磁环；GM · H 换英雄' },
  { title: '骑士冲杀换皮：圆盾羽冠矛尖、木栏 Stall、领地纹章、冲锋残影' },
  { title: 'Stall 改各队半场底线；冲锋 2s 峰值 7.5，前 0.4s 拉升' },
  { title: '开局 Stall 围栏 5s + 冲锋 2s 无敌；Esc / 点空白可跳过' },
  { title: '设置面板：常规 / 版本 / GM；R 正式可重开；GM 默认开' },
  { title: '领地文案、右上角 ? 说明卡、局结束结算' },
  { title: '钩刺四技能；击破 5s 回场' },
  { title: '点地纠偏、无左摇杆' },
];
