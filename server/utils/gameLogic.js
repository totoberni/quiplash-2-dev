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
            activePrompts: [], // [promptObjects]
            results : [], // [answerObjects]
            podium: [], // [{position, players: [playerObjects]}]
            leaderBoard: [], // [playerObjects]
            numPlayers: 0, // Added to keep track of the number of players
            serverTime: 0,
            roundNumber: 1,
            totalRounds: 3,
        };
    }

    // Getters
    getGameState() {
        return this.gameState;
    }

    calculateResults() {
        const allAnswers = [];
        for (const prompt of this.gameState.activePrompts) {
            for (const answer of prompt.answers) {
                allAnswers.push(answer);
            }
        }
        // Sort descending by votes.length
        allAnswers.sort((a, b) => b.votes.length - a.votes.length);
        this.gameState.results = allAnswers;
    }

    updateLeaderBoard(playerManager) {
        playerManager.updatePlayersOnResults(this.gameState);
        const allPlayers = playerManager.getPlayers();
        allPlayers.sort((a, b) => {
            const diff = b.score - a.score; // Sort primarily by total score descending
            // If tie, fallback to alphabetical by username
            return diff !== 0 ? diff : a.username.localeCompare(b.username);
        });
        // 3) Assign sorted players to the leaderBoard
        this.gameState.leaderBoard = allPlayers;
    }

    // Build a podium (top 5) from gameState.leaderBoard
    makePodium() {
        const playersArray = this.gameState.leaderBoard || [];
        const podium = [];
        let position = 1;
        let i = 0;

        // Group by identical scores, rank the group together
        while (position <= 5 && i < playersArray.length) {
            const currentScore = playersArray[i].score;
            const playersAtPosition = [];

            // Group all players who share the same score
            while (
                i < playersArray.length &&
                playersArray[i].score === currentScore
            ) {
                playersAtPosition.push(playersArray[i]);
                i++;
            }
            podium.push({ position, players: playersAtPosition });
            position++;
        }

        return podium;
    }

    async halfPromptsReceived(playerManager) {
        this.gameState.numPlayers = playerManager.getPlayers().length;
        const needPrompts = this.gameState.numPlayers % 2 === 0 ? this.gameState.numPlayers / 2 : this.gameState.numPlayers;
        return (this.gameState.activePrompts.length / needPrompts) >= 0.5;
    }

    async allAnswersSubmitted(playerManager) {
        const answers = playerManager.getPlayers().map(player => player.answers);
        return answers.length >= this.gameState.activePrompts.length;  
    }

    async allVotesSubmitted(playerManager) {
        const numPlayers = ((playerManager.getPlayers()).concat(playerManager.getAudience())).length;
        let totalVotes = 0;
    
        // Sum up all votes across all prompt answers
        for (const prompt of this.gameState.activePrompts) {
            for (const answer of prompt.answers) {
                totalVotes += answer.votes.length;
            }
        }
        return totalVotes >= (numPlayers * this.gameState.activePrompts.length);
    }

    // Updates players and client sockets on the game state
    async gameStateUpdate(io, playerManager) {
        playerManager.getAdmin().nextPhaseRequest = false; // Put it here to avoid switch statement in playerManager.updatePlayersOnGameState() 
        playerManager.updatePlayersOnGameState(this.gameState.phase, this.gameState);
        this.emit('gameStateUpdate', { gameState: this.getGameState() });
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
        this.gameState.numPlayers = playerManager.getPlayers().length;
        const needPrompts = this.gameState.numPlayers % 2 === 0 ? this.gameState.numPlayers / 2 : this.gameState.numPlayers;
        return (this.gameState.activePrompts.length >= needPrompts);
    }

    async generatePrompts() {
        let needPrompts = this.gameState.numPlayers % 2 === 0 ? this.gameState.numPlayers / 2 : this.gameState.numPlayers;
        let numGeneratedPrompts = needPrompts - this.gameState.activePrompts.length;

        for (let i = 0; i < numGeneratedPrompts; i++) {
            const suggestedPromptResponse = await apiUtils.suggestPrompt('make a random quiplash prompt');
            const suggestedPromptText = suggestedPromptResponse.suggestion;
            if (suggestedPromptText !== 'Cannot generate suggestion') {
                prompt = new Prompt('AI Generated', suggestedPromptText);
                this.gameState.activePrompts.push(prompt);
                console.log(`Suggested Prompt Added: [API, ${suggestedPromptText}]`);
            } else {
                console.warn('API could not generate a suggestion.');
            }
        }
    }

    async assignPrompts(io, playerManager) {// change this 
        const players = playerManager.getPlayers();
        this.gameState.numPlayers = players.length;
        const needPrompts = this.gameState.numPlayers % 2 === 0 ? this.gameState.numPlayers : this.gameState.numPlayers * 2;

        // Fetch prompts until we have enough
        while (!await this.enoughPrompts(playerManager)) {
            const fetchedPrompts = await playerManager.fetchPrompts('en');
            this.gameState.activePrompts.push(...fetchedPrompts);
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
            const player = shuffledPlayers[playerIndex % this.gameState.numPlayers];
            playerManager.assignPromptToPlayer(player, prompt);
            playerIndex++;
        }
        console.log('Prompts Assigned');

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
                return this.showScores(io, playerManager);
            case 'nextRound':
                return this.nextRoundOrEndGame(io, playerManager);
            case 'endGame':
                return this.endGame(io, playerManager);
            default:
                return { success: false, message: 'Invalid game phase.' };
        }
    }

    // Phase 1: Check if all players are ready to start the game
    async checkAllPlayersReady(io, playerManager) {
        let elapsedSeconds_1 = 0;
        const intervalId = setInterval(() => {
            if (playerManager.getPlayers().length >= 3 && playerManager.getAdmin().nextPhaseRequest) {
                clearInterval(intervalId);
                this.gameState.phase = 'prompts';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            } else {
                elapsedSeconds_1 += 1;
                if (this.elapsedSeconds % 10 === 0) {
                    io.emit('message', { message: 'Waiting for more players...' });
                    console.log('Waiting for players...');
                }
            }
        }, 500);
    }

    // Phase 2: Start prompt collection
    async startPromptCollection(io, playerManager) {
        this.gameState.phase = 'prompts';
        this.gameStateUpdate(io, playerManager);
        let elapsedSeconds_2 = 0;

        const intervalId = setInterval(async () => {
            if (await this.halfPromptsReceived(playerManager)) {
                const admin = playerManager.getAdmin();
                if (admin && admin.nextPhaseRequest) {
                    clearInterval(intervalId);
                    await this.assignPrompts(io, playerManager);
                    this.gameState.phase = 'answers';
                    this.gameStateUpdate(io, playerManager);
                    this.advanceGameState(io, playerManager);
            }} else {
                elapsedSeconds_2 += 1;
                if (this.elapsedSeconds % 10 === 0) {
                    console.log('Waiting for prompts...');
                    io.emit('message', { message: 'Waiting for prompts...' });
                }
            }
        }, 500);
    }

    // Phase 3: Start answer submission
    async startAnswerSubmission(io, playerManager) {
        this.gameState.phase = 'answers';
        this.gameStateUpdate(io, playerManager);
        let elapsedSeconds_3 = 0;
        const intervalId = setInterval(async () => {
            if (await this.allAnswersSubmitted(playerManager)){
                const admin = playerManager.getAdmin();
                if (admin && admin.nextPhaseRequest) {
                    clearInterval(intervalId);
                    this.gameState.phase = 'voting';
                    this.gameStateUpdate(io, playerManager);
                    this.advanceGameState(io, playerManager);
            }} else {
                elapsedSeconds_3 += 1;
                if (this.elapsedSeconds % 10 === 0) {
                    console.log('Waiting for answers...');
                    io.emit('message', { message: 'Waiting for answers...' });
                }
                // Implement a maximum waiting time if desired
                // For example, if elapsedSeconds >= maxWaitingTime, force progression
            }
        }, 500);
    }

    // Phase 4: Start voting
    async startVoting(io, playerManager) {
        let elapsedSeconds_4 = 0;
        const intervalId = setInterval(async () => {
            if (await this.allVotesSubmitted(playerManager)) {
                const admin = playerManager.getAdmin();
                if (admin && admin.nextPhaseRequest) {
                clearInterval(intervalId);
                this.gameState.phase = 'results';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            }} else {
                elapsedSeconds_4 += 1;
                if (this.elapsedSeconds % 10 === 0) {
                    console.log('Waiting for players to vote...');
                    io.emit('message', { message: 'Waiting for players to vote...' });
                }
            }
        }, 500);
    }

    // Phase 5: Show results
    async showResults(io, playerManager) {    
        // Calculate and set results
        this.gameState.results = await this.calculateResults();
        io.emit('gameStateUpdate', { gameState: this.getGameState() });
        const intervalId = setInterval(() => {
            if (playerManager.getAdmin().nextPhaseRequest){
                const admin = playerManager.getAdmin();
                if (admin && admin.nextPhaseRequest) {
                    this.gameState.phase = 'scores';
                    this.gameStateUpdate(io, playerManager);
                    this.advanceGameState(io, playerManager);
                    clearInterval(intervalId);
                }
            }
        }, 500); // Adjust the timeout as needed
    }

    // Phase 6: Show scores
    async showScores(io, playerManager) {
        this.gameState.updateScores = await this.calculateVoteScores();
        this.gameStateUpdate(io, playerManager);
        const intervalId = setInterval(() => {
            const admin = playerManager.getAdmin();
            if (admin && admin.nextPhaseRequest){
                this.gameState.phase = 'nextRound';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
                clearInterval(intervalId);
            }
        }, 500); // Adjust the timeout as needed
    }

    
    // Phase 7: Next round or end game
    async nextRoundOrEndGame(io, playerManager) {
        if (this.gameState.roundNumber < this.gameState.totalRounds) {
            this.gameState.serverTime = Date.now();
            this.gameStateUpdate(io, playerManager);
            // Start an 8-second timer before starting the next round
            const intervalId = setInterval(() => {
                if (playerManager.getAdmin().nextPhaseRequest){
                    this.gameState.roundNumber += 1;
                    // Reset necessary game state properties for the new round
                    this.gameState.phase = 'prompts';
                    delete this.gameState.serverTime; // Remove the timer after it's done
                    this.gameState.numPlayers = 0;
                    this.gameState.activePrompts = [];
                    this.gameState.answers = [];
                    this.gameState.votes = [];
                    this.gameState.updateScores = [];
                    this.gameState.results = [];
                    this.gameStateUpdate(io, playerManager);
                    this.advanceGameState(io, playerManager);
                    clearInterval(intervalId);   
                }
            }, 100); // 10 seconds timer added for style points
        } else {
            this.gameState.phase = 'endGame';
            this.gameStateUpdate(io, playerManager);
            this.advanceGameState(io, playerManager);
        }
    }
    // Phase 8: End game
    async endGame(io, playerManager) {
        this.gameState.phase = 'endGame';
        this.gameStateUpdate(io, playerManager);
        io.emit('message', { message: 'Game Over' });
    }
}

module.exports = GameLogic;