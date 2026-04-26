import { BOARD_SQUARES, CHANCE_CARDS, COMMUNITY_CHEST_CARDS } from './boardData';

export function createRoom(roomId, hostName) {
  return {
    id: roomId,
    status: 'lobby', // lobby | playing | ended
    host: hostName,
    players: [],
    properties: {}, // squareId -> { ownerId, houses, mortgaged }
    currentPlayerIndex: 0,
    dice: [1, 1],
    hasRolled: false,
    doublesCount: 0,
    log: [`Room created. Waiting for players...`],
    chanceIndex: 0,
    communityChestIndex: 0,
    freeParkingPot: 0,
    pendingAction: null, // { type, data } - for buy/card prompts
    createdAt: Date.now(),
  };
}

export function addPlayer(room, playerName) {
  if (room.players.length >= 8) return { error: 'Room is full' };
  if (room.status !== 'lobby') return { error: 'Game already started' };
  if (room.players.find(p => p.name === playerName)) return { error: 'Name taken' };

  const id = Math.random().toString(36).slice(2, 8);
  room.players.push({
    id,
    name: playerName,
    money: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    jailFreeCards: 0,
    bankrupt: false,
    tokenIndex: room.players.length,
  });
  room.log.push(`${playerName} joined the game.`);
  return { playerId: id };
}

export function startGame(room) {
  if (room.players.length < 2) return { error: 'Need at least 2 players' };
  room.status = 'playing';
  room.log.push(`Game started! ${room.players[0].name}'s turn.`);
  return {};
}

export function rollDice(room, playerId) {
  if (room.hasRolled) return { error: 'Already rolled this turn' };
  const player = room.players[room.currentPlayerIndex];
  if (player.id !== playerId) return { error: 'Not your turn' };

  const d1 = Math.ceil(Math.random() * 6);
  const d2 = Math.ceil(Math.random() * 6);
  room.dice = [d1, d2];
  const isDoubles = d1 === d2;

  if (player.inJail) {
    if (isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      room.log.push(`${player.name} rolled doubles (${d1}+${d2}) and got out of jail!`);
    } else {
      player.jailTurns++;
      if (player.jailTurns >= 3) {
        player.money -= 50;
        player.inJail = false;
        player.jailTurns = 0;
        room.log.push(`${player.name} paid $50 to get out of jail.`);
      } else {
        room.log.push(`${player.name} rolled ${d1}+${d2} and stays in jail (turn ${player.jailTurns}/3).`);
        room.hasRolled = true;
        return {};
      }
    }
  }

  if (isDoubles) {
    room.doublesCount++;
    if (room.doublesCount >= 3) {
      sendToJail(room, player);
      room.hasRolled = true;
      return {};
    }
  } else {
    room.doublesCount = 0;
  }

  const newPos = (player.position + d1 + d2) % 40;
  const passedGo = newPos < player.position && !player.inJail;
  if (passedGo) {
    player.money += 200;
    room.log.push(`${player.name} passed GO! Collected $200.`);
  }
  player.position = newPos;
  room.log.push(`${player.name} rolled ${d1}+${d2} and moved to ${BOARD_SQUARES[newPos].name}.`);
  room.hasRolled = true;

  handleLanding(room, player, newPos);

  if (isDoubles && !player.inJail) {
    room.hasRolled = false; // get another roll
  }

  return {};
}

function handleLanding(room, player, pos) {
  const square = BOARD_SQUARES[pos];

  if (square.type === 'gotojail') {
    sendToJail(room, player);
    return;
  }

  if (square.type === 'tax') {
    player.money -= square.amount;
    room.freeParkingPot += square.amount;
    room.log.push(`${player.name} paid $${square.amount} in tax.`);
    return;
  }

  if (square.type === 'freeparking') {
    if (room.freeParkingPot > 0) {
      player.money += room.freeParkingPot;
      room.log.push(`${player.name} collected $${room.freeParkingPot} from Free Parking!`);
      room.freeParkingPot = 0;
    }
    return;
  }

  if (square.type === 'chance') {
    drawCard(room, player, 'chance');
    return;
  }

  if (square.type === 'community_chest') {
    drawCard(room, player, 'community_chest');
    return;
  }

  if (square.type === 'property' || square.type === 'railroad' || square.type === 'utility') {
    const prop = room.properties[pos];
    if (!prop) {
      // Unowned - offer to buy
      room.pendingAction = { type: 'buy_property', squareId: pos };
      return;
    }
    if (prop.ownerId === player.id || prop.mortgaged) return;

    // Pay rent
    const owner = room.players.find(p => p.id === prop.ownerId);
    if (!owner || owner.bankrupt) return;

    let rent = 0;
    if (square.type === 'railroad') {
      const ownedRRs = Object.entries(room.properties)
        .filter(([sid, p]) => p.ownerId === owner.id && BOARD_SQUARES[+sid].type === 'railroad').length;
      rent = [25, 50, 100, 200][ownedRRs - 1] || 25;
    } else if (square.type === 'utility') {
      const ownedUtils = Object.entries(room.properties)
        .filter(([sid, p]) => p.ownerId === owner.id && BOARD_SQUARES[+sid].type === 'utility').length;
      rent = (room.dice[0] + room.dice[1]) * (ownedUtils === 2 ? 10 : 4);
    } else {
      const colorProps = BOARD_SQUARES.filter(s => s.color === square.color).map(s => s.id);
      const ownsAll = colorProps.every(id => room.properties[id]?.ownerId === owner.id);
      const houses = prop.houses || 0;
      rent = square.rent[houses] || square.rent[0];
      if (ownsAll && houses === 0) rent *= 2;
    }

    rent = Math.min(rent, player.money);
    player.money -= rent;
    owner.money += rent;
    room.log.push(`${player.name} paid $${rent} rent to ${owner.name}.`);

    if (player.money <= 0) {
      player.bankrupt = true;
      room.log.push(`${player.name} is bankrupt!`);
    }
  }
}

function drawCard(room, player, deck) {
  let cards, index;
  if (deck === 'chance') {
    cards = CHANCE_CARDS;
    index = room.chanceIndex % cards.length;
    room.chanceIndex++;
  } else {
    cards = COMMUNITY_CHEST_CARDS;
    index = room.communityChestIndex % cards.length;
    room.communityChestIndex++;
  }
  const card = cards[index];
  room.log.push(`${player.name} drew: "${card.text}"`);

  switch (card.action) {
    case 'collect':
      player.money += card.amount;
      break;
    case 'pay':
      player.money -= card.amount;
      room.freeParkingPot += card.amount;
      break;
    case 'go_to_jail':
      sendToJail(room, player);
      break;
    case 'jail_free':
      player.jailFreeCards++;
      break;
    case 'move': {
      const passGo = card.target < player.position;
      if (passGo || card.collect) { player.money += 200; room.log.push(`${player.name} collected $200 passing GO.`); }
      player.position = card.target;
      handleLanding(room, player, card.target);
      break;
    }
    case 'move_back': {
      player.position = (player.position - card.amount + 40) % 40;
      handleLanding(room, player, player.position);
      break;
    }
    case 'pay_each':
      room.players.filter(p => p.id !== player.id && !p.bankrupt).forEach(p => {
        player.money -= card.amount;
        p.money += card.amount;
      });
      break;
    case 'collect_each':
      room.players.filter(p => p.id !== player.id && !p.bankrupt).forEach(p => {
        p.money -= card.amount;
        player.money += card.amount;
      });
      break;
    case 'repairs': {
      let total = 0;
      Object.entries(room.properties).forEach(([sid, p]) => {
        if (p.ownerId === player.id) {
          total += p.houses < 5 ? p.houses * card.house : card.hotel;
        }
      });
      player.money -= total;
      room.freeParkingPot += total;
      if (total > 0) room.log.push(`${player.name} paid $${total} for repairs.`);
      break;
    }
    case 'nearest_railroad': {
      const rrs = [5, 15, 25, 35];
      const nearest = rrs.find(r => r > player.position) || rrs[0];
      if (nearest <= player.position) { player.money += 200; }
      player.position = nearest;
      handleLanding(room, player, nearest);
      break;
    }
    case 'nearest_utility': {
      const utils = [12, 28];
      const nearest = utils.find(u => u > player.position) || utils[0];
      if (nearest <= player.position) { player.money += 200; }
      player.position = nearest;
      handleLanding(room, player, nearest);
      break;
    }
  }
}

function sendToJail(room, player) {
  player.position = 10;
  player.inJail = true;
  player.jailTurns = 0;
  room.log.push(`${player.name} was sent to Jail!`);
}

export function buyProperty(room, playerId, squareId) {
  const player = room.players[room.currentPlayerIndex];
  if (player.id !== playerId) return { error: 'Not your turn' };
  const square = BOARD_SQUARES[squareId];
  if (!square?.price) return { error: 'Not purchasable' };
  if (player.money < square.price) return { error: 'Not enough money' };
  if (room.properties[squareId]) return { error: 'Already owned' };

  player.money -= square.price;
  room.properties[squareId] = { ownerId: playerId, houses: 0, mortgaged: false };
  room.pendingAction = null;
  room.log.push(`${player.name} bought ${square.name} for $${square.price}.`);
  return {};
}

export function declineBuy(room, playerId) {
  const player = room.players[room.currentPlayerIndex];
  if (player.id !== playerId) return { error: 'Not your turn' };
  room.pendingAction = null;
  room.log.push(`${player.name} declined to buy ${BOARD_SQUARES[room.pendingAction?.squareId]?.name || 'the property'}.`);
  return {};
}

export function buildHouse(room, playerId, squareId) {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found' };
  const prop = room.properties[squareId];
  if (!prop || prop.ownerId !== playerId) return { error: 'Not your property' };
  const square = BOARD_SQUARES[squareId];
  if (!square.houseCost) return { error: 'Cannot build here' };
  if (prop.houses >= 5) return { error: 'Already has hotel' };

  const colorProps = BOARD_SQUARES.filter(s => s.color === square.color).map(s => s.id);
  const ownsAll = colorProps.every(id => room.properties[id]?.ownerId === playerId);
  if (!ownsAll) return { error: 'Must own all properties of this color' };
  if (player.money < square.houseCost) return { error: 'Not enough money' };

  player.money -= square.houseCost;
  prop.houses++;
  room.log.push(`${player.name} built a ${prop.houses < 5 ? 'house' : 'hotel'} on ${square.name}.`);
  return {};
}

export function endTurn(room, playerId) {
  const player = room.players[room.currentPlayerIndex];
  if (player.id !== playerId) return { error: 'Not your turn' };
  if (!room.hasRolled) return { error: 'Must roll first' };
  if (room.pendingAction) return { error: 'Must resolve pending action first' };

  room.pendingAction = null;
  room.hasRolled = false;
  room.doublesCount = 0;

  // Advance to next active player
  let next = room.currentPlayerIndex;
  for (let i = 0; i < room.players.length; i++) {
    next = (next + 1) % room.players.length;
    if (!room.players[next].bankrupt) break;
  }
  room.currentPlayerIndex = next;

  const activePlayers = room.players.filter(p => !p.bankrupt);
  if (activePlayers.length === 1) {
    room.status = 'ended';
    room.log.push(`${activePlayers[0].name} wins the game!`);
  } else {
    room.log.push(`${room.players[next].name}'s turn.`);
  }
  return {};
}
