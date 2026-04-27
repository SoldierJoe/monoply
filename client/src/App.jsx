import { useState } from 'react';
import { api, playerId } from './apiClient.js';
import { useRoomConsumer } from './useRoomConsumer.js';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';

export default function App() {
  const [code, setCode] = useState(null);
  const [name, setName] = useState('');

  const { room, status, error } = useRoomConsumer(code);

  // Connection pill maps to the consumer's transport state.
  const connStatus = !code
    ? 'connected'
    : status === 'connected' ? 'connected'
    : status === 'error' ? 'error'
    : 'connecting';

  const view = !code ? 'home'
    : !room ? 'connecting'
    : room.phase === 'lobby' ? 'lobby'
    : 'game';

  async function leaveRoom() {
    if (code) {
      try { await api.leaveRoom(code); } catch {}
    }
    setCode(null);
  }

  return (
    <>
      <ConnectionPill status={connStatus} />
      {view === 'home' && (
        <Home
          connStatus={connStatus}
          name={name}
          setName={setName}
          onJoined={(joinedCode) => setCode(joinedCode)}
        />
      )}
      {view === 'connecting' && (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <p style={{ color: 'var(--muted)' }}>
            {error ? `Connecting… (${error})` : 'Loading room…'}
          </p>
        </main>
      )}
      {view === 'lobby' && room && (
        <Lobby room={room} selfId={playerId} onLeave={leaveRoom} />
      )}
      {view === 'game' && room && (
        <Game room={room} selfId={playerId} onLeave={leaveRoom} />
      )}
    </>
  );
}

function ConnectionPill({ status }) {
  const label = {
    connecting: 'Connecting',
    connected:  'Online',
    error:      'Offline',
  }[status] ?? 'Idle';

  const className = `status-pill ${
    status === 'connected' ? 'is-connected' : status === 'error' ? 'is-error' : ''
  }`;

  return (
    <div className={className}>
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}
