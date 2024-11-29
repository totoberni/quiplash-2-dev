// controllers/gameController.js

'use strict';

const PlayerManager = require('../utils/playerManager');
const GameLogic = require('../utils/gameLogic');
const apiUtils = require('../utils/apiUtils');

const activeGames = {}; // Keep track of active games

// Identify gameLogic and playerManager objects using a gamecode.
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
        const playerManager = game[1];
        const username = socket.user;
        const player = playerManager.getPlayerByUsername(username);
        if (player) {
            socket.emit('updatePlayerInfo', { playerInfo: player });
        } else {
            console.log(`Player ${username} not found in game ${gameCode}`);
        }
    } else {
        console.log(`Game ${gameCode} not found`);
    }
}

// Update all players' info in the game
function updateAllPlayers(gameCode, io) {
    const game = activeGames[gameCode];
    if (game) {
        const playerManager = game[1];
        const players = playerManager.getPlayers();
        players.forEach(player => {
            const socketId = player.socketId;
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                updatePlayer(gameCode, socket);
            } else {
                console.log(`Socket for player ${player.username} not found`);
            }
        });
    } else {
        console.log(`Game ${gameCode} not found`);
    }
}

// Starting a new Game
function gameCreate(socket, io) {
    const username = socket.user;
    if (username) {
        const gameLogic = new GameLogic();
        const playerManager = new PlayerManager();

        // Ensure gameState is initialized
        gameLogic.gameState = gameLogic.gameState || {};
        gameLogic.gameState.phase = 'joining';

        // Generate a unique game code
        const gameCode = generateGameCode();
        gameLogic.gameState.gameCode = gameCode;

        // Store the game instances using the game code
        activeGames[gameCode] = [gameLogic, playerManager];

        // Add the player to the game
        playerManager.addPlayer(username, socket.id, gameLogic.gameState.phase);

        // Join the socket to a room identified by the game code
        socket.join(gameCode);
        socket.gameCode = gameCode; // Store game code on socket

        // Emit to the client that the game has been created
        socket.emit('gameCreated', { gameCode });
        console.log(`Game created by ${username} with code ${gameCode}`);

        // Update client sockets with the player info
        updatePlayer(gameCode, socket);
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
        const playerManager = game[1];
        const gameLogic = game[0];
        const added = playerManager.addPlayer(username, socket.id, gameLogic.gameState.phase);
        if (added) {
            socket.join(gameCode);
            socket.gameCode = gameCode;
            socket.emit('gameJoined', { gameCode });
            console.log(gameCode).emit('message', { message: `${username} has joined the game.` }); // Will need to put this in io later: io.to(gameCode).emit('message', { message: `${username} has joined the game.` });
            updatePlayer(gameCode, socket); /// Update player info
        } else {
            socket.emit('error', { message: 'Could not join the game. It might be full or you are already in it.' });
        }
    } else {
        socket.emit('error', { message: 'Game code not found! Try again' });
    }
}

// Helper Functions
function findGameBySocketId(socketId) {
    return Object.values(activeGames).find(([_, playerManager]) => playerManager.getPlayerBySocketId(socketId));
}



// Handle Chat Messages
function handleChatMessage(socket, data, io) {
    const username = socket.user;
    const message = data.message;

    if (!message || typeof message !== 'string') {
        socket.emit('error', { message: 'Invalid message.' });
        return;
    }

    console.log(`Handling chat from ${username}: ${message}`);

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
        const playerManager = game[1];
        playerManager.removeUserBySocketId(socket.id);
        console.log(`Player ${username} disconnected from game ${gameCode}`);
        io.to(gameCode).emit('message', { message: `${username} has disconnected.` });
        updatePlayerList(gameCode, io);

        // Remove the game if no players are left
        if (playerManager.getPlayers().length === 0) {
            delete activeGames[gameCode];
            console.log(`Game ${gameCode} has been removed due to no active players.`);
        }
    }
}

// Export Functions
module.exports = {
    gameCreate,
    gameJoin,
    handleChatMessage,
    handleDisconnect,
    findGameBySocketId
};