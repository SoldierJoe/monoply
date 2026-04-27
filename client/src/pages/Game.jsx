import { useEffect, useRef, useState } from 'react';
import { api } from '../apiClient.js';
import Board from '../components/Board.jsx';
import { TOKEN_GLYPHS, TOKEN_COLORS } from '../tokens.js';
import { sfx, isSoundEnabled, setSoundEnabled } from '../sound.js';

export default function Game({ room, selfId, onLeave }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const [selectedTileIdx, setSelectedTileIdx] = useState(null);
  const prevRoom = useRef(room);

  const me = room.players.find(p => p.id === selfId);
  const isMyTurn = room.turn.currentPlayerId === selfId;
  const currentPlayer = room.players.find(p => p.id === room.turn.currentPlayerId);
  const winner = room.turn.winnerId ? room.players.find(p => p.id === room.turn.winnerId) : null;

  useEffect(() => {
    const prev = prevRoom.current;
    if (prev) {
      // Dice rolled
      if (room.turn.lastRoll && prev.turn.lastRoll?.d1 !== room.turn.lastRoll.d1) {
        sfx.diceRoll();
        setTimeout(() => sfx.move(), 250);
      }
      // Pawn moved (any player position changed)
      const prevPositions = new Map(prev.players.map(p => [p.id, p.position]));
      for (const p of room.players) {
        if (prevPositions.get(p.id) !== p.position && prev.turn.lastRoll?.d1 === room.turn.lastRoll?.d1) {
          // sound already played for the dice; nothing extra
        }
      }
      // Property changed owner
      const prevOwners = new Map(prev.board.map(t => [t.idx, t.ownerId]));
      for (const t of room.board) {
        if (prevOwners.get(t.idx) !== t.ownerId && t.ownerId) sfx.buy();
      }
      // New jail entries
      for (const p of room.players) {
        const wasFree = !prev.players.find(x => x.id === p.id)?.inJail;
        if (wasFree && p.inJail) sfx.jail();
      }
      // Bankruptcy
      for (const p of room.players) {
        const wasAlive = !prev.players.find(x => x.id === p.id)?.bankrupt;
        if (wasAlive && p.bankrupt) sfx.bankrupt();
      }
      // Win
      if (prev.phase !== 'ended' && room.phase === 'ended') sfx.win();
      // Your turn just started
      const wasMyTurn = prev.turn.currentPlayerId === selfId;
      if (!wasMyTurn && isMyTurn && room.phase === 'playing') sfx.yourTurn();
      // Rent paid (cash decreased on a non-turn player)
      for (const p of room.players) {
        const before = prev.players.find(x => x.id === p.id);
        if (!before) continue;
        if (p.cash < before.cash && p.id !== prev.turn.currentPlayerId) {
          // landed-on someone else's tile and paid — only fires for the lander though
        }
        if (before.cash > p.cash && before.id === prev.turn.currentPlayerId && room.turn.lastRoll) {
          // current player paid rent or tax — generic "rent" sound
          if (!prev.turn.pendingPurchaseTileIdx && !room.turn.pendingPurchaseTileIdx) {
            sfx.rent();
          }
        }
      }
    }
    prevRoom.current = room;
  }, [room, selfId, isMyTurn]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  const actions = {
    'turn:roll':    () => api.rollDice(room.code),
    'turn:buy':     () => api.buy(room.code),
    'turn:decline': () => api.decline(room.code),
    'turn:end':     () => api.endTurn(room.code),
    'jail:pay':     () => api.payJail(room.code),
    'build':        () => api.build(room.code, selectedTileIdx),
  };

  async function emit(event) {
    setError(null);
    setBusy(true);
    try {
      await actions[event]();
    } catch (err) {
      setError(err.message || `Failed: ${event}`);
    } finally {
      setBusy(false);
    }
  }

  const pendingPurchase = room.turn.pendingPurchaseTileIdx !== null
    ? room.board[room.turn.pendingPurchaseTileIdx]
    : null;

  const showRoll = isMyTurn && !room.turn.hasRolled && !pendingPurchase && room.phase === 'playing';
  const showEnd = isMyTurn && room.turn.hasRolled && !pendingPurchase && room.phase === 'playing';
  const showBuy = isMyTurn && pendingPurchase && me && me.cash >= pendingPurchase.price;
  const showDecline = isMyTurn && pendingPurchase;
  const showJailPay = isMyTurn && me?.inJail && !room.turn.hasRolled && me.cash >= 50 && room.phase === 'playing';

  // Build House logic check
  let showBuild = false;
  let selectedTile = null;
  if (selectedTileIdx !== null) {
    selectedTile = room.board[selectedTileIdx];
    if (selectedTile && selectedTile.type === 'property' && isMyTurn && room.phase === 'playing') {
      const groupTiles = room.board.filter(t => t.type === 'property' && t.group === selectedTile.group);
      const ownsGroup = groupTiles.every(t => t.ownerId === me?.id);
      if (ownsGroup && me.cash >= selectedTile.houseCost && selectedTile.houses < 5) {
        showBuild = true;
      }
    }
  }

  return (
    <main className="game">
      <div className="game__layout">
        <aside className="game__side game__side--left">
          <PlayersPanel room={room} selfId={selfId} />
        </aside>

        <div className="game__board-wrap">
          <Board room={room} selfId={selfId} selectedTileIdx={selectedTileIdx} onSelectTile={setSelectedTileIdx} />
        </div>

        <aside className="game__side game__side--right">
          <TurnPanel
            room={room}
            me={me}
            currentPlayer={currentPlayer}
            isMyTurn={isMyTurn}
            pendingPurchase={pendingPurchase}
            winner={winner}
          />
          <div className="game__actions">
            {showJailPay && (
              <button className="btn-ghost" disabled={busy} onClick={() => emit('jail:pay')}>
                Pay 50 to leave jail
              </button>
            )}
            {showRoll && (
              <button className="btn-primary" disabled={busy} onClick={() => emit('turn:roll')}>
                Roll Dice
              </button>
            )}
            {showBuy && (
              <button className="btn-primary" disabled={busy} onClick={() => emit('turn:buy')}>
                Buy {pendingPurchase.name} ({pendingPurchase.price})
              </button>
            )}
            {showDecline && (
              <button className="btn-ghost" disabled={busy} onClick={() => emit('turn:decline')}>
                Pass
              </button>
            )}
            {showBuild && (
              <button className="btn-primary" style={{ background: 'var(--success)', color: '#fff' }} disabled={busy} onClick={() => emit('build')}>
                Build {selectedTile.houses === 4 ? 'Hotel' : 'House'} on {selectedTile.name} ({selectedTile.houseCost})
              </button>
            )}
            {showEnd && (
              <button className="btn-ghost" disabled={busy} onClick={() => emit('turn:end')}>
                End Turn
              </button>
            )}
            {!isMyTurn && room.phase === 'playing' && (
              <p className="game__waiting">Waiting for {currentPlayer?.name}…</p>
            )}
            {error && <p className="game__error">{error}</p>}
          </div>
          <Log entries={room.turn.log} />
          <div className="game__footer">
            <button className="game__sound" onClick={toggleSound} title="Toggle sound">
              {soundOn ? '🔊' : '🔇'}
            </button>
            <button className="btn-ghost game__leave" onClick={onLeave}>
              {room.phase === 'ended' ? 'Back to Home' : 'Leave Game'}
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}

function PlayersPanel({ room, selfId }) {
  return (
    <div className="panel">
      <p className="panel__label">Players</p>
      <ul className="players">
        {room.players.map((p) => (
          <li
            key={p.id}
            className={`players__row ${p.id === room.turn.currentPlayerId ? 'is-turn' : ''} ${p.bankrupt ? 'is-bankrupt' : ''}`}
          >
            <span className="players__token" style={{ background: TOKEN_COLORS[p.token] }}>
              {TOKEN_GLYPHS[p.token]}
            </span>
            <div className="players__info">
              <div className="players__name">
                {p.name}
                {p.id === selfId && <span className="players__you"> (you)</span>}
              </div>
              <div className="players__cash">
                {p.bankrupt ? 'Bankrupt' : `${p.cash} EGP`}
                {p.inJail && <span className="players__jail"> · jail</span>}
                {!p.connected && <span className="players__off"> · offline</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TurnPanel({ room, me, currentPlayer, isMyTurn, pendingPurchase, winner }) {
  if (room.phase === 'ended') {
    return (
      <div className="panel panel--accent">
        <p className="panel__label">Game over</p>
        <h3 className="panel__title">{winner ? `${winner.name} wins!` : 'No winner'}</h3>
      </div>
    );
  }
  return (
    <div className="panel panel--accent">
      <p className="panel__label">Current turn</p>
      <h3 className="panel__title">
        {isMyTurn ? 'Your turn' : `${currentPlayer?.name ?? '—'}'s turn`}
      </h3>
      {room.turn.lastRoll && (
        <p className="panel__sub">
          Rolled {room.turn.lastRoll.d1} + {room.turn.lastRoll.d2} = {room.turn.lastRoll.total}
          {room.turn.lastRoll.isDouble && ' · double!'}
        </p>
      )}
      {pendingPurchase && isMyTurn && (
        <p className="panel__sub">
          {me && me.cash < pendingPurchase.price
            ? `${pendingPurchase.name} costs ${pendingPurchase.price} — you can't afford it.`
            : `Buy ${pendingPurchase.name} for ${pendingPurchase.price}?`}
        </p>
      )}
      {me?.inJail && isMyTurn && (
        <p className="panel__sub">You're in jail (turn {me.jailTurns}/3). Roll doubles or pay 50.</p>
      )}
    </div>
  );
}

function Log({ entries }) {
  return (
    <div className="panel">
      <p className="panel__label">Activity</p>
      <ul className="log">
        {[...entries].reverse().map((e, i) => (
          <li key={`${e.at}-${i}`} className="log__row">
            <span className="log__time">
              {new Date(e.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="log__msg">{e.message}</span>
          </li>
        ))}
        {entries.length === 0 && <li className="log__empty">No activity yet.</li>}
      </ul>
    </div>
  );
}
