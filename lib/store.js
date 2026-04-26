// In-memory store — works for demos. 
// For production on Vercel, swap this with Vercel KV (Redis):
//   import { kv } from '@vercel/kv';
//   export const getRooms = () => kv; // etc.

let rooms = {};

export function getRooms() { return rooms; }
export function getRoom(id) { return rooms[id]; }
export function setRoom(id, room) { rooms[id] = room; }
export function deleteRoom(id) { delete rooms[id]; }

// Clean up old rooms every 10 min
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 hours
    Object.keys(rooms).forEach(id => {
      if (rooms[id].createdAt < cutoff) delete rooms[id];
    });
  }, 10 * 60 * 1000);
}
