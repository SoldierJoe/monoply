import { rollDice, buyProperty, declineBuy, buildHouse, endTurn, startGame } from '../../../../lib/gameEngine';
import { getRoom, setRoom } from '../../../../lib/store';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { id } = req.query;
  const { action, playerId, ...data } = req.body || {};

  const room = getRoom(id);
  if (!room) {
    return res.status(404).json({
      error: 'Room state was lost. This can happen on Vercel after inactivity. Please create a new room.',
      code: 'ROOM_NOT_FOUND',
    });
  }

  let result = {};
  switch (action) {
    case 'start':       result = startGame(room); break;
    case 'roll':        result = rollDice(room, playerId); break;
    case 'buy':         result = buyProperty(room, playerId, data.squareId); break;
    case 'decline_buy': result = declineBuy(room, playerId); break;
    case 'build_house': result = buildHouse(room, playerId, data.squareId); break;
    case 'end_turn':    result = endTurn(room, playerId); break;
    default:            result = { error: 'Unknown action' };
  }

  if (result.error) return res.status(400).json(result);
  setRoom(id, room);
  res.json({ ok: true });
}
