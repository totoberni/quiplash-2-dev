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
        console.log('New client connected:', 'Session:', socket.handshake.auth.sessionId, socket.id, 'User:', socket.user);

        // Handle chat messages
        socket.on('chat', (data) => {
            gameController.handleChatMessage(socket, data, io);
        });

        // Handle game creation
        socket.on('gameCreate', () => {
            gameController.gameCreate(socket, io);
        });

        // Handle game join
        socket.on('gameJoin', (data) => {
            gameController.gameJoin(socket, data, io);
        });

        // Handle submit prompt
        socket.on('submitPrompt', (data) => {
            gameController.handleSubmitPrompt(socket, data, io);
        });

        // Handle generate prompt suggestion
        socket.on('generatePromptSuggestion', (data) => {
            gameController.handleGeneratePromptSuggestion(socket, data, io);
        });

        // Handle submit answers
        socket.on('submitAnswers', (data) => {
            gameController.handleSubmitAnswers(socket, data, io);
        });

        // Handle submit vote
        socket.on('submitVote', (data) => {
            gameController.handleSubmitVote(socket, data, io);
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id, 'User:', socket.user);
            gameController.handleDisconnect(socket, io);
        });
    });
};