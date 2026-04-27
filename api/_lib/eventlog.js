/**
 * Kafka-style event log per room.
 *
 * Each room has a topic at key `room:<code>:events`. Events are appended
 * with a monotonically increasing seq (the list length after append).
 * Consumers (clients) track their last-seen seq and ask for everything
 * after it, exactly like a Kafka consumer offset.
 *
 * fetchSince() supports long-polling: if there are no new events yet,
 * it parks for up to `waitMs` and returns as soon as new events arrive
 * (or empty on timeout). This gives near-real-time push semantics over
 * plain HTTP, with no WebSocket.
 */

import { store } from './store.js';

const ROOM_TTL_MS = 30 * 60 * 1000; // 30 minutes idle
const POLL_INTERVAL_MS = 250;       // how often the long-poll wakes to recheck

function eventsKey(code) {
  return `room:${code}:events`;
}

/**
 * Append an event to the room's log. Returns the assigned seq (1-indexed).
 * Caller should pass plain event objects; we add `seq` and `at` here.
 */
export async function appendEvent(code, event) {
  const seq = await store.rpush(
    eventsKey(code),
    { ...event, at: Date.now() },
    { ttlMs: ROOM_TTL_MS },
  );
  // Patch the seq into the stored record by rewriting? No — readers can
  // compute seq from list position. We expose seq when reading.
  return seq;
}

export async function appendEvents(code, events) {
  const seqs = [];
  for (const ev of events) {
    seqs.push(await appendEvent(code, ev));
  }
  return seqs;
}

/**
 * Read events with seq > since. Returns an array of { seq, ...event }.
 *
 * If `waitMs > 0` and no events are available, parks the request for up to
 * `waitMs` waking every POLL_INTERVAL_MS to recheck. Returns as soon as new
 * events appear, or an empty array on timeout.
 */
export async function fetchSince(code, since, { waitMs = 0 } = {}) {
  const deadline = Date.now() + waitMs;

  while (true) {
    const len = await store.llen(eventsKey(code));
    if (len > since) {
      // LRANGE start..end is inclusive; we want items at positions [since, len-1]
      // because seq is 1-indexed and equals (position + 1).
      const items = await store.lrange(eventsKey(code), since, len - 1);
      return items.map((event, i) => ({ seq: since + i + 1, ...event }));
    }
    if (Date.now() >= deadline) return [];
    await sleep(Math.min(POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
  }
}

export async function currentSeq(code) {
  return store.llen(eventsKey(code));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
