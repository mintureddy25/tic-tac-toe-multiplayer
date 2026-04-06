// Nakama JS runtime uses goja (Go-based JS engine)
// Must use plain objects instead of Map (goja doesn't serialize Map properly)

export interface PlayerInfo {
  oddsUserId: string;
  username: string;
}

export interface GameState {
  board: number[];
  players: { [key: string]: PlayerInfo };
  playerSymbols: { [key: string]: number };
  currentTurn: string;
  phase: 'waiting' | 'playing' | 'done';
  winner: string | null;
  winningLine: number[] | null;
  timedMode: boolean;
  turnDeadline: number;
  turnDuration: number;
  moveCount: number;
  matchId: string;
  ranked: boolean;
}

export var OpCode = {
  MOVE: 1,
  STATE: 2,
  DONE: 3,
  REJECTED: 4,
  TURN_TIMER: 5,
};

var WINNING_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: number[]): { winner: number; line: number[] } | null {
  for (var i = 0; i < WINNING_LINES.length; i++) {
    var line = WINNING_LINES[i];
    var a = line[0], b = line[1], c = line[2];
    if (board[a] !== 0 && board[a] === board[b] && board[b] === board[c]) {
      return { winner: board[a], line: line };
    }
  }
  return null;
}

function playerCount(players: { [key: string]: PlayerInfo }): number {
  return Object.keys(players).length;
}

function calculatePoints(moveCount: number): number {
  // moveCount is total moves by both players
  // Winner's moves: ceil(moveCount / 2) for X (goes first), floor for O
  // Simplified: 5 total = 50, 6 = 45, 7 = 40, 8 = 35, 9 = 30
  if (moveCount <= 5) return 50;
  if (moveCount <= 6) return 45;
  if (moveCount <= 7) return 40;
  if (moveCount <= 8) return 35;
  return 30;
}

function serializeState(state: GameState): { [key: string]: any } {
  var playersObj: { [key: string]: any } = {};
  var keys = Object.keys(state.players);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    playersObj[k] = { oddsUserId: state.players[k].oddsUserId, username: state.players[k].username };
  }

  return {
    board: state.board,
    players: playersObj,
    playerSymbols: state.playerSymbols,
    currentTurn: state.currentTurn,
    phase: state.phase,
    winner: state.winner,
    winningLine: state.winningLine,
    timedMode: state.timedMode,
    turnDeadline: state.turnDeadline,
    turnDuration: state.turnDuration,
    moveCount: state.moveCount,
    matchId: state.matchId,
  };
}

export function matchInit(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  params: { [key: string]: string }
): { state: nkruntime.MatchState; tickRate: number; label: string } {
  var timedMode = params['timedMode'] === 'true';
  var ranked = params['ranked'] !== 'false'; // default true, only false for private rooms

  var state: GameState = {
    board: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    players: {},
    playerSymbols: {},
    currentTurn: '',
    phase: 'waiting',
    winner: null,
    winningLine: null,
    timedMode: timedMode,
    turnDeadline: 0,
    turnDuration: 30,
    moveCount: 0,
    matchId: ctx.matchId,
    ranked: ranked,
  };

  var label = JSON.stringify({ open: ranked, mode: timedMode ? 'timed' : 'classic' });
  logger.info('Match initialized: %s, timedMode: %s, ranked: %s', ctx.matchId, timedMode, ranked);

  return { state: state, tickRate: 1, label: label };
}

export function matchJoinAttempt(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  s: nkruntime.MatchState,
  presence: nkruntime.Presence,
  metadata: { [key: string]: any }
): { state: nkruntime.MatchState; accept: boolean; rejectMessage?: string } {
  var state = s as GameState;

  if (state.phase !== 'waiting') {
    return { state: state, accept: false, rejectMessage: 'Match already in progress or finished.' };
  }

  if (playerCount(state.players) >= 2) {
    return { state: state, accept: false, rejectMessage: 'Match is full.' };
  }

  logger.info('Player %s attempting to join match %s', presence.userId, ctx.matchId);
  return { state: state, accept: true };
}

