import React, { useState, useEffect } from 'react';
import { Client } from '@heroiclabs/nakama-js';
import nakamaClient from '../nakama';

interface LoginScreenProps {
  onLogin: () => void;
}

interface TopPlayer {
  username: string;
  wins: number;
  score: number;
}

const AVATAR_COLORS = [
  { bg: '#EEEDFE', tc: '#3C3489' },
  { bg: '#E1F5EE', tc: '#085041' },
  { bg: '#FAECE7', tc: '#712B13' },
];

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [nickname, setNickname] = useState(nakamaClient.getSavedUsername() || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);

  // Fetch top 3 players on mount using a temp anonymous session
  useEffect(() => {
    const fetchTop3 = async () => {
      try {
        const host = process.env.REACT_APP_NAKAMA_HOST || 'localhost';
        const port = process.env.REACT_APP_NAKAMA_PORT || '7350';
        const useSSL = process.env.REACT_APP_NAKAMA_SSL === 'true';
        const tempClient = new Client('defaultkey', host, port, useSSL, undefined, false);
        const session = await tempClient.authenticateDevice('ttt_leaderboard_viewer_001', true, 'viewer');
        const socket = tempClient.createSocket(useSSL, false);
        await socket.connect(session, false);
        const response = await socket.rpc('get_leaderboard', '{}');
        const data = typeof response.payload === 'string' ? JSON.parse(response.payload) : response.payload;
        const records = (data.records || []).slice(0, 3).map((r: any) => ({
          username: r.username || 'Unknown',
          wins: r.wins || 0,
          score: r.score || 0,
        }));
        setTopPlayers(records);
        socket.disconnect(false);
      } catch (e) {
        // Silently fail - top players preview is optional
      }
    };
    fetchTop3();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nickname.trim();
    if (!trimmed || loading) return;

    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('Name must be 2-20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('Only letters, numbers, and underscores allowed');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await nakamaClient.authenticate(trimmed);
      await nakamaClient.connect();
      onLogin();
    } catch (e: any) {
      let msg = 'Connection failed. Please try again.';
      if (e?.message) msg = e.message;
      else if (e?.status === 400) msg = 'Invalid username. Use 2-20 alphanumeric characters.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-zinc-950 text-white px-4">

      {/* Logo */}
      <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mb-6">
        <span className="text-3xl font-black text-white">#</span>
      </div>

      {/* Title */}
      <h1 className="text-4xl font-[800] font-syne text-white tracking-tight mb-1">
        TIC TAC TOE
      </h1>
      <p className="text-zinc-500 text-sm font-mono mb-10">
        The ultimate grid battle arena
      </p>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">
          Your Gamer Tag
        </label>

        <form onSubmit={handleSubmit}>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white font-mono placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors disabled:opacity-60 mb-4"
            type="text"
            placeholder="e.g. NeonShadow99"
            value={nickname}
            onChange={(e) => { setNickname(e.target.value); setError(null); }}
            maxLength={20}
            autoFocus
            disabled={loading}
          />

          {error && (
            <div className="text-red-400 text-sm text-center mb-4 bg-red-400/10 rounded-lg py-2 px-3">{error}</div>
          )}

          <button
            className="w-full bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            type="submit"
            disabled={!nickname.trim() || nickname.trim().length < 2 || loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                Connecting...
              </span>
            ) : 'Enter the Arena \u2192'}
          </button>
        </form>
      </div>

      {/* Top Players Preview */}
      {topPlayers.length > 0 && (
        <div className="w-full max-w-sm mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
          <p className="text-xs font-bold tracking-widest text-zinc-600 uppercase text-center mb-3">
            Top Players
          </p>
          <div className="space-y-2">
            {topPlayers.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-sm w-6 text-center">{medals[i]}</span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: AVATAR_COLORS[i].bg, color: AVATAR_COLORS[i].tc }}
                >
                  {p.username.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-zinc-300 text-sm font-semibold flex-1 truncate">{p.username}</span>
                <span className="font-mono text-xs text-zinc-500">{p.wins}W</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginScreen;
