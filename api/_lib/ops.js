/**
 * Operation wrapper. Each API route calls runOp(code, fn) which:
 *   1. Loads the room from the store under a per-room lock
 *   2. Calls fn(ctx, room) where ctx collects events
 *   3. Persists the mutated room
 *   4. Appends collected events to the Kafka-style event log
 *
 * fn returns whatever it wants; that's bubbled out as the runOp result.
 * If fn throws, the room is left untouched (mutate's lock holds the original).
 */

import { store } from './store.js';
import { newRoomState, makeCode, addPlayer } from './game/rooms.js';
import { appendEvents } from './eventlog.js';

const ROOM_TTL_MS = 30 * 60 * 1000;

function roomKey(code) {
  return `room:${code}`;
}

export async function loadRoom(code) {
  return store.get(roomKey(code));
}

export async function runOp(code, fn) {
  const ctx = { events: [], deleteRoom: false };

  const result = await store.mutate(roomKey(code), async (room) => {
    if (!room) throw new Error('Room not found');
    const r = await fn(ctx, room);
    if (ctx.deleteRoom) return { value: null, result: r };
    return { value: room, result: r };
  }, { ttlMs: ROOM_TTL_MS });

  if (ctx.deleteRoom) {
    await store.del(roomKey(code));
  }

  if (ctx.events.length > 0) {
    await appendEvents(code, ctx.events);
  }

  return result;
}

export async function createRoomOp(hostId, name) {
  // Try a few codes until we hit an unused one.
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    if (await store.exists(roomKey(code))) continue;

    const room = newRoomState({ code, hostId });
    const ctx = { events: [] };
    addPlayer(ctx, room, hostId, name);

    await store.set(roomKey(code), room, { ttlMs: ROOM_TTL_MS });
    if (ctx.events.length > 0) await appendEvents(code, ctx.events);
    return { code, room };
  }
  throw new Error('Could not allocate room code');
}
