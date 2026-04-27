// In-memory store. Bound to globalThis so the same Node process reuses
// the Map across module reloads (Next.js dev HMR + Vercel warm invocations).
// NOTE: cold starts and multiple concurrent serverless instances each have
// their own memory — true persistence requires a real store (KV/Redis).

const KEY = '__monopoly_rooms__';

function getStore() {
  if (!globalThis[KEY]) {
    globalThis[KEY] = {
      rooms: new Map(),
      lastCleanup: Date.now(),
    };
  }
  return globalThis[KEY];
}

function maybeCleanup(store) {
  const now = Date.now();
  if (now - store.lastCleanup < 10 * 60 * 1000) return;
  store.lastCleanup = now;
  const cutoff = now - 2 * 60 * 60 * 1000;
  for (const [id, room] of store.rooms) {
    if (room.createdAt < cutoff) store.rooms.delete(id);
  }
}

export function getRoom(id) {
  const store = getStore();
  maybeCleanup(store);
  return store.rooms.get(id);
}

export function setRoom(id, room) {
  const store = getStore();
  store.rooms.set(id, room);
}

export function deleteRoom(id) {
  getStore().rooms.delete(id);
}

export function getRooms() {
  return getStore().rooms;
}
