import { resetBoomFlashes } from './boomFlashes';
import { resetChainEqualize } from './chainEqualize';
import { resetCombatFloatAcc } from './combatFloat';
import { clearHookBleeds } from './hookBleed';
import { resetMagnetWells } from './magnetWells';
import { resetMirrorWalls } from './mirrorWalls';
import { resetStakes } from './ropeStakes';
import { resetTrapZones } from './trapZones';

/** 清测试/上一局临时场域。不含存档、roster、技能数值。 */
export function resetMatchFieldFx(): void {
  resetTrapZones();
  resetMagnetWells();
  resetChainEqualize();
  resetStakes();
  resetMirrorWalls();
  resetBoomFlashes();
  clearHookBleeds();
  resetCombatFloatAcc();
}
