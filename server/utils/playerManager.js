// utils/playerManager.js
// Handles logic for players and their actions during the game.
// Shares responsibility with gameLogic.js.

'use strict';

const apiUtils = require('./apiUtils');
const { Player, Prompt, Answer } = require('./models')

class PlayerManager {

    constructor() {
        this.players = []; // Active players
        this.admin = null; // Game admin player object
        this.audience = []; // Audience members
    }

    // Getters 
    getPlayers() {
        return this.players;
    }

    getPlayer(player) {
        return this.getPlayers().find((p) => p.username === player.username);
    }

    getPlayerByUsername(username) {
        return this.getPlayers().find((p) => p.username === username);
    }

    getPlayerBySocketId(socketId) {
        const player = this.getPlayers().find((player) => player.socketId === socketId);
        if (player) {
            return player;
        } else {
            console.log('Player not found.');
            return null;
        }
    }

    getAdmin() {
        return this.getPlayers().find((player) => player.isAdmin);
        
    }

    getAudience() {
        return this.audience;
    }

    getAudienceMember(audience) {
        return this.getAudience().find((p) => p.username === audience.username);
    }

    async fetchPrompts(language) {
        const allUsernames = this.getPlayers().concat(this.getAudience()).map((p) => p.username);
        try {
            const response = await apiUtils.getPrompts(allUsernames, language);

            if (Array.isArray(response)) {
                // Convert each returned prompt from the API to a new Prompt object
                const apiPrompts = response.map(({ username, text }) => {
                    const promptObj = new Prompt(username, text);
                    return promptObj;
                });
                return apiPrompts;
            } else {
                console.error('Error fetching prompts. Response is not an array.');
                return [];
            }
        } catch (error) {
            console.error('Error in fetchPrompts:', error);
            return [];
        }
    }

    // Helpers
    isPlayer(player) {
        return !!this.getPlayer(player);
    }

    isAudience(audience) {
        return !!this.getAudienceMember(audience);
    }

    isAdmin(player) {
        const admin = this.getAdmin();
        return admin && admin.username === player.username;
    }

    reassignAdmin() {
        if ((this.getAdmin() === null || this.getAdmin() === undefined) && this.getPlayers().length > 0) {
            this.getPlayers()[0].isAdmin = true;
        } else {
            console.log('Cannot reassign admin.');
        }
    }

    // Add new clients
    addPlayer(username, socketId, gameStatePhase) {
        const existingPlayer = this.getPlayerByUsername(username);
        if (existingPlayer) {
            return false; // Username already taken
        }
        if (this.getPlayers().length >= 8) {
            this.addAudience(username, socketId);
            return false; // Room is full
        }
        const isAdmin = this.getPlayers().length === 0; // First player is admin
        const justJoined = gameStatePhase !== 'joining';
        const newPlayer = new Player(socketId, username, isAdmin, justJoined);
        this.players.push(newPlayer);
        console.log(`Player ${username} added with clearance: ${newPlayer.isAdmin ? 'true' : 'false'}`);
        return true;
    }

    addAudience(username, socketId) {
        this.audience.push(new Player(socketId, username, false));
        return true;
    }

    // Update clients based on game state
    updatePlayersOnGameState(gameStatePhase, gameState) {
        switch (gameStatePhase) {
            case 'joining':
                this.getPlayers().concat(this.getAudience()).forEach((player) => player.state = 'waitingPlayers');
                break;
            case 'prompts':
                this.getPlayers().concat(this.getAudience()).forEach((player) => player.state = 'active');
                this.getPlayers().forEach((player) => player.justJoined = false);
                break;
            case 'answers':
                this.getAudience().forEach((player) => player.state = 'waitingAnswers');
                this.getPlayers().forEach((player) => player.state = 'active');
                break;
            case 'voting':
                this.getPlayers().concat(this.getAudience()).forEach((player) => player.state = 'active');
                break;
            case 'results':
                this.updatePlayersOnResults(gameState);
                this.getPlayers().concat(this.getAudience()).forEach((player) => player.state = 'waitingResults');
                break;
            case 'scores':
                this.getPlayers().concat(this.getAudience()).forEach((client) => client.state = 'waitingScores');
                break;
            case 'nextRound':
                this.getPlayers().concat(this.getAudience()).forEach((player) => player.state = 'waitingNextRound');
                this.updatePlayersNextRound();
                break;
            case 'endGame':
                this.getPlayers().concat(this.getAudience()).forEach((player) => player.state = 'waitingEndGame');
                this.updatePlayersAfterGame();
                break;
            default:
                console.log('Error updating player states.');
        }
    }

    // Update players' scores based on game results calculated in gameLogic.js as answerScore
    updatePlayersOnResults(gameState) {
        // For each answer in the final results
        for (let answer of gameState.results) {
            const player = this.getPlayerByUsername(answer.username);
            if (player) {
                const answerScore = answer.votes.length * gameState.roundNumber * 100;
                player.roundScore += answerScore;   
            }
        }
    }


