# Cairo Monopoly

A self-hosted Monopoly clone with a Cairo theme — playable in the
browser with friends over a single shared link. **Fully serverless** on
Vercel: React client + a set of Vercel API routes that share a
Redis-like in-memory store and a Kafka-style event log per room.

The server is still **authoritative**. Clients POST action requests
(`/api/room/<code>/action` with `{type: "roll"|"buy"|...}`) and the
function validates against the rules, mutates state, and appends
events to the room's log. Actions are funneled through a single
dispatcher to stay under Vercel Hobby's 12-function limit.
Other clients long-poll `/api/room/<code>/events?since=<seq>` and pull
a fresh snapshot whenever new events appear — exactly like Kafka
consumers tracking an offset.

```
┌────────┐  POST action     ┌────────┐  rpush to events log     ┌────────┐
│ Client │ ───────────────▶ │ /api/* │ ───────────────────────▶ │ store  │
│  (you) │                  │ (auth) │                          │ (KV +  │
└────────┘                  └────────┘                          │  list) │
     ▲                                                          └────────┘
     │  GET /events?since=N (long-poll, ≤25s)                        │
     └──────────────────────────────────────────────────────────────-┘
        Kafka-style consumer offset
```

### Architecture at a glance

- **No WebSockets.** Every interaction is an HTTP request to `/api/*`.
- **Redis-like store** (`api/_lib/store.js`) with a swap-in adapter.
  Default adapter is in-memory, with a **30-minute idle TTL** per room.
  Swap to Upstash/Redis without touching game logic.
- **Kafka-style event log** (`api/_lib/eventlog.js`) per room. Each
  state-changing op appends events; clients long-poll for everything
  past their last seen `seq`.
- **Player identity** lives in `localStorage` as a stable `playerId` and
  is sent on every request via `X-Player-Id`. No socket IDs.
- **Game logic is pure** in `api/_lib/game/{board,rooms,turn}.js` —
  takes `(ctx, room, ...)`, mutates the room, and pushes events to
  `ctx.events`. The route handlers do the I/O around it.

### Running locally

```bash
npm install -g vercel
cd cairo-monopoly
vercel dev          # serves client + /api on http://localhost:3000
```

That's it — no separate server process. `vercel dev` runs the API
routes as functions and serves the client build/HMR on the same origin.

### Deploying

```bash
vercel              # one-time link
vercel --prod
```

The in-memory store is per-instance, so for production with multiple
users you'll want to swap `api/_lib/store-memory.js` for an Upstash
Redis adapter. The store interface (`get`/`set`/`mutate`/`rpush`/
`lrange`/`llen`) is intentionally Redis-shaped to make this a one-file
change.

---

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Server runtime | Node.js 20+ | `node --watch`, native ESM, Socket.io maturity |
| Server framework | Express + Socket.io | Minimal HTTP + battle-tested websocket layer |
| Client | React 18 + Vite | Fast HMR, simple build, no over-engineering |
| Realtime | Socket.io 4 | Built-in rooms, reconnection, fallbacks |
| Styling | Plain CSS + tokens | Theme-able with CSS vars, no framework lock-in |

No database. Game state lives in server memory; if the server restarts,
in-flight games end. That's fine for a friends-only game; persistence
can come later if needed.

---

## Roadmap

Eight phases, each independently testable. Phase 1 is shipped; phases
2–8 are specified below in enough detail to implement straight from
this doc.

| # | Name | Status | What you can do at the end |
|---|------|--------|-----------------------------|
| 1 | Setup | ✅ Done | Run server + client locally, see "Online" pill, ping round-trips |
| 2 | Rooms & Lobby | ☐ | Create a room, share a code, see other players join |
| 3 | Static Board | ☐ | See the 40-tile Cairo board rendered, with players at GO |
| 4 | Turn Loop | ☐ | Roll dice, watch your token move, hand off the turn |
| 5 | Properties | ☐ | Buy properties on landing, pay rent to owners |
| 6 | Jail | ☐ | Go-to-jail tile works, three-doubles rule, pay/roll to leave |
| 7 | Bankruptcy & Win | ☐ | Last player standing wins; bankrupt players' assets transfer |
| 8 | Polish | ☐ | Token animations, dice animations, mobile layout, sounds |

---

## Phase 1 — Setup ✅

