/**
 * Tiny helpers for Vercel Node-style serverless handlers.
 * Keeps the route files focused on game logic, not plumbing.
 */

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function ok(res, body = {}) {
  json(res, 200, { ok: true, ...body });
}

export function fail(res, status, message) {
  json(res, status, { ok: false, error: message });
}

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

export function getPlayerId(req) {
  return (
    req.headers['x-player-id'] ||
    req.headers['X-Player-Id'] ||
    null
  );
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  fail(res, 405, `Method not allowed. Use ${allowed.join(', ')}.`);
}