    updatePlayersNextRound() {
        for (let player of this.getPlayers()) {
            player.score += player.roundScore;
            player.roundScore = 0;
            player.assignedPrompts = [];
            player.answers = [];
            player.votes = [];
            player.justJoined = false;
        }
    }

    // Update players' scores and states after a game ends
    updatePlayersAfterGame() {
        for (let player of this.getPlayers()) {
            player.gamesPlayed += 1;
        }
        this.updatePlayersNextRound();
    }

    // Update player's info before logging out
    updateClientBeforeLogout(client) {
        client.score += client.roundScore;
        apiUtils.editPlayer(client.username, client.gamesPlayed, client.score);
        client.roundScore = 0;
        client.assignedPrompts = [];
        client.answers = [];
        client.vote = [];
        client.nextPhaseRequest = false; 
        client.state = 'offline';
        client.justJoined = false;
    }

    // Remove clients
    removeUser(player) {
        if (this.isPlayer(player)) {
            const playerIndex = this.getPlayers().findIndex((p) => p === player);
            if (playerIndex !== -1) {
                if (playerIndex === 0) {
                    player.isAdmin = false;
                }
                this.players.splice(playerIndex, 1);
                this.reassignAdmin();
                console.log(`Player ${player.username} removed.`);
                this.updateClientBeforeLogout(player);
                return true;
            }
        } else if (this.isAudience(player)) {
            const audienceIndex = this.getAudience().findIndex((a) => a.username === player.username);
            if (audienceIndex !== -1) {
                this.audience.splice(audienceIndex, 1);
                console.log(`Audience member ${player.username} removed.`);
                this.updateClientBeforeLogout(player);
                return true;
            }
        } else {
            console.log('Error removing user.');
            return false;
        }
    }

    removeUserBySocketId(socketId) {
        const client = this.getPlayers().concat(this.getAudience()).find((player) => player.socketId === socketId);
        if (client) {
            this.removeUser(client);
            console.log('Player removed.');
            return true;
        } else {
            console.log('User not found. Could not remove user.');
            return false;
        }
    }

    // Submissions
    // Handle prompt submission by a player
    async submitPrompt(gameState, player, text) {
        if (!player) {
            return { success: false, message: 'User cannot submit prompts.' };
        }
        const apiResponse = await apiUtils.createPrompt(player.username, text);
        // Check if the API response contains an 'id', indicating success
        if (apiResponse && apiResponse.id) {
            const prompt = new Prompt(player.username, text);
            gameState.activePrompts.push(prompt);
            return { success: true };
        } else {
            // Handle cases where the prompt already exists or other issues
            return { success: false, message: apiResponse.msg || 'Failed to create prompt.' };
        }
    }

    // Handle answer submission by a player
    submitAnswer(player, text, prompt) {
        if (!player || player.state !== 'active' || !player.assignedPrompts || player.justJoined) {
            return { success: false, message: 'Player cannot submit answers.' };
        }
        if (!player.assignedPrompts.includes(prompt)) {
            return { success: false, message: 'Player has not been assigned this prompt.' };
        }
        if (!player.answers) {
            player.answers = [];
        }
        const answer = new Answer(player.username, text);
        prompt.answers.push(answer);
        player.answers.push(answer);
        if (player.answers.length === player.assignedPrompts.length) {
            player.state = 'submitted';
        }
        return { success: true };
    }

    submitVote(gameState, player, answerUsername) {
        // Ensure the player is in an active state to vote
        if (player.state !== 'active') {
            return { success: false, message: 'Player cannot vote in current state.' };
        }
        // Locate the answer object in gameState.activePrompts
        let foundAnswer = null;
        let foundPrompt = null;
        for (const prompt of gameState.activePrompts) {
            for (const ans of prompt.answers) {
                if (ans.username === answerUsername) {
                    foundAnswer = ans;
                    foundPrompt = prompt;
                    break;
                }
            }
            if (foundAnswer) break;
            else return { success: false, message: 'Answer not found or invalid answerUsername.' };
        }
        // Push the voting player's username onto the answer's votes array
        foundAnswer.votes.push(player.username);

        // If the player has cast as many votes as there are prompts, mark them submitted
        if (gameState.activePrompts.length === player.votes.length) {
            player.state = 'submitted';
        }
        return { success: true };
    }

    // Assigning prompts to players used in gameLogic.js
    assignPromptToPlayer(player, prompt) {
        if (!player || player.justJoined || player.state !== 'active') {
            return { success: false, message: 'Player cannot be assigned prompts.' };
        }
        if (!player.assignedPrompts) {
            player.assignedPrompts = [];
        }
        player.assignedPrompts.push(prompt);
        return { success: true };
    }
}

module.exports = PlayerManager;