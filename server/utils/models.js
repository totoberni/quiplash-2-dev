// server/models/models.js
class Player {
    constructor(socketId, username, isAdmin, justJoined) {
      this.socketId = socketId; 
      this.username = username; 
      this.isAdmin = isAdmin; // Admin flag
      this.nextPhaseRequest = false; // Admin request flag to progress game phase
      this.score = 0; 
      this.roundScore = 0; 
      this.gamesPlayed = 0; 
      this.assignedPrompts = []; // [promptObject] 
      this.answers = []; // [answerObject] 
      this.state = 'joining'; // Keeps track of players' state
      this.justJoined = justJoined; // Reset at the end of each round
    }
  }

class Prompt {
    constructor(username, text) {
        this.username = username;
        this.text = text;
        this.answers = []; // [answerObjects]
    }
}

class Answer {
    constructor(username, text) {
        this.username = username;
        this.text = text;
        this.votes = []; // [voteUsernames]
    }
}

module.exports = {Player, Prompt, Answer};