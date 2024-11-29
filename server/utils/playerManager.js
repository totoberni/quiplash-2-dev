// utils/playerManager.js
// Handles logic for players and their actions during the game. Shares responsibility with gameLogic.js.
'use strict';

const apiUtils = require('./apiUtils');
const Player = require('../models/playerModel');

class PlayerManager {

  constructor() {
    this.players = []; // Active players
    this.admin = null; // Game admin player object
    this.audience = []; // Audience members
  }

    // Getters 
    getPlayers() {
        return Object.values(this.players);
    }
    getPlayer(player) {
        return this.getPlayers().find((p) => p.username === player.username); // Maybe need to change this
    }
    getPlayerByUsername(username) {
        return this.getPlayers().find((p) => p.username === username);
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

    // Fetch Prompts returns all prompts submitted in previous games by the player
    async fetcPrompts(language){
        const allUsernames = getPlayers().concat(getAudience()).map((p) => p.username); // Get all usernames for API call
        const response = await apiUtils.getPrompts(allUsernames, language); 
        if (response.prompts) {
            // convert [{id, username, texr}] to [[username, text]]
            const apiPrompts = response.prompts.map(({username, text }) => [username, text]);
            return apiPrompts;
        } else {return [];} // Error handng is done in apiUtils. Might want t edit this
    }

    // Helpers
    isPlayer(player) {
        return !!this.getPlayer(player); // Returns true if player exists
      }
    isAudience(audience) {
        return !!this.getAudienceMember(audience);
    }    
    isAdmin(player) {
        return this.getAdmin().username === player.username; // May need to check without username boh
    }
    reassignAdmin() {
        if (this.getAdmin === (null||undefined) && this.getPlayers().length > 0) {this.getPlayers[0].isAdmin = true;} 
        else {console.log('Cannot reassign admin.');}
    }

    // Add new clients
    addPlayer(username, socketId, gameStatePhase) {
        const player = this.getPlayerByUsername(username);
        if (player) {
          return false; // Username already taken
        }
        if (this.getPlayers().length === 8) {
            this.addAudience(username, socketId);
            return false; // Room is full
        }
        const isAdmin = this.getPlayers() == 0 || null|| undefined; // First player is admin
        const justJoined = gameStatePhase !== 'joining';
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
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'waitingPlayers');
                break;
            case 'prompts':
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'active');
                this.getPlayers().forEach((player) => player.justJoined = false); // Enable them to play starting from this round
                break;
            case 'answers':
                getAudience().forEach((player) => player.state = 'waitingAnswers');
                getPlayers().forEach((player) => player.state = 'active');
                break;
            case 'voting':
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'active');
                break;
            case 'results':
                updatePlayersOnResults(gameState);
                getPlayers().concat(getAudience()).forEach((player) => player.state = 'waitingResults');
                break;
            case 'scores':
                getPlayers().concat(getAudience()).forEach((client) => client.state = "waitingScores");
                break;
            case 'endGame':
                updatePlayersAfterGame(player);
                
                //getPlayers().concat(getAudience()).forEach((client) => this.removeUser(client.username)); // figure out what happens here
            default:
                console.log('Error updating player states.');
        }
    }
    // Update players' scores based on game results calculated in gameLogic.js as answerScore
    updatePlayersOnResults(gameState) {
        for (entry in gameState.updateScores) {
            const player = getPlayerByUsername(entry.answerUsername);
            player.roundScore = gameState.updateScores[entry.answerScore]
            player.score += roundScore;
        }
    }
    // Update players' scores and states after a game ends
    updatePlayersAfterGame(player) {
        for (player in getPlayers()) {
            player.gamesPlayed += 1;
            player.score += player.roundScore;
            player.roundScore = 0;
            player.assignedPrompts = [];
            player.submittedPrompts = [];
            player.answer = [];
            player.vote = [];
            player.state = 'waitingEndgame';
            player.justJoined = false;
            }
    }
    // Update player's info before logging out
    updateClientBeforeLogout(client) { // Client is still a player object
        client.score += client.roundScore;
        apiUtils.editPlayer(client.username, client.gamesPlayed, client.score);
        client.roundScore = 0;
        client.assignedPrompts = [];
        client.submittedPrompts = [];
        client.answer = [];
        client.vote = [];
        client.state = 'offline';
        client.justJoined = false;
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
        updatePlayerBeforeLogout(player); // Should run after all validation is done
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
    // Assigning prompts to players used in gameLogic.js
    assignPromptToPlayer(player, prompt) {
        if (!player || player.justJoined || player.state !== 'active') {
            return { success: false, message: 'Player cannot be assigned prompts.' };
        }
        player.assignedPrompts.push(prompt);
    }
}        

module.exports = PlayerManager;