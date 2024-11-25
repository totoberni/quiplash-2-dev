// utils/playerManager.js
// Handles logic for players and their actions during the game. Shares responsibility with gameLogic.js.
'use strict';

const gameLogic = require('./gameLogic');
const apiUtils = require('./apiUtils');
const Player = require('../models/playerModel');

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
    getPlayerByUsername(username) {
        return this.getPlayers().find((player) => player.username === username);
    }
    getAdmin() {
        return this.getPlayers().find((player) => player.isAdmin);
    }
    getAudience() {
        return Object.values(this.audience);
    }
    getAudienceByUsername(username) {
        return this.getAudience().find((player) => player.username === username);
    }

    // Helpers
    isPlayer(username) {
        return this.getPlayerByUsername(username) !== (undefined||null||''); 
    }
    isAudience(username) {
        return !this.isPlayer(username) && this.audience[username] !== (undefined||null||'');
    }    
    isAdmin(username) {
        return this.getAdmin().username === username;
    }
    // Reassign admin if current admin disconnects
    reassignAdmin() {
        if (this.getAdmin === null && this.getPlayers().length > 0) {this.getPlayers[0].isAdmin = true;} 
        else {console.log('Cannot reassign admin.');}
    }

    // Add new clients
    addPlayer(username, socketId,) {
      if (this.isPlayer(username) || this.isAudience(username)) {
        return false; // Username already taken
      }

      if (this.getPlayers().length === 8) {
          this.addAudience(username, socketId);
          return false; // Room is full
      }
      const isAdmin = getPlayers().length === 0; // First player is admin
      this.players.push(new Player(socketId, username, isAdmin));
      return true;
    }
    addAudience(username, socketId) {
      this.audience.push(new Player(socketId, username, false));
      return true;
    }

    // Update clients based on game state
    updatePlayersOnGameState(gameState) {
        switch (gameState.phase) {
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
                updatePlayersAfterVoting(gameState);
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'waiting');
                break;
            case 'scores':
                getAudience().forEach((audience) => audience.state = "waiting");
                updatePlayersAfterGame(player);
                break;
            case 'endGame':
                getPlayers().concat(getAudience()).forEach((client) => this.removeUser(client.username)); // figure out what happens here
            default:
                console.log('Error updating player states.');
        }
    }

    updatePlayersAfterVoting(gameState) {
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
            player.state = 'waiting';
            }
    }
    
    // Remove clients
    removeUser(username) {
        if (isPlayer(username)) {
            const playerIndex = this.getPlayers().findIndex((player) => player.username === username);
            if (playerIndex !== -1) {
                this.players.splice(playerIndex, 1);
                if(isAdmin(username)){
                    this.getPlayerByUsername(username).isAdmin = false;
                    this.reassignAdmin()};
                    console.log(`Player ${username} removed.`);
                return true;
            }

        } else if (isAudience(username)) {
            const audienceIndex = this.getAudience().findIndex((player) => player.username === username);
            if (audienceIndex !== -1) {
                this.audience.splice(audienceIndex, 1);
                console.log(`Audience member ${username} removed.`);
                return true;
            }
        } else {
            console.log('Error removing user.');
            return false; // Username not found
        }
    }
    removeUserBySocketId(socketId) {
        // Check if player or audience member
        const playerSocketId = Object.values(this.players).find((p) => p.socketId === socketId);
        const audienceSocketId = Object.values(this.audience).find((a) => a.socketId === socketId);
      
        if (playerSocketId || audienceSocketId) {
            const username = playerSocketId?.username || audienceSocketId?.username;
            this.removeUser(username);
            console.log('Player removed.');
            return true;
        }
        
        else{
            console.log('User not found. Could not remove user.');
            return false;
        }
    }

}

module.exports = new PlayerManager();