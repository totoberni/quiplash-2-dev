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
    getPhase() {
      return this.gameState.phase;
    }
    getActivePrompts() {
        return this.gameState.getActivePrompts;
    }
    getSubmittedPrompts() {
        return this.gameState.submittedPrompts;
    }
    getPromptByUsername(dict,username) { // Supports both activePrompts and submittedPrompts
        return dict.find((prompt) => prompt.username === username);
    }
    getAnswers() {
        return this.gameState.answers;
    }// may need to add more answer getters
    getVotes() {
        return this.gameState.votes;
    }// getters for votes will be added later


    getRoundNumber() {
        return this.gameState.roundNumber;
    }
    getTotalRounds() {
        return this.gameState.totalRounds;
    }
    getTotalScores() {
        return this.gameState.totalScores;
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
            io.emit('Next Phase: ', { phase: 'prompts' });
            clearInterval(this); // Stop checking
            //return { success: true }; 
        }} , 1000);
        return { success: false, message: 'Waiting for players...' };
    }
}

module.exports = GameLogic;