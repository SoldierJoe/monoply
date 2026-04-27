import Tile from './Tile.jsx';
import { gridCellFor } from '../board-layout.js';

export default function Board({ room, selfId }) {
  const playersByTile = new Map();
  for (const p of room.players) {
    if (p.bankrupt) continue;
    if (!playersByTile.has(p.position)) playersByTile.set(p.position, []);
    playersByTile.get(p.position).push(p);
  }

  return (
    <div className="board" role="grid" aria-label="Cairo Monopoly board">
      {room.board.map((tile) => {
        const cell = gridCellFor(tile.idx);
        const owner = tile.ownerId ? room.players.find(p => p.id === tile.ownerId) : null;
        const playersHere = playersByTile.get(tile.idx) || [];
        return (
          <div
            key={tile.idx}
            className="board__cell"
            style={{ gridRow: cell.row, gridColumn: cell.col }}
          >
            <Tile
              tile={tile}
              side={cell.side}
              players={playersHere}
              owner={owner}
              isCurrent={room.turn?.currentPlayerId &&
                room.players.find(p => p.id === room.turn.currentPlayerId)?.position === tile.idx}
            />
          </div>
        );
      })}

      <div className="board__center" style={{ gridRow: '2 / 11', gridColumn: '2 / 11' }}>
        <BoardCenter room={room} selfId={selfId} />
      </div>
    </div>
  );
}

function BoardCenter({ room }) {
  return (
    <div className="board__center-inner">
      <p className="board__eyebrow">Cairo</p>
      <h2 className="board__title">Monopoly</h2>
      <p className="board__subtitle">A Monopoly for the city of a thousand minarets</p>
      {room.turn?.lastRoll && (
        <div className="dice">
          <Die n={room.turn.lastRoll.d1} />
          <Die n={room.turn.lastRoll.d2} />
        </div>
      )}
    </div>
  );
}

function Die({ n }) {
  return <span className="die">{['⚀','⚁','⚂','⚃','⚄','⚅'][n - 1] ?? '·'}</span>;
}
