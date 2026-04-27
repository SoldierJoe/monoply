import { runOp } from '../../_lib/ops.js';
import { removePlayer } from '../../_lib/game/rooms.js';
import { ok, fail, getPlayerId, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const playerId = getPlayerId(req);
  if (!playerId) return fail(res, 400, 'Missing X-Player-Id header');

  const code = String(req.query.code || '').toUpperCase();

  try {
    await runOp(code, (ctx, room) => {
      const { roomDeleted } = removePlayer(ctx, room, playerId);
      if (roomDeleted) ctx.deleteRoom = true;
    });
    ok(res);
  } catch (err) {
    if (/not found/i.test(err.message)) return ok(res);
    fail(res, 400, err.message || String(err));
  }
}
