import type { TeamId } from './ballBody';
import { isEightKill, type MatchModeId } from './matchMode';
import type { MatchWinner } from './matchSession';
import {
  TECH_REWARD_DRAW,
  TECH_REWARD_EIGHT_FIRST,
  TECH_REWARD_EIGHT_REST,
  TECH_REWARD_LOSE,
  TECH_REWARD_WIN,
} from './techIds';

export type MatchRewardInput = {
  mode: MatchModeId;
  winner: MatchWinner;
  playerTeam?: TeamId;
  practice?: boolean;
  matchId?: string;
};

export type MatchRewardPlan = {
  amount: number;
  label: string;
  skip: boolean;
  reason: string;
};

/** 沿现有结算胜负/平，不另造玩家排名。本地只有红1 领奖。 */
export function planMatchTechReward(input: MatchRewardInput): MatchRewardPlan {
  if (input.practice) {
    return { amount: 0, label: '', skip: true, reason: '练习不发科技点' };
  }
  const team: TeamId = input.playerTeam ?? 'red';
  if (isEightKill(input.mode)) {
    if (input.winner === team) {
      return { amount: TECH_REWARD_EIGHT_FIRST, label: '八杀第一', skip: false, reason: '八杀第一' };
    }
    if (input.winner == null) {
      return { amount: TECH_REWARD_EIGHT_FIRST, label: '八杀并列第一', skip: false, reason: '八杀并列第一' };
    }
    return { amount: TECH_REWARD_EIGHT_REST, label: '八杀其余', skip: false, reason: '八杀其余' };
  }
  if (input.winner === team) {
    return { amount: TECH_REWARD_WIN, label: '胜利', skip: false, reason: '胜利' };
  }
  if (input.winner == null) {
    return { amount: TECH_REWARD_DRAW, label: '平局', skip: false, reason: '平局' };
  }
  return { amount: TECH_REWARD_LOSE, label: '失败', skip: false, reason: '失败' };
}
