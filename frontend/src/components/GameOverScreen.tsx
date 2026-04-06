import React, { useState, useEffect } from 'react';
import nakamaClient from '../nakama';
import { GameResult } from './GameBoard';

interface GameOverScreenProps {
  result: GameResult;
  onPlayAgain: () => void;
  onViewLeaderboard?: () => void;
}

interface LeaderboardRecord {
  ownerId: string;
  username: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
}

const AVATAR_COLORS = [
  { bg: 'bg-emerald-900', text: 'text-emerald-400' },
  { bg: 'bg-sky-900', text: 'text-sky-400' },
  { bg: 'bg-rose-900', text: 'text-rose-400' },
  { bg: 'bg-amber-900', text: 'text-amber-400' },
  { bg: 'bg-violet-900', text: 'text-violet-400' },
  { bg: 'bg-cyan-900', text: 'text-cyan-400' },
  { bg: 'bg-pink-900', text: 'text-pink-400' },
  { bg: 'bg-indigo-900', text: 'text-indigo-400' },
];

const GameOverScreen: React.FC<GameOverScreenProps> = ({ result, onPlayAgain, onViewLeaderboard }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);
  const [streak, setStreak] = useState(0);
  const [showStreak, setShowStreak] = useState(true);

  const userId = nakamaClient.getUserId();
  const isWinner = result.winner === userId;
  const isDraw = result.winner === 'draw';
  const points = result.points || 0;

  const winnerSymbol = isWinner
    ? (result.mySymbol === 1 ? 'X' : 'O')
    : (result.mySymbol === 1 ? 'O' : 'X');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await nakamaClient.getLeaderboard();
        setLeaderboard(data.records || []);
      } catch (e) {}
      finally { setLoadingLeaderboard(false); }
    };
    setTimeout(fetchLeaderboard, 500);
  }, []);

  // Check streak from leaderboard data - only show for winners
  useEffect(() => {
    if (leaderboard.length > 0 && isWinner) {
      const myRecord = leaderboard.find(r => r.ownerId === userId);
      if (myRecord && myRecord.streak >= 2) {
        setStreak(myRecord.streak);
        setShowStreak(true);
        const timer = setTimeout(() => setShowStreak(false), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [leaderboard, userId, isWinner]);

  const getResultEmoji = () => {
    if (isDraw) return '\uD83E\uDD1D';
    return isWinner ? '\uD83C\uDFC6' : '\uD83D\uDC80';
  };

  const getResultTitle = () => {
    if (isDraw) return 'Great Match!';
    return isWinner ? 'Victory!' : 'Defeated';
  };

  const getResultSubtitle = () => {
    const myName = nakamaClient.getUsername() || 'You';
    if (isDraw) return `${myName} tied with ${result.opponentName}`;
    if (isWinner) return `${myName} defeated ${result.opponentName}`;
    return `${result.opponentName} defeated ${myName}`;
  };

  const getReasonText = () => {
    switch (result.reason) {
      case 'forfeit': return isWinner ? 'Opponent disconnected' : 'You left the match';
      case 'timeout': return isWinner ? 'Opponent ran out of time' : 'You ran out of time';
      default: return '';
    }
  };

  const getPointsDisplay = () => {
    if (isDraw) return '+20 pts';
    if (isWinner) return `+${points} pts`;
    return '-20 pts';
  };

  const getPointsColor = () => {
    if (isDraw) return 'text-yellow-400';
    if (isWinner) return 'text-emerald-400';
    return 'text-red-400';
  };

  const getRankMedal = (index: number) => {
    switch (index) {
      case 0: return '\uD83E\uDD47';
      case 1: return '\uD83E\uDD48';
      case 2: return '\uD83E\uDD49';
      default: return `${index + 1}`;
    }
  };

  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  // Leaderboard display logic
  const top10 = leaderboard.slice(0, 10);
  const myRank = leaderboard.findIndex(r => r.ownerId === userId);
  const isInTop10 = myRank >= 0 && myRank < 10;
  const showMyRow = !isInTop10 && myRank >= 0;
  const hasMore = leaderboard.length > 10;

  const renderLeaderboardRow = (record: LeaderboardRecord, index: number, rank: number) => {
    const isMe = record.ownerId === userId;
    const colors = getAvatarColor(index);
    return (
      <div
        key={record.ownerId}
        className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
          isMe ? 'bg-zinc-800' : ''
        }`}
      >
        {/* Rank */}
        <span className="text-sm w-6 text-center">{getRankMedal(rank)}</span>

        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${colors.bg} ${colors.text}`}>
          {(record.username || '?')[0].toUpperCase()}
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className={`text-sm font-bold truncate ${isMe ? 'text-white' : 'text-zinc-300'}`}>
            {record.username || 'Unknown'}
          </span>
          {isMe && (
            <span className="text-[10px] font-bold bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">YOU</span>
          )}
        </div>

        {/* W/L/D */}
        <span className="font-mono text-xs text-emerald-400">{record.wins}W</span>
        <span className="font-mono text-xs text-rose-400">{record.losses}L</span>
        <span className="font-mono text-xs text-amber-400">{record.draws}D</span>

        {/* Streak */}
        <span className="font-mono text-xs text-orange-400">{record.streak >= 2 ? '\uD83D\uDD25' + record.streak : '-'}</span>

        {/* Score */}
        <span className="font-mono text-sm font-bold text-white w-12 text-right">{record.score}</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-zinc-950 text-white px-4 py-8 overflow-y-auto">

      <div className="w-full max-w-[420px]">

        {/* Streak badge */}
        {streak >= 2 && showStreak && (
          <div className="text-center mb-4">
            <span className="inline-block bg-orange-900/50 border border-orange-700/50 text-orange-400 text-sm font-bold px-4 py-1.5 rounded-full">
              {'\uD83D\uDD25'} {streak} Win Streak!
            </span>
          </div>
        )}

        {/* Result card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center mb-4">
          <div className="text-6xl mb-3">{getResultEmoji()}</div>
          <h1 className="text-2xl font-[800] font-syne text-white mb-1">{getResultTitle()}</h1>
          <p className="text-zinc-500 text-sm mb-2">{getResultSubtitle()}</p>
          {getReasonText() && (
            <p className="text-zinc-600 text-xs mb-2">{getReasonText()}</p>
          )}
          <p className={`text-lg font-bold font-mono ${getPointsColor()}`}>{getPointsDisplay()}</p>

          {/* Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              className="flex-1 border border-zinc-700 text-zinc-300 rounded-xl py-3 text-sm font-bold hover:bg-zinc-800 transition-all"
              onClick={onPlayAgain}
            >
              &larr; Home
            </button>
            <button
              className="flex-1 bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-zinc-200 active:scale-95 transition-all"
              onClick={onPlayAgain}
            >
              Play Again &rarr;
            </button>
          </div>
        </div>

        {/* Leaderboard card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-bold text-white">Leaderboard</span>
            <span className="text-xs font-bold tracking-widest text-zinc-600 uppercase">All Time</span>
          </div>

          {loadingLeaderboard ? (
            <div className="flex justify-center gap-2 py-8">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-zinc-600"
                     style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          ) : leaderboard.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-6">No records yet</p>
          ) : (
            <div className="space-y-1">
              {/* Top 10 rows */}
              {top10.map((record, index) => renderLeaderboardRow(record, index, index))}

              {/* Separator + user row if not in top 10 */}
              {showMyRow && (
                <>
                  <div className="flex items-center justify-center py-2 text-zinc-600 text-sm tracking-widest">
                    · · ·
                  </div>
                  {renderLeaderboardRow(leaderboard[myRank], myRank, myRank)}
                </>
              )}

              {/* View Complete Leaderboard button */}
              {hasMore && onViewLeaderboard && (
                <button
                  className="w-full mt-3 text-zinc-400 hover:text-white text-sm font-semibold py-2 transition-colors"
                  onClick={onViewLeaderboard}
                >
                  View Complete Leaderboard &rarr;
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;