**Goal.** Stand up server + client. Prove they can talk over a websocket.
Have the static Cairo board data ready so we can light it up in Phase 3.

**Deliverables**
- Express + Socket.io server on `:3001` with health check at `/`
- Cairo board template (`server/game/board.js`) — 40 validated tiles
- React + Vite client on `:5173`, themed Home page
- Singleton Socket.io client (`client/src/socket.js`)
- Connection-status pill (Online / Offline)
- "Ping server" button that round-trips through Socket.io

**Acceptance**
- `npm run dev` works in both folders
- Visit `http://localhost:5173` → Online pill turns green
- Click "Ping server" → success message with timestamp

**Files**
```
server/index.js
server/package.json
server/game/board.js
client/index.html
client/vite.config.js
client/package.json
client/src/{main.jsx, App.jsx, socket.js, styles.css}
client/src/pages/Home.jsx
```

---

## Phase 2 — Rooms & Lobby

**Goal.** Two or more browsers can join the same game room via a shared
6-character code. Host can start the game when at least 2 players are
present.

**New server pieces**
- `server/rooms.js` — in-memory registry: `Map<code, RoomState>`
- 6-char alphanumeric code generator (avoid I, O, 0, 1 to reduce typos)
- Auto-cleanup: if a room is empty for >5 min, drop it
- Each socket joins a Socket.io *room* matching the code, so broadcasts
  are scoped automatically

**RoomState shape**

```js
RoomState {
  code: string                    // e.g. "K7DPMX"
  hostId: string                  // socket id of creator
  status: 'lobby' | 'playing' | 'finished'
  players: Player[]               // ordered by join time
  createdAt: number
}

Player {
  id: string                      // socket id
  name: string
  color: string                   // assigned from a fixed palette
  // game-state fields added in later phases:
  cash: 1500,
  position: 0,
  inJail: false,
  bankrupt: false,
}
```

**Socket events introduced**

Client → Server:
- `room:create({ name }, ack)` → `ack({ code, you: Player })`
- `room:join({ name, code }, ack)` → `ack({ ok, room?, error? })`
- `room:leave()`
- `game:start()` (host only; requires ≥2 players)

Server → Client (broadcast within room):
- `room:update(roomState)` — sent on any membership change
- `game:started(initialGameState)` — transitions everyone to the game page
- `error({ message })` — for invalid actions

**Client work**
- `pages/Home.jsx` — wire up Create + Join buttons, navigate to Lobby on success
- `pages/Lobby.jsx` — show player list, room code (with copy-to-clipboard),
  host's "Start Game" button (disabled until 2+ players)
- Tiny `useRoom` hook that holds room state and subscribes to `room:update`
- Page routing: simple state in `App.jsx` (`'home' | 'lobby' | 'game'`) —
  no router library needed for three pages

**Acceptance**
- Two browser tabs can both join the same room
- Both tabs see each other in the player list within 1 second
- Closing a tab removes that player from the others' lists
- Host clicking "Start Game" navigates everyone to the (still-empty) Game page

---

## Phase 3 — Static Board Rendering

**Goal.** Render the 40-tile Cairo board on the Game page. Show every
player's token sitting on GO. No interactivity yet — just looks like
the real thing.

**Layout.** Classic Monopoly layout: an 11×11 grid where the 4 corners
and 9 tiles per side make the perimeter. CSS Grid with named lines is
the cleanest fit:

```
┌─────┬───────────────────────┬─────┐
│ 20  │  21  22  23  24 …  29 │ 30  │  ← top row
├─────┼───────────────────────┼─────┤
│ 19  │                       │ 31  │
│ ⋮   │      center area      │ ⋮   │
│ 11  │                       │ 39  │
├─────┼───────────────────────┼─────┤
│ 10  │   9   8   7  …    1   │  0  │  ← bottom row
└─────┴───────────────────────┴─────┘
```

**Components**
- `Game.jsx` — page wrapper; pulls `gameState` from socket
- `Board.jsx` — the grid; positions 40 `<Tile />` children
- `Tile.jsx` — single tile renderer, branches on `tile.type`:
  - property → color stripe + name + price
  - railroad → train icon + name
  - utility → bolt/water icon + name
  - corner tiles → distinct treatment (GO, jail bars, free parking,
    "go to jail" arrow)
