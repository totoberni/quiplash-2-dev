// controllers/gameController.js

'use strict';

const playerManager = require('../utils/playerManager');
const gameLogic = require('../utils/gameLogic');
const apiUtils = require('../utils/apiUtils');



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
    })
    .catch((error) => {
      console.error('Prompt generation error:', error);
      socket.emit('error', { message: 'Failed to generate prompt.' });
    });
}

/**
 * Handles prompt submission via Socket.IO.
 */
function handlePrompt(socket, data, io) {
  const username = socket.user;
  const promptText = data.promptText;

  if (!promptText || promptText.length < 20 || promptText.length > 100) {
    socket.emit('error', {message: 'Prompt must be between 20 and 100 characters.',});
    return;
  }

  const result = gameLogic.submitPrompt(username, promptText);
  if (result.success) {
    // After successfully adding the prompt to game logic, create the prompt via API
    apiUtils.createPrompt(username, promptText)
      .then(() => {
        socket.emit('Prompt Submitted!', { success: true });})
      .catch((error) => {
        console.error('Prompt submission error:', error);
        socket.emit('error', { message: 'Failed to submit prompt to backend'});
      });
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

  if (!answerText || answerText.length < 5 || answerText.length > 200) {
    socket.emit('error', {
      message: 'Answer must be between 5 and 200 characters.',
    });
    return;
  }

  const result = gameLogic.submitAnswer(username, promptId, answerText);
  if (result.success) {
    socket.emit('answerResult', { success: true });
    // Check if all answers are received
    if (gameLogic.allAnswersReceived()) {
      gameLogic.advanceGameState(io);
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

  const result = gameLogic.submitVote(
    username,
    promptId,
    selectedAnswerUsername
  );

  if (result.success) {
    socket.emit('voteResult', { success: true });
    // Check if all votes are received
    if (gameLogic.allVotesReceived()) {
      gameLogic.advanceGameState(io);
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

  const result = gameLogic.advanceGameState(io);
  if (result.success) {
    io.emit('phaseChange', { phase: gameLogic.getPhase() });
  } else {
    socket.emit('error', { message: result.message });
  }
}

/**
 * Handles user disconnection via Socket.IO.
 */
function handleDisconnect(socket, io) {
  const username = socket.user;
  playerManager.removeUserBySocketId(socket.id);
  io.emit('message', { message: `${username} has disconnected.` });
}

module.exports = {
  handleChatMessage,
  handleGeneratePrompt,
  handlePrompt,
  handleAnswer,
  handleVote,
  handleAdvance,
  handleDisconnect,
};