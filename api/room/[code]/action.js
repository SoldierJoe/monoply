/**
 * Single dispatcher for all turn/jail actions. Consolidated to stay under
 * Vercel Hobby's 12-function limit. The body's `type` field selects the op:
 *
 *   POST /api/room/<code>/action
 *   { "type": "roll" | "buy" | "decline" | "end" | "jail-pay" }
 */

import { runOp } from '../../_lib/ops.js';
import { rollDice, buyProperty, declinePurchase, endTurn, payJailFine }
  from '../../_lib/game/turn.js';
import { scheduleBotTurn } from '../../_lib/game/bot.js';
import { ok, fail, readJsonBody, getPlayerId, methodNotAllowed }
  from '../../_lib/http.js';

const ACTIONS = {
  roll:       (ctx, room, pid) => ({ roll: rollDice(ctx, room, pid) }),
  buy:        (ctx, room, pid) => { buyProperty(ctx, room, pid); return {}; },
  decline:    (ctx, room, pid) => { declinePurchase(ctx, room, pid); return {}; },
  end:        (ctx, room, pid) => { endTurn(ctx, room, pid); return {}; },
  'jail-pay': (ctx, room, pid) => { payJailFine(ctx, room, pid); return {}; },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const playerId = getPlayerId(req);
  if (!playerId) return fail(res, 400, 'Missing X-Player-Id header');

  const code = String(req.query.code || '').toUpperCase();
  const body = await readJsonBody(req);
  const fn = ACTIONS[body.type];
  if (!fn) return fail(res, 400, `Unknown action type: ${body.type}`);

  try {
    const result = await runOp(code, (ctx, room) => fn(ctx, room, playerId));
    scheduleBotTurn(code);
    ok(res, result);
  } catch (err) {
    fail(res, 400, err.message || String(err));
  }
}