- `Token.jsx` — small colored disc absolutely positioned on its tile,
  one per player; multiple tokens on the same tile fan out
- Center area: large Art Deco "CAIRO" treatment + game log scroll

**Tile sizing**. ~7vmin square tiles works on desktop; tile names use
the smaller side so the orientation matches the player's view of that
edge of the board (top tiles read upside-down to people standing at
the bottom — same as the physical game).

**Acceptance**
- Loading the Game page shows the full 40-tile board with all themed names
- Each player has a colored token on GO
- Resizing the window keeps the board square and centered
- Names fit on tiles without truncation at the default size

---

## Phase 4 — Turn Loop

**Goal.** Active player can roll dice, watch their token move, and end
their turn. No properties yet — landing on anything just sits there.

**GameState additions**

```js
GameState {
  // ...from Phase 2
  currentPlayerIdx: 0,
  dice: [number, number] | null,    // last roll
  doublesCount: 0,                   // resets when turn ends
  turnPhase: 'roll' | 'action' | 'end',
}
```

**Turn FSM** (server side)

```
roll → action → end
 ▲                │
 └── if doubles ──┘   (max 3, then jail in Phase 6)
```

- `roll`: only `turn:roll` accepted
- `action`: post-roll, only `turn:end` (more options in Phase 5)
- `end`: turn passes to next non-bankrupt player

**Pass-GO logic.** When `newPos < oldPos` (wrapped past 39 → 0), award
the GO reward (200) to the player.

**Socket events introduced**

Client → Server:
- `turn:roll()`
- `turn:end()`

Server → Client:
- `state:update(gameState)` — full state after every change (simpler
  than diffs; for ≤6 players the bandwidth is fine)
- `event:dice({ playerId, roll: [d1, d2], doubles: bool })` — for animation
- `event:moved({ playerId, from, to, passedGo })` — for animation

**Client work**
- `Dice.jsx` — shows the two dice; consumes `event:dice`
- `ActionBar.jsx` — bottom of the screen; shows "Roll" if it's your turn
  and `turnPhase === 'roll'`, otherwise greys out
- Token movement: in Phase 4 we can use a snap (instant); the smooth
  tween animation comes in Phase 8

**Acceptance**
- Active player sees the Roll button enabled; others see it greyed with
  "Mohamed's turn" label
- Clicking Roll: dice update for everyone, token moves, log entry appears
- Doubles → roll button stays enabled
- After non-doubles roll, End Turn button enables; clicking it advances
- Passing GO awards 200 EGP, visible in the player card

---

## Phase 5 — Properties

**Goal.** Buy properties on landing on unowned ones. Pay rent on landing
on owned ones (automatically). Win condition still doesn't fire — just
accumulating cash and properties.

**GameState additions**. Per-tile fields are already in the board template
(`ownerId`, `houses`, `mortgaged`); they get populated as the game runs.
Game state itself doesn't need new fields.

**Rules implemented**
- Land on unowned property → option to buy at face price
- Land on owned property → auto-pay rent to owner
  - Rent = base if no monopoly, **2× base** if owner holds full color group
  - (Houses are MVP-out-of-scope but the data already supports them)
- Land on owned **railroad** → rent = `[25, 50, 100, 200][nOwnedRailroads-1]`
- Land on owned **utility** → rent = `dice_total × (4 if 1 utility, 10 if 2)`
- Land on **tax** tile → pay the listed amount to the bank (lost from game)
- Skip-on-decline: if the player declines to buy, property stays
  unowned (auctions are deferred to a post-MVP phase, per the original spec)

**Socket events introduced**

Client → Server:
- `turn:buy()` (only valid in `action` phase, on unowned property)
- `turn:skip()` (decline to buy)

Server → Client:
- `event:bought({ playerId, tileIdx, price })`
- `event:rentPaid({ fromId, toId, tileIdx, amount })`
- `event:taxPaid({ playerId, amount })`

**Client work**
- `PropertyCard.jsx` — popup-style card shown when landing on an unowned
  property; "Buy for 220" / "Skip" buttons
- Rent toast / log entries
- Player panel shows owned properties grouped by color

