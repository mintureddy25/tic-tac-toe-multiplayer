import React, { useState, useEffect } from 'react';
import nakamaClient from '../nakama';

interface LeaderboardRecord {
  ownerId: string;
  username: string;
  score: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
}

interface LeaderboardPageProps {
  onBack: () => void;
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

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ onBack }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = nakamaClient.getUserId();

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await nakamaClient.getLeaderboard();
        setLeaderboard(data.records || []);
      } catch (e) {}
      finally { setLoading(false); }
    };
    fetch();
  }, []);

  const getRankMedal = (index: number) => {
    switch (index) {
      case 0: return '\uD83E\uDD47';
      case 1: return '\uD83E\uDD48';
      case 2: return '\uD83E\uDD49';
      default: return `${index + 1}`;
    }
  };

  const getAvatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length];

  return (
    <div className="min-h-screen w-full flex flex-col items-center bg-zinc-950 text-white px-4 py-8">

      {/* Header */}
      <div className="w-full max-w-[500px] mb-6">
        <button
          className="text-zinc-400 hover:text-white text-sm transition-colors mb-6 flex items-center gap-1"
          onClick={onBack}
        >
          &larr; Back
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-[800] font-syne text-white">Leaderboard</h1>
          <span className="text-xs font-bold tracking-widest text-zinc-600 uppercase">All Time</span>
        </div>
      </div>

      {/* Leaderboard Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 w-full max-w-[500px]">

        {loading ? (
          <div className="flex justify-center gap-2 py-12">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2.5 h-2.5 rounded-full bg-zinc-600"
                   style={{ animation: 'dotPulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 text-sm">No players yet</p>
            <p className="text-zinc-600 text-xs mt-2">Play a game to get on the board!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {leaderboard.map((record, index) => {
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
                  <span className="text-sm w-6 text-center">{getRankMedal(index)}</span>

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${colors.bg} ${colors.text}`}>
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
            })}
          </div>
        )}
      </div>

      {/* Scoring Info */}
      <div className="mt-6 text-center text-zinc-600 text-xs max-w-[400px]">
        <p className="mb-1">Win: +30 to +50 pts (faster wins = more points)</p>
        <p>Loss: -20 pts &middot; Draw: +20 pts each</p>
      </div>
    </div>
  );
};

export default LeaderboardPage;
