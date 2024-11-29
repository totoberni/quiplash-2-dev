// server/models/playerModel.js

class Player {
    constructor(socketId, username, isAdmin) {
      this.socketId = socketId; 
      this.username = username; 
      this.isAdmin = isAdmin; // Admin flag
      this.score = 0; 
      this.roundScore = 0; 
      this.gamesPlayed = 0; 
      this.submittedPrompts = []; // [promptUsername, text] only 1 prompt can be submitted
      this.assignedPrompts = []; // [[promptUsername, text]] can contain up to 2 prompts
      this.answers = []; //[[promptUsername, answerUsername, answer]] can contain up to 2 answers 
      this.vote = []; // [answerUsername, voteUsername] only 1 vote
      this.state = 'joining'; // Keeps track of players' state
      this.justJoined = true; // Reset at the end of each round
    }
  }
  
module.exports = Player;  