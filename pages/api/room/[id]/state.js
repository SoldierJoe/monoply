import { getRoom } from '../../../../lib/store';

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const room = getRoom(req.query.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
}
