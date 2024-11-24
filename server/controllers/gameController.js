// server/controllers/gameController.js

'use strict';

const apiUtils = require('../utils/apiUtils');
const { sessionStore } = require('../utils/sessionStore');
// Import gameLogic if needed
// const gameLogic = require('../gameLogic/gameLogic'); // Uncomment if gameLogic is used

// Example in-memory storage for demonstration purposes
// In production, consider using a database or persistent storage
let players = []; // Array of player objects
let audience = []; // Array of audience member objects
let prompts = []; // Array of prompt objects
let currentGameState = 'waitingForPlayers'; // Initial game state
let leaderboard = []; // Array of player scores

// Handler for chat messages
exports.handleChatMessage = (socket, data, io) => {
  const message = data.message;
  const username = socket.user;

  console.log(`Chat message from ${username}: ${message}`);

  // Broadcast the message to all connected clients in the format "username: message"
  io.emit('chat', `${username}: ${message}`);
};

// Handler for prompt submissions
exports.handlePrompt = async (socket, data, io) => {
  const username = socket.user;
  const promptText = data.promptText;

  console.log(`Prompt submitted by ${username}: ${promptText}`);

  // Validate prompt length
  if (promptText.length < 20 || promptText.length > 100) {
    socket.emit('errorMessage', 'Prompt must be between 20 and 100 characters.');
    return;
  }

  try {
    // Use apiUtils to create the prompt in the backend
    const response = await apiUtils.createPrompt(username, promptText);

    if (response.result) {
      // Add the prompt to the local prompts list
      prompts.push({ id: response.promptId, username, text: promptText });

      // Notify all clients about the new prompt
      io.emit('newPrompt', { username, text: promptText });

      // Optionally, acknowledge the sender
      socket.emit('promptAcknowledged', 'Your prompt has been submitted successfully.');
    } else {
      // Handle failure in prompt creation
      socket.emit('errorMessage', response.msg || 'Failed to create prompt.');
    }
  } catch (error) {
    console.error('Error handling prompt submission:', error.message);
    socket.emit('errorMessage', 'An error occurred while submitting the prompt.');
  }
};

// Handler for answer submissions
exports.handleAnswer = (socket, data, io) => {
  const username = socket.user;
  const answerText = data.answerText;
  const promptId = data.promptId;

  console.log(`Answer submitted by ${username} for prompt ${promptId}: ${answerText}`);

  // TODO: Implement logic to store the answer and associate it with the prompt and player
  // Example:
  // gameLogic.storeAnswer(username, promptId, answerText);

  // Notify all clients that an answer has been received
  io.emit('answerReceived', { username, promptId, answerText });

  // Optionally, acknowledge the sender
  socket.emit('answerAcknowledged', 'Your answer has been submitted successfully.');
};

// Handler for voting
exports.handleVote = (socket, data, io) => {
  const username = socket.user;
  const answerId = data.answerId;

  console.log(`Vote received from ${username} for answer ${answerId}`);

  // TODO: Implement voting logic
  // Example:
  // gameLogic.recordVote(username, answerId);

  // Notify all clients about the vote
  io.emit('voteReceived', { username, answerId });

  // Optionally, acknowledge the sender
  socket.emit('voteAcknowledged', 'Your vote has been recorded.');
};

// Handler for generating a prompt suggestion (e.g., using a keyword)
exports.handleGeneratePrompt = async (socket, data, io) => {
  const keyword = data.keyword;
  const username = socket.user;

  console.log(`Prompt generation requested by ${username} with keyword: ${keyword}`);

  try {
    // Use apiUtils to get a prompt suggestion from the backend
    const response = await apiUtils.suggestPrompt(keyword);

    if (response.suggestion) {
      // Emit the suggestion back to the requesting client
      socket.emit('promptSuggestion', response.suggestion);
    } else {
      socket.emit('errorMessage', 'No suggestion could be generated.');
    }
  } catch (error) {
    console.error('Error generating prompt suggestion:', error.message);
    socket.emit('errorMessage', 'An error occurred while generating the prompt suggestion.');
  }
};

// Handler for selecting a prompt (admin action)
exports.handleSelectPrompt = (socket, data, io) => {
  const username = socket.user;
  const promptId = data.promptId;

  console.log(`Prompt selected by ${username}: ${promptId}`);

  // TODO: Implement logic to mark the prompt as selected for the current game
  // Example:
  // gameLogic.selectPrompt(promptId);

  // Notify all clients that a prompt has been selected
  io.emit('promptSelected', promptId);

  // Optionally, acknowledge the sender
  socket.emit('selectPromptAcknowledged', 'Prompt has been selected for the game.');
};

// Handler for advancing the game state (admin action)
exports.handleAdvance = (socket, io) => {
  const username = socket.user;

  console.log(`Game advancement requested by ${username}`);

  // TODO: Implement logic to advance the game state
  // Example:
  // gameLogic.advanceState();

  // Notify all clients about the state advancement
  io.emit('gameAdvanced', { newState: currentGameState });

  // Optionally, acknowledge the sender
  socket.emit('advanceAcknowledged', 'Game state has been advanced.');
};

// Handler for client disconnection
exports.handleDisconnect = (socket, io) => {
  const username = socket.user;

  console.log(`Client disconnected: ${socket.id}, User: ${username}`);

  // TODO: Implement logic to remove the player from the game or handle cleanup
  // Example:
  // gameLogic.removePlayer(username);

  // Notify all clients about the disconnection
  io.emit('playerDisconnected', username);
};

// Additional handler functions can be added here following the same pattern
