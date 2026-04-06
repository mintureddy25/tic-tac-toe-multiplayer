export function rpcGetOnlineCount(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  // Count all players currently in active matches
  var inMatchCount = 0;
  try {
    var matches = nk.matchList(100, true, undefined, undefined, undefined, undefined);
    if (matches) {
      for (var i = 0; i < matches.length; i++) {
        inMatchCount += matches[i].size || 0;
      }
    }
  } catch (e) {}
  // The caller is online too, even if not in a match
  // Minimum 1 (the caller themselves)
  var count = Math.max(1, inMatchCount);
  return JSON.stringify({ count: count });
}

export function rpcHealthCheck(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  logger.info('Health check called by user %s', ctx.userId);
  return JSON.stringify({ status: 'ok', timestamp: Date.now() });
}

export function rpcGetMatchState(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  if (!payload) {
    return JSON.stringify({ error: 'matchId is required' });
  }

  let matchId: string;
  try {
    const data = JSON.parse(payload);
    matchId = data.matchId;
  } catch (e) {
    return JSON.stringify({ error: 'Invalid payload format' });
  }

  if (!matchId) {
    return JSON.stringify({ error: 'matchId is required' });
  }

  try {
    const match = nk.matchGet(matchId);
    if (!match) {
      return JSON.stringify({ error: 'Match not found' });
    }

    // Signal the match to get its current state
    const result = nk.matchSignal(matchId, 'get_state');

    return JSON.stringify({
      matchId: matchId,
      label: match.label,
      size: match.size,
      state: result ? JSON.parse(result) : null,
    });
  } catch (e) {
    logger.error('Failed to get match state for %s: %s', matchId, e);
    return JSON.stringify({ error: 'Failed to get match state' });
  }
}
