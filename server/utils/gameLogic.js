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
          activePrompts: {},// {text, promptUsername} all prompts that can be voted on  
          submittedPrompts: {}, // {text, promptUsername} all prompts submitted by players
          answers: {}, // {promptUsername, {answerUsername, answer}}
          votes: {}, // {answerUsername, voteUsername}
          roundNumber: 1,
          totalRounds: 3,
          updateScores: {},}; // {username, answerScore} May need to update this later
        }
    
    // Getters
    getGameState() {
        return this.gameState;
    }

    // Helpers
    addPrompt(text, username) { // Add prompt to submittedPrompts for in-game mgt
        this.gameState.submittedPrompts.push({"text": text, "username": username});
        return apiUtils.createPrompt(username, text);
    }

    calculateAnswerScores(votes) {
        for (answerUsername in answers) {
            const answerVotes = votes.filter((vote) => vote === answerUsername).length;
            const answerScore = answerVotes * this.gameState.roundNumber*100; // Each vote is worth 10 points
            this.gameState.updateScores.push({answerUsername, answerScore});
        }
        return updateScores;
    }

    halfPromptsReceived() {
        return this.gameState.submittedPrompts.length >= playerManager.getPlayers().length/2;
    }

    gameStateUpdate(io) {
        io.emit('Next Phase', `gameState: ${getGameState().phase}`);
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
    checkAllPlayersReady(io) {setInterval(() => {
        if (playerManager.getPlayers().length >= 3) {
            this.gameState.phase = 'prompts';
            this.gameStateUpdate(io);
            clearInterval(this); // Stop checking
        }} , 1000);
        return { success: false, message: 'Waiting for players...' };
    }

    // Phase 2: Start prompt collection
    async startPromptCollection(io) {
        this.gameState.phase = 'prompts';
        this.gameStateUpdate(io);
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