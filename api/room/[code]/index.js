import { loadRoom } from '../../_lib/ops.js';
import { publicRoom } from '../../_lib/game/rooms.js';
import { currentSeq } from '../../_lib/eventlog.js';
import { json, ok, fail, methodNotAllowed } from '../../_lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const code = String(req.query.code || '').toUpperCase();
  const room = await loadRoom(code);
  if (!room) return fail(res, 404, 'Room not found');

  const seq = await currentSeq(code);
  json(res, 200, { ok: true, room: publicRoom(room), seq });
}
