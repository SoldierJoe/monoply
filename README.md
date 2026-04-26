# 🎲 Monopoly Online — Multiplayer

A full multiplayer Monopoly game built with Next.js, deployable to Vercel in minutes.

## Features
- 2–8 players per room
- Room codes for sharing
- Real-time state sync via polling (1.5s interval)
- Full Monopoly rules: properties, railroads, utilities, rent, houses, hotels, jail, cards, taxes
- No database needed — state is in-memory (see upgrade note below)

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

That's it! Vercel auto-detects Next.js.

## ⚠️ In-Memory State Note

Game state lives in `lib/store.js` as a JavaScript `Map`. This works perfectly for demos and prototyping. On Vercel's serverless infrastructure, state resets on cold starts (after ~5 min of inactivity).

### Upgrade to persistent state (5 min):

1. `npm install @vercel/kv`
2. In Vercel dashboard → Storage → Create KV database
3. Replace `lib/store.js` with:

```js
import { kv } from '@vercel/kv';
export const getRoom = (id) => kv.get(`room:${id}`);
export const setRoom = (id, room) => kv.set(`room:${id}`, room, { ex: 7200 });
export const deleteRoom = (id) => kv.del(`room:${id}`);
```

## Project Structure

```
pages/
  index.js              # Home/lobby
  room/[id].js          # Game room
  api/room/
    create.js           # POST - create room
    [id]/
      join.js           # POST - join room
      state.js          # GET  - poll game state
      action.js         # POST - game actions

lib/
  boardData.js          # Board squares, cards, tokens
  gameEngine.js         # All game logic
  store.js              # In-memory state

components/
  Board.js              # SVG board renderer
```

## Game Actions

All actions go to `POST /api/room/[id]/action` with `{ action, playerId, ...data }`:

| Action | Description |
|--------|-------------|
| `start` | Host starts the game |
| `roll` | Roll dice |
| `buy` | Buy landed property |
| `decline_buy` | Pass on buying |
| `build_house` | Build house/hotel on owned property |
| `end_turn` | End current turn |
