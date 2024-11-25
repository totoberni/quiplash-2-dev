// utils/gameLogic.js
// neeed to refine game logic
'use strict';

const playerManager = require('./playerManager');
const apiUtils = require('./apiUtils');
const { io } = require('socket.io-client');
const { all } = require('axios');
const e = require('express');
  
class GameLogic {

  constructor() {
      this.resetGameState();
  }

  resetGameState() {
  this.gameState = {
    phase: 'joining',
    prompts: [],
    gameInstancePrompts: [],
    answers: {},
    votes: {},
    roundNumber: 1,
    totalRounds: 3,
    totalScores: {},};
  }

  // HELPER FUNCTIONS
  // Get the number of submitted prompts
  getPromptCount() {
      return this.gameState.gameInstancePrompts.length;
  }

  // Get current game phase
  getPhase() {
      return this.gameState.phase;
  }

  // Add a submitted prompt
  addPrompt(promptText, username) {
      this.gameState.gameInstancePrompts.push({ text: promptText, username });
      return { success: true };
  }

  // Shuffle an array
  shuffleArray(array) {
      const newArray = array.slice();
      for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
      }
      return newArray;
      }

  // Advance the game state
    //TODO: Implement the advanceGameState method from startAnswerSubmission
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
      case 'nextRound':
          return this.nextRoundOrEndGame(io);
      default:
          return { success: false, message: 'Invalid game phase.' };
  }
  }

  // Check if all players are ready
  checkAllPlayersReady(io) {
      //repeat the check every 5 seconds
      setInterval(() => {
      if (playerManager.getTotalPlayers() >= 3) {
          this.gameState.phase = 'prompts';
          io.emit('phaseChange', { phase: 'prompts' });
          return { success: true };
      }} , 1000);
      return { success: false, message: 'Waiting for players...' };
  }

  // Start prompt collection phase
  // Start checking until 50% of the players have submitted a prompt
  startPromptCollection(io) {
      setInterval(() => {
      if (halfPromptsReceived()) {
          this.gameState.phase = 'answers';
          io.emit('phaseChange', { phase: 'answers' });
          return { success: true };
      }} , 1000);
      return { success: false, message: '' };
  }

  // Submit a prompt - shared with the playerManager to validate player data
  handlePromptSubmission(username, promptText) {
    if (this.gameState.phase !== 'prompts') {
      return { success: false, message: 'Not accepting prompts at this time.' };
    }
    // Delegate to playerManager
    this.gameInstancePrompts.push({ text: promptText, username });
    const result = playerManager.submitPrompt(username, promptText, this.gameState);
    return result;
  }

  // Check if all prompts are received through playerManager
  halfPromptsReceived() {
    let numPlayers = playerManager.getTotalPlayers();
    let needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers; // need to decide what to do with varnames 
    return (needPrompts/playerManager.promptsSubmitted() >= 0.5);
  }

  async assignPrompts() {
    // Determine the number of prompts needed
    const numPlayers = playerManager.getTotalPlayers();
    const needPrompts = numPlayers % 2 === 0 ? numPlayers / 2 : numPlayers;
    // Fetch prompts from API
    const apiPrompts = [];
    const languages = ["en"]; // "es", "it", "sv", "ru", "id", "bg", "zh-Hans", "hi", "ga", "pl"]; add more languages later
    const players = Object.keys(playerManager.players);
    for (const player of players) {
      for (const lang of languages) {
        try {
          apiPrompts = await apiUtils.getPrompts(player, lang);
          if (apiPrompts.length >= needPrompts / 2) {break;}
        }catch (error) {
        console.error('Error fetching prompts from API:', error);}
      }
    }
    // If no prompts are available, generate them using suggestPrompt
    while (this.gameInstancePrompts.length + apiPrompts.length < needPrompts) {
        try {
            const suggestedPrompt = await apiUtils.suggestPrompt("make a random prompt for a quiplash game entry");
            apiPrompts.push({ text: suggestedPrompt.suggestion });
        } catch (error) {
            console.error('Error generating prompts using suggestPrompt:', error);
        }
    }
    
    // Combine player and API prompts and shuffle prompts
    this.gameInstancePrompts = this.shuffleArray([...this.gameInstancePrompts, ...this.apiPrompts]);
    // Assign shuffled players to shuffled prompts using playerManager
    playerManager.playerToPrompt(this.shuffleArray(players), this.gameInstancePrompts);
  }
    // Comparing number of stored answers to number of players who have submitted
    allAnswersReceived() {
      return (Object.keys(this.gameState.answers).length === playerManager.answersSubmitted());
    }

    // Start answer submission phase
    async startAnswerSubmission(io) {
      // Assign prompts to players
      await this.assignPrompts();
    
      // Start checking every 5 seconds if all answers are received
      const answerCheckInterval = setInterval(() => {
          if (this.allAnswersReceived()) {
              clearInterval(answerCheckInterval);
              // Transition to voting phase
              this.gameState.phase = 'voting';
              io.emit('phaseChange', { phase: 'voting', prompts: this.gameState.gameInstancePrompts });
          }
      }, 5000);
      return { success: true };
    }

  // Handle answer submission
  // May not need to have it here
  handleAnswerSubmission(username, answerText) {
    if (this.gameState.phase !== 'answers') {
      return { success: false, message: 'Not accepting answers at this time.' };
    }
    // Delegate to playerManager
    const result = playerManager.submitAnswer(username, answerText, this.gameState);
    return result;
  }

  // Check if all votes are received
  async votesReceived() {
    return (Object.keys(this.gameState.votes).length === playerManager.getNumPlayers() + playerManager.getNumAudience());
  }
  
  // Method to reset votes (used when starting a new round)
  resetVotes() {
    this.votes = {};
  }

  // Start voting phase
  async startVoting(io) {
    // set interval to check if all votes are received
    setInterval(() => {
    if (this.allVotesReceived()) {
      this.gameState.phase = 'results';
      io.emit('phaseChange', { phase: 'results' });
      return { success: true };
      }} , 500);
    return { success: false, message: '' };
  }
  // Maybe delete later
  submitVote(username, promptId, selectedAnswerUsername) {
    return playerManager.submitVote(username, promptId, selectedAnswerUsername, this.gameState);
  }

  // Calculate round scores
  calculateRoundScores() {
      const roundNumber = this.gameState.roundNumber;    
      // For each prompt, calculate scores
      this.gameState.gameInstancePrompts.forEach(prompt => {
        const answers = this.gameState.answers[prompt.id] || [];
        const votes = this.gameState.votes[prompt.id] || {};
  
        answers.forEach(answer => {
          const voteCount = votes[answer.username] ? votes[answer.username].size : 0;
          const points = roundNumber * voteCount * 100;
          const player = playerManager.getPlayer(answer.username);
          if (player) {
            player.roundScore += points;
          } else {
            console.error('Player not found, better check the logic... ', answer.username);
          }
        });
      });
  }
  
  // Update total scores
  updateTotalScores() {
      Object.keys(playerManager.players).forEach(username => {
        const player = playerManager.getPlayer(username);
        player.score += player.roundScore;
        player.roundScore = 0; // Reset round score
        this.gameState.totalScores[username] = player.score;
      });
  }

  // Show results
  async showResults(io) {
      // Calculate scores
      this.calculateRoundScores();
      this.updateTotalScores();
  
      // Get the podium from the backend API
      let podium = [];
      try {
        podium = await apiUtils.getPodium();
      } catch (error) {
        console.error('Error fetching podium from API:', error);
      }
  
      // Prepare scores data
      const scores = Object.keys(playerManager.players).map(username => {
        const player = playerManager.getPlayer(username);
        return {
          username,
          roundScore: player.roundScore,
          totalScore: player.score,
        };
      });
  
      // Emit the results to clients
      io.emit('phaseChange', {
        phase: 'results',
        scores,
        podium,
      });
  
      return { success: true };
    }
    
    // Proceed to next round or end game
    nextRoundOrEndGame(io) {
    if (this.gameState.roundNumber < this.gameState.totalRounds) {
      this.gameState.roundNumber += 1;
      // Reset round-specific data
      this.gameState.gameInstancePrompts = [];
      this.gameState.answers = {};
      this.gameState.votes = {};
      this.gameState.phase = 'prompts';
      io.emit('phaseChange', { phase: 'prompts' });

      // Resets need better handling
      playerManager.resetPlayerStates();
      playerManager.resetPlayerScores();
      playerManager.resetVotes();

      // Start the next round
      this.startPromptCollection(io);
    } else {
      // End the game
      this.gameState.phase = 'gameOver';
      io.emit('phaseChange', { phase: 'gameOver' });
    }
    return { success: true };
    }
}

module.exports = new GameLogic();