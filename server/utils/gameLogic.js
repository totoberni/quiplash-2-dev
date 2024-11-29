// utils/gameLogic.js
// This class handles phase transitions and game state management.

'use strict';

const EventEmitter = require('events');
const apiUtils = require('./apiUtils');

class GameLogic extends EventEmitter {

    constructor() {
        super(); // Initialize EventEmitter
        this.resetGameState();
    }

    resetGameState() {
        this.gameState = {
            phase: 'joining',
            activePrompts: [], // [[promptUsername, text]]
            submittedPrompts: [], // [[promptUsername, text]]
            answers: [], // [[promptUsername, answerUsername, text]]
            votes: [], // [[answerUsername, voteUsername]]
            roundNumber: 1,
            totalRounds: 3,
            updateScores: [], // [{ answerUsername, answerScore }]
            numPlayers: 0, // Added to keep track of the number of players
        };
    }

    // Getters
    getGameState() {
        return this.gameState;
    }

    calculateVoteScores() {
        for (let answer of this.gameState.answers) {
            const answerUsername = answer[1];
            const answerVotes = this.gameState.votes.filter((vote) => vote[0] === answerUsername).length;
            const answerScore = answerVotes * this.gameState.roundNumber * 100;
            this.gameState.updateScores.push({ answerUsername, answerScore });
        }
        return this.gameState.updateScores;
    }

    async halfPromptsReceived(playerManager) {
        let numPlayers = playerManager.getPlayers().length;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
        return (this.gameState.submittedPrompts.length / needPrompts) >= 0.5;
    }

    // Updates players and client sockets on the game state
    async gameStateUpdate(io, playerManager) {
        io.emit(`Round ${this.gameState.roundNumber}, Phase Change: ${this.gameState.phase}`);
        playerManager.updatePlayersOnGameState(this.gameState.phase, this.gameState);

        // Emit events
        this.emit('phaseChanged', this.gameState.phase);
        this.emit('playerUpdate', playerManager.getPlayers());
    }

    // Fisher-Yates shuffle
    shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // Check if we have enough prompts
    async enoughPrompts(playerManager) {
        let numPlayers = playerManager.getPlayers().length;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
        return this.gameState.activePrompts.length >= needPrompts;
    }

    async generatePrompts() {
        let numPlayers = this.gameState.numPlayers;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
        let numGeneratedPrompts = needPrompts - this.gameState.activePrompts.length;

        for (let i = 0; i < numGeneratedPrompts; i++) {
            const suggestedPromptResponse = await apiUtils.suggestPrompt('make a random quiplash prompt');
            const suggestedPromptText = suggestedPromptResponse.suggestion;
            if (suggestedPromptText !== 'Cannot generate suggestion') {
                this.gameState.activePrompts.push(['API', suggestedPromptText]);
                console.log(`Suggested Prompt Added: [API, "${suggestedPromptText}"]`);
            } else {
                console.warn('API could not generate a suggestion.');
            }
        }
    }

    async assignPrompts(io, playerManager) {
        const players = playerManager.getPlayers();
        const numPlayers = players.length;
        this.gameState.numPlayers = numPlayers;
        const needPrompts = numPlayers % 2 === 0 ? numPlayers : numPlayers * 2;

        io.emit('message', { message: `Assigning ${needPrompts} prompts to ${numPlayers} players.` });

        // Fetch prompts until we have enough
        while (!await this.enoughPrompts(playerManager)) {
            const fetchedPrompts = await playerManager.fetchPrompts('en');
            this.gameState.activePrompts = this.gameState.activePrompts.concat(fetchedPrompts);
            if (this.gameState.activePrompts.length < needPrompts) {
                await this.generatePrompts();
            }
        }

        // Shuffle players and prompts
        const shuffledPlayers = this.shuffleArray([...players]);
        const shuffledPrompts = this.shuffleArray([...this.gameState.activePrompts]);

        // Assign prompts
        const promptsToAssign = shuffledPrompts.slice(0, needPrompts);
        let playerIndex = 0;
        for (const prompt of promptsToAssign) {
            const player = shuffledPlayers[playerIndex % numPlayers];
            playerManager.assignPromptToPlayer(player, prompt);
            playerIndex++;
        }
        io.emit('Prompts Assigned');

        // Emit assigned prompts to players
        for (const player of players) {
            const socketId = player.socketId;
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('assignedPrompts', { assignedPrompts: player.assignedPrompts });
            }
        }
    }

    // Game State Management
    async advanceGameState(io, playerManager) {
        switch (this.gameState.phase) {
            case 'joining':
                return this.checkAllPlayersReady(io, playerManager);
            case 'prompts':
                return await this.startPromptCollection(io, playerManager);
            case 'answers':
                return await this.startAnswerSubmission(io, playerManager);
            case 'voting':
                return await this.startVoting(io, playerManager);
            case 'results':
                return this.showResults(io, playerManager);
            case 'scores':
                return this.nextRoundOrEndGame(io, playerManager);
            case 'endGame':
                return this.endGame(io, playerManager);
            default:
                return { success: false, message: 'Invalid game phase.' };
        }
    }

    // Phase 1: Check if all players are ready to start the game
    async checkAllPlayersReady(io, playerManager) {
        const intervalId = setInterval(() => {
            if (playerManager.getPlayers().length >= 3) {
                clearInterval(intervalId);
                this.gameState.phase = 'prompts';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            } else {
                console.log('Waiting for players...');
            }
        }, 1000);
    }

    // Phase 2: Start prompt collection
    async startPromptCollection(io, playerManager) {
        this.gameState.phase = 'prompts';
        this.gameStateUpdate(io, playerManager);

        const intervalId = setInterval(async () => {
            if (await this.halfPromptsReceived(playerManager)) {
                clearInterval(intervalId);
                await this.assignPrompts(io, playerManager);
                this.gameState.phase = 'answers';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            } else {
                console.log('Waiting for prompts...');
            }
        }, 1000);
    }

    // Phase 3: Start answer submission
    async startAnswerSubmission(io, playerManager) {
        this.gameState.phase = 'answers';
        this.gameStateUpdate(io, playerManager);

        // Wait for answers or set a timer
        setTimeout(() => {
            this.gameState.phase = 'voting';
            this.gameStateUpdate(io, playerManager);
            this.advanceGameState(io, playerManager);
        }, 10000); // Adjust the timeout as needed
    }

    // Phase 4: Start voting
    async startVoting(io, playerManager) {
        this.gameState.phase = 'voting';
        this.gameStateUpdate(io, playerManager);

        // Emit voting options
        io.emit('votingOptions', { votingOptions: this.gameState.answers });

        // Wait for votes or set a timer
        setTimeout(() => {
            this.gameState.phase = 'results';
            this.gameStateUpdate(io, playerManager);
            this.advanceGameState(io, playerManager);
        }, 10000); // Adjust the timeout as needed
    }

    // Phase 5: Show results
    async showResults(io, playerManager) {
        this.gameState.phase = 'results';
        this.gameStateUpdate(io, playerManager);

        // Calculate and emit results
        const results = this.calculateVoteScores();
        io.emit('gameResults', { results });

        setTimeout(() => {
            this.gameState.phase = 'scores';
            this.gameStateUpdate(io, playerManager);
            this.advanceGameState(io, playerManager);
        }, 5000); // Adjust the timeout as needed
    }

    // Phase 6: Next round or end game
    async nextRoundOrEndGame(io, playerManager) {
        if (this.gameState.roundNumber < this.gameState.totalRounds) {
            this.gameState.roundNumber += 1;
            this.gameState.phase = 'prompts';
            this.gameStateUpdate(io, playerManager);
            this.advanceGameState(io, playerManager);
        } else {
            this.gameState.phase = 'endGame';
            this.gameStateUpdate(io, playerManager);
            this.advanceGameState(io, playerManager);
        }
    }

    async endGame(io, playerManager) {
        this.gameState.phase = 'endGame';
        this.gameStateUpdate(io, playerManager);
        io.emit('message', { message: 'Game Over' });
    }
}

module.exports = GameLogic;
