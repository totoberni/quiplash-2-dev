// utils/playerManager.js
// Handles logic for players and their actions during the game. Shares responsibility with gameLogic.js.
'use strict';

const gameLogic = require('./gameLogic');
const apiUtils = require('./apiUtils');
const Player = require('../models/playerModel');
const { get } = require('../controllers/authController');

class PlayerManager {
  constructor() {
    this.players = {}; // Active players
    this.admin = null; // Game admin player object
    this.audience = {}; // Audience members
  }

    // Getters 
    getPlayers() {
        return Object.values(this.players);
    }
    getPlayer(player) {
        return this.getPlayers().find((p) => p.username === player.username); // Maybe need to change this
    }
    getPlayerBySocketId(socketId) {
        let player =  this.getPlayers().find((player) => player.socketId === socketId);
        if (player) {
            return player;
        } else {
            console.log('Player not found.'); 
            return null;}
    }

    getAdmin() {
        return this.getPlayers().find((player) => player.isAdmin);
    }
    getAudience() {
        return Object.values(this.audience);
    }
    getAudienceMember(audience) {
        return this.getAudience().find((p) => p.username === audience.username);
    }

    // Helpers
    isPlayer(player) {
        return this.getPlayer(player) !== (undefined||null||''); 
    }
    isAudience(audience) {
        return this.getAudienceMember(audience) !== (undefined||null||'');
    }    
    isAdmin(player) {
        return this.getAdmin().username === player.username; // May need to check without username boh
    }
    reassignAdmin() {
        if (this.getAdmin === (null||undefined) && this.getPlayers().length > 0) {this.getPlayers[0].isAdmin = true;} 
        else {console.log('Cannot reassign admin.');}
    }

    // Add new clients
    addPlayer(player, socketId, gameStatePhase) {
      if (this.isPlayer(player.username)|| this.isAudience(player.username)) {
        return false; // Username already taken
      }
      if (this.getPlayers().length === 8) {
          this.addAudience(username, socketId);
          return false; // Room is full
      }
      const isAdmin = getPlayers() == 0 || null|| undefined; // First player is admin
      const justJoined = gameStatePhase !== joining;
      this.players.push(new Player(socketId, username, isAdmin, justJoined)); // justJoined is true if player joins during a game
      return true;
    }
    addAudience(player, socketId) {
      this.audience.push(new Player(socketId, player.username, false));
      return true;
    }

    // Update clients based on game state
    updatePlayersOnGameState(gameStatePhase) {
        switch (gameStatePhase) {
            case 'joining':
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'waiting');
                break;
            case 'prompts':
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'active');
                break;
            case 'answers':
                getAudience().forEach((player) => player.state = 'waiting');
                getPlayers().forEach((player) => player.state = 'active');
                break;
            case 'voting':
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'active');
                break;
            case 'results':
                updatePlayersOnResults(gameState);
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'waiting');
                break;
            case 'scores':
                getPlayers().concat(getAudience()).forEach((client) => client.state = "waiting");
                break;
            case 'endGame':
                updatePlayersAfterGame(player);
                getPlayers().concat(getAudience()).forEach((client) => this.removeUser(client.username)); // figure out what happens here
            default:
                console.log('Error updating player states.');
        }
    }
    updatePlayersOnResults(gameState) {
        for (entry in gameState.updateScores) {
            const player = getPlayerByUsername(entry.answerUsername);
            player.roundScore = gameState.updateScores[entry.answerScore]
            player.score += roundScore;
        }
    }
    updatePlayersAfterGame(player) {
        for (player in getPlayers()) {
            player.gamesPlayed += 1;
            player.roundScore = 0;
            player.assignedPrompts = [];
            player.submittedPrompts = [];
            player.answer = [];
            player.vote = [];
            player.state = 'waiting';
            player.justJoined = false;
            }
    }
    
    // Remove clients
    removeUser(player) {
        if (isPlayer(player)) {
            const playerIndex = this.getPlayers().findIndex((p) => p === player);
            
            if (playerIndex !== -1) { // Player found
                if(playerIndex == 0){player.isAdmin = false;} // first player is admin
                this.players.splice(playerIndex, 1);
                reassignAdmin();
                console.log(`Player ${username} removed.`);
                return true;
            }
        }

        else if (isAudience(player)) {
            const audienceIndex = this.getAudience().findIndex((a) => a.username === player.username);
            if (audienceIndex !== -1) {
                this.audience.splice(audienceIndex, 1);
                console.log(`Audience member ${username} removed.`);
                return true;
            }
        } 
        
        else { // Username not found
            console.log('Error removing user.'); 
            return false;
        } 
    }
    removeUserBySocketId(socketId) {
        const client = this.getPlayers().concat(this.getAudience()).find((player) => player.socketId === socketId);
        if (client) {
            removeUser(client);
            console.log('Player removed.');
            return true;
        }
        else{
            console.log('User not found. Could not remove user.');
            return false;
        }
    }

    // Submittions
    // Handle prompt submission by a player
    submitPrompt(gameState, player, text) {
      if (!player) {
        return { success: false, message: 'User cannot submit prompts.' };
      }
      // Update player's state
      gameState.submittedPrompts.push([player.username, text]);
      return { success: true };
    }

    // Handle answer submission by a player
    // Takes prompt -> [promptUsername, text] and pushes answer -> [promptUsername, answerUsername, text] to gameState.answers and player.answers
    submitAnswer(gameState, player, text, prompt) {
        // Validating player's answer
        if (!player ||player.state !== 'active' || !player.assignedPrompts|| player.justJoined) { // Checking justJoined avoids having to reassign prompts
            return { success: false, message: 'Player cannot submit answers.' };
        }
        if (!player.assignedPrompts.includes(prompt)) {
            return { success: false, message: 'Player has not been assigned this prompt.' };
        }
        if (player.answers.includes(prompt)) {
            return { success: false, message: 'Player cannot answer the same prompt twice.' };
        } 
        gameState.answers.push([prompt[0], player.username, text]);
        player.answers.push([prompt[0], player.username, text]); // [promptUsername, answerUsername, text]
        if (player.answers.length === player.assignedPrompts.length) {
            player.state = 'submitted'; // Helps check if all answers have been submitted
        }
    }

    // Handle vote submission by a player
    // Takes answer -> [promptUsername, answerUsername, text] and pushes vote -> [answerUsername, voteUsername] to gameState.votes and player.vote
    submitVote(gameState, player, answer) {
        // Validating player's vote
        if (!player || gameState.phase !== 'voting') {
            return { success: false, message: 'Player cannot submit votes.' };
        }
        if (player.vote) {
            return { success: false, message: 'Player has already voted.' };
        }
        gameState.votes.push([answer[1], player.username]);
        player.vote.push([answer[1], player.username]); // [answerUsername, voteUsername]
        player.state = 'submitted'; 
    }
}        

module.exports = new PlayerManager();