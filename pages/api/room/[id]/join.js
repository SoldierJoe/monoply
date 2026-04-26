import { addPlayer } from '../../../../lib/gameEngine';
import { getRoom, setRoom } from '../../../../lib/store';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;
  const { playerName } = req.body;
  if (!playerName?.trim()) return res.status(400).json({ error: 'Name required' });

  const room = getRoom(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const result = addPlayer(room, playerName.trim());
  if (result.error) return res.status(400).json(result);

  setRoom(id, room);
  res.json({ playerId: result.playerId });
}
