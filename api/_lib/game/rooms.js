/**
 * Pure room/lobby operations. No I/O — every function takes a `room` object
 * and a `ctx` for log emission, and mutates `room` in place. The caller
 * (API route) is responsible for loading via the store and persisting.
 */

import { makeBoard } from './board.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;
const STARTING_CASH = 1500;
const TOKENS = ['felucca', 'fez', 'cat', 'pyramid', 'lantern', 'scarab'];

export function makeCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    token: p.token,
    cash: p.cash,
    position: p.position,
    inJail: p.inJail,
    jailTurns: p.jailTurns,
    jailFreeCards: p.jailFreeCards,
    bankrupt: p.bankrupt,
    connected: p.connected,
  };
}

export function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map(publicPlayer),
    board: room.board,
    turn: {
      currentPlayerId: room.currentPlayerId,
      lastRoll: room.lastRoll,
      doublesCount: room.doublesCount,
      hasRolled: room.hasRolled,
      pendingPurchaseTileIdx: room.pendingPurchaseTileIdx,
      log: room.log.slice(-30),
      winnerId: room.winnerId ?? null,
    },
  };
}

export function newRoomState({ code, hostId }) {
  return {
    code,
    hostId,
    phase: 'lobby',
    players: [],
    board: makeBoard(),
    currentPlayerId: null,
    lastRoll: null,
    doublesCount: 0,
    hasRolled: false,
    pendingPurchaseTileIdx: null,
    log: [],
    winnerId: null,
  };
}

export function pushLog(ctx, room, message) {
  const entry = { at: Date.now(), message };
  room.log.push(entry);
  ctx.events.push({ type: 'log', message });
}

export function addPlayer(ctx, room, playerId, name) {
  if (room.phase !== 'lobby') throw new Error('Game already started');
  if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full');
  if (room.players.some(p => p.id === playerId)) {
    return room.players.find(p => p.id === playerId);
  }

  const cleanName = (name || 'Player').trim().slice(0, 20) || 'Player';
  const usedTokens = new Set(room.players.map(p => p.token));
  const token = TOKENS.find(t => !usedTokens.has(t)) ?? TOKENS[0];

  const player = {
    id: playerId,
    name: cleanName,
    token,
    cash: STARTING_CASH,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailFreeCards: 0,
    bankrupt: false,
    connected: true,
  };
  room.players.push(player);
  pushLog(ctx, room, `${cleanName} joined.`);
  ctx.events.push({ type: 'player:joined', playerId, name: cleanName });
  return player;
}

export function removePlayer(ctx, room, playerId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { roomDeleted: false };

  if (room.phase === 'lobby') {
    room.players = room.players.filter(p => p.id !== playerId);
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }
    pushLog(ctx, room, `${player.name} left.`);
  } else {
    player.connected = false;
    if (!player.bankrupt) {
      bankruptPlayer(ctx, room, player, null);
    }
    if (room.currentPlayerId === playerId) {
      advanceTurn(ctx, room);
    }
  }

  ctx.events.push({ type: 'player:left', playerId });

  if (room.players.length === 0) {
    return { roomDeleted: true };
  }

  if (room.phase === 'playing') {
    const alive = room.players.filter(p => !p.bankrupt);
    if (alive.length === 1) {
      room.phase = 'ended';
      room.winnerId = alive[0].id;
      pushLog(ctx, room, `${alive[0].name} wins by default — everyone else is out.`);
    }
  }
  return { roomDeleted: false };
}

export function startGame(ctx, room) {
  if (room.phase !== 'lobby') throw new Error('Already started');
  if (room.players.length < MIN_PLAYERS) throw new Error('Need at least 2 players');
  room.phase = 'playing';
  room.currentPlayerId = room.players[0].id;
  room.hasRolled = false;
  room.doublesCount = 0;
  pushLog(ctx, room, `Game started — ${room.players[0].name}'s turn.`);
  ctx.events.push({ type: 'game:started' });
}

export function advanceTurn(ctx, room) {
  const alive = room.players.filter(p => !p.bankrupt);
  if (alive.length <= 1) {
    if (alive.length === 1) {
      room.phase = 'ended';
      room.winnerId = alive[0].id;
      pushLog(ctx, room, `${alive[0].name} wins!`);
    }
    return;
  }
  const idx = room.players.findIndex(p => p.id === room.currentPlayerId);
  let next = idx;
  for (let i = 0; i < room.players.length; i++) {
    next = (next + 1) % room.players.length;
    if (!room.players[next].bankrupt) break;
  }
  room.currentPlayerId = room.players[next].id;
  room.hasRolled = false;
  room.doublesCount = 0;
  room.pendingPurchaseTileIdx = null;
  pushLog(ctx, room, `${room.players[next].name}'s turn.`);
}

export function bankruptPlayer(ctx, room, player, creditorId) {
  player.bankrupt = true;
  for (const tile of room.board) {
    if (tile.ownerId === player.id) {
      if (creditorId) {
        tile.ownerId = creditorId;
        tile.mortgaged = false;
      } else {
        tile.ownerId = null;
        tile.houses = 0;
        tile.mortgaged = false;
      }
    }
  }
  pushLog(ctx, room, `${player.name} is bankrupt.`);
}
