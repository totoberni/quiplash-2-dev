// controllers/gameController.js

'use strict';

const PlayerManager = require('../utils/playerManager');
const GameLogic = require('../utils/gameLogic');
const apiUtils = require('../utils/apiUtils');
//const { use } = require('./authController');
const activeGames  = []; // [gameLogic, playerManager]

// Starting a new Game
function gameCreate(socket, io) {
  const username = socket.user;
  if (username) {
    const gameLogic = new GameLogic ()
    const playerManager = new PlayerManager();
    activeGames.push([gameLogic, playerManager]); 
    playerManager.addPlayer(username, socket.id, gameLogic.gameState.phase);
    socket.join(gameLogic.gameState.gameCode);
    socket.emit('gameCreated', { gameCode: gameLogic.gameState.gameCode });
    console.log(`Game created by ${username} with code ${gameLogic.gameState.gameCode}`);
  } else {
    Socket.emit('error', { message: 'Unable to start the game. User is invalid' });
  }
}

//Joining a Game
function gameJoin(socket, gameCode) {
  const username = socket.user;
  const game = gameSearch(socket, gameCode);
  if (game) {
    const playerManager = game[1];
    playerManager.addPlayer(username, socket.id, game[0].gameState.phase); // Pass the current game phase
    socket.emit('message', { message: `${username} has connected to the game.` });
  } else {
    socket.emit('error', { message: 'Game code not found! Try again' });
  }
}

// Helpers
function gameSearch(socket, gameCode) {
  const game = activeGames.find(([gameLogic, _]) => gameLogic.gameState.gameCode === gameCode);
  if (game) {
    return game;
  } else {
    socket.emit('error', { message: 'Game not found.' });
  }
}
function findGameBySocketId(socketId) {
  return activeGames.find(([_, playerManager]) => playerManager.getPlayerBySocketId(socketId));
}

// Handlers
function handleChatMessage(socket, data, io) {
  const username = socket.user;
  const message = data.message;

  if (!message || typeof message !== 'string') {
    socket.emit('error', { message: 'Invalid message.' });
    return;
  }

  console.log(`Handling chat from ${username}: ${message}`);
  io.emit('chat', { username: username, message: message });
}
// Handles prompt submission via Socket.IO.
function handlePromptSubmission(socket, data, io) {
  const username = socket.user;
  const promptText = data.promptText;
  const result = apiUtils.createPrompt(username, promptText);
  const game = findGameBySocketId(socket.id);
  if (result.success && game) {
    game[1].submitPrompt(game[0].gameState, username, promptText)
      .then(() => {
        socket.emit(`${username} submitted a prompt.`);
      })
      .catch((err) => {
        socket.emit('Logic error', { message: err.message });
      });
  } else {
    socket.emit('Server error', { message: result.message });
  }
}

// Disconnects the user from the game.
function handleDisconnect(socket, io) {
  const username = socket.user;
  const game = findGameBySocketId(socket.id);
  const player = game[1].getPlayerBySocketId(socket.id);
  if (player) {
    playerManager.removeUserBySocketId(socket.id); // handles updating user stats in playerManager
    updateAllPlayers(io);
    io.emit('message', { message: `${username} has disconnected.` });
  }
}

module.exports = {
  gameCreate,
  gameJoin,
  handleChatMessage,
  handlePromptSubmission,
  handleDisconnect,
};