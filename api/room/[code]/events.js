/**
 * Kafka-style consumer endpoint. Long-polls until new events with seq > since
 * are available, or `wait` ms elapse.
 *
 *   GET /api/room/ABC123/events?since=42&wait=20000
 *   -> { ok: true, events: [{seq, type, ...}], seq: 47 }
 *
 * `wait` is capped at 25s so we stay under Vercel's 30s function ceiling.
 */

import { fetchSince, currentSeq } from '../../_lib/eventlog.js';
import { loadRoom } from '../../_lib/ops.js';
import { json, fail, methodNotAllowed } from '../../_lib/http.js';

const MAX_WAIT_MS = 25_000;

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const code = String(req.query.code || '').toUpperCase();
  const since = Math.max(0, parseInt(req.query.since, 10) || 0);
  const waitMs = Math.min(MAX_WAIT_MS, Math.max(0, parseInt(req.query.wait, 10) || 0));

  const room = await loadRoom(code);
  if (!room) return fail(res, 404, 'Room not found');

  const events = await fetchSince(code, since, { waitMs });
  const seq = events.length > 0 ? events[events.length - 1].seq : await currentSeq(code);

  json(res, 200, { ok: true, events, seq });
}
