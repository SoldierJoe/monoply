import { BOARD_SQUARES, PLAYER_COLORS, PLAYER_TOKENS } from '../lib/boardData';

const COLOR_MAP = {
  brown: '#8B4513', lightblue: '#87CEEB', pink: '#FF69B4',
  orange: '#FF8C00', red: '#DC143C', yellow: '#FFD700',
  green: '#228B22', darkblue: '#00008B',
};

// Board layout: corners at 0,10,20,30 with sides going CW
// bottom row: 0-10 (right to left), right col: 10-20 (bottom to top)
// top row: 20-30 (left to right), left col: 30-40 (top to bottom)

const CELL_SIZE = 56;
const CORNER_SIZE = 72;
const BOARD_SIZE = CORNER_SIZE * 2 + CELL_SIZE * 9;

function getSquarePos(id) {
  // Returns {x, y, w, h, rotate} for each square
  if (id === 0)  return { x: BOARD_SIZE - CORNER_SIZE, y: BOARD_SIZE - CORNER_SIZE, w: CORNER_SIZE, h: CORNER_SIZE };
  if (id === 10) return { x: 0, y: BOARD_SIZE - CORNER_SIZE, w: CORNER_SIZE, h: CORNER_SIZE };
  if (id === 20) return { x: 0, y: 0, w: CORNER_SIZE, h: CORNER_SIZE };
  if (id === 30) return { x: BOARD_SIZE - CORNER_SIZE, y: 0, w: CORNER_SIZE, h: CORNER_SIZE };

  if (id > 0 && id < 10) {
    // Bottom row, right to left
    const slot = 9 - (id - 1);
    return { x: CORNER_SIZE + slot * CELL_SIZE, y: BOARD_SIZE - CORNER_SIZE, w: CELL_SIZE, h: CORNER_SIZE, rotate: 0 };
  }
  if (id > 10 && id < 20) {
    // Left col, bottom to top
    const slot = id - 11;
    return { x: 0, y: BOARD_SIZE - CORNER_SIZE - (slot + 1) * CELL_SIZE, w: CORNER_SIZE, h: CELL_SIZE, rotate: 90 };
  }
  if (id > 20 && id < 30) {
    // Top row, left to right
    const slot = id - 21;
    return { x: CORNER_SIZE + slot * CELL_SIZE, y: 0, w: CELL_SIZE, h: CORNER_SIZE, rotate: 180 };
  }
  if (id > 30 && id < 40) {
    // Right col, top to bottom
    const slot = 39 - id;
    return { x: BOARD_SIZE - CORNER_SIZE, y: CORNER_SIZE + slot * CELL_SIZE, w: CORNER_SIZE, h: CELL_SIZE, rotate: 270 };
  }
  return { x: 0, y: 0, w: CELL_SIZE, h: CORNER_SIZE };
}

function SquareCell({ square, pos, players, property }) {
  const { x, y, w, h } = pos;
  const playersHere = players.filter(p => p.position === square.id && !p.bankrupt);
  const color = square.color ? COLOR_MAP[square.color] : null;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill="white" stroke="#999" strokeWidth="0.5" />

      {/* Color strip */}
      {color && (
        <rect
          x={square.id > 20 && square.id < 30 ? x : square.id > 0 && square.id < 10 ? x : x}
          y={square.id > 0 && square.id < 10 ? y + h - 12 :
             square.id > 20 && square.id < 30 ? y :
             square.id > 10 && square.id < 20 ? x < 5 ? y : y : y}
          width={w} height={12}
          fill={color}
          style={{
            transformBox: 'fill-box',
            transformOrigin: 'center',
          }}
        />
      )}

      {/* Houses/hotel indicators */}
      {property && property.houses > 0 && (
        <text x={x + w / 2} y={y + h / 2 + 4} textAnchor="middle" fontSize="8" fill="green">
          {property.houses < 5 ? '🏠'.repeat(property.houses) : '🏨'}
        </text>
      )}

      {/* Player tokens */}
      {playersHere.map((p, i) => (
        <circle key={p.id}
          cx={x + 10 + i * 10} cy={y + h / 2}
          r={5} fill={PLAYER_COLORS[p.tokenIndex % PLAYER_COLORS.length]}
          stroke="white" strokeWidth="1" />
      ))}
    </g>
  );
}

export default function Board({ gameState }) {
  const { players = [], properties = {} } = gameState;

  return (
    <div className="overflow-auto">
      <svg
        width={BOARD_SIZE}
        height={BOARD_SIZE}
        viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
        style={{ maxWidth: '100%' }}
      >
        {/* Board background */}
        <rect width={BOARD_SIZE} height={BOARD_SIZE} fill="#c8e6c9" />

        {/* Center */}
        <rect
          x={CORNER_SIZE}
          y={CORNER_SIZE}
          width={BOARD_SIZE - CORNER_SIZE * 2}
          height={BOARD_SIZE - CORNER_SIZE * 2}
          fill="#e8f5e9"
        />
        <text x={BOARD_SIZE / 2} y={BOARD_SIZE / 2 - 20} textAnchor="middle"
          fontSize="28" fontWeight="bold" fill="#1b5e20" fontFamily="serif">
          MONOPOLY
        </text>
        <text x={BOARD_SIZE / 2} y={BOARD_SIZE / 2 + 10} textAnchor="middle"
          fontSize="11" fill="#388e3c">
          {players.filter(p => !p.bankrupt).map(p => p.name).join(' • ')}
        </text>

        {/* Dice display in center */}
        {gameState.dice && (
          <g>
            <text x={BOARD_SIZE / 2 - 20} y={BOARD_SIZE / 2 + 50}
              textAnchor="middle" fontSize="32">
              {['⚀','⚁','⚂','⚃','⚄','⚅'][gameState.dice[0] - 1]}
            </text>
            <text x={BOARD_SIZE / 2 + 20} y={BOARD_SIZE / 2 + 50}
              textAnchor="middle" fontSize="32">
              {['⚀','⚁','⚂','⚃','⚄','⚅'][gameState.dice[1] - 1]}
            </text>
          </g>
        )}

        {/* Board squares */}
        {BOARD_SQUARES.map(square => {
          const pos = getSquarePos(square.id);
          return (
            <SquareCell
              key={square.id}
              square={square}
              pos={pos}
              players={players}
              property={properties[square.id]}
            />
          );
        })}

        {/* Square labels for corners */}
        <text x={BOARD_SIZE - CORNER_SIZE / 2} y={BOARD_SIZE - CORNER_SIZE / 2 + 5}
          textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1b5e20">GO</text>
        <text x={CORNER_SIZE / 2} y={BOARD_SIZE - CORNER_SIZE / 2 + 5}
          textAnchor="middle" fontSize="7" fontWeight="bold" fill="#555">JAIL</text>
        <text x={CORNER_SIZE / 2} y={CORNER_SIZE / 2 + 5}
          textAnchor="middle" fontSize="6" fontWeight="bold" fill="#555">FREE{'\n'}PARK</text>
        <text x={BOARD_SIZE - CORNER_SIZE / 2} y={CORNER_SIZE / 2 + 5}
          textAnchor="middle" fontSize="6" fontWeight="bold" fill="#c62828">GO TO{'\n'}JAIL</text>
      </svg>
    </div>
  );
}
