// Map a board tile index (0..39) to a CSS-grid cell on an 11x11 board.
// Index 0 (Tahrir Square / GO) is the bottom-right corner. Movement runs
// counter-clockwise around the board — bottom row right-to-left, then left
// side bottom-to-top, etc., matching classic Monopoly.
//
// Each return value is { row, col, side } with row/col 1-indexed and side
// being 'bottom' | 'left' | 'top' | 'right' | 'corner'. Side determines how
// the tile content rotates so it always faces inward.
export function gridCellFor(idx) {
  if (idx === 0)  return { row: 11, col: 11, side: 'corner' };
  if (idx === 10) return { row: 11, col: 1,  side: 'corner' };
  if (idx === 20) return { row: 1,  col: 1,  side: 'corner' };
  if (idx === 30) return { row: 1,  col: 11, side: 'corner' };

  if (idx >= 1 && idx <= 9) {
    return { row: 11, col: 11 - idx, side: 'bottom' };
  }
  if (idx >= 11 && idx <= 19) {
    return { row: 11 - (idx - 10), col: 1, side: 'left' };
  }
  if (idx >= 21 && idx <= 29) {
    return { row: 1, col: 1 + (idx - 20), side: 'top' };
  }
  if (idx >= 31 && idx <= 39) {
    return { row: 1 + (idx - 30), col: 11, side: 'right' };
  }
  throw new Error(`Invalid tile index: ${idx}`);
}

export const GROUP_COLORS = {
  brown:     '#7a4f2a',
  lightblue: '#9bd3e8',
  pink:      '#d77fa1',
  orange:    '#e4933b',
  red:       '#c9352f',
  yellow:    '#e8c547',
  green:     '#4a8b5c',
  darkblue:  '#1f3a5f',
};
