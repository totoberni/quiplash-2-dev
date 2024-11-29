// controllers/gameController.js

'use strict';

const PlayerManager = require('../utils/playerManager');
const GameLogic = require('../utils/gameLogic');
const apiUtils = require('../utils/apiUtils');

const activeGames = {}; // Keep track of active games

// Generate a unique game code
function generateGameCode() {
    const codeLength = 6;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
        code = '';
        for (let i = 0; i < codeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
    } while (activeGames[code]); // Ensure the code is unique
    return code;
}

// Update a single player's info
function updatePlayer(gameCode, socket) {
    const game = activeGames[gameCode];
    if (game) {
        const playerManager = game.playerManager;
        const username = socket.user;
        const player = playerManager.getPlayerByUsername(username);
        if (player) {
            socket.emit('playerInfo', { playerInfo: player });
        }
    }
}

// Update all players' info in the game
function updateAllPlayers(gameCode, io) {
    const game = activeGames[gameCode];
    if (game) {
        const playerManager = game.playerManager;
        const players = playerManager.getPlayers();
        players.forEach(player => {
            const socketId = player.socketId;
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                updatePlayer(gameCode, socket);
            }
        });
    }
}

// Starting a new Game
function gameCreate(socket, io) {
    const username = socket.user;
    if (username) {
        const gameLogic = new GameLogic();
        const playerManager = new PlayerManager();

        // Initialize gameState
        gameLogic.gameState.phase = 'joining';

        // Generate a unique game code
        const gameCode = generateGameCode();
        gameLogic.gameState.gameCode = gameCode;

        // Store the game instances using the game code
        activeGames[gameCode] = {
            gameLogic: gameLogic,
            playerManager: playerManager
        };

        // Add the player to the game
        playerManager.addPlayer(username, socket.id, gameLogic.gameState.phase);

        // Join the socket to a room identified by the game code
        socket.join(gameCode);
        socket.gameCode = gameCode; // Store game code on socket

        // Set up event listeners for game logic events
        gameLogic.on('phaseChanged', (newPhase) => {
            io.to(gameCode).emit('gameStateUpdate', { gameState: gameLogic.getGameState() });
            updateAllPlayers(gameCode, io);
        });

        gameLogic.on('playerUpdate', () => {
            updateAllPlayers(gameCode, io);
        });

        // Emit to the client that the game has been created
        socket.emit('gameCreated', { gameCode });

        // Send initial game state to the client
        socket.emit('gameStateUpdate', { gameState: gameLogic.getGameState() });

        // Update client sockets with the player info
        updatePlayer(gameCode, socket);

        // Start the game logic
        gameLogic.advanceGameState(io, playerManager);
    } else {
        socket.emit('error', { message: 'Unable to start the game. User is invalid' });
    }
}

// Joining a Game
function gameJoin(socket, data, io) {
    const username = socket.user;
    const gameCode = data.gameCode.toUpperCase(); // Ensure case-insensitivity
    const game = activeGames[gameCode];

    if (game) {
        const playerManager = game.playerManager;
        const gameLogic = game.gameLogic;
        const added = playerManager.addPlayer(username, socket.id, gameLogic.gameState.phase);
        if (added) {
            socket.join(gameCode);
            socket.gameCode = gameCode;
            socket.emit('gameJoined', { gameCode });
            socket.emit('gameStateUpdate', { gameState: gameLogic.getGameState() });
            updatePlayer(gameCode, socket);
            updateAllPlayers(gameCode, io);
        } else {
            socket.emit('error', { message: 'Could not join the game. It might be full or you are already in it.' });
        }
    } else {
        socket.emit('error', { message: 'Game code not found! Try again' });
    }
}

// Handle Chat Messages
function handleChatMessage(socket, data, io) {
    const username = socket.user;
    const message = data.message;

    if (!message || typeof message !== 'string') {
        socket.emit('error', { message: 'Invalid message.' });
        return;
    }

    const gameCode = socket.gameCode;
    if (gameCode) {
        io.to(gameCode).emit('chat', { username, message });
    } else {
        socket.emit('error', { message: 'You are not in a game.' });
    }
}

// Handle Disconnection
function handleDisconnect(socket, io) {
    const username = socket.user;
    const gameCode = socket.gameCode;
    const game = activeGames[gameCode];

    if (game) {
        const playerManager = game.playerManager;
        playerManager.removeUserBySocketId(socket.id);
        updateAllPlayers(gameCode, io);

        // Remove the game if no players are left
        if (playerManager.getPlayers().length === 0) {
            delete activeGames[gameCode];
            console.log(`Game ${gameCode} has been removed due to no active players.`);
        }
    }
}

// Handle Player Submissions
function handleSubmitPrompt(socket, data, io) {
    const username = socket.user;
    const gameCode = socket.gameCode;
    const game = activeGames[gameCode];

    if (game) {
        const playerManager = game.playerManager;
        const gameLogic = game.gameLogic;
        const player = playerManager.getPlayerByUsername(username);
        if (player) {
            const result = playerManager.submitPrompt(gameLogic.gameState, player, data.text);
            if (result.success) {
                socket.emit('message', { message: 'Prompt submitted successfully.' });
            } else {
                socket.emit('error', { message: result.message });
            }
        }
    }
}

function handleGeneratePromptSuggestion(socket, data, io) {
    const topic = data.topic || 'random quiplash prompt';
    apiUtils.suggestPrompt(topic)
        .then(response => {
            socket.emit('suggestedPrompt', { suggestedPrompt: response.suggestion });
        })
        .catch(error => {
            console.error('Error generating prompt suggestion:', error);
            socket.emit('error', { message: 'Failed to generate prompt suggestion.' });
        });
}

function handleSubmitAnswers(socket, data, io) {
    const username = socket.user;
    const gameCode = socket.gameCode;
    const game = activeGames[gameCode];

    if (game) {
        const playerManager = game.playerManager;
        const gameLogic = game.gameLogic;
        const player = playerManager.getPlayerByUsername(username);
        if (player) {
            data.answers.forEach((answer, index) => {
                const prompt = player.assignedPrompts[index];
                const result = playerManager.submitAnswer(gameLogic.gameState, player, answer, prompt);
                if (!result.success) {
                    socket.emit('error', { message: result.message });
                }
            });
            socket.emit('message', { message: 'Answers submitted successfully.' });
        }
    }
}

function handleSubmitVote(socket, data, io) {
    const username = socket.user;
    const gameCode = socket.gameCode;
    const game = activeGames[gameCode];

    if (game) {
        const playerManager = game.playerManager;
        const gameLogic = game.gameLogic;
        const player = playerManager.getPlayerByUsername(username);
        if (player) {
            const result = playerManager.submitVote(gameLogic.gameState, player, data.answer);
            if (result.success) {
                socket.emit('message', { message: 'Vote submitted successfully.' });
            } else {
                socket.emit('error', { message: result.message });
            }
        }
    }
}

// Export Functions
module.exports = {
    gameCreate,
    gameJoin,
    handleChatMessage,
    handleDisconnect,
    handleSubmitPrompt,
    handleGeneratePromptSuggestion,
    handleSubmitAnswers,
    handleSubmitVote
};