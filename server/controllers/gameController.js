// controllers/gameController.js

'use strict';

const playerManager = require('../utils/playerManager');
const gameLogic = require('../utils/gameLogic');
const apiUtils = require('../utils/apiUtils');

/**
 * Updates a specific player with the current game and player state.
 */ // needs some work
function updatePlayer(socket) {
  const username = socket.user;
  const gameState = gameLogic.getGameState();
  const playerState = playerManager.getPlayerState(username);
  socket.emit('gameStateUpdate', { gameState, playerState });
}

/**
 * Updates all connected players with the current game state.
 */
function updateAllPlayers(io) {
  const gameState = gameLogic.getGameState();
  io.emit('gameStateUpdate', { gameState });
}

/**
 * Handles chat messages via Socket.IO.
 */
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
 * Handles prompt submission via Socket.IO.
 */
function handlePrompt(socket, data, io) {
  const username = socket.user;
  const promptText = data.promptText;

  const result = gameLogic.submitPrompt(username, promptText);
  if (result.success) {
    // After successfully adding the prompt to game logic, create the prompt via API
    apiUtils.createPrompt(username, promptText)
      .then(() => {
        socket.emit('promptSubmitted');
      });
    // Error checking is handled by apiUtils
  } else {
    socket.emit('error', { message: result.message });
  }
}

/**
 * Handles answer submission via Socket.IO.
 */
function handleAnswer(socket, data, io) {
  const username = socket.user;
  const { promptId, answerText } = data;

  const result = gameLogic.submitAnswer(username, promptId, answerText);
  if (result.success) {
    socket.emit('answerResult', { success: true });
    // Check if all answers are received
    if (gameLogic.allAnswersReceived()) {
      gameLogic.advanceGameState();
      updateAllPlayers(io);
    }
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
 * Handles starting a new game.
 */
function handleStartGame(socket, data, io) {
  const username = socket.user;

  if (gameLogic.canStartGame(username)) {
    gameLogic.startGame();
    updateAllPlayers(io);
  } else {
    socket.emit('error', { message: 'Unable to start the game.' });
  }
}

/**
 * Handles joining an existing game.
 */
function handleJoinGame(socket, data, io) {
  const username = socket.user;
  const added = playerManager.addPlayer(username, socket.id);

  if (added) {
    updatePlayer(socket);
    updateAllPlayers(io);
  } else {
    socket.emit('error', { message: 'Unable to join the game.' });
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
  handleChatMessage,
  handleGeneratePrompt,
  handlePrompt,
  handleAnswer,
  handleVote,
  handleAdvance,
  handleStartGame,
  handleJoinGame,
  handleDisconnect,
};