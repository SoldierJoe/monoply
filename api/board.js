import { BOARD } from './_lib/game/board.js';
import { json, methodNotAllowed } from './_lib/http.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  json(res, 200, BOARD);
}
