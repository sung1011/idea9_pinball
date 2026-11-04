export type ChangeLogItem = {
  title: string;
};

export const APP_VERSION = {
  version: __APP_VERSION__,
  sha: __GIT_SHA__,
};

export const CHANGE_LOG: readonly ChangeLogItem[] = [
  { title: '骑士冲杀换皮：圆盾羽冠矛尖、木栏 Stall、领地纹章、冲锋残影' },
  { title: 'Stall 改各队半场底线；冲锋 2s 峰值 7.5，前 0.4s 拉升' },
  { title: '开局 Stall 围栏 5s + 冲锋 2s 无敌；Esc / 点空白可跳过' },
  { title: '设置面板：常规 / 版本 / GM；R 正式可重开；GM 默认开' },
  { title: '领地文案、右上角 ? 说明卡、局结束结算' },
  { title: '钩刺四技能；击破 5s 回场' },
  { title: '点地纠偏、无左摇杆' },
];
