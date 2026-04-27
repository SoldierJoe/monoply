import { useState } from 'react';
import { api } from '../apiClient.js';
import { TOKEN_GLYPHS } from '../tokens.js';

export default function Lobby({ room, selfId, onLeave }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const isHost = room.hostId === selfId;
  const canStart = isHost && room.players.length >= 2;

  async function startGame() {
    setError(null);
    setBusy(true);
    try {
      await api.startGame(room.code);
    } catch (err) {
      setError(err.message || 'Failed to start');
    } finally {
      setBusy(false);
    }
  }

  async function addBot() {
    setError(null);
    setBusy(true);
    try {
      await api.addBot(room.code);
    } catch (err) {
      setError(err.message || 'Failed to add bot');
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (navigator.clipboard) navigator.clipboard.writeText(room.code).catch(() => {});
  }

  return (
    <main className="lobby">
      <div className="lobby__card">
        <p className="lobby__eyebrow">Lobby</p>
        <h2 className="lobby__title">Room code</h2>
        <button className="lobby__code" onClick={copyCode} title="Click to copy">
          {room.code}
        </button>
        <p className="lobby__hint">Share this code with friends to let them join.</p>

        <div className="lobby__divider" />

        <p className="lobby__section-label">Players ({room.players.length}/6)</p>
        <ul className="lobby__players">
          {room.players.map((p) => (
            <li key={p.id} className={`lobby__player ${p.id === selfId ? 'is-self' : ''}`}>
              <span className="lobby__token" aria-hidden>{TOKEN_GLYPHS[p.token] ?? '·'}</span>
              <span className="lobby__pname">
                {p.name}
                {p.id === room.hostId && <span className="lobby__host"> · host</span>}
                {p.id === selfId && <span className="lobby__you"> · you</span>}
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, 2 - room.players.length) }).map((_, i) => (
            <li key={`empty-${i}`} className="lobby__player lobby__player--empty">
              <span className="lobby__token" aria-hidden>·</span>
              <span className="lobby__pname">Waiting for player…</span>
            </li>
          ))}
        </ul>

        <div className="lobby__divider" />

        <div className="lobby__actions">
          {isHost ? (
            <>
              {room.players.length < 6 && (
                <button className="btn-secondary" disabled={busy} onClick={addBot}>
                  Add Bot Player
                </button>
              )}
              <button className="btn-primary" disabled={!canStart || busy} onClick={startGame}>
                {room.players.length < 2 ? 'Need 2+ players' : 'Start Game'}
              </button>
            </>
          ) : (
            <p className="lobby__waiting">Waiting for host to start the game…</p>
          )}
          <button className="btn-ghost" onClick={onLeave}>Leave Room</button>
        </div>

        {error && <p className="lobby__error">{error}</p>}
      </div>

      <style>{`
        .lobby { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 4rem 1.5rem 2rem; }
        .lobby__card {
          width: 100%; max-width: 460px;
          background: var(--bg-raised);
          border: 1px solid var(--line);
          border-radius: var(--radius-lg);
          padding: 2.5rem 2.5rem;
          box-shadow: 0 1px 0 rgba(212, 165, 116, 0.08) inset, 0 24px 60px rgba(0, 0, 0, 0.6);
        }
        .lobby__eyebrow {
          font-size: 0.65rem; letter-spacing: 0.32em; text-transform: uppercase;
          color: var(--gold); margin: 0 0 0.5rem; text-align: center;
        }
        .lobby__title {
          font-family: var(--font-display); font-style: italic;
          color: var(--muted); text-align: center; margin: 0 0 0.5rem;
          font-size: 1rem; font-weight: 400;
        }
        .lobby__code {
          display: block; width: 100%;
          background: transparent; border: 1px dashed var(--gold-deep);
          color: var(--gold-bright);
          font-family: var(--font-display); font-size: 2.5rem; font-weight: 900;
          letter-spacing: 0.5em; text-indent: 0.5em;
          padding: 1rem; border-radius: var(--radius);
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .lobby__code:hover { border-color: var(--gold-bright); color: var(--cream); }
        .lobby__hint { color: var(--muted); font-size: 0.8rem; text-align: center; margin: 0.5rem 0 0; }
        .lobby__divider {
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, var(--gold-deep) 30%, var(--gold-deep) 70%, transparent 100%);
          margin: 2rem 0; opacity: 0.4;
        }
        .lobby__section-label {
          font-size: 0.65rem; letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--muted); margin: 0 0 1rem;
        }
        .lobby__players { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
        .lobby__player {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          background: var(--bg);
          border: 1px solid var(--line);
          border-radius: var(--radius);
        }
        .lobby__player.is-self { border-color: var(--gold-deep); }
        .lobby__player--empty { opacity: 0.4; }
        .lobby__token { font-size: 1.25rem; width: 1.5rem; text-align: center; }
        .lobby__pname { color: var(--cream); font-size: 0.95rem; }
        .lobby__host { color: var(--gold); font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; }
        .lobby__you { color: var(--muted); font-size: 0.75rem; letter-spacing: 0.15em; text-transform: uppercase; }
        .lobby__actions { display: flex; flex-direction: column; gap: 0.75rem; }
        .lobby__waiting { color: var(--muted); font-size: 0.85rem; text-align: center; margin: 0 0 0.5rem; font-style: italic; }
        .lobby__error { color: var(--danger); font-size: 0.8rem; text-align: center; margin: 1rem 0 0; }
      `}</style>
    </main>
  );
}
