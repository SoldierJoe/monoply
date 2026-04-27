import { GROUP_COLORS } from '../board-layout.js';
import { TOKEN_COLORS, TOKEN_GLYPHS } from '../tokens.js';

const TILE_TYPE_LABELS = {
  cc: 'Community Chest',
  chance: 'Chance',
  go: 'The Pyramids',
  jail: 'Jail',
  free: 'Khan el-Khalili',
  gotojail: 'Go to Jail',
  tax: 'Tax',
  railroad: 'Transit',
  utility: 'Utility',
};

export default function Tile({ tile, side, players, owner, isCurrent }) {
  const isCorner = side === 'corner';
  const orient = 0;

  return (
    <div
      className={`tile tile--${side} ${isCorner ? 'tile--corner' : ''} ${isCurrent ? 'is-current' : ''}`}
      title={tile.name}
    >
      <div className="tile__inner" style={{ transform: `rotate(${orient}deg)` }}>
        {tile.type === 'property' && (
          <div className="tile__band" style={{ background: GROUP_COLORS[tile.group] }} />
        )}
        <div className="tile__body">
          {(tile.type === 'railroad') && <div className="tile__icon">🚆</div>}
          {(tile.type === 'utility')  && <div className="tile__icon">{tile.idx === 12 ? '⚡' : '💧'}</div>}
          {(tile.type === 'cc')       && <div className="tile__icon">📜</div>}
          {(tile.type === 'chance')   && <div className="tile__icon">❓</div>}
          {(tile.type === 'tax')      && <div className="tile__icon">💸</div>}
          {(tile.type === 'go')       && <div className="tile__icon tile__icon--big">★</div>}
          {(tile.type === 'jail')     && <div className="tile__icon tile__icon--big">⛓</div>}
          {(tile.type === 'free')     && <div className="tile__icon tile__icon--big">☕</div>}
          {(tile.type === 'gotojail') && <div className="tile__icon tile__icon--big">🚔</div>}

          <div className="tile__name">{tile.name}</div>
          {tile.price && <div className="tile__price">{tile.price}</div>}
          {tile.type === 'tax' && <div className="tile__price">Pay {tile.amount}</div>}
          {!tile.price && tile.type !== 'tax' && tile.type !== 'property' && (
            <div className="tile__sub">{TILE_TYPE_LABELS[tile.type] ?? ''}</div>
          )}
        </div>

        {owner && (
          <div className="tile__owner" style={{ background: TOKEN_COLORS[owner.token] }} title={`Owned by ${owner.name}`} />
        )}
        {tile.houses > 0 && (
          <div className="tile__houses">
            {tile.houses < 5 ? '🏠'.repeat(tile.houses) : '🏨'}
          </div>
        )}
        {tile.mortgaged && <div className="tile__mortgaged">M</div>}
      </div>

      {players.length > 0 && (
        <div className="tile__pawns">
          {players.map((p) => (
            <span
              key={p.id}
              className="pawn"
              style={{ background: TOKEN_COLORS[p.token] }}
              title={p.name}
            >
              {TOKEN_GLYPHS[p.token]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
