import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { BOARD_SQUARES, PLAYER_COLORS, PLAYER_TOKENS } from '../../lib/boardData';

const Board = dynamic(() => import('../../components/Board'), { ssr: false });

export default function RoomPage() {
  const router = useRouter();
  const { id: roomId } = router.query;
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPlayerId(localStorage.getItem('playerId') || '');
      setPlayerName(localStorage.getItem('playerName') || '');
    }
  }, []);

  const fetchState = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/room/${roomId}/state`);
      if (res.ok) setGameState(await res.json());
    } catch {}
  }, [roomId]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 1500);
    return () => clearInterval(interval);
  }, [fetchState]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState?.log]);

  async function doAction(action, extra = {}) {
    setLoading(true); setError('');
    const res = await fetch(`/api/room/${roomId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, playerId, ...extra }),
    });
    const data = await res.json();
    if (data.error) setError(data.error);
    await fetchState();
    setLoading(false);
  }

  if (!gameState) return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading room...</div>
    </div>
  );

  const me = gameState.players.find(p => p.id === playerId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === playerId;
  const pending = gameState.pendingAction;
  const pendingSquare = pending ? BOARD_SQUARES[pending.squareId] : null;

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <Head><title>Monopoly – Room {roomId}</title></Head>
      <div className="min-h-screen bg-green-900 p-2 md:p-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div>
              <h1 className="text-2xl font-black text-white">🎲 MONOPOLY</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-green-300 text-sm font-mono font-bold">Room: {roomId}</span>
                <button onClick={() => navigator.clipboard?.writeText(shareUrl)}
                  className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-0.5 rounded font-medium transition">
                  Copy Link
                </button>
              </div>
            </div>
            {gameState.status === 'lobby' && gameState.host === playerName && (
              <button onClick={() => doAction('start')} disabled={loading || gameState.players.length < 2}
                className="bg-yellow-400 hover:bg-yellow-300 disabled:bg-gray-400 text-black font-bold px-6 py-2 rounded-lg shadow-lg text-sm transition">
                {gameState.players.length < 2 ? 'Need 2+ players' : '▶ Start Game'}
              </button>
            )}
            {gameState.status === 'ended' && (
              <span className="text-yellow-300 font-bold text-lg">🏆 Game Over!</span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            {/* Board */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <Board gameState={gameState} />
            </div>

            {/* Sidebar */}
            <div className="flex flex-col gap-3">
              {/* Status / Actions */}
              <div className="bg-white rounded-xl shadow p-4">
                {gameState.status === 'lobby' ? (
                  <div>
                    <h2 className="font-bold text-gray-800 mb-2">⏳ Waiting for players</h2>
                    <p className="text-sm text-gray-500">Share the room link or code <strong>{roomId}</strong></p>
                  </div>
                ) : gameState.status === 'ended' ? (
                  <div>
                    <h2 className="font-bold text-gray-800">🏆 Game Ended</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {gameState.players.find(p => !p.bankrupt)?.name} wins!
                    </p>
                    <button onClick={() => router.push('/')} className="mt-3 w-full bg-green-700 text-white rounded-lg py-2 text-sm font-bold hover:bg-green-600 transition">
                      Play Again
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full animate-pulse"
                        style={{ backgroundColor: PLAYER_COLORS[currentPlayer?.tokenIndex % 8] }} />
                      <span className="font-semibold text-sm text-gray-800">
                        {isMyTurn ? "Your turn!" : `${currentPlayer?.name}'s turn`}
                      </span>
                      {gameState.dice && (
                        <span className="ml-auto text-lg">
                          {['⚀','⚁','⚂','⚃','⚄','⚅'][gameState.dice[0]-1]}
                          {['⚀','⚁','⚂','⚃','⚄','⚅'][gameState.dice[1]-1]}
                        </span>
                      )}
                    </div>

                    {error && <p className="text-red-600 text-xs bg-red-50 px-2 py-1 rounded mb-2">{error}</p>}

                    {isMyTurn && (
                      <div className="space-y-2">
                        {/* Buy prompt */}
                        {pending?.type === 'buy_property' && pendingSquare && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <p className="text-sm font-semibold text-yellow-800 mb-2">
                              Buy {pendingSquare.name}?
                            </p>
                            <p className="text-xs text-yellow-700 mb-3">
                              Price: <strong>${pendingSquare.price}</strong> &nbsp;|&nbsp; You have: <strong>${me?.money}</strong>
                            </p>
                            <div className="flex gap-2">
                              <button onClick={() => doAction('buy', { squareId: pending.squareId })}
                                disabled={loading || me?.money < pendingSquare.price}
                                className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-xs font-bold py-2 rounded transition">
                                Buy ✓
                              </button>
                              <button onClick={() => doAction('decline_buy')} disabled={loading}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold py-2 rounded transition">
                                Pass ✗
                              </button>
                            </div>
                          </div>
                        )}

                        {!pending && (
                          <>
                            <button onClick={() => doAction('roll')}
                              disabled={loading || gameState.hasRolled}
                              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-lg transition text-sm shadow">
                              🎲 Roll Dice
                            </button>
                            <button onClick={() => doAction('end_turn')}
                              disabled={loading || !gameState.hasRolled}
                              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-lg transition text-sm shadow">
                              End Turn →
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {!isMyTurn && (
                      <p className="text-gray-500 text-sm text-center py-1">
                        Waiting for {currentPlayer?.name}...
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Players */}
              <div className="bg-white rounded-xl shadow p-4">
                <h2 className="font-bold text-gray-800 text-sm mb-3">Players</h2>
                <div className="space-y-2">
                  {gameState.players.map((p, i) => (
                    <div key={p.id}
                      className={`flex items-center gap-2 p-2 rounded-lg ${p.id === playerId ? 'bg-green-50 border border-green-200' : 'bg-gray-50'} ${p.bankrupt ? 'opacity-40' : ''}`}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: PLAYER_COLORS[p.tokenIndex % 8] }}>
                        {PLAYER_TOKENS[p.tokenIndex % 8]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">
                          {p.name} {p.id === playerId && '(you)'}
                          {p.bankrupt && ' 💀'}
                          {currentPlayer?.id === p.id && gameState.status === 'playing' && ' 🔄'}
                        </p>
                        <p className="text-xs text-gray-500">${p.money.toLocaleString()}</p>
                      </div>
                      {p.inJail && <span className="text-xs bg-orange-100 text-orange-700 px-1 rounded font-medium">🔒</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* My properties */}
              {me && (
                <div className="bg-white rounded-xl shadow p-4">
                  <h2 className="font-bold text-gray-800 text-sm mb-2">My Properties</h2>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {Object.entries(gameState.properties)
                      .filter(([, p]) => p.ownerId === playerId)
                      .map(([sid]) => {
                        const sq = BOARD_SQUARES[+sid];
                        return (
                          <div key={sid} className="flex items-center gap-2 text-xs">
                            {sq.color && <div className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: { brown:'#8B4513',lightblue:'#87CEEB',pink:'#FF69B4',orange:'#FF8C00',red:'#DC143C',yellow:'#FFD700',green:'#228B22',darkblue:'#00008B' }[sq.color] }} />}
                            <span className="text-gray-700 truncate">{sq.name}</span>
                            {gameState.status === 'playing' && isMyTurn && sq.houseCost && !gameState.pendingAction && (
                              <button onClick={() => doAction('build_house', { squareId: +sid })}
                                className="ml-auto text-green-700 hover:text-green-600 font-bold text-xs flex-shrink-0">+🏠</button>
                            )}
                          </div>
                        );
                      })}
                    {Object.values(gameState.properties).filter(p => p.ownerId === playerId).length === 0 && (
                      <p className="text-xs text-gray-400">No properties yet</p>
                    )}
                  </div>
                </div>
              )}

              {/* Log */}
              <div className="bg-white rounded-xl shadow p-4 flex-1">
                <h2 className="font-bold text-gray-800 text-sm mb-2">Game Log</h2>
                <div className="space-y-1 max-h-48 overflow-y-auto text-xs text-gray-600">
                  {gameState.log.slice(-20).map((entry, i) => (
                    <p key={i} className="py-0.5 border-b border-gray-50">{entry}</p>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