export function matchJoin(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  s: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var state = s as GameState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    var userId = presence.userId;

    if (state.players[userId]) {
      continue;
    }

    state.players[userId] = {
      oddsUserId: userId,
      username: presence.username,
    };

    var count = playerCount(state.players);
    var symbol = count === 1 ? 1 : 2;
    state.playerSymbols[userId] = symbol;

    logger.info('Player %s (%s) joined as %s', userId, presence.username, symbol === 1 ? 'X' : 'O');
  }

  if (playerCount(state.players) === 2) {
    state.phase = 'playing';

    var playerIds = Object.keys(state.playerSymbols);
    var firstPlayer = '';
    for (var j = 0; j < playerIds.length; j++) {
      if (state.playerSymbols[playerIds[j]] === 1) {
        firstPlayer = playerIds[j];
      }
    }

    state.currentTurn = firstPlayer;

    if (state.timedMode) {
      state.turnDeadline = Math.floor(Date.now() / 1000) + state.turnDuration;
    }

    var label = JSON.stringify({ open: false, mode: state.timedMode ? 'timed' : 'classic' });
    dispatcher.matchLabelUpdate(label);

    var stateMessage = JSON.stringify(serializeState(state));
    dispatcher.broadcastMessage(OpCode.STATE, stateMessage);

    logger.info('Match %s started!', ctx.matchId);
  }

  return { state: state };
}

export function matchLeave(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  s: nkruntime.MatchState,
  presences: nkruntime.Presence[]
): { state: nkruntime.MatchState } | null {
  var state = s as GameState;

  for (var i = 0; i < presences.length; i++) {
    var presence = presences[i];
    var userId = presence.userId;
    logger.info('Player %s left match %s', userId, ctx.matchId);

    if (state.phase === 'playing') {
      var remainingPlayer = '';
      var playerIds = Object.keys(state.players);
      for (var j = 0; j < playerIds.length; j++) {
        if (playerIds[j] !== userId) {
          remainingPlayer = playerIds[j];
        }
      }

      if (remainingPlayer) {
        state.phase = 'done';
        state.winner = remainingPlayer;
        var forfeitPoints = 25;

        var doneMessage = JSON.stringify({
          winner: remainingPlayer,
          reason: 'forfeit',
          board: state.board,
          winningLine: null,
          moveCount: state.moveCount,
          points: forfeitPoints,
        });
        dispatcher.broadcastMessage(OpCode.DONE, doneMessage);

        var winnerInfo = state.players[remainingPlayer];
        var loserInfo = state.players[userId];
        if (state.ranked) {
          if (winnerInfo) recordWinFromHandler(nk, logger, remainingPlayer, winnerInfo.username, forfeitPoints);
          if (loserInfo) recordLossFromHandler(nk, logger, userId, loserInfo.username);
        }
        if (winnerInfo) saveGameToStorage(nk, logger, remainingPlayer, state.matchId, 'win', 'forfeit', state.board, loserInfo ? loserInfo.username : 'Unknown');
        if (loserInfo) saveGameToStorage(nk, logger, userId, state.matchId, 'loss', 'forfeit', state.board, winnerInfo ? winnerInfo.username : 'Unknown');

        logger.info('Player %s wins by forfeit in match %s (ranked: %s)', remainingPlayer, ctx.matchId, state.ranked);
      }
    }

    delete state.players[userId];
    delete state.playerSymbols[userId];
  }

  return { state: state };
}

