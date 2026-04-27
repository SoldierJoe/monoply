/**
 * Pure turn/dice operations. Same contract as rooms.js: take (ctx, room, ...),
 * mutate room in place, push events to ctx.events.
 */

import { advanceTurn, bankruptPlayer, pushLog } from './rooms.js';

const JAIL_TILE = 10;
const JAIL_FINE = 50;

function rollDie() {
  return 1 + Math.floor(Math.random() * 6);
}

export function rollDice(ctx, room, playerId) {
  if (room.phase !== 'playing') throw new Error('Game not running');
  if (room.currentPlayerId !== playerId) throw new Error('Not your turn');
  if (room.hasRolled && room.pendingPurchaseTileIdx === null) {
    throw new Error('Already rolled — end your turn');
  }
  if (room.pendingPurchaseTileIdx !== null) {
    throw new Error('Resolve pending purchase first');
  }

  const player = room.players.find(p => p.id === playerId);
  const d1 = rollDie();
  const d2 = rollDie();
  const isDouble = d1 === d2;
  room.lastRoll = { d1, d2, total: d1 + d2, isDouble };
  room.hasRolled = true;
  ctx.events.push({ type: 'turn:rolled', playerId, d1, d2, isDouble });

  if (player.inJail) {
    handleJailRoll(ctx, room, player, isDouble, d1 + d2);
    return room.lastRoll;
  }

  if (isDouble) {
    room.doublesCount += 1;
    if (room.doublesCount >= 3) {
      pushLog(ctx, room, `${player.name} rolled three doubles — straight to jail.`);
      sendToJail(ctx, room, player);
      return room.lastRoll;
    }
  } else {
    room.doublesCount = 0;
  }

  movePlayer(ctx, room, player, d1 + d2);
  return room.lastRoll;
}

function handleJailRoll(ctx, room, player, isDouble, total) {
  if (isDouble) {
    pushLog(ctx, room, `${player.name} rolls doubles and walks free.`);
    player.inJail = false;
    player.jailTurns = 0;
    movePlayer(ctx, room, player, total);
    room.doublesCount = 0;
  } else {
    player.jailTurns += 1;
    if (player.jailTurns >= 3) {
      pushLog(ctx, room, `${player.name} pays ${JAIL_FINE} after 3 turns in jail.`);
      chargePlayer(ctx, room, player, JAIL_FINE, null);
      player.inJail = false;
      player.jailTurns = 0;
      if (!player.bankrupt) movePlayer(ctx, room, player, total);
    } else {
      pushLog(ctx, room, `${player.name} stays in jail (turn ${player.jailTurns}/3).`);
    }
  }
}

function movePlayer(ctx, room, player, steps) {
  const from = player.position;
  const to = (from + steps) % 40;
  if (to < from) {
    player.cash += 200;
    pushLog(ctx, room, `${player.name} passes Tahrir Square — collect 200.`);
  }
  player.position = to;
  ctx.events.push({ type: 'player:moved', playerId: player.id, from, to });
  resolveLanding(ctx, room, player);
}

function resolveLanding(ctx, room, player) {
  const tile = room.board[player.position];
  pushLog(ctx, room, `${player.name} lands on ${tile.name}.`);

  switch (tile.type) {
    case 'go':
    case 'free':
    case 'jail':
    case 'cc':
    case 'chance':
      break;
    case 'gotojail':
      sendToJail(ctx, room, player);
      break;
    case 'tax':
      chargePlayer(ctx, room, player, tile.amount, null);
      break;
    case 'property':
    case 'railroad':
    case 'utility':
      resolvePropertyLanding(ctx, room, player, tile);
      break;
  }
}

function resolvePropertyLanding(ctx, room, player, tile) {
  if (tile.ownerId === null) {
    if (player.cash >= tile.price) {
      room.pendingPurchaseTileIdx = tile.idx;
      pushLog(ctx, room, `${tile.name} is unowned — ${player.name} can buy for ${tile.price}.`);
    } else {
      pushLog(ctx, room, `${player.name} can't afford ${tile.name}.`);
    }
    return;
  }
  if (tile.ownerId === player.id) return;
  if (tile.mortgaged) {
    pushLog(ctx, room, `${tile.name} is mortgaged — no rent.`);
    return;
  }
  const rent = computeRent(room, tile);
  const owner = room.players.find(p => p.id === tile.ownerId);
  pushLog(ctx, room, `${player.name} pays ${owner.name} ${rent} rent for ${tile.name}.`);
  chargePlayer(ctx, room, player, rent, owner.id);
}

