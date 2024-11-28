// controllers/gameController.js

'use strict';

const playerManager = require('../utils/playerManager');
const gameLogic = require('../utils/gameLogic');
const apiUtils = require('../utils/apiUtils');
const { use } = require('./authController');
const activeGames  = [];

// Starting a new Game
function gameStart(socket) {
  const username = socket.user;
  if (username) {
    activeGames.push([gameLogic(), playerManager()]); // add new gameLogic and playerManager objects to activeGames
    playerManager.addPlayer(username, socket.id);
    io.emit('message', { message: `${username} has created a game.` });
  } else {
    socket.emit('error', { message: 'Unable to start the game. User is invalid' });
  }
}

//Joining a Game
function gameJoin(socket, gameCode) {
  const username = socket.user;
  const game = gameSearch(socket, gameCode);
  if (game) {
    const playerManager = game[1]; // get playerManager object from game
    playerManager.addPlayer(username, socket.id);
    io.emit('message', { message: `${username} has connected to the game.` });
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
  const player = playerManager.getPlayerBySocketId(socket.id);
  if (player) {
    playerManager.removeUserBySocketId(socket.id); // handles updating user stats in playerManager
    updateAllPlayers(io);
    io.emit('message', { message: `${username} has disconnected.` });
  }
}

module.exports = {
  gameStart,
  gameJoin,
  handleChatMessage,
  handlePromptSubmission,
  handleDisconnect,
};