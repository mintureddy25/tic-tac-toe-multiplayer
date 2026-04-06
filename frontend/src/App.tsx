import React, { useState, useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import './App.css';
import nakamaClient from './nakama';
import LoginScreen from './components/LoginScreen';
import MatchmakingScreen from './components/MatchmakingScreen';
import GameBoard, { GameResult } from './components/GameBoard';
import GameOverScreen from './components/GameOverScreen';
import LeaderboardPage from './components/LeaderboardPage';

type GameMode = 'classic' | 'timed';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authenticated, setAuthenticated] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentMatchId, setCurrentMatchId] = useState('');
  const [currentMode, setCurrentMode] = useState<GameMode>('classic');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [screen, setScreen] = useState<'matchmaking' | 'game' | 'gameover'>('matchmaking');

  // Auto-login on mount if saved username exists
  useEffect(() => {
    const autoLogin = async () => {
      const saved = nakamaClient.getSavedUsername();
      if (saved) {
        try {
          await nakamaClient.authenticate(saved);
          await nakamaClient.connect();
          setAuthenticated(true);
          // If on login page, go to play
          if (location.pathname === '/') {
            navigate('/play');
          }
        } catch (e) {
          // Failed, show login
        }
      }
      setInitializing(false);
    };
    autoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback(() => {
    setAuthenticated(true);
    navigate('/play');
  }, [navigate]);

  const handleMatchFound = useCallback((matchId: string, mode: GameMode) => {
    setCurrentMatchId(matchId);
    setCurrentMode(mode);
    setGameResult(null);
    setScreen('game');
  }, []);

  const handleGameOver = useCallback((result: GameResult) => {
    setGameResult(result);
    setScreen('gameover');
  }, []);

  const handleLeaveGame = useCallback(() => {
    setCurrentMatchId('');
    setScreen('matchmaking');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setCurrentMatchId('');
    setGameResult(null);
    setScreen('matchmaking');
  }, []);

  const handleLogout = useCallback(() => {
    nakamaClient.disconnect();
    localStorage.removeItem('ttt_username');
    setAuthenticated(false);
    navigate('/');
  }, [navigate]);

  if (initializing) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center" style={{ background: '#1a1a2e' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-teal/30 border-t-teal rounded-full animate-spin" />
          <span className="text-teal text-sm font-semibold">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={
          authenticated ? (
            <PlayPage
              screen={screen}
              currentMatchId={currentMatchId}
              currentMode={currentMode}
              gameResult={gameResult}
              onMatchFound={handleMatchFound}
              onGameOver={handleGameOver}
              onLeaveGame={handleLeaveGame}
              onPlayAgain={handlePlayAgain}
              onLogout={handleLogout}
            />
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )
        } />
        <Route path="/play" element={
          authenticated ? (
            <PlayPage
              screen={screen}
              currentMatchId={currentMatchId}
              currentMode={currentMode}
              gameResult={gameResult}
              onMatchFound={handleMatchFound}
              onGameOver={handleGameOver}
              onLeaveGame={handleLeaveGame}
              onPlayAgain={handlePlayAgain}
              onLogout={handleLogout}
            />
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )
        } />
        <Route path="/leaderboard" element={
          authenticated ? (
            <LeaderboardPage onBack={() => navigate('/play')} />
          ) : (
            <LoginScreen onLogin={handleLogin} />
          )
        } />
      </Routes>
    </div>
  );
}

interface PlayPageProps {
  screen: 'matchmaking' | 'game' | 'gameover';
  currentMatchId: string;
  currentMode: GameMode;
  gameResult: GameResult | null;
  onMatchFound: (matchId: string, mode: GameMode) => void;
  onGameOver: (result: GameResult) => void;
  onLeaveGame: () => void;
  onPlayAgain: () => void;
  onLogout: () => void;
}

function PlayPage({ screen, currentMatchId, currentMode, gameResult, onMatchFound, onGameOver, onLeaveGame, onPlayAgain, onLogout }: PlayPageProps) {
  const navigate = useNavigate();

  return (
    <>
      {screen === 'matchmaking' && (
        <MatchmakingScreen
          onMatchFound={onMatchFound}
          onCancel={onLogout}
        />
      )}
      {screen === 'game' && currentMatchId && (
        <GameBoard
          key={currentMatchId}
          matchId={currentMatchId}
          mode={currentMode}
          onGameOver={onGameOver}
          onLeave={onLeaveGame}
        />
      )}
      {screen === 'gameover' && gameResult && (
        <GameOverScreen
          result={gameResult}
          onPlayAgain={onPlayAgain}
          onViewLeaderboard={() => navigate('/leaderboard')}
        />
      )}

      {/* Floating nav - show on matchmaking and gameover screens */}
      {(screen === 'matchmaking' || screen === 'gameover') && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            className="bg-zinc-900 border border-zinc-700 text-zinc-300 px-4 py-2 rounded-full text-sm font-bold hover:bg-zinc-800 hover:text-white transition-all duration-200 shadow-lg"
            onClick={() => navigate('/leaderboard')}
          >
            &#127942; Leaderboard
          </button>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
