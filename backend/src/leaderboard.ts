// Changed ID to force fresh creation with 'set' operator (old 'wins_leaderboard' used 'incr')
const LEADERBOARD_ID = 'ttt_leaderboard_v2';

export function initLeaderboard(nk: nkruntime.Nakama, logger: nkruntime.Logger): void {
  // JS runtime expects string values for sort and operator
  nk.leaderboardCreate(
    LEADERBOARD_ID,
    false,           // authoritative
    'descending' as any,   // sortOrder
    'set' as any,          // operator
    undefined,       // resetSchedule - never reset
    undefined        // metadata
  );

  logger.info('Leaderboard "%s" initialized', LEADERBOARD_ID);
}

export function rpcGetLeaderboard(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  payload: string
): string {
  const result = nk.leaderboardRecordsList(LEADERBOARD_ID, [], 20);

  const records: any[] = [];

  if (result && result.records) {
    for (const record of result.records) {
      let metadata = { wins: 0, losses: 0, draws: 0, streak: 0 };

      if (record.metadata) {
        try {
          // metadata can be object or string depending on Nakama version
          metadata = typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata as any;
        } catch (e) {
          // Use defaults
        }
      }

      records.push({
        ownerId: record.ownerId,
        username: record.username,
        score: record.score,
        wins: metadata.wins || 0,
        losses: metadata.losses || 0,
        draws: metadata.draws || 0,
        streak: metadata.streak || 0,
      });
    }
  }

  return JSON.stringify({ records });
}

export function recordWin(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  username: string
): void {
  const stats = getPlayerStats(nk, userId);

  const wins = stats.wins + 1;
  const losses = stats.losses;
  const streak = stats.streak > 0 ? stats.streak + 1 : 1;

  const metadata = JSON.stringify({ wins, losses, streak });
  nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, username, 1, 0, metadata);

  logger.info('Recorded win for %s (total: %d, streak: %d)', username, wins, streak);
}

export function recordLoss(
  nk: nkruntime.Nakama,
  logger: nkruntime.Logger,
  userId: string,
  username: string
): void {
  const stats = getPlayerStats(nk, userId);

  const wins = stats.wins;
  const losses = stats.losses + 1;
  const streak = 0;

  const metadata = JSON.stringify({ wins, losses, streak });
  nk.leaderboardRecordWrite(LEADERBOARD_ID, userId, username, 0, 0, metadata);

  logger.info('Recorded loss for %s (total: %d)', username, losses);
}

export function getPlayerStats(
  nk: nkruntime.Nakama,
  userId: string
): { wins: number; losses: number; streak: number } {
  const defaults = { wins: 0, losses: 0, streak: 0 };

  try {
    const records = nk.leaderboardRecordsList(LEADERBOARD_ID, [userId], 1);

    if (records && records.records && records.records.length > 0) {
      const record = records.records[0];
      if (record.metadata) {
        const meta = JSON.parse(record.metadata as string);
        return {
          wins: meta.wins || 0,
          losses: meta.losses || 0,
          streak: meta.streak || 0,
        };
      }
    }
  } catch (e) {
    // Return defaults if no record exists
  }

  return defaults;
}
