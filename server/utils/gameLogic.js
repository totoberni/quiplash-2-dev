// utils/gameLogic.js
// This class handles phase transitions and game state management.
'use strict';

const playerManager = require('./playerManager');
const apiUtils = require('./apiUtils');
const { io } = require('socket.io-client');
const { all, get } = require('axios');
const e = require('express');


class GameLogic {

    constructor(){
        this.resetGameState();
    }

    resetGameState() {
        this.gameState = {
            phase: 'joining',
            activePrompts: [],// [[promptUsername, text]] all prompts that can be voted on  
            submittedPrompts: [], // [[promptUsername, text]] all prompts submitted by players
            answers: [], // [[promptUsername, answerUsername, text]]
            votes: [], // [[answerUsername, voteUsername]]
            roundNumber: 1,
            totalRounds: 3,
            updateScores: [], // [[username, answerScore]] May need to update this later
        };
    }

    // Getters
    getGameState() {
        return this.gameState;
    }

    calculateVoteScores() {
        for (answerUsername in answers) {
            const answerVotes = this.votes.filter((vote) => vote[0] === answerUsername).length;
            const answerScore = answerVotes * this.gameState.roundNumber*100;
            this.gameState.updateScores.push({answerUsername, answerScore});
        }
        return updateScores;
    }

    async halfPromptsReceived() {
        let numPlayers = playerManager.getPlayers().length;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers
        return (needPrompts/this.gameState.submittedPrompts >= 0.5);
    }

    // Updates players and client sockets on the game state 
    async gameStateUpdate(io, playerManager) {
        io.emit(`Round ${this.getGameState.roundNumber}, Phase Change: ${getGameState().phase}`);
        playerManager.updatePlayersOnGameState(this.gameState.phase);
    }

    // Fisher-Yates shuffle :)
    shuffleArray(array) { 
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }

    // Check if we have enough prompts, returns bool
    async enoughPrompts(playerManager) {
        let numPlayers = playerManager.getPlayers().length;
        let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers
        this.gameState.activePrompts = this.gameState.activePrompts.concat(this.gameState.submittedPrompts); //squishing all submittedPrompts into activePrompts
        return (this.gameState.activePrompts.length >= needPrompts); // using activePrompts to store prompts from API + submitted prompts
    }

    async generatePrompts() {
        // cursed way of getting the number of missing prompts
        numGeneratedPrompts = (numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers) - this.activePrompts.length;
        // Iterate over the number of prompts we need to generate
        for (let i = 0; i < numGeneratedPrompts; i++) {
            const suggestedPromptResponse = await apiUtils.suggestPrompt('make a random quiplash prompt'); // keyword might need changing
            const suggestedPromptText = suggestedPromptResponse.suggestion;
            if (suggestedPromptText !== "Cannot generate suggestion") {
                // Add the suggested prompt with username 'API'
                this.gameState.activePrompts.push(['API', suggestedPromptText]);
                console.log(`Suggested Prompt Added: [API, "${suggestedPromptText}"]`);
            } else {
                console.warn('API could not generate a suggestion.');
                return
            }
        }
    }

    async assignPrompts(io, playerManager) {
        // Constants
        const players = playerManager.getPlayers();
        const numPlayers = players.length;
        const needPrompts = (numPlayers % 2 === 0) ? numPlayers : numPlayers * 2;
        // Io just to keep track of the game state
        io.emit(`Assigning ${needPrompts} prompts to ${numPlayers} players.`);
        // Fetch prompts until we have enough
        while (!enoughPrompts(playerManager)) {
            this.activePrompts.push(playerManager.fetchPrompts('en')); // Fetch prompts needs players list so playerManager does it
            // Maybe we need more prompts
            if (this.gameState.activePrompts.length < needPrompts) {
               this.generatePrompts();
            }
        }
        // Shuffle players and activePrompts
        const shuffledPlayers = this.shuffleArray([...players]); // Clone to avoid breaking original array
        const shuffledPrompts = this.shuffleArray([...this.gameState.activePrompts]); 

        // Select the required number of prompts
        const promptsToAssign = shuffledPrompts.slice(0, needPrompts);

        // Assign prompts to players in a round-robin fashion
        let playerIndex = 0;
        for (const prompt of promptsToAssign) {
            const player = shuffledPlayers[playerIndex % numPlayers];
            playerManager.assignPromptToPlayer(player, prompt);
            playerIndex++;
        }
        io.emit('Prompts Assigned');
        // Testing: Log the assignments for verification
        // console.log('Prompt Assignments:');
        // players.forEach(player => {
        //     console.log(`- ${player.username}:`);
        //     player.assignedPrompts.forEach((prompt, index) => {
        //         console.log(`  ${index + 1}. [${prompt[0]}, "${prompt[1]}"]`);
        //     });
        // });
    }

    // Game State Management. Each method transitions to the next phase and handles the game logic.
    async advanceGameState(io, playerManager) {
        switch (this.gameState.phase) {
            case 'joining':
                return this.checkAllPlayersReady(io);
            case 'prompts':
                return await this.startPromptCollection(io, playerManager);
            case 'answers':
                return this.startAnswerSubmission(io);
            case 'voting':
                return await this.startVoting(io);
            case 'results':
                return this.showResults(io);
            case 'scores':
                return this.nextRoundOrEndGame(io);
            case 'endGame':
                return this.endGame(io);
            default:
                return { success: false, message: 'Invalid game phase.' };
        }
    }

    // Phase 1: Check if all players are ready to start the game
    async checkAllPlayersReady(io, playerManager) {
        setInterval(() => {
            if (playerManager.getPlayers().length >= 3) {
                this.gameState.phase = 'prompts';
                this.gameStateUpdate(io);
                this.advanceGameState(io);
                clearInterval(this); // Stop checking
                return {success: true, message: ''};
            } else {return { success: false, message: 'Waiting for players...' };}
        } , 1000);   
    }

    // Phase 2: Start prompt collection
    async startPromptCollection(io, playerManager) {
        setInterval(() => {
            if (halfPromptsReceived()) {
                this.assignPrompts(playerManager);
                this.gameState.phase = 'answers';
                this.gameStateUpdate(io);
                this.advanceGameState(io);
                clearInterval(this);
                return {success: true, message: ''}
            } else {return { success: false, message: 'Waiting for prompts...' }}
        } , 1000);
    }

    // Phase 3: Start answer submission
    async startAnswerSubmission(io) {
        this.gameState.phase = 'answers';
        this.gameStateUpdate(io);
    }

    // Phase 4: Start voting
    async startVoting(io) {
        this.gameState.phase = 'voting';
        this.gameStateUpdate(io);
    }

    // Phase 5: Show results
    async showResults(io) {
        this.gameState.phase = 'results';
        this.gameStateUpdate(io);
    }

    // Phase 6: Next round or end game
    async nextRoundOrEndGame(io) {
        if (this.gameState.roundNumber < this.gameState.totalRounds) {
            this.gameState.phase = 'prompts';
            this.gameState.roundNumber += 1;
            this.gameStateUpdate(io);
        } else {
            this.gameState.phase = 'endGame';
            this.gameStateUpdate(io);
        }
    }
}

module.exports = GameLogic;