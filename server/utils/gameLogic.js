// utils/gameLogic.js
// This class handles phase transitions and game state management.

'use strict';

const EventEmitter = require('events');
const apiUtils = require('./apiUtils');
const e = require('express');

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
            votingOptions: [], // [{ promptText, options: [{ answerUsername, answerText }] }]
            votes: [], // [[answerUsername, voteUsername]]
            roundNumber: 1,
            totalRounds: 3,
            results : [], // [[ answerUsername, answerText, votes]]
            updateScores: [], // [[ answerUsername, answerScore ]]
            numPlayers: 0, // Added to keep track of the number of players
            serverTime: 0,
        };
    }

    // Getters
    getGameState() {
        return this.gameState;
    }

    async calculateResults() {
        const voteCounts = {}; // { answerUsername: votes }
    
        // Count votes per answerUsername
        for (const vote of this.gameState.votes) {
            const [answerUsername, _] = vote; // change to [answerUsername, voteUsername] if needed
            if (!voteCounts[answerUsername]) {
                voteCounts[answerUsername] = 0;
            }
            voteCounts[answerUsername]++;
        }
    
        // Build results array
        const results = [];
        const addedAnswerUsernames = new Set();
    
        for (const answer of this.gameState.answers) {
            const [promptUsername, answerUsername, answerText] = answer;
    
            // Ensure each answerUsername is unique
            if (!addedAnswerUsernames.has(answerUsername)) {
                const votes = voteCounts[answerUsername] || 0;
    
                // Only include answers with votes > 0
                if (votes > 0) {
                    results.push([answerUsername, answerText, votes]);
                    addedAnswerUsernames.add(answerUsername);
                }
            }
        }
        // Sort results in descending order of votes
        results.sort((a, b) => b[2] - a[2]); // Sort by votes descending
    
        return results; // [[ answerUsername, answerText, votes]] descending order by votes
    }

    async calculateVoteScores() {
        const playerScores = {}; // { answerUsername: totalScore }
        // Calculate scores for each player
        for (let answer of this.gameState.answers) {
            const answerUsername = answer[1];
            const answerVotes = this.gameState.votes.filter((vote) => vote[0] === answerUsername).length;
            const answerScore = answerVotes * this.gameState.roundNumber * 100;
    
            if (!playerScores[answerUsername]) {
                playerScores[answerUsername] = 0;
            }
            playerScores[answerUsername] += answerScore;
        }
        // Convert playerScores object to array
        const scoresArray = Object.keys(playerScores).map(username => {
            return [username, playerScores[username]];
        });
        // Sort the array
        scoresArray.sort((a, b) => {
            if (b[1] !== a[1]) {
                // Sort by score descending
                return b[1] - a[1];
            } else {
                // If scores are equal, sort alphabetically
                return a[0].localeCompare(b[0]);
            }
        });
        // Build the podium (top 5 positions)
        const podium = [];
        let position = 1;
        let i = 0;
        while (position <= 5 && i < scoresArray.length) {
            const currentScore = scoresArray[i][1];
            const playersAtPosition = [];
    
            while (i < scoresArray.length && scoresArray[i][1] === currentScore) {
                playersAtPosition.push([scoresArray[i][0], scoresArray[i][1]]);
                i++;
            }
            podium.push({
                position: position,
                players: playersAtPosition
            });
            position++;
        }
        return podium;
    }

    async halfPromptsReceived(playerManager) {
        let numPlayers = playerManager.getPlayers().length;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
        return (this.gameState.submittedPrompts.length / needPrompts) >= 0.5;
    }

    async allAnswersSubmitted(playerManager) {
        let numPlayers = playerManager.getPlayers().length;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
        return this.gameState.answers.length >= needPrompts*2;  
    }

    async allVotesSubmitted(playerManager) {
        return this.gameState.votes.length >= (playerManager.getPlayers().concat(playerManager.getAudience())).length;
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
        const numPlayers = playerManager.getPlayers().length;
        const needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
        return (this.gameState.activePrompts.length >= needPrompts);
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
            const player = shuffledPlayers[playerIndex % numPlayers];
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

    // Helper method to prepare voting options
    async prepareVotingOptions() {
        const votingOptions = [];
        console.log('Starting to prepare voting options...');
        for (const answer of this.gameState.answers) {
            const [promptUsername, answerUsername, answerText] = answer;
            const promptEntry = this.gameState.activePrompts.find(p => p[0] === promptUsername);
            const promptText = promptEntry ? promptEntry[1] : 'Unknown Prompt';
            console.log('Voting options pushed:', [answerUsername, promptText, answerText]);
            votingOptions.push([answerUsername, promptText, answerText]);
        }
        console.log('Voting options prepared:', votingOptions);
        this.gameState.votingOptions = votingOptions;
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
            if (await this.halfPromptsReceived(playerManager) && playerManager.getAdmin().nextPhaseRequest) {
                clearInterval(intervalId);
                await this.assignPrompts(io, playerManager);
                this.gameState.phase = 'answers';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            } else {
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
            if (await this.allAnswersSubmitted(playerManager) && playerManager.getAdmin().nextPhaseRequest) {
                clearInterval(intervalId);
                this.gameState.phase = 'voting';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            } else {
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
        // Emit voting options
        await this.prepareVotingOptions();
        this.gameState.phase = 'voting';
        this.gameStateUpdate(io, playerManager);
        let elapsedSeconds_4 = 0;
        const intervalId = setInterval(async () => {
            if (await this.allVotesSubmitted(playerManager) && playerManager.getAdmin().nextPhaseRequest) {
                clearInterval(intervalId);
                this.gameState.phase = 'results';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
            } else {
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
        this.gameState.phase = 'results';
        this.gameStateUpdate(io, playerManager);
    
        // Calculate and set results
        this.gameState.results = await this.calculateResults();
        io.emit('gameStateUpdate', { gameState: this.getGameState() });
    
        const intervalId = setInterval(() => {
            if (playerManager.getAdmin().nextPhaseRequest){
                this.gameState.phase = 'scores';
                this.gameStateUpdate(io, playerManager);
                this.advanceGameState(io, playerManager);
                clearInterval(intervalId);
            }
        }, 500); // Adjust the timeout as needed
    }

    // Phase 6: Show scores
    async showScores(io, playerManager) {
        this.gameState.updateScores = await this.calculateVoteScores();
        this.gameStateUpdate(io, playerManager);
        console.log("Next Phase Request: ", playerManager.getAdmin().nextPhaseRequest)
        const intervalId = setInterval(() => {
            if (playerManager.getAdmin().nextPhaseRequest){
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
            //this.gameState.phase = 'nextRound'; // Resetting phase to prevent delay with timer
            // Store the next round start time (current time + 8 seconds)
            this.gameState.serverTime = Date.now();
            this.gameStateUpdate(io, playerManager);
            // Start an 8-second timer before starting the next round
            const intervalId = setInterval(() => {
                if (playerManager.getAdmin().nextPhaseRequest){
                    this.gameState.roundNumber += 1;
                    // Reset necessary game state properties for the new round
                    this.gameState.phase = 'prompts';
                    delete this.gameState.serverTime; // Remove the timer after it's done
                    this.gameState.activePrompts = [];
                    this.gameState.submittedPrompts = [];
                    this.gameState.answers = [];
                    this.gameState.votes = [];
                    this.gameState.updateScores = [];
                    this.gameState.votingOptions = [];
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