// Standard political rules. Version-one encounters retain their earlier table.
export const INTEREST_EFFECTS=Object.freeze({
  service:{persuade:2,promise:3,record:4,address:2,threaten:3},
  security:{persuade:2,promise:4,record:3,address:2,threaten:4},
  law:{persuade:3,promise:2,record:2,address:3,threaten:1},
  grain:{persuade:2,promise:4,record:1,address:1,threaten:3},
  office:{persuade:1,promise:4,record:1,address:1,threaten:4}
});
export const BLOC_AFFINITIES=Object.freeze({Veterans:{record:1,threaten:1},Landholders:{promise:1},Civic:{persuade:1,address:1,threaten:-1}});
export const POLITICAL_BALANCE=Object.freeze({cooperationRange:2,cooperationBonus:1,materialPromiseCost:3,ordinaryPromiseCost:2,rivalMove:3,rivalLobby:2,rivalResolve:3,brokerPromisePressure:1});
// Score visible opportunities rather than granting opposition hidden bonuses.
export const RIVAL_PRIORITIES=Object.freeze({lobby:{vote:9,pressure:.4,withdraw:7,promise:0},broker:{vote:8,pressure:.4,withdraw:7,promise:2},prosecutor:{vote:8,pressure:1,withdraw:11,promise:0}});
