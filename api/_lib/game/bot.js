/**
 * Bot auto-play logic. After any state mutation, call `scheduleBotTurn`
 * to check if the current player is a bot — if so, auto-play their turn
 * after a short delay.
 *
 * Bot strategy (deliberately simple):
 *   - In jail? Pay the fine if affordable, otherwise roll.
 *   - Roll dice.
 *   - Buy any property they can afford (80% chance, some randomness).
 *   - End turn.
 */

import { runOp } from '../ops.js';
import { rollDice, buyProperty, declinePurchase, endTurn, payJailFine }
  from './turn.js';

const BOT_DELAY_MS = 1200;   // delay before a bot acts (feels natural)
const BOT_BUY_CHANCE = 0.8;  // 80% chance to buy when affordable
const pending = new Set();    // prevent duplicate scheduling per room

export function scheduleBotTurn(code) {
  if (pending.has(code)) return;
  pending.add(code);

  setTimeout(async () => {
    pending.delete(code);
    try {
      await playBotTurn(code);
    } catch (err) {
      // Silently ignore — bot errors shouldn't crash anything
      if (!/not found|not your turn|already/i.test(err.message)) {
        console.error(`[bot] Error in room ${code}:`, err.message);
      }
    }
  }, BOT_DELAY_MS);
}

async function playBotTurn(code) {
  // Step 1: check if current player is a bot
  const room = await peekRoom(code);
  if (!room || room.phase !== 'playing') return;

  const current = room.players.find(p => p.id === room.currentPlayerId);
  if (!current || !current.isBot || current.bankrupt) return;

  // Step 2: if in jail, try to pay
  if (current.inJail && !room.hasRolled) {
    if (current.cash >= 50) {
      await runOp(code, (ctx, r) => {
        payJailFine(ctx, r, current.id);
      });
    }
  }

  // Step 3: roll dice (if haven't rolled yet)
  const room2 = await peekRoom(code);
  if (!room2 || room2.phase !== 'playing') return;
  if (room2.currentPlayerId !== current.id) return;

  if (!room2.hasRolled) {
    await runOp(code, (ctx, r) => {
      rollDice(ctx, r, current.id);
    });
  }

  // Step 4: handle pending purchase
  const room3 = await peekRoom(code);
  if (!room3 || room3.currentPlayerId !== current.id) return;

  if (room3.pendingPurchaseTileIdx !== null) {
    const tile = room3.board[room3.pendingPurchaseTileIdx];
    const player = room3.players.find(p => p.id === current.id);
    const canAfford = player && player.cash >= tile.price;
    const willBuy = canAfford && Math.random() < BOT_BUY_CHANCE;

    await runOp(code, (ctx, r) => {
      if (willBuy) {
        buyProperty(ctx, r, current.id);
      } else {
        declinePurchase(ctx, r, current.id);
      }
    });
  }

  // Step 5: end turn (or re-roll on doubles)
  const room4 = await peekRoom(code);
  if (!room4 || room4.currentPlayerId !== current.id) return;
  if (room4.phase !== 'playing') return;

  if (room4.hasRolled && room4.pendingPurchaseTileIdx === null) {
    await runOp(code, (ctx, r) => {
      endTurn(ctx, r, current.id);
    });
  }

  // Step 6: check if it's still a bot's turn (doubles → re-roll, or next bot)
  const room5 = await peekRoom(code);
  if (room5 && room5.phase === 'playing') {
    const next = room5.players.find(p => p.id === room5.currentPlayerId);
    if (next && next.isBot && !next.bankrupt) {
      scheduleBotTurn(code);
    }
  }
}

// Quick read of room state without locking
async function peekRoom(code) {
  const { store } = await import('../store.js');
  return store.get(`room:${code}`);
}
