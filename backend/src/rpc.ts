export function rpcGetOnlineCount(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var now = Math.floor(Date.now() / 1000);
  var systemUserId = '00000000-0000-0000-0000-000000000000';

  // Read current online list
  var onlineUsers: { [key: string]: number } = {};
  try {
    var existing = nk.storageRead([{ collection: 'system', key: 'online_users', userId: systemUserId }]);
    if (existing && existing.length > 0 && existing[0].value) {
      onlineUsers = (existing[0].value as any).users || {};
    }
  } catch (e) {}

  // Add/update current user
  onlineUsers[ctx.userId] = now;

  // Remove users not seen in last 60 seconds
  var keys = Object.keys(onlineUsers);
  for (var i = 0; i < keys.length; i++) {
    if (now - onlineUsers[keys[i]] > 60) {
      delete onlineUsers[keys[i]];
    }
  }

  // Save back
  try {
    nk.storageWrite([{
      collection: 'system',
      key: 'online_users',
      userId: systemUserId,
      value: { users: onlineUsers },
      permissionRead: 2,
      permissionWrite: 0,
    }]);
  } catch (e) {}

  var count = Object.keys(onlineUsers).length;
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