export function matchLoop(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  s: nkruntime.MatchState,
  messages: nkruntime.MatchMessage[]
): { state: nkruntime.MatchState } | null {
  var state = s as GameState;

  if (state.phase === 'done') {
    if (tick > 5) {
      return null;
    }
    return { state: state };
  }

  // Check timer expiration
  if (state.phase === 'playing' && state.timedMode && state.turnDeadline > 0) {
    var now = Math.floor(Date.now() / 1000);
    if (now >= state.turnDeadline) {
      var otherPlayer = '';
      var playerIds = Object.keys(state.players);
      for (var i = 0; i < playerIds.length; i++) {
        if (playerIds[i] !== state.currentTurn) {
          otherPlayer = playerIds[i];
        }
      }

      state.phase = 'done';
      state.winner = otherPlayer || null;
      var timeoutPoints = 25;

      var doneMessage = JSON.stringify({
        winner: otherPlayer,
        reason: 'timeout',
        board: state.board,
        winningLine: null,
        moveCount: state.moveCount,
        points: timeoutPoints,
      });
      dispatcher.broadcastMessage(OpCode.DONE, doneMessage);

      var timeoutLoserInfo = state.players[state.currentTurn];
      if (state.ranked) {
        if (otherPlayer && state.players[otherPlayer]) recordWinFromHandler(nk, logger, otherPlayer, state.players[otherPlayer].username, timeoutPoints);
        if (timeoutLoserInfo) recordLossFromHandler(nk, logger, state.currentTurn, timeoutLoserInfo.username);
      }
      if (otherPlayer && state.players[otherPlayer]) saveGameToStorage(nk, logger, otherPlayer, state.matchId, 'win', 'timeout', state.board, timeoutLoserInfo ? timeoutLoserInfo.username : 'Unknown');
      if (timeoutLoserInfo) {
        var wInfo = otherPlayer ? state.players[otherPlayer] : null;
        saveGameToStorage(nk, logger, state.currentTurn, state.matchId, 'loss', 'timeout', state.board, wInfo ? wInfo.username : 'Unknown');
      }

      logger.info('Player %s wins by timeout in match %s (ranked: %s)', otherPlayer, ctx.matchId, state.ranked);
    }
  }

  for (var m = 0; m < messages.length; m++) {
    handleMessage(state, messages[m], dispatcher, logger, nk);
  }

  return { state: state };
}

export function matchSignal(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  s: nkruntime.MatchState,
  data: string
): { state: nkruntime.MatchState; data?: string } | null {
  var state = s as GameState;
  return { state: state, data: JSON.stringify(serializeState(state)) };
}

export function matchTerminate(
  ctx: nkruntime.Context,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama,
  dispatcher: nkruntime.MatchDispatcher,
  tick: number,
  s: nkruntime.MatchState,
  graceSeconds: number
): { state: nkruntime.MatchState } | null {
  return null;
}

function handleMessage(
  state: GameState,
  message: nkruntime.MatchMessage,
  dispatcher: nkruntime.MatchDispatcher,
  logger: nkruntime.Logger,
  nk: nkruntime.Nakama
): void {
  if (message.opCode !== OpCode.MOVE) {
    return;
  }

  var senderId = message.sender.userId;

  if (state.phase !== 'playing') {
    dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Game is not in progress.' }), [message.sender]);
    return;
  }

  if (state.currentTurn !== senderId) {
    dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Not your turn.' }), [message.sender]);
    return;
  }

  var moveData: { position: number };
  try {
    // message.data can be string, ArrayBuffer, or Uint8Array depending on Nakama version
    var rawData = message.data;
    var dataStr: string;
    if (typeof rawData === 'string') {
      dataStr = rawData;
    } else if (rawData instanceof ArrayBuffer) {
      dataStr = String.fromCharCode.apply(null, Array.from(new Uint8Array(rawData)));
    } else if (rawData && typeof rawData === 'object') {
      // Try treating as Uint8Array-like
      var bytes = new Uint8Array(rawData as ArrayBuffer);
      dataStr = String.fromCharCode.apply(null, Array.from(bytes));
    } else {
      dataStr = String(rawData);
    }
    logger.info('Move data received: %s (type: %s)', dataStr, typeof rawData);
    moveData = JSON.parse(dataStr);
  } catch (e) {
    logger.error('Failed to parse move data: %s (raw type: %s, raw: %s)', e, typeof message.data, String(message.data));
    dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Invalid message format.' }), [message.sender]);
    return;
  }

  var position = moveData.position;

  if (position < 0 || position > 8 || Math.floor(position) !== position) {
    dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Invalid position. Must be 0-8.' }), [message.sender]);
    return;
  }

  if (state.board[position] !== 0) {
    dispatcher.broadcastMessage(OpCode.REJECTED, JSON.stringify({ reason: 'Cell is already occupied.' }), [message.sender]);
    return;
  }

  // Make the move
  var symbol = state.playerSymbols[senderId];
  state.board[position] = symbol;
  state.moveCount++;

  // Check for winner
  var result = checkWinner(state.board);
  if (result) {
    state.phase = 'done';
    state.winner = senderId;
    state.winningLine = result.line;

    var points = calculatePoints(state.moveCount);

    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify({
      winner: senderId,
      reason: 'win',
      board: state.board,
      winningLine: result.line,
      moveCount: state.moveCount,
      points: points,
    }));

    var senderInfo = state.players[senderId];
    var pIds = Object.keys(state.players);

    // Only update leaderboard for ranked (random) matches
    if (state.ranked) {
      if (senderInfo) recordWinFromHandler(nk, logger, senderId, senderInfo.username, points);
      for (var i = 0; i < pIds.length; i++) {
        if (pIds[i] !== senderId) recordLossFromHandler(nk, logger, pIds[i], state.players[pIds[i]].username);
      }
    }

    // Always save match history
    for (var j = 0; j < pIds.length; j++) {
      if (pIds[j] !== senderId) {
        saveGameToStorage(nk, logger, pIds[j], state.matchId, 'loss', 'win', state.board, senderInfo ? senderInfo.username : 'Unknown');
      }
    }
    if (senderInfo) {
      var oppId = pIds.find(function(id) { return id !== senderId; });
      var oppName = oppId ? state.players[oppId].username : 'Unknown';
      saveGameToStorage(nk, logger, senderId, state.matchId, 'win', 'win', state.board, oppName);
    }

    logger.info('Player %s wins match %s (ranked: %s, +%d pts, %d moves)', senderId, state.matchId, state.ranked, points, state.moveCount);
    return;
  }

  // Check for draw
  if (state.moveCount >= 9) {
    state.phase = 'done';
    state.winner = 'draw';
    state.winningLine = null;

    dispatcher.broadcastMessage(OpCode.DONE, JSON.stringify({
      winner: 'draw',
      reason: 'draw',
      board: state.board,
      winningLine: null,
      moveCount: state.moveCount,
      points: state.ranked ? 20 : 0,
    }));

    var drawIds = Object.keys(state.players);
    if (drawIds.length === 2) {
      if (state.ranked) {
        recordDrawFromHandler(nk, logger, drawIds[0], state.players[drawIds[0]].username);
        recordDrawFromHandler(nk, logger, drawIds[1], state.players[drawIds[1]].username);
      }
      saveGameToStorage(nk, logger, drawIds[0], state.matchId, 'draw', 'draw', state.board, state.players[drawIds[1]].username);
      saveGameToStorage(nk, logger, drawIds[1], state.matchId, 'draw', 'draw', state.board, state.players[drawIds[0]].username);
    }

    logger.info('Match %s ended in a draw (ranked: %s)', state.matchId, state.ranked);
    return;
  }

  // Switch turn
  var switchIds = Object.keys(state.players);
  for (var s2 = 0; s2 < switchIds.length; s2++) {
    if (switchIds[s2] !== senderId) {
      state.currentTurn = switchIds[s2];
    }
  }

  // Reset timer
  if (state.timedMode) {
    state.turnDeadline = Math.floor(Date.now() / 1000) + state.turnDuration;
  }

  // Broadcast updated state
  dispatcher.broadcastMessage(OpCode.STATE, JSON.stringify(serializeState(state)));
}

function saveGameToStorage(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, matchId: string, result: string, reason: string, board: number[], opponentUsername: string): void {
  try {
    nk.storageWrite([{
      collection: 'match_history',
      key: matchId,
      userId: userId,
      value: { matchId: matchId, result: result, reason: reason, board: board, opponent: opponentUsername, playedAt: new Date().toISOString() },
      permissionRead: 2,
      permissionWrite: 0,
    }]);
  } catch (e) {
    logger.error('Failed to save match history for %s: %s', userId, e);
  }
}

function getPlayerStats(nk: nkruntime.Nakama, userId: string): { wins: number; losses: number; draws: number; streak: number; score: number } {
  var stats = { wins: 0, losses: 0, draws: 0, streak: 0, score: 0 };
  try {
    var result = nk.storageRead([{ collection: 'player_stats', key: 'scores', userId: userId }]);
    if (result && result.length > 0 && result[0].value) {
      var val = result[0].value as any;
      stats.wins = val.wins || 0;
      stats.losses = val.losses || 0;
      stats.draws = val.draws || 0;
      stats.streak = val.streak || 0;
      stats.score = val.score || 0;
    }
  } catch (e) {}
  return stats;
}

function savePlayerStats(nk: nkruntime.Nakama, userId: string, username: string, stats: { wins: number; losses: number; draws: number; streak: number; score: number }): void {
  // Save to storage (source of truth)
  nk.storageWrite([{
    collection: 'player_stats',
    key: 'scores',
    userId: userId,
    value: stats,
    permissionRead: 2,
    permissionWrite: 0,
  }]);
  // Also update leaderboard for ranking
  var leaderboardId = 'ttt_leaderboard_v2';
  nk.leaderboardRecordWrite(leaderboardId, userId, username, stats.score, 0, { wins: stats.wins, losses: stats.losses, draws: stats.draws, streak: stats.streak } as any);
}

function recordWinFromHandler(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, username: string, points: number): void {
  try {
    var stats = getPlayerStats(nk, userId);
    stats.wins++;
    stats.streak = stats.streak > 0 ? stats.streak + 1 : 1;
    stats.score = stats.score + points;
    savePlayerStats(nk, userId, username, stats);
    logger.info('Recorded win for %s (W:%d L:%d D:%d streak:%d score:%d +%d)', username, stats.wins, stats.losses, stats.draws, stats.streak, stats.score, points);
  } catch (e) {
    logger.error('Failed to record win for %s: %s', userId, e);
  }
}

function recordLossFromHandler(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, username: string): void {
  try {
    var stats = getPlayerStats(nk, userId);
    stats.losses++;
    stats.streak = 0;
    stats.score = Math.max(0, stats.score - 20);
    savePlayerStats(nk, userId, username, stats);
    logger.info('Recorded loss for %s (W:%d L:%d D:%d streak:%d score:%d)', username, stats.wins, stats.losses, stats.draws, stats.streak, stats.score);
  } catch (e) {
    logger.error('Failed to record loss for %s: %s', userId, e);
  }
}

function recordDrawFromHandler(nk: nkruntime.Nakama, logger: nkruntime.Logger, userId: string, username: string): void {
  try {
    var stats = getPlayerStats(nk, userId);
    stats.draws++;
    stats.streak = 0;
    stats.score = stats.score + 20;
    savePlayerStats(nk, userId, username, stats);
    logger.info('Recorded draw for %s (W:%d L:%d D:%d streak:%d score:%d)', username, stats.wins, stats.losses, stats.draws, stats.streak, stats.score);
  } catch (e) {
    logger.error('Failed to record draw for %s: %s', userId, e);
  }
}
