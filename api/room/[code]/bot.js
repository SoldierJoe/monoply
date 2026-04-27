import { runOp } from '../../_lib/ops.js';
import { addBot } from '../../_lib/game/rooms.js';
import { ok, fail, getPlayerId, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const playerId = getPlayerId(req);
  if (!playerId) return fail(res, 400, 'Missing X-Player-Id header');

  const code = String(req.query.code || '').toUpperCase();

  try {
    const player = await runOp(code, (ctx, room) => {
      if (room.hostId !== playerId) throw new Error('Only the host can add bots');
      return addBot(ctx, room);
    });
    ok(res, { player });
  } catch (err) {
    fail(res, 400, err.message || String(err));
  }
}
