import { BOARD_SQUARES, PLAYER_COLORS, PLAYER_TOKENS } from '../lib/boardData';

const COLOR_MAP = {
  brown: '#8B4513', lightblue: '#87CEEB', pink: '#FF69B4',
  orange: '#FF8C00', red: '#DC143C', yellow: '#FFD700',
  green: '#228B22', darkblue: '#00008B',
};

const CELL_W = 60;   // short side of an edge tile
const CELL_H = 92;   // long side (depth from board edge)
const CORNER = 92;   // square corner cell
const BOARD = CORNER * 2 + CELL_W * 9;

// Side identifiers
const SIDE_BOTTOM = 'bottom';
const SIDE_LEFT = 'left';
const SIDE_TOP = 'top';
const SIDE_RIGHT = 'right';

function getSquareLayout(id) {
  if (id === 0)  return { side: 'corner-br', x: BOARD - CORNER, y: BOARD - CORNER, w: CORNER, h: CORNER };
  if (id === 10) return { side: 'corner-bl', x: 0,              y: BOARD - CORNER, w: CORNER, h: CORNER };
  if (id === 20) return { side: 'corner-tl', x: 0,              y: 0,              w: CORNER, h: CORNER };
  if (id === 30) return { side: 'corner-tr', x: BOARD - CORNER, y: 0,              w: CORNER, h: CORNER };

  if (id > 0 && id < 10) {
    const slot = 9 - id; // bottom row, right→left
    return { side: SIDE_BOTTOM, x: CORNER + slot * CELL_W, y: BOARD - CELL_H, w: CELL_W, h: CELL_H };
  }
  if (id > 10 && id < 20) {
    const slot = id - 11; // left column, bottom→top
    return { side: SIDE_LEFT, x: 0, y: BOARD - CORNER - (slot + 1) * CELL_W, w: CELL_H, h: CELL_W };
  }
  if (id > 20 && id < 30) {
    const slot = id - 21; // top row, left→right
    return { side: SIDE_TOP, x: CORNER + slot * CELL_W, y: 0, w: CELL_W, h: CELL_H };
  }
  // 31..39 right column, top→bottom
  const slot = id - 31;
  return { side: SIDE_RIGHT, x: BOARD - CELL_H, y: CORNER + slot * CELL_W, w: CELL_H, h: CELL_W };
}

// Token positions inside a square — up to 8 players, arranged in a grid
function tokenOffset(layout, index) {
  const cols = 4;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const padX = 6, padY = 6;
  const cellW = (layout.w - padX * 2) / cols;
  const cellH = 14;
  return {
    cx: layout.x + padX + cellW * col + cellW / 2,
    cy: layout.y + layout.h - padY - cellH * (row + 1) + cellH / 2,
  };
}

