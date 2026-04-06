import {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchSignal,
  matchTerminate,
} from './match_handler';

// Re-export match handlers so they're accessible globally via rollup footer
export {
  matchInit,
  matchJoinAttempt,
  matchJoin,
  matchLeave,
  matchLoop,
  matchSignal,
  matchTerminate,
};

import {
  rpcFindMatch,
  rpcCreateMatch,
  matchmakerMatched,
} from './matchmaking';

import {
  initLeaderboard,
  rpcGetLeaderboard,
} from './leaderboard';

import {
  rpcHealthCheck,
  rpcGetMatchState,
  rpcGetOnlineCount,
} from './rpc';

export function InitModule(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  initializer: nkruntime.Initializer
): void {
  logger.info('Tic-Tac-Toe module loaded');

  // Initialize leaderboard
  initLeaderboard(nk, logger);

  // Register match handler - Nakama JS runtime requires handler functions
  // to be accessible, passing them as object properties
  initializer.registerMatch('tic_tac_toe', {
    matchInit: matchInit,
    matchJoinAttempt: matchJoinAttempt,
    matchJoin: matchJoin,
    matchLeave: matchLeave,
    matchLoop: matchLoop,
    matchSignal: matchSignal,
    matchTerminate: matchTerminate,
  } as any);

  // Register RPCs
  initializer.registerRpc('find_match', rpcFindMatch);
  initializer.registerRpc('create_match', rpcCreateMatch);
  initializer.registerRpc('get_leaderboard', rpcGetLeaderboard);
  initializer.registerRpc('health_check', rpcHealthCheck);
  initializer.registerRpc('get_match_state', rpcGetMatchState);
  initializer.registerRpc('get_online_count', rpcGetOnlineCount);

  // Register matchmaker matched hook
  initializer.registerMatchmakerMatched(matchmakerMatched);

  logger.info('Tic-Tac-Toe module initialized successfully');
}

