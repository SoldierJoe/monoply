import { createRoom, addPlayer } from '../../../lib/gameEngine';
import { setRoom } from '../../../lib/store';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { hostName } = req.body;
  if (!hostName?.trim()) return res.status(400).json({ error: 'Name required' });

  const roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
  const room = createRoom(roomId, hostName.trim());
  const result = addPlayer(room, hostName.trim());
  if (result.error) return res.status(400).json(result);

  setRoom(roomId, room);
  res.json({ roomId, playerId: result.playerId });
}
