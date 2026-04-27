/**
 * HTTP API client. Replaces the old socket.io client.
 *
 * Identity: a stable `playerId` is generated on first load and stored in
 * localStorage. Sent on every request as X-Player-Id. The server uses this
 * to identify the player across function invocations (no socket.id anymore).
 *
 * Base URL: same-origin in production (Vercel serves both /api and the
 * static client). For dev, points at the local Vite proxy or env override.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

function ensurePlayerId() {
  let id = localStorage.getItem('cairo:playerId');
  if (!id) {
    id = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem('cairo:playerId', id);
  }
  return id;
}

export const playerId = ensurePlayerId();

async function request(path, { method = 'GET', body, signal } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Player-Id': playerId,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  createRoom: (name) =>
    request('/api/room/create', { method: 'POST', body: { name } }),

  joinRoom: (code, name) =>
    request(`/api/room/${encodeURIComponent(code)}/join`, { method: 'POST', body: { name } }),

  leaveRoom: (code) =>
    request(`/api/room/${encodeURIComponent(code)}/leave`, { method: 'POST' }),

  startGame: (code) =>
    request(`/api/room/${encodeURIComponent(code)}/start`, { method: 'POST' }),

  addBot: (code) =>
    request(`/api/room/${encodeURIComponent(code)}/bot`, { method: 'POST' }),

  getRoom: (code) =>
    request(`/api/room/${encodeURIComponent(code)}`),

  // Long-poll consumer fetch — Kafka-style: hand it the last seq you saw.
  fetchEvents: (code, since, { waitMs = 20_000, signal } = {}) =>
    request(
      `/api/room/${encodeURIComponent(code)}/events?since=${since}&wait=${waitMs}`,
      { signal },
    ),

  // All turn/jail actions go through a single dispatcher to stay under
  // Vercel Hobby's 12-function limit. The `type` field selects the op.
  action: (code, type) =>
    request(`/api/room/${encodeURIComponent(code)}/action`, {
      method: 'POST',
      body: { type },
    }),

  rollDice: (code) => api.action(code, 'roll'),
  buy:      (code) => api.action(code, 'buy'),
  decline:  (code) => api.action(code, 'decline'),
  endTurn:  (code) => api.action(code, 'end'),
  payJail:  (code) => api.action(code, 'jail-pay'),
  build:    (code, tileIdx) =>
    request(`/api/room/${encodeURIComponent(code)}/action`, {
      method: 'POST',
      body: { type: 'build', tileIdx },
    }),
};
