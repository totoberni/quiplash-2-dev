// server/models/playerModel.js

class Player {
    constructor(socketId, username) {
      this.socketId = socketId; // Unique identifier for the player's socket connection
      this.username = username; // Player's username
      this.isAdmin = false; // Indicates if the player is the game admin
      this.score = 0; // Total score accumulated by the player
      this.roundScore = 0; // Score accumulated in the current round
      this.assignedPrompts = []; // Prompts assigned to the player for answering
      this.state = 'active'; // Current state of the player (e.g., active, answered, voted, disconnected)
      // Additional properties can be added as needed
    }
  }
  
module.exports = Player;  