// utils/playerManager.js

'use strict';

const Player = require('../models/playerModel');

class PlayerManager {
  constructor() {
    this.players = {};   // Active players
    this.audience = {};  // Audience members
  }

  //getter for # players
  getNumPlayers() {
    return Objecy.keys(this.players).length;
  }

  getNumAudience() {
    return Object.keys(this.audience).length;
  }

  // Add a new player
  addPlayer(username, socketId) {
    if (this.players[username] || this.audience[username]) {
      return false; // Username already taken
    }

    if (Object.keys(this.players).length === 8) {
        this.addAudience(username, socketId);
        return false; // Room is full
    }
    // First player is admin
    const isAdmin = Object.keys(this.players).length === 0;
    const player = new Player(socketId, username, isAdmin);
    this.players[username] = player;
    return true;
  }

  // Add a new audience member
  addAudience(username, socketId) {
    if (this.players[username] || this.audience[username]) {
      return false; // Username already taken
    }
    const audienceMember = {socketId,username};
    this.audience[username] = audienceMember;
    return true;
  }

  // Handle prompt submission by a player
  submitPrompt(username) {
    const player = this.getPlayer(username);  
    if (
      !player ||
      player.state !== 'active' ||
      player.state === 'submittedPrompt' ||
      this.audience[username]
    ) {
      return { success: false, message: 'Player cannot submit prompts.' };
    }
    // Update player's state
    player.state = 'submittedPrompt';
    return { success: true };
  } 

  // total number of prompts submitted
  promptsSubmitted() {return Object.values(this.players).filter((player) => player.state === 'submittedPrompt').length;}

  // Helper function to assign prompts to players. Handles the player-side of assignment.
  playerToPrompt(shuffledPlayers, shuffledPrompts) {
    const numPlayers = shuffledPlayers.length;
    const numPrompts = shuffledPrompts.length;

    for (let i = 0; i < numPrompts; i++) {
        let assignedPlayers = [];

        if (numPlayers % 2 === 0) {
            // Even number of players, each player gets 1 prompt
            assignedPlayers = [
                shuffledPlayers[(i * 2) % numPlayers],
                shuffledPlayers[(i * 2 + 1) % numPlayers]];} 
        else {
            // Odd number of players, each player gets 2 prompts
            assignedPlayers = [
                shuffledPlayers[i % numPlayers],
                shuffledPlayers[(i + 1) % numPlayers],];}

        // Assign prompt to players
        assignedPlayers.forEach((username) => {
            const player = this.getPlayer(username);
            if (player) {
                player.assignedPrompts.push(i);}});
    }
  }

  // Handle answer submission by a player
  submitAnswer(username, promptId) {
    const player = this.getPlayer(username);

    if (player.state === 'answered') {
      return { success: false, message: 'Answer already submitted.' };
    }

    if (!player || !player.assignedPrompts.includes(promptId)) {
      return { success: false, message: 'Prompt not assigned to you.' };
    }
    // add playe's answer to Player model
    player.answers[promptId] = answerText;
    player.state = 'answered';
  
  }
  // Count submitted answers
  answersSubmitted() {
    return Object.values(this.players).filter((player) => player.state === 'answered').length};

  // Handle voting by a player
  // Submit a vote
  submitVote(username, selectedAnswerUsername, gameState) {
    const voter = this.getPlayer(username) || this.getAudience(username);
    if (!voter) {
      return { success: false, message: 'User not found.' };
    }
    // Prevent self-voting
    if (voter.username === selectedAnswerUsername) {
      return { success: false, message: 'You cannot vote on your own prompt.' };
    }

    const answers = gameState.answers[prompt.id] || [];
    const selectedAnswer = answers.find(ans => ans.username === selectedAnswerUsername);
    if (!selectedAnswer) {
      return { success: false, message: 'Selected answer does not exist for this prompt.' };
    }

    // Initialize votes for the prompt and answer if not present
    if (!this.votes[prompt.id]) {
      this.votes[prompt.id] = {};
    }
    if (!this.votes[prompt.id][selectedAnswerUsername]) {
      this.votes[prompt.id][selectedAnswerUsername] = new Set();
    }

    // Check if the voter has already voted for this prompt
    const hasVoted = Object.values(this.votes[prompt.id]).some(votersSet =>
      votersSet.has(username)
    );
    if (hasVoted) {
      return { success: false, message: 'You have already voted on this prompt.' };
    }

    // Record the vote
    this.votes[prompt.id][selectedAnswerUsername].add(username);

    // Update voter's state if necessary
    voter.state = 'voted';
    return { success: true };
  }

  // Method to get total votes received (used in gameLogic.js)
  totalVotes() {
    let votedPlayers = Object.values(this.players).filter((player) => player.state === 'voted').length;
    let votedAudience = Object.values(this.audience).filter((audience) => audience.state === 'voted').length;
    return votedPlayers + votedAudience;
  }



  // Remove a user by socket ID
  removeUserBySocketId(socketId) {
    const playerEntry = Object.values(this.players).find(
      (p) => p.socketId === socketId
    );

    if (playerEntry) {
      const username = playerEntry.username;
      delete this.players[username];
      this.reassignAdmin();
      return username;
    }

    const audienceEntry = Object.values(this.audience).find(
      (a) => a.socketId === socketId
    );
    if (audienceEntry) {
      const username = audienceEntry.username;
      delete this.audience[username];
      return username;
    }

    return null;
  }

  // Reassign admin if current admin disconnects
  reassignAdmin() {
    const remainingPlayers = Object.values(this.players);
    if (remainingPlayers.length > 0) {
      remainingPlayers[0].isAdmin = true;
    }
  }

  // Get audience members
  getAudience() {
    return Object.values(this.audience);
  }

  // Get player by username
  getPlayer(username) {
    return this.players[username] || null;
  }

  // Get player by socket ID
  getPlayerBySocketId(socketId) {
    return Object.values(this.players).find(
      (p) => p.socketId === socketId
    ) || null;
  }

  // Check if user is in the game
  isUserInGame(username) {
    return (
      this.players.hasOwnProperty(username) ||
      this.audience.hasOwnProperty(username)
    );
  }

  // Get username by socket ID
  getUsernameBySocketId(socketId) {
    const player = this.getPlayerBySocketId(socketId);
    if (player) return player.username;

    const audienceMember = Object.values(this.audience).find(
      (a) => a.socketId === socketId
    );
    return audienceMember ? audienceMember.username : null;
  }

  // Check if a user is admin
  isAdmin(username) {
    const player = this.getPlayer(username);
    return player ? player.isAdmin : false;
  }

  // Update player's state
  updatePlayerState(username, state) {
    const player = this.getPlayer(username);
    if (player) {
      player.state = state;
    }
  }
}

module.exports = new PlayerManager();