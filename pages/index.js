import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('create'); // create | join

  async function createRoom() {
    if (!name.trim()) return setError('Enter your name');
    setLoading(true); setError('');
    const res = await fetch('/api/room/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostName: name.trim() }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setLoading(false); return; }
    localStorage.setItem('playerId', data.playerId);
    localStorage.setItem(`playerId:${data.roomId}`, data.playerId);
    localStorage.setItem('playerName', name.trim());
    router.push(`/room/${data.roomId}`);
  }

  async function joinRoom() {
    if (!name.trim()) return setError('Enter your name');
    if (!roomCode.trim()) return setError('Enter room code');
    setLoading(true); setError('');
    const res = await fetch(`/api/room/${roomCode.trim().toUpperCase()}/join`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName: name.trim() }),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); setLoading(false); return; }
    const code = roomCode.trim().toUpperCase();
    localStorage.setItem('playerId', data.playerId);
    localStorage.setItem(`playerId:${code}`, data.playerId);
    localStorage.setItem('playerName', name.trim());
    router.push(`/room/${code}`);
  }

  return (
    <>
      <Head><title>Monopoly Online</title></Head>
      <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="bg-green-800 p-8 text-center">
            <div className="text-6xl mb-2">🎲</div>
            <h1 className="text-4xl font-black text-white tracking-tight">MONOPOLY</h1>
            <p className="text-green-300 mt-1 text-sm font-medium">Multiplayer Online</p>
          </div>

          <div className="p-8">
            {/* Tabs */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
              {['create', 'join'].map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${tab === t ? 'bg-white shadow text-green-800' : 'text-gray-500 hover:text-gray-700'}`}>
                  {t === 'create' ? '🏠 Create Room' : '🔗 Join Room'}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Your Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (tab === 'create' ? createRoom() : joinRoom())}
                  placeholder="Enter your name..."
                  className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 text-gray-900 font-medium" />
              </div>

              {tab === 'join' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Room Code</label>
                  <input value={roomCode} onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && joinRoom()}
                    placeholder="e.g. AB12CD"
                    maxLength={6}
                    className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:border-green-500 text-gray-900 font-mono font-bold text-lg tracking-widest uppercase" />
                </div>
              )}

              {error && <p className="text-red-600 text-sm font-medium bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button onClick={tab === 'create' ? createRoom : joinRoom} disabled={loading}
                className="w-full bg-green-700 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition-colors text-lg shadow-lg">
                {loading ? '...' : tab === 'create' ? 'Create Game' : 'Join Game'}
              </button>
            </div>

            <p className="text-center text-xs text-gray-400 mt-6">
              2–8 players • No account needed
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
