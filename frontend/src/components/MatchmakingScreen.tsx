import React, { useState, useEffect } from 'react';
import nakamaClient from '../nakama';

type GameMode = 'classic' | 'timed';

interface MatchmakingScreenProps {
  onMatchFound: (matchId: string, mode: GameMode) => void;
  onCancel: () => void;
}

type Tab = 'random' | 'join' | 'create';

const MatchmakingScreen: React.FC<MatchmakingScreenProps> = ({ onMatchFound, onCancel }) => {
  const [mode, setMode] = useState<GameMode>('classic');
  const [searching, setSearching] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [joinMatchId, setJoinMatchId] = useState('');
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('random');
  // Timer for search duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (searching) {
      interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [searching]);

  // Fetch online player count
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const socket = nakamaClient.getSocket();
        if (socket) {
          const response = await socket.rpc('get_online_count', '{}');
          const data = typeof response.payload === 'string' ? JSON.parse(response.payload) : response.payload;
          setOnlineCount(data.count || 0);
        }
      } catch (e) {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  const startSearch = async () => {
    setSearching(true);
    setElapsed(0);
    setError(null);
    try {
      const matchId = await nakamaClient.findMatch(mode);
      if (matchId) {
        setSearching(false);
        onMatchFound(matchId, mode);
      }
    } catch (e: any) {
      console.error('Find match error:', e);
      setError('Failed to find match: ' + (e?.message || 'Unknown error'));
      setSearching(false);
    }
  };

  const cancelSearch = () => {
    setSearching(false);
    setElapsed(0);
  };

  const createRoom = async () => {
    try {
      setError(null);
      const matchId = await nakamaClient.createMatch(mode);
      setCreatedMatchId(matchId);
    } catch (e: any) {
      setError('Failed to create room: ' + (e?.message || 'Unknown error'));
    }
  };

  const joinCreatedRoom = () => {
    if (createdMatchId) {
      onMatchFound(createdMatchId, mode);
    }
  };

  const handleJoinWithCode = () => {
    if (joinMatchId.trim()) {
      onMatchFound(joinMatchId.trim(), mode);
    }
  };

  const copyToClipboard = () => {
    if (createdMatchId) {
      navigator.clipboard.writeText(createdMatchId).catch(() => {});
    }
  };

  const username = nakamaClient.getUsername() || '?';

  return (
    <div className="min-h-screen w-full flex flex-col bg-zinc-950 text-white px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between max-w-[480px] w-full mx-auto mb-8">
        <button
          className="text-zinc-400 hover:text-white text-sm transition-colors flex items-center gap-1"
          onClick={onCancel}
        >
          &larr; Back
        </button>
        <span className="text-xs font-bold tracking-widest text-zinc-600 uppercase">Matchmaking</span>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-emerald-900 text-emerald-400 flex items-center justify-center text-xs font-bold">
            {username.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-zinc-400">{username}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center max-w-[480px] w-full mx-auto">
        {/* Title */}
        <h1 className="text-2xl font-[800] font-syne text-white mb-1">Find a Match</h1>
        <p className="text-zinc-500 text-sm mb-6">Choose how you want to play</p>

        {/* Mode toggle */}
        <div className="mb-6 w-full">
          <span className="block text-xs font-bold tracking-widest text-zinc-600 uppercase mb-2">Game Mode</span>
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'classic' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => setMode('classic')}
            >
              Classic
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'timed' ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => setMode('timed')}
            >
              Timed (30s)
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-full mb-4">
          {([
            { key: 'random' as Tab, label: '\u26A1 Random' },
            { key: 'join' as Tab, label: '\uD83D\uDD17 Join' },
            { key: 'create' as Tab, label: '\uD83C\uDFE0 Create' },
          ]).map((tab) => (
            <button
              key={tab.key}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab.key ? 'bg-white text-black' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              onClick={() => { setActiveTab(tab.key); setError(null); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full min-h-[200px] flex flex-col items-center justify-center">
          {error && (
            <div className="text-red-400 text-sm mb-4 bg-red-400/10 rounded-lg py-2.5 px-4 w-full text-center">
              {error}
            </div>
          )}

          {/* Random tab */}
          {activeTab === 'random' && !searching && (
            <>
              <span className="text-5xl mb-4">{'\u26A1'}</span>
              <p className="text-zinc-400 text-sm mb-6 text-center">Get matched with a random opponent instantly</p>
              <button
                className="w-full bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-zinc-200 active:scale-95 transition-all"
                onClick={startSearch}
              >
                Find Random Player
              </button>
            </>
          )}

          {activeTab === 'random' && searching && (
            <>
              <div className="flex gap-1.5 mb-4">
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
              <p className="text-white font-bold mb-1">Searching for opponent...</p>
              <p className="text-zinc-500 text-sm font-mono mb-6">{elapsed}s elapsed</p>
              <button
                className="border border-zinc-700 text-zinc-300 rounded-xl py-2.5 px-8 text-sm font-bold hover:bg-zinc-800 transition-all"
                onClick={cancelSearch}
              >
                Cancel
              </button>
            </>
          )}

          {/* Join tab */}
          {activeTab === 'join' && (
            <>
              <span className="text-5xl mb-4">{'\uD83D\uDD17'}</span>
              <label className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Room Code</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-white font-mono text-center uppercase placeholder-zinc-600 outline-none focus:border-zinc-500 transition-colors mb-4"
                type="text"
                placeholder="Paste match ID..."
                value={joinMatchId}
                onChange={(e) => setJoinMatchId(e.target.value)}
                autoFocus
              />
              <button
                className="w-full bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-zinc-200 active:scale-95 transition-all disabled:opacity-40"
                disabled={!joinMatchId.trim()}
                onClick={handleJoinWithCode}
              >
                Join Room &rarr;
              </button>
            </>
          )}

          {/* Create tab */}
          {activeTab === 'create' && !createdMatchId && (
            <>
              <span className="text-5xl mb-4">{'\uD83C\uDFE0'}</span>
              <p className="text-zinc-400 text-sm mb-6 text-center">Create a private room and invite a friend</p>
              <button
                className="w-full bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-zinc-200 active:scale-95 transition-all"
                onClick={createRoom}
              >
                Generate Room Code
              </button>
            </>
          )}

          {activeTab === 'create' && createdMatchId && (
            <>
              <p className="text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Room Code</p>
              <div className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 mb-4 w-full">
                <p className="font-mono text-sm text-white break-all select-all text-center">{createdMatchId}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  className="flex-1 border border-zinc-700 text-zinc-300 rounded-xl py-3 text-sm font-bold hover:bg-zinc-800 transition-all"
                  onClick={copyToClipboard}
                >
                  Copy
                </button>
                <button
                  className="flex-1 bg-white text-black font-bold rounded-xl py-3 text-sm hover:bg-zinc-200 active:scale-95 transition-all"
                  onClick={joinCreatedRoom}
                >
                  Start &rarr;
                </button>
              </div>
              <button
                className="text-zinc-500 text-sm mt-4 hover:text-zinc-300 transition-colors"
                onClick={() => setCreatedMatchId(null)}
              >
                &larr; Back
              </button>
            </>
          )}
        </div>

        {/* Online indicator */}
        <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl mt-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-zinc-500 text-xs">
            {onlineCount !== null ? (
              <><span className="text-zinc-300 font-mono font-bold">{onlineCount}</span> player{onlineCount !== 1 ? 's' : ''} online right now</>
            ) : (
              'Checking players online...'
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MatchmakingScreen;