function SquareCell({ square, layout, players, property }) {
  const { x, y, w, h, side } = layout;
  const playersHere = players.filter(p => p.position === square.id && !p.bankrupt);

  const color = square.color ? COLOR_MAP[square.color] : null;
  const stripThickness = 16;

  // Color strip is on the inner edge (towards board center) of each square
  let stripRect = null;
  if (color) {
    if (side === SIDE_BOTTOM) stripRect = { x, y, w, h: stripThickness };
    if (side === SIDE_TOP)    stripRect = { x, y: y + h - stripThickness, w, h: stripThickness };
    if (side === SIDE_LEFT)   stripRect = { x: x + w - stripThickness, y, w: stripThickness, h };
    if (side === SIDE_RIGHT)  stripRect = { x, y, w: stripThickness, h };
  }

  // Text orientation per side
  // Center text inside the non-strip portion of the square
  const textProps = (() => {
    if (side === SIDE_BOTTOM) {
      return {
        nameX: x + w / 2,
        nameY: y + stripThickness + 14,
        priceX: x + w / 2,
        priceY: y + h - 8,
        rotate: 0,
      };
    }
    if (side === SIDE_TOP) {
      return {
        nameX: x + w / 2,
        nameY: y + 14,
        priceX: x + w / 2,
        priceY: y + h - stripThickness - 6,
        rotate: 0,
      };
    }
    if (side === SIDE_LEFT) {
      // Rotate text 90° (reads from bottom up). Anchor at center of cell.
      return {
        nameX: x + (w - stripThickness) / 2,
        nameY: y + h / 2,
        priceX: x + w - stripThickness - 8,
        priceY: y + h / 2,
        rotate: -90,
      };
    }
    // RIGHT
    return {
      nameX: x + stripThickness + (w - stripThickness) / 2,
      nameY: y + h / 2,
      priceX: x + stripThickness + 10,
      priceY: y + h / 2,
      rotate: 90,
    };
  })();

  // Wrap long names to two lines
  const words = square.name.split(' ');
  let line1 = square.name, line2 = '';
  if (words.length > 1 && square.name.length > 10) {
    const mid = Math.ceil(words.length / 2);
    line1 = words.slice(0, mid).join(' ');
    line2 = words.slice(mid).join(' ');
  }

  const houseDots = property?.houses && property.houses < 5
    ? Array.from({ length: property.houses }, (_, i) => i)
    : [];
  const hasHotel = property?.houses === 5;

  // Position house indicators along the strip
  const houseY = side === SIDE_BOTTOM ? y + stripThickness / 2
    : side === SIDE_TOP ? y + h - stripThickness / 2
    : null;
  const houseX = side === SIDE_LEFT ? x + w - stripThickness / 2
    : side === SIDE_RIGHT ? x + stripThickness / 2
    : null;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fafaf5" stroke="#222" strokeWidth="1" />
      {stripRect && (
        <rect {...stripRect} fill={color} stroke="#222" strokeWidth="0.5" />
      )}

      {/* Square name */}
      <g transform={textProps.rotate ? `rotate(${textProps.rotate}, ${textProps.nameX}, ${textProps.nameY})` : undefined}>
        <text x={textProps.nameX} y={textProps.nameY}
          textAnchor="middle" fontSize="8" fontWeight="600" fill="#222" fontFamily="system-ui, sans-serif">
          <tspan x={textProps.nameX} dy="0">{line1}</tspan>
          {line2 && <tspan x={textProps.nameX} dy="9">{line2}</tspan>}
        </text>
      </g>

      {/* Type icon for special tiles */}
      {square.type === 'chance' && (
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="20">?</text>
      )}
      {square.type === 'community_chest' && (
        <text x={x + w / 2} y={y + h / 2 + 6} textAnchor="middle" fontSize="18">📦</text>
      )}
      {square.type === 'tax' && (
        <text x={x + w / 2} y={y + h / 2 + 6} textAnchor="middle" fontSize="16">💰</text>
      )}
      {square.type === 'railroad' && (
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="18">🚂</text>
      )}
      {square.type === 'utility' && square.name.includes('Electric') && (
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="16">💡</text>
      )}
      {square.type === 'utility' && square.name.includes('Water') && (
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="16">🚰</text>
      )}

      {/* Price */}
      {square.price && (
        <g transform={textProps.rotate ? `rotate(${textProps.rotate}, ${textProps.priceX}, ${textProps.priceY})` : undefined}>
          <text x={textProps.priceX} y={textProps.priceY}
            textAnchor="middle" fontSize="8" fill="#444" fontFamily="system-ui, sans-serif">
            ${square.price}
          </text>
        </g>
      )}

      {/* Houses on color strip */}
      {houseDots.map((i) => {
        if (side === SIDE_BOTTOM || side === SIDE_TOP) {
          const cx = x + (w / (houseDots.length + 1)) * (i + 1);
          return <rect key={i} x={cx - 3} y={houseY - 3} width={6} height={6} fill="#1b5e20" stroke="white" strokeWidth="0.5" />;
        }
        const cy = y + (h / (houseDots.length + 1)) * (i + 1);
        return <rect key={i} x={houseX - 3} y={cy - 3} width={6} height={6} fill="#1b5e20" stroke="white" strokeWidth="0.5" />;
      })}
      {hasHotel && (
        <rect
          x={(side === SIDE_BOTTOM || side === SIDE_TOP) ? x + w / 2 - 6 : houseX - 6}
          y={(side === SIDE_BOTTOM || side === SIDE_TOP) ? houseY - 4 : y + h / 2 - 4}
          width={12} height={8} fill="#c62828" stroke="white" strokeWidth="0.5" rx="1"
        />
      )}

      {/* Player tokens */}
      {playersHere.map((p, i) => {
        const { cx, cy } = tokenOffset(layout, i);
        return (
          <g key={p.id}>
            <circle cx={cx} cy={cy} r={6}
              fill={PLAYER_COLORS[p.tokenIndex % PLAYER_COLORS.length]}
              stroke="white" strokeWidth="1.5" />
            <text x={cx} y={cy + 3} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
              {p.name[0]?.toUpperCase()}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CornerCell({ id, layout, players }) {
  const { x, y, w, h } = layout;
  const playersHere = players.filter(p => p.position === id && !p.bankrupt);

  const content = {
    0:  { title: 'GO', subtitle: 'COLLECT $200', color: '#e74c3c', emoji: '⬅' },
    10: { title: 'JAIL', subtitle: 'JUST VISITING', color: '#f39c12', emoji: '🔒' },
    20: { title: 'FREE', subtitle: 'PARKING', color: '#3498db', emoji: '🅿' },
    30: { title: 'GO TO', subtitle: 'JAIL', color: '#c0392b', emoji: '🚓' },
  }[id];

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fafaf5" stroke="#222" strokeWidth="1" />
      <text x={x + w / 2} y={y + 18} textAnchor="middle" fontSize="11" fontWeight="bold" fill={content.color}>
        {content.title}
      </text>
      <text x={x + w / 2} y={y + h / 2 + 6} textAnchor="middle" fontSize="28">
        {content.emoji}
      </text>
      <text x={x + w / 2} y={y + h - 10} textAnchor="middle" fontSize="8" fontWeight="600" fill="#444">
        {content.subtitle}
      </text>

      {playersHere.map((p, i) => {
        const cols = 4;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = x + 12 + col * 18;
        const cy = y + h - 14 - row * 14;
        return (
          <g key={p.id}>
            <circle cx={cx} cy={cy} r={6}
              fill={PLAYER_COLORS[p.tokenIndex % PLAYER_COLORS.length]}
              stroke="white" strokeWidth="1.5" />
            <text x={cx} y={cy + 3} textAnchor="middle" fontSize="8" fill="white" fontWeight="bold">
              {p.name[0]?.toUpperCase()}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function DieFace({ x, y, value, size = 44 }) {
  const dotR = 3.5;
  const off = size * 0.25;
  const cx = x + size / 2;
  const cy = y + size / 2;

  // Pip positions per face
  const pips = {
    1: [[cx, cy]],
    2: [[x + off, y + off], [x + size - off, y + size - off]],
    3: [[x + off, y + off], [cx, cy], [x + size - off, y + size - off]],
    4: [[x + off, y + off], [x + size - off, y + off], [x + off, y + size - off], [x + size - off, y + size - off]],
    5: [[x + off, y + off], [x + size - off, y + off], [cx, cy], [x + off, y + size - off], [x + size - off, y + size - off]],
    6: [[x + off, y + off], [x + size - off, y + off], [x + off, cy], [x + size - off, cy], [x + off, y + size - off], [x + size - off, y + size - off]],
  }[value] || [];

  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={6} ry={6}
        fill="white" stroke="#333" strokeWidth="2" />
      {pips.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={dotR} fill="#222" />
      ))}
    </g>
  );
}

export default function Board({ gameState }) {
  const { players = [], properties = {}, dice = [1, 1] } = gameState;

  return (
    <div className="overflow-auto p-2 bg-[#cfe9d2]">
      <svg
        width="100%"
        viewBox={`0 0 ${BOARD} ${BOARD}`}
        style={{ display: 'block', maxWidth: BOARD, margin: '0 auto' }}
      >
        {/* Outer board background */}
        <rect width={BOARD} height={BOARD} fill="#cfe9d2" />

        {/* Inner playing field */}
        <rect
          x={CELL_H} y={CELL_H}
          width={BOARD - CELL_H * 2} height={BOARD - CELL_H * 2}
          fill="#cfe9d2" stroke="#222" strokeWidth="1"
        />

        {/* Center title — diagonally for that classic feel */}
        <g transform={`translate(${BOARD / 2}, ${BOARD / 2 - 60}) rotate(-20)`}>
          <text textAnchor="middle" fontSize="42" fontWeight="900" fill="#c62828"
            fontFamily="Georgia, serif" letterSpacing="2">
            MONOPOLY
          </text>
        </g>

        {/* Dice display */}
        <g>
          <DieFace x={BOARD / 2 - 56} y={BOARD / 2 - 10} value={dice[0]} size={44} />
          <DieFace x={BOARD / 2 + 12} y={BOARD / 2 - 10} value={dice[1]} size={44} />
        </g>

        {/* Current turn caption */}
        {gameState.status === 'playing' && players[gameState.currentPlayerIndex] && (
          <text x={BOARD / 2} y={BOARD / 2 + 70} textAnchor="middle"
            fontSize="14" fontWeight="600" fill="#1b5e20">
            {players[gameState.currentPlayerIndex].name}'s turn
          </text>
        )}
        {gameState.status === 'lobby' && (
          <text x={BOARD / 2} y={BOARD / 2 + 70} textAnchor="middle"
            fontSize="13" fill="#1b5e20">
            Waiting for players...
          </text>
        )}

        {/* Squares */}
        {BOARD_SQUARES.map(square => {
          const layout = getSquareLayout(square.id);
          if ([0, 10, 20, 30].includes(square.id)) {
            return <CornerCell key={square.id} id={square.id} layout={layout} players={players} />;
          }
          return (
            <SquareCell
              key={square.id}
              square={square}
              layout={layout}
              players={players}
              property={properties[square.id]}
            />
          );
        })}
      </svg>
    </div>
  );
}
