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
            gameCode: this.generateGameCode(),
            phase: 'joining',
            activePrompts: {},// [[promptUsername, text]] all prompts that can be voted on  
            submittedPrompts: [], // [[promptUsername, text]] all prompts submitted by players
            answers: [], // [[promptUsername, answerUsername, text]]
            votes: [], // [[answerUsername, voteUsername]]
            roundNumber: 1,
            totalRounds: 3,
            updateScores: [], // [[username, answerScore]] May need to update this later
        };
    }

    
    // Create a function that generates a unique game code
    generateGameCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
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
    async gameStateUpdate(io) {
        io.emit(`Round ${this.getGameState.roundNumber}, Phase Change: ${getGameState().phase}`);
        playerManager.updatePlayersOnGameState(this.gameState.phase);
    }

    // Fisher-Yates shuffle :)
    shufflePrompts() { 
        let prompts = this.gameState.activePrompts;
        let currentIndex = prompts.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [prompts[currentIndex], prompts[randomIndex]] = [prompts[randomIndex], prompts[currentIndex]];
        }
        this.gameState.activePrompts = prompts;
    }

    // Game State Management. Each method transitions to the next phase and handles the game logic.
    async advanceGameState(io) {
        switch (this.gameState.phase) {
            case 'joining':
                return this.checkAllPlayersReady(io);
            case 'prompts':
                return await this.startPromptCollection(io);
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
    async checkAllPlayersReady(io) {
        setInterval(() => {
        if (playerManager.getPlayers().length >= 3) {
            this.gameState.phase = 'prompts';
            this.gameStateUpdate(io);
            this.advanceGameState(io);
            clearInterval(this); // Stop checking
        }return {success: true, message: ''}} , 1000);
        return { success: false, message: 'Waiting for players...' };
    }

    // Phase 2: Start prompt collection
    async startPromptCollection(io) {
        setInterval(() => {
            if (halfPromptsReceived()) {
                this.gameState.phase = 'answers';
                this.gameStateUpdate(io);
                this.advanceGameState(io);
                clearInterval(this);
            } return {success: true, message: ''}} , 1000);
        return { success: false, message: 'Waiting for prompts...' };
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