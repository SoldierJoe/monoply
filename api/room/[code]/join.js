import { runOp } from '../../_lib/ops.js';
import { addPlayer, publicRoom } from '../../_lib/game/rooms.js';
import { ok, fail, readJsonBody, getPlayerId, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const playerId = getPlayerId(req);
  if (!playerId) return fail(res, 400, 'Missing X-Player-Id header');

  const code = String(req.query.code || '').toUpperCase();
  const { name } = await readJsonBody(req);

  try {
    const room = await runOp(code, (ctx, room) => {
      addPlayer(ctx, room, playerId, name);
      return publicRoom(room);
    });
    ok(res, { code, room });
  } catch (err) {
    const status = /not found/i.test(err.message) ? 404 : 400;
    fail(res, status, err.message || String(err));
  }
}
