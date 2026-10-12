// Standard combat tuning. No difficulty-specific health or damage multipliers.
export const BATTLE_BALANCE=Object.freeze({version:2,hitMorale:8,flankMorale:4,withdrawalShock:6,regroupMorale:15,shakenThreshold:25,brokenThreshold:15,chargeDistance:2,chargeBonus:1,coverRanged:1,heightRanged:1,defencePressure:10,weights:Object.freeze({damage:3,finish:6,threat:.65,progress:1.6,cover:.7,cohesion:.7,convoy:3,flank:1.1})});
export const FORMATION_RULES=Object.freeze({
  line:Object.freeze({label:'Line',summary:'Normal march through marsh; morale loss −5; adjacent line members screen ranged attacks by 1.',morale:5}),
  'shield-wall':Object.freeze({label:'Shield wall',summary:'March 1; brace reduces damage by 2; adjacent shield-wall members add 1 frontal protection.',march:1}),
  wedge:Object.freeze({label:'Wedge',summary:'Melee +1 on firm open ground; incoming damage +1. No attack bonus in marsh, ford or fortifications.',attack:1,exposure:1})
});
export const ROUGH_TERRAIN=Object.freeze(['marsh','ford','wall','rock','rubble']);