**Acceptance**
- Landing on Imbaba (idx 1) shows a buy prompt with "60 EGP"
- Buying deducts cash, marks tile owned, color-tints the tile
- Another player landing on it pays the correct rent automatically
- Owning both Imbaba and Bulaq doubles rent for both (monopoly bonus)
- Owning 2 of the 4 railroads charges 50 EGP rent

---

## Phase 6 — Jail

**Goal.** Jail mechanics work end-to-end.

**Three ways into jail**
1. Land on tile 30 ("Go to Jail")
2. Roll three doubles in a row in one turn
3. (Chance/CC card "Go to Jail" — out of MVP scope; deferred)

**Three ways out**
1. Pay 50 EGP at the start of your turn
2. Roll doubles on any of your next 3 turns (immediate exit + use that roll)
3. After 3 turns, must pay and exit (or go bankrupt trying)

**GameState changes**. `Player` already has `inJail` and `jailTurns` fields.
The action handlers route differently when `currentPlayer.inJail`.

**Socket events introduced**

Client → Server:
- `jail:pay()` — at start of turn, pay 50 and roll normally
- `jail:roll()` — roll for doubles; failure consumes a turn

Server → Client:
- `event:jailed({ playerId, reason: 'tile' | 'doubles' })`
- `event:released({ playerId, by: 'paid' | 'doubles' | 'forced' })`

**Client work**
- Jail UI in the player card and on tile 10 (small icon showing jailed
  players)
- ActionBar shows "Pay 50 to Leave" / "Roll for Doubles" while in jail

**Acceptance**
- Landing on tile 30 → token jumps to tile 10, player marked jailed
- Three doubles → same outcome
- Paying 50 → player rolls and moves normally that same turn
- Failing to roll doubles 3 turns → forced pay-and-exit on turn 3

---

## Phase 7 — Bankruptcy & Win

**Goal.** When a player can't pay a debt, they go bankrupt; their
assets transfer to the creditor (or the bank for tax debts). Last
non-bankrupt player wins.

