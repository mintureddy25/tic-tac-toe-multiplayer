import React, { useState, useEffect, useCallback, useRef } from 'react';
import nakamaClient from '../nakama';
import { MatchData } from '@heroiclabs/nakama-js';

interface GameBoardProps {
  matchId: string;
  mode: 'classic' | 'timed';
  onGameOver: (result: GameResult) => void;
  onLeave: () => void;
}

export interface GameResult {
  winner: string | null;
  reason: string;
  board: number[];
  winningLine: number[] | null;
  mySymbol: number;
  opponentName: string;
  points?: number;
}

interface GameStateData {
  board: number[];
  players: { [key: string]: { oddsUserId: string; username: string } };
  playerSymbols: { [key: string]: number };
  currentTurn: string;
  phase: string;
  winner: string | null;
  winningLine: number[] | null;
  timedMode: boolean;
  turnDeadline: number;
  turnDuration: number;
  moveCount: number;
  matchId: string;
}

const OpCode = { MOVE: 1, STATE: 2, DONE: 3, REJECTED: 4, TURN_TIMER: 5 };

const GameBoard: React.FC<GameBoardProps> = ({ matchId, mode, onGameOver, onLeave }) => {
  const [board, setBoard] = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [mySymbol, setMySymbol] = useState<number>(0);
  const [currentTurn, setCurrentTurn] = useState<string>('');
  const [players, setPlayers] = useState<{ [key: string]: { oddsUserId: string; username: string } }>({});
  const [playerSymbols, setPlayerSymbols] = useState<{ [key: string]: number }>({});
  const [phase, setPhase] = useState<string>('waiting');
  const [winningLine, setWinningLine] = useState<number[] | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [turnDeadline, setTurnDeadline] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const opponentNameRef = useRef<string>('Opponent');
  const mySymbolRef = useRef<number>(0);
  const joinedRef = useRef(false);
  const leftRef = useRef(false);

  const userId = nakamaClient.getUserId();
  const username = nakamaClient.getUsername();

  const updateFromState = useCallback((state: GameStateData) => {
    setBoard([...state.board]);
    setPlayers(state.players);
    setPlayerSymbols(state.playerSymbols);
    setCurrentTurn(state.currentTurn);
    setPhase(state.phase);
    setWinningLine(state.winningLine);
    if (state.turnDeadline) setTurnDeadline(state.turnDeadline);

    if (userId && state.playerSymbols[userId]) {
      setMySymbol(state.playerSymbols[userId]);
      mySymbolRef.current = state.playerSymbols[userId];
    }

    Object.entries(state.players).forEach(([id, info]) => {
      if (id !== userId) opponentNameRef.current = info.username;
    });
  }, [userId]);

  // Single useEffect for join + listeners - with StrictMode protection
  useEffect(() => {
    let cancelled = false;

    // Set up data listener
    nakamaClient.onMatchData((data: MatchData) => {
      if (cancelled || data.match_id !== matchId) return;
      let decoded: string;
      try {
        if (data.data instanceof Uint8Array) {
          decoded = new TextDecoder().decode(data.data);
        } else {
          decoded = data.data as unknown as string;
        }
      } catch (e) {
        return;
      }
      let parsed: any;
      try { parsed = JSON.parse(decoded); } catch (e) { return; }

      switch (data.op_code) {
        case OpCode.STATE:
          updateFromState(parsed as GameStateData);
          break;
        case OpCode.DONE:
          if (parsed.board) setBoard(parsed.board);
          setWinningLine(parsed.winningLine);
          setPhase('done');
          onGameOver({
            winner: parsed.winner,
            reason: parsed.reason,
            board: parsed.board,
            winningLine: parsed.winningLine,
            mySymbol: mySymbolRef.current,
            opponentName: opponentNameRef.current,
            points: parsed.points || 0,
          });
          break;
        case OpCode.REJECTED:
          setError(parsed.reason || 'Move rejected');
          setTimeout(() => setError(null), 2000);
          break;
      }
    });

    nakamaClient.onMatchPresence((event) => {
      if (cancelled) return;
      if (event.joins) {
        event.joins.forEach((p: any) => {
          if (p.user_id !== userId) opponentNameRef.current = p.username;
        });
      }
    });

    // Join the match (only once, protect against StrictMode double-mount)
    if (!joinedRef.current) {
      joinedRef.current = true;
      nakamaClient.joinMatch(matchId).then(() => {
        if (!cancelled) setJoined(true);
      }).catch((e: any) => {
        if (!cancelled) {
          setError('Failed to join match: ' + (e?.message || 'Unknown error'));
          joinedRef.current = false;
        }
      });
    } else {
      setJoined(true);
    }

    return () => {
      cancelled = true;
      // Do NOT leave match on cleanup - StrictMode would cause immediate leave
    };
  }, [matchId, updateFromState, onGameOver, userId]);

  // Timer countdown
  useEffect(() => {
    if (mode !== 'timed' || !turnDeadline || phase !== 'playing') return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, turnDeadline - Math.floor(Date.now() / 1000));
      setTimeLeft(remaining);
    }, 200);
    return () => clearInterval(interval);
  }, [mode, turnDeadline, phase]);

  const handleCellClick = (index: number) => {
    if (phase !== 'playing' || currentTurn !== userId || board[index] !== 0) return;
    nakamaClient.sendMove(matchId, index);
  };

  const handleLeave = async () => {
    if (!leftRef.current) {
      leftRef.current = true;
      try { await nakamaClient.leaveMatch(matchId); } catch (e) {}
    }
    onLeave();
  };

  const isMyTurn = currentTurn === userId;
  const myName = username || 'You';
  const opponentName = opponentNameRef.current;
  const getSymbolChar = (symbol: number) => symbol === 1 ? 'X' : symbol === 2 ? 'O' : '';

  const getTimerColor = () => {
    if (timeLeft <= 5) return 'text-red-400';
    if (timeLeft <= 15) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  // Waiting for opponent
  if (!joined || phase === 'waiting') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white px-4">
        <div className="flex gap-1.5 mb-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-white"
              style={{
                animation: 'dotPulse 1.4s ease-in-out infinite',
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
        <h2 className="text-xl font-bold mb-2 text-white">
          {!joined ? 'Joining match...' : 'Waiting for opponent...'}
        </h2>
        <p className="text-sm text-zinc-500 mb-6">Your opponent will join shortly</p>
        <button
          className="border border-zinc-700 text-zinc-300 rounded-xl py-2.5 px-8 text-sm font-bold hover:bg-zinc-800 transition-all"
          onClick={handleLeave}
        >
          Leave
        </button>
      </div>
    );
  }

  // Get player info for score cards
  const mySymbolChar = getSymbolChar(mySymbol);
  const oppSymbolChar = getSymbolChar(mySymbol === 1 ? 2 : 1);

  // Playing
  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-zinc-950 px-4 py-4">

      {/* Top bar */}
      <div className="flex items-center justify-between max-w-[420px] w-full mb-6">
        <button
          className="text-zinc-400 hover:text-white text-sm font-bold transition-colors"
          onClick={handleLeave}
        >
          &times; QUIT
        </button>
        <span className="text-xs font-[800] font-syne tracking-widest text-zinc-600 uppercase">TIC TAC TOE</span>
        <span className="text-xs font-bold tracking-widest text-zinc-600 uppercase">ROUND 1</span>
      </div>

      <div className="flex flex-col items-center max-w-[420px] w-full">

        {/* Score board */}
        <div className="grid grid-cols-2 gap-3 w-full mb-4">
          {/* My card */}
          <div className={`bg-zinc-900 rounded-2xl p-4 text-center border transition-all ${
            isMyTurn ? 'border-zinc-600' : 'border-zinc-800'
          }`}>
            <p className={`text-sm font-bold mb-1 ${mySymbol === 1 ? 'text-rose-400' : 'text-sky-400'}`}>
              {mySymbolChar} &middot; {myName}
            </p>
            {isMyTurn && phase === 'playing' && (
              <p className="text-xs text-zinc-500 animate-pulse">playing...</p>
            )}
          </div>

          {/* Opponent card */}
          <div className={`bg-zinc-900 rounded-2xl p-4 text-center border transition-all ${
            !isMyTurn ? 'border-zinc-600' : 'border-zinc-800'
          }`}>
            <p className={`text-sm font-bold mb-1 ${mySymbol === 1 ? 'text-sky-400' : 'text-rose-400'}`}>
              {oppSymbolChar} &middot; {opponentName}
            </p>
            {!isMyTurn && phase === 'playing' && (
              <p className="text-xs text-zinc-500 animate-pulse">playing...</p>
            )}
          </div>
        </div>

        {/* Timer */}
        {mode === 'timed' && phase === 'playing' && (
          <div className={`mb-3 px-4 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
            <span className={`text-2xl font-black font-mono ${getTimerColor()}`}>
              {timeLeft}
            </span>
            <span className="text-zinc-500 text-sm ml-1">sec</span>
          </div>
        )}

        {/* Turn/Result banner */}
        <div className={`rounded-xl px-4 py-2.5 text-center text-sm font-bold mb-4 w-full ${
          phase === 'done'
            ? 'bg-zinc-900 border border-zinc-800 text-white'
            : isMyTurn
              ? 'bg-zinc-900 border border-zinc-700 text-white'
              : 'bg-zinc-900 border border-zinc-800 text-zinc-400'
        }`}>
          {phase === 'playing' && isMyTurn && '\u26A1 Your turn'}
          {phase === 'playing' && !isMyTurn && `\uD83E\uDD16 ${opponentName} is thinking...`}
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {board.map((cell, index) => {
            const isWinning = winningLine?.includes(index);
            const clickable = isMyTurn && cell === 0 && phase === 'playing';
            return (
              <div
                key={index}
                className={`w-[100px] h-[100px] sm:w-[110px] sm:h-[110px] flex items-center justify-center rounded-2xl border transition-colors duration-200
                  ${isWinning
                    ? 'bg-emerald-900 border-emerald-700'
                    : 'bg-zinc-900 border-zinc-800'
                  }
                  ${clickable ? 'cursor-pointer hover:border-zinc-600 hover:bg-zinc-800' : 'cursor-default'}
                `}
                onClick={() => handleCellClick(index)}
              >
                {cell === 1 && (
                  <span className="x-mark text-4xl font-black font-mono text-rose-400 select-none">X</span>
                )}
                {cell === 2 && (
                  <svg className="o-circle-svg" width="50" height="50" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#38bdf8" strokeWidth="8" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="text-red-400 text-sm mb-3 bg-red-400/10 px-4 py-2 rounded-lg border border-red-400/20">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameBoard;
