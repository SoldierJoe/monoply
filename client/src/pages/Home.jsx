import { useState } from 'react';
import { api } from '../apiClient.js';

export default function Home({ connStatus, name, setName, onJoined }) {
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = name.trim().length > 0 && !busy;

  async function createRoom() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.createRoom(name.trim());
      onJoined(res.code);
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.joinRoom(roomCode.trim(), name.trim());
      onJoined(res.code);
    } catch (err) {
      setError(err.message || 'Failed to join room');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="home">
      <div className="home__card">
        <DecoOrnament />

        <header className="home__header">
          <p className="home__eyebrow">est. 1935 · played in cairo</p>
          <h1 className="home__title">Cairo</h1>
          <p className="home__subtitle">A Monopoly for the city of a thousand minarets</p>
        </header>

        <div className="home__divider" />

        <div className="home__form">
          <div>
            <label className="label" htmlFor="name">Your Name</label>
            <input
              id="name"
              className="input"
              type="text"
              placeholder="e.g. Mohamed"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="home__actions">
            <button
              className="btn-primary"
              disabled={!canSubmit}
              onClick={createRoom}
            >
              Create Room
            </button>
            <span className="home__or">or</span>
            <div className="home__join">
              <input
                className="input"
                type="text"
                placeholder="ROOM CODE"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <button
                className="btn-ghost"
                disabled={!canSubmit || roomCode.length < 6}
                onClick={joinRoom}
              >
                Join
              </button>
            </div>
          </div>

          {error && <p className="home__error">{error}</p>}
        </div>
      </div>

      <Footer />

      <style>{`
        .home {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1.5rem 2rem;
          position: relative;
          z-index: 1;
        }
        .home__card {
          width: 100%;
          max-width: 460px;
          background: var(--bg-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 3rem 2.5rem;
          position: relative;
          box-shadow:
            0 1px 0 rgba(212, 165, 116, 0.08) inset,
            0 24px 60px rgba(0, 0, 0, 0.6);
        }
        .home__header { text-align: center; }
        .home__eyebrow {
          font-size: 0.65rem;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--gold);
          margin: 0 0 1rem;
        }
        .home__title {
          font-family: var(--font-display);
          font-weight: 900;
          font-size: 4.5rem;
          line-height: 1;
          color: var(--cream);
          margin: 0;
          font-style: italic;
          letter-spacing: -0.02em;
        }
        .home__subtitle {
          font-family: var(--font-display);
          font-style: italic;
          color: var(--muted);
          margin: 1rem 0 0;
          font-size: 0.95rem;
        }
        .home__divider {
          height: 1px;
          background: linear-gradient(90deg,
            transparent 0%,
            var(--gold-deep) 30%,
            var(--gold-deep) 70%,
            transparent 100%);
          margin: 2rem 0;
          opacity: 0.5;
        }
        .home__form { display: flex; flex-direction: column; gap: 1.5rem; }
        .home__actions {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          align-items: stretch;
        }
        .home__or {
          align-self: center;
          color: var(--muted);
          font-size: 0.7rem;
          letter-spacing: 0.3em;
          text-transform: uppercase;
        }
        .home__join { display: flex; gap: 0.5rem; }
        .home__join .input { flex: 1; letter-spacing: 0.2em; text-align: center; }
        .home__error {
          color: var(--danger);
          font-size: 0.8rem;
          text-align: center;
          margin: 0;
        }
      `}</style>
    </main>
  );
}

function DecoOrnament() {
  return (
    <svg
      width="80"
      height="40"
      viewBox="0 0 80 40"
      style={{ display: 'block', margin: '0 auto 1.5rem' }}
      aria-hidden
    >
      <g stroke="var(--gold)" strokeWidth="1" fill="none" opacity="0.85">
        <path d="M 10 38 A 30 30 0 0 1 70 38" />
        <path d="M 18 38 A 22 22 0 0 1 62 38" />
        <path d="M 26 38 A 14 14 0 0 1 54 38" />
        <path d="M 34 38 A 6 6 0 0 1 46 38" />
        <line x1="40" y1="38" x2="40" y2="6" />
        <line x1="40" y1="38" x2="22" y2="14" />
        <line x1="40" y1="38" x2="58" y2="14" />
      </g>
      <circle cx="40" cy="38" r="2" fill="var(--gold)" />
    </svg>
  );
}

function Footer() {
  return (
    <footer
      style={{
        marginTop: '2rem',
        fontSize: '0.7rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
        textAlign: 'center',
      }}
    >
      Cairo Monopoly
    </footer>
  );
}
