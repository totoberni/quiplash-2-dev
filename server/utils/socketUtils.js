// server/utils/socketUtils.js

const gameController = require('../controllers/gameController');

// Import sessionStore
const { sessionStore } = require('./sessionStore');

module.exports.initializeSocket = (io) => {
  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const sessionId = socket.handshake.auth.sessionId;

    if (sessionId && sessionStore[sessionId]) {
      // Authentication successful
      socket.user = sessionStore[sessionId].username;
      console.log('Socket authenticated for user:', socket.user);
      return next();
    } else {
      // Authentication failed
      console.log('Socket authentication failed for sessionId:', sessionId);
      const err = new Error('Authentication error');
      err.data = { message: 'Invalid session ID' };
      return next(err);
    }
  });

  io.on('connection', (socket) => {
    console.log('New client connected:', 'Session: ', socket.sessionId ,socket.id, 'User:', socket.user);

    // Handle chat messages
    socket.on('chat', (data) => {
      gameController.handleChatMessage(socket, data, io);
    });

    // Handle game start
    socket.on('gameCreate', () => {
      gameController.gameCreate(socket, io);
    });

    // Handle game join
    socket.on('gameJoin', (data) => {
      gameController.gameJoin(socket, data, io);
    });

    // Handle prompt submission
    socket.on('prompt', (data) => {
      gameController.handlePrompt(socket, data, io);
    });

    // Handle answer submission
    socket.on('answer', (data) => {
      gameController.handleAnswer(socket, data, io);
    });

    // Handle prompt generation
    socket.on('generatePrompt', (data) => {
      gameController.handleGeneratePrompt(socket, data, io);
    });

    // Handle prompt selection
    socket.on('selectPrompt', (data) => {
      gameController.handleSelectPrompt(socket, data, io);
    });

    // Handle voting
    socket.on('vote', (data) => {
      gameController.handleVote(socket, data, io);
    });

    // Handle advancing the game
    socket.on('advance', (data) => {
      gameController.handleAdvance(socket, io);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id, 'User:', socket.user);
      gameController.handleDisconnect(socket, io);
    });
  });
};
