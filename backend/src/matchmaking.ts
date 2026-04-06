// find_match RPC is no longer needed - matchmaking is done client-side via socket.addMatchmaker()
// This RPC is kept as a fallback that creates a match and returns it for the player to join
export function rpcFindMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  // Since matchmakerAdd is not available in JS runtime RPCs,
  // this RPC now finds an open match or creates one
  var mode = 'classic';

  if (payload) {
    try {
      var data = JSON.parse(payload);
      if (data.mode === 'timed' || data.mode === 'classic') {
        mode = data.mode;
      }
    } catch (e) {
      logger.error('Invalid payload for find_match: %s', e);
    }
  }

  // Try to find an existing open match with the same mode
  // matchList params: limit, isAuthoritative, label, minSize, maxSize, query
  // label filter uses exact match on the label string
  try {
    // List all authoritative matches with 1 player (waiting for opponent)
    var matches = nk.matchList(10, true, undefined, 1, 1, undefined);
    logger.info('Found %d matches with 1 player', matches ? matches.length : 0);
    if (matches && matches.length > 0) {
      for (var i = 0; i < matches.length; i++) {
        var match = matches[i];
        // Check label to find matching mode
        if (match.label) {
          try {
            var labelData = JSON.parse(match.label as string);
            if (labelData.open === true && labelData.mode === mode) {
              logger.info('Found open match %s for mode %s', match.matchId, mode);
              return JSON.stringify({ matchId: match.matchId });
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    logger.error('Error listing matches: %s', e);
  }

  // No open match found, create a new ranked one
  var matchId = nk.matchCreate('tic_tac_toe', {
    timedMode: mode === 'timed' ? 'true' : 'false',
    ranked: 'true',
  });

  logger.info('Created new ranked match %s for mode %s (no open matches found)', matchId, mode);
  return JSON.stringify({ matchId: matchId });
}

export function rpcCreateMatch(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  var mode = 'classic';

  if (payload) {
    try {
      var data = JSON.parse(payload);
      if (data.mode === 'timed' || data.mode === 'classic') {
        mode = data.mode;
      }
    } catch (e) {
      logger.error('Invalid payload for create_match: %s', e);
    }
  }

  // Private rooms are unranked - scores don't count in leaderboard
  var matchId = nk.matchCreate('tic_tac_toe', {
    timedMode: mode === 'timed' ? 'true' : 'false',
    ranked: 'false',
  });

  logger.info('Private room created: %s with mode %s (unranked)', matchId, mode);
  return JSON.stringify({ matchId: matchId });
}

export function matchmakerMatched(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  matches: nkruntime.MatchmakerResult[]
): string {
  var timedMode = false;

  if (matches.length > 0 && matches[0].properties) {
    var numericProps = matches[0].properties.numeric;
    if (numericProps && numericProps['mode'] === 1) {
      timedMode = true;
    }
  }

  var matchId = nk.matchCreate('tic_tac_toe', {
    timedMode: timedMode ? 'true' : 'false',
    ranked: 'true',
  });

  logger.info('Matchmaker matched %d players, created ranked match: %s', matches.length, matchId);
  return matchId;
}