function computeRent(room, tile) {
  if (tile.type === 'property') {
    if (tile.houses > 0) return tile.rent[Math.min(tile.houses, 5)];
    const groupTiles = room.board.filter(t => t.type === 'property' && t.group === tile.group);
    const ownsWholeGroup = groupTiles.every(t => t.ownerId === tile.ownerId);
    return ownsWholeGroup ? tile.rent[0] * 2 : tile.rent[0];
  }
  if (tile.type === 'railroad') {
    const ownedCount = room.board.filter(
      t => t.type === 'railroad' && t.ownerId === tile.ownerId,
    ).length;
    return tile.rent[ownedCount - 1];
  }
  if (tile.type === 'utility') {
    const ownedCount = room.board.filter(
      t => t.type === 'utility' && t.ownerId === tile.ownerId,
    ).length;
    const multiplier = ownedCount === 2 ? 10 : 4;
    return room.lastRoll.total * multiplier;
  }
  return 0;
}

function sendToJail(ctx, room, player) {
  player.position = JAIL_TILE;
  player.inJail = true;
  player.jailTurns = 0;
  room.doublesCount = 0;
  pushLog(ctx, room, `${player.name} is sent to jail.`);
  ctx.events.push({ type: 'player:jailed', playerId: player.id });
}

function chargePlayer(ctx, room, player, amount, creditorId) {
  if (player.cash >= amount) {
    player.cash -= amount;
    if (creditorId) {
      const creditor = room.players.find(p => p.id === creditorId);
      if (creditor) creditor.cash += amount;
    }
    return true;
  }
  if (creditorId) {
    const creditor = room.players.find(p => p.id === creditorId);
    if (creditor) creditor.cash += player.cash;
  }
  player.cash = 0;
  bankruptPlayer(ctx, room, player, creditorId);
  return false;
}

export function buyProperty(ctx, room, playerId) {
  if (room.currentPlayerId !== playerId) throw new Error('Not your turn');
  if (room.pendingPurchaseTileIdx === null) throw new Error('Nothing to buy');
  const tile = room.board[room.pendingPurchaseTileIdx];
  const player = room.players.find(p => p.id === playerId);
  if (tile.ownerId !== null) throw new Error('Already owned');
  if (player.cash < tile.price) throw new Error('Insufficient funds');

  player.cash -= tile.price;
  tile.ownerId = player.id;
  pushLog(ctx, room, `${player.name} buys ${tile.name} for ${tile.price}.`);
  ctx.events.push({ type: 'property:bought', playerId, tileIdx: tile.idx });
  room.pendingPurchaseTileIdx = null;
}

export function declinePurchase(ctx, room, playerId) {
  if (room.currentPlayerId !== playerId) throw new Error('Not your turn');
  if (room.pendingPurchaseTileIdx === null) return;
  const tile = room.board[room.pendingPurchaseTileIdx];
  const player = room.players.find(p => p.id === playerId);
  pushLog(ctx, room, `${player.name} passes on ${tile.name}.`);
  room.pendingPurchaseTileIdx = null;
}

export function endTurn(ctx, room, playerId) {
  if (room.currentPlayerId !== playerId) throw new Error('Not your turn');
  if (!room.hasRolled) throw new Error('You must roll first');
  if (room.pendingPurchaseTileIdx !== null) {
    throw new Error('Resolve pending purchase first');
  }

  const player = room.players.find(p => p.id === playerId);
  const justRolledDouble = room.lastRoll?.isDouble && !player.inJail;
  if (justRolledDouble && room.doublesCount > 0 && room.doublesCount < 3) {
    room.hasRolled = false;
    pushLog(ctx, room, `${player.name} rolled doubles — rolls again.`);
    return;
  }
  advanceTurn(ctx, room);
}

export function payJailFine(ctx, room, playerId) {
  if (room.currentPlayerId !== playerId) throw new Error('Not your turn');
  const player = room.players.find(p => p.id === playerId);
  if (!player.inJail) throw new Error('Not in jail');
  if (room.hasRolled) throw new Error('Already rolled this turn');
  if (player.cash < JAIL_FINE) throw new Error('Insufficient funds');
  player.cash -= JAIL_FINE;
  player.inJail = false;
  player.jailTurns = 0;
  pushLog(ctx, room, `${player.name} pays ${JAIL_FINE} to leave jail.`);
}
