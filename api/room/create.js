import { createRoomOp } from '../_lib/ops.js';
import { publicRoom } from '../_lib/game/rooms.js';
import { ok, fail, readJsonBody, getPlayerId, methodNotAllowed } from '../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const playerId = getPlayerId(req);
  if (!playerId) return fail(res, 400, 'Missing X-Player-Id header');

  const { name } = await readJsonBody(req);

  try {
    const { code, room } = await createRoomOp(playerId, name);
    ok(res, { code, room: publicRoom(room) });
  } catch (err) {
    fail(res, 400, err.message || String(err));
  }
}