**Bankruptcy resolution**
- Triggered when: rent or tax owed > current cash, with no recovery
  path (Phase-7 MVP doesn't include house-selling/mortgaging, so this
  fires the moment cash is insufficient — we'll loosen this later)
- All properties owned by the bankrupt player transfer to the creditor
  (or revert to unowned if creditor is the bank)
- Player marked `bankrupt: true`, removed from turn rotation
- Their token disappears from the board

**Win condition.** Checked after every state mutation: if exactly one
non-bankrupt player remains, set `status: 'finished'` and broadcast a
`game:over` event with the winner.

**Socket events introduced**

Server → Client:
- `event:bankrupt({ playerId, creditorId | null })`
- `game:over({ winnerId, finalState })`

**Client work**
- `pages/GameOver.jsx` — winner takes the screen; "Back to lobby" button
- Bankrupt players see a spectator view; can stay in the room and watch

**Acceptance**
- Player owing more than they have → goes bankrupt, properties transfer
- Last solvent player → game ends, GameOver screen shows their name
- Bankrupt players can still see the board but can't act

---

## Phase 8 — Polish

A grab-bag of quality-of-life upgrades. Each is small and independent;
do them in any order.

- **Smooth token movement** — tween from old position to new along the
  board path, hopping tile-by-tile (~150ms per tile). Use the
  Web Animations API or a simple `requestAnimationFrame` loop.
- **3D dice roll** — CSS-only animated dice (cube with face transforms)
  that comes to rest on the rolled values
- **Sounds** — dice clatter, cash register on buy, jail door on jailing,
  fanfare on win. Web Audio or just `<audio>` tags. Mute toggle in UI.
- **Toast notifications** — "Mohamed bought Zamalek" type popups, top-right
- **Mobile layout** — board scales to viewport; on narrow screens the
  player panel becomes a bottom drawer
- **Reconnection** — if a player drops mid-game, hold their seat for 60s;
  they re-join the same room with their state intact
- **Spectator mode** — share a read-only link to the game; spectators
  see the board but can't act
- **Game log** — center-of-board scroll showing every action, with
  timestamps; hover to highlight the related tile/player

---

## Data model (consolidated)

By the end of Phase 7, the full server-side game state looks like:

```js
GameState {
  // identity & lifecycle
  code: string                              // shared with RoomState.code
  hostId: string
  status: 'lobby' | 'playing' | 'finished'
  createdAt: number

  // players (ordered)
  players: Player[]
  currentPlayerIdx: number

  // turn state
  dice: [number, number] | null
  doublesCount: number
  turnPhase: 'roll' | 'action' | 'end'

  // board state
  board: Tile[]                              // mutable copy of the template

  // event log (server-side, optional broadcast)
  log: { t: number, type: string, ...payload }[]
}

Player {
  id: string                                 // socket id
  name: string
  color: string                              // hex from token palette
  cash: number                               // starts at 1500
  position: number                           // 0–39
  inJail: boolean
  jailTurns: number                          // 0–3
  bankrupt: boolean
}

Tile {
  idx: number                                // 0–39
  type: 'go' | 'property' | 'railroad' | 'utility'
       | 'tax' | 'jail' | 'gotojail' | 'free' | 'chance' | 'cc'
  name: string

  // property-only
  group?: 'brown' | 'lightblue' | 'pink' | 'orange'
        | 'red' | 'yellow' | 'green' | 'darkblue'
  price?: number
  rent?: number[]                            // [base, 1h, 2h, 3h, 4h, hotel]
  houseCost?: number
  mortgageValue?: number
  ownerId?: string | null
  houses?: 0 | 1 | 2 | 3 | 4 | 5             // 5 = hotel
  mortgaged?: boolean

  // railroad / utility — same ownership fields, no houses
  // tax — has `amount`
  // go — has `passReward`
}
```

---

## Socket protocol (consolidated)

### Client → Server

| Event | Payload | Phase | Notes |
|-------|---------|-------|-------|
| `ping` | `{ from, t }` | 1 | Smoke test; remove once Phase 4 lands |
| `room:create` | `{ name }` | 2 | ack returns `{ code, you }` |
| `room:join` | `{ name, code }` | 2 | ack returns `{ ok, room?, error? }` |
| `room:leave` | — | 2 | |
| `game:start` | — | 2 | Host only; ≥2 players required |
| `turn:roll` | — | 4 | Active player only, in `roll` phase |
| `turn:end` | — | 4 | Active player only, in `action` phase |
| `turn:buy` | — | 5 | After landing on unowned property |
| `turn:skip` | — | 5 | Decline to buy |
| `jail:pay` | — | 6 | At start of jailed player's turn |
| `jail:roll` | — | 6 | Try to roll doubles to escape |

### Server → Client

| Event | Payload | Phase | Scope |
|-------|---------|-------|-------|
| `room:update` | `RoomState` | 2 | Room-wide |
| `game:started` | `GameState` | 2 | Room-wide |
| `state:update` | `GameState` | 4 | Room-wide; full state, not diff |
| `event:dice` | `{ playerId, roll, doubles }` | 4 | Room-wide |
| `event:moved` | `{ playerId, from, to, passedGo }` | 4 | Room-wide |
| `event:bought` | `{ playerId, tileIdx, price }` | 5 | Room-wide |
| `event:rentPaid` | `{ fromId, toId, tileIdx, amount }` | 5 | Room-wide |
| `event:taxPaid` | `{ playerId, amount }` | 5 | Room-wide |
| `event:jailed` | `{ playerId, reason }` | 6 | Room-wide |
| `event:released` | `{ playerId, by }` | 6 | Room-wide |
| `event:bankrupt` | `{ playerId, creditorId? }` | 7 | Room-wide |
| `game:over` | `{ winnerId, finalState }` | 7 | Room-wide |
| `error` | `{ message }` | 2 | To the offending socket only |

**Why full `state:update` instead of diffs?** With ≤6 players the state
is a few KB. Diffs add complexity (sync edge cases, ordering bugs)
without meaningful gain at this scale.

---

## The Cairo board

22 properties span Cairo's actual real-estate hierarchy, from
working-class neighborhoods through the most prestigious districts:

| Tier | Group | Tiles | Price range |
|------|-------|-------|-------------|
| 1 | Brown | Imbaba, Bulaq | 60 |
| 2 | Light Blue | Shubra, Helwan, Sayeda Zeinab | 100–120 |
| 3 | Pink | Ain Shams, Matariya, El-Marg | 140–160 |
| 4 | Orange | Dokki, Agouza, Mohandessin | 180–200 |
| 5 | Red | Heliopolis, Nasr City, Korba | 220–240 |
| 6 | Yellow | Maadi, 6th of October, Sheikh Zayed | 260–280 |
| 7 | Green | New Cairo, Madinaty, New Admin Capital | 300–320 |
| 8 | Dark Blue | Garden City, **Zamalek** | 350–400 |

Plus:
- **GO** = Tahrir Square (200 EGP reward)
- **Transit** = Ramses Station, Metro Line 1, Metro Line 3, Cairo Monorail
- **Utilities** = Cairo Electricity, Cairo Water
- **Taxes** = Income Tax (200), Luxury Tax (100)

Money is in EGP units, but kept on classic Monopoly numbers (60–400) so
gameplay tuning stays familiar.

---

## Project layout

```
cairo-monopoly/
├── README.md                  ← you are here
├── .gitignore
├── server/
│   ├── package.json
│   ├── index.js               # Express + Socket.io entry
│   ├── rooms.js               # [Phase 2] room registry
│   └── game/
│       ├── board.js           # 40-tile Cairo template
│       ├── createGame.js      # [Phase 4] initial-state factory
│       ├── actions.js         # [Phase 4+] roll/buy/end-turn handlers
│       └── rules.js           # [Phase 5+] rent calc, jail logic, win check
└── client/
    ├── index.html
    ├── vite.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx            # Connection status + page routing
        ├── socket.js          # Singleton Socket.io client
        ├── styles.css         # Design tokens
        ├── pages/
        │   ├── Home.jsx       # ✅ Phase 1
        │   ├── Lobby.jsx      # [Phase 2]
        │   ├── Game.jsx       # [Phase 3]
        │   └── GameOver.jsx   # [Phase 7]
        └── components/
            ├── Board.jsx      # [Phase 3]
            ├── Tile.jsx       # [Phase 3]
            ├── Token.jsx      # [Phase 3]
            ├── Dice.jsx       # [Phase 4]
            ├── ActionBar.jsx  # [Phase 4]
            ├── PlayerCard.jsx # [Phase 4]
            └── PropertyCard.jsx # [Phase 5]
```

---

## Running locally

**Requirements** — Node.js 20 or newer, npm.

Open two terminals:

```bash
# terminal 1
cd server
npm install
npm run dev          # → http://localhost:3001
```

```bash
# terminal 2
cd client
npm install
npm run dev          # → http://localhost:5173
```

Then open `http://localhost:5173`. To play with friends on your local
network, find your machine's LAN IP (e.g. `192.168.1.42`), update
`SERVER_URL` in `client/src/socket.js` to point at it, restart Vite,
and have friends visit `http://<your-lan-ip>:5173`.

For internet play, you'll need to deploy — that's a Phase 8+ concern.
Quick options when the time comes: server on Render or Railway, client
on Vercel or Netlify, with the `SERVER_URL` set via Vite env var.

---

## Conventions

A few rules of the road, applied across phases:

- **Server is authoritative.** Never trust the client. Validate
  *every* incoming action against server state before applying it.
- **Pure action functions.** Game logic in `server/game/actions.js`
  takes `(state, action) → newState` — no I/O, no socket calls. The
  socket handler in `index.js` does the I/O around it. This keeps
  rules unit-testable.
- **No floating-point money.** All cash is integers. Avoid percentages;
  use multiplications.
- **Names over indices in logs.** `"Mohamed bought Zamalek"` not
  `"player 1 bought tile 39"`.
- **Server-side validation errors → `error` event.** Client should never
  silently fail; show a toast.
- **One feature per phase.** Resist scope creep. If a Phase-5 idea
  shows up while building Phase 3, write it down and keep moving.

---

## What's out of scope (for now)

These are real Monopoly rules that the original MVP scope deliberately
defers. We can add them in post-MVP phases without architectural change:

- **Auctions** when a player declines a property
- **Trading** between players (properties + cash)
- **Mortgaging** properties for half their price
- **Building houses and hotels** (data fields exist; rules don't)
- **Chance / Community Chest cards** (tiles render but do nothing)
- **House and hotel limits** (32 houses + 12 hotels in physical game)
- **Even-build rule** (must build evenly across a color group)

The data model accommodates all of these — the tiles already carry
`houses`, `mortgaged`, and `houseCost` fields — so adding them later
is just rules + UI, not a rewrite.
