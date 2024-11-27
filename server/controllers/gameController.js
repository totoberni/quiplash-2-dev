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
    activeGames.push([gameLogic(), playerManager()]);
    playerManager.addPlayer(username, socket.id);
  } else {
    socket.emit('error', { message: 'Unable to start the game. User is invalid' });
  }
}

//Joining a Game
function gameJoin(socket, gameCode) {
  const username = socket.user;
  const game = gameSearch(socket, gameCode);

  if (game) {
    const playerManager = game[1];
    playerManager.addPlayer(username, socket.id);
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

// returns the game and playerManager for the socket in binary array
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
  if (result.success) {
    findGameBySocketId(socket.id)[1].submitPrompt(username, promptText)
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

/**
 * Handles answer submission via Socket.IO.
 */
function handleAnswerSubmission(socket, data, io) {
  const payload = {"answerUsername": socket.user, "text":data.text};
  if (result.success) {
    socket.emit(`${username} submitted an answer.`);
  } else {
    socket.emit('error', { message: result.message });
  }
}

/**
 * Handles vote submission via Socket.IO.
 */
function handleVote(socket, data, io) {
  const username = socket.user;
  const { promptId, selectedAnswerUsername } = data;

  const result = gameLogic.submitVote(username, promptId, selectedAnswerUsername);

  if (result.success) {
    socket.emit('voteResult', { success: true });
    // Check if all votes are received
    if (gameLogic.allVotesReceived()) {
      gameLogic.advanceGameState();
      updateAllPlayers(io);
    }
  } else {
    socket.emit('error', { message: result.message });
  }
}

/**
 * Handles prompt generation via Socket.IO.
 */
function handleGeneratePrompt(socket, data) {
  const keyword = data.keyword;
  apiUtils.suggestPrompt(keyword)
    .then((suggestion) => {
      socket.emit('promptSuggestion', { suggestion });
    });
  // Error checking is handled by apiUtils
}

/**
 * Handles game advancement via Socket.IO.
 */
function handleAdvance(socket, data, io) {
  const username = socket.user;

  if (!playerManager.isAdmin(username)) {
    socket.emit('error', { message: 'Only admin can advance the game.' });
    return;
  }

  const result = gameLogic.advanceGameState();
  if (result.success) {
    updateAllPlayers(io);
  } else {
    socket.emit('error', { message: result.message });
  }
}

/**
 * Updates player stats before logout.
 */
function updatePlayerBeforeLogout(player) {
  apiUtils.editPlayer(player.username, player.gamesPlayed, player.score)
    .then(() => {
      console.log('Player updated before logout.');
    });
  // Error checking is handled by apiUtils
}

/**
 * Handles user disconnection via Socket.IO.
 */
function handleDisconnect(socket, io) {
  const username = socket.user;
  const player = playerManager.getPlayerByUsername(username);
  if (player) {
    updatePlayerBeforeLogout(player);
    playerManager.removeUserBySocketId(socket.id);
    updateAllPlayers(io);
    io.emit('message', { message: `${username} has disconnected.` });
  }
}

module.exports = {
  gameStart,
  gameJoin,
  handleChatMessage,
  handleGeneratePrompt,
  handlePromptSubmission,
  handleVote,
  handleAdvance,
  handleDisconnect,
};