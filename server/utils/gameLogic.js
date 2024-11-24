// utils/gameLogic.js
// neeed to refine game logic
'use strict';

const playerManager = require('./playerManager');
const apiUtils = require('./apiUtils');
const { io } = require('socket.io-client');
const { all } = require('axios');

class GameLogic {

    constructor() {
        this.resetGameState();
    }

    resetGameState() {
    this.gameState = {
      phase: 'joining',
      prompts: [],
      activePrompts: [],
      answers: {},
      votes: {},
      roundNumber: 1,
      totalRounds: 3,
      totalScores: {},
    };
    }

    // Get the number of submitted prompts
    getPromptCount() {
        return this.gameState.prompts.length;
    }

    // Get current game phase
    getPhase() {
        return this.gameState.phase;
    }

    // Add a submitted prompt
    addPrompt(promptText, username) {
        this.gameState.prompts.push({ text: promptText, username });
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
        }} , 500);
        return { success: false, message: '' };
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
        // Start a 20-second timer to wait for the remaining prompts, if not, generate prompts from the API
        return { success: false, message: '' };
    }
    
    // Submit a prompt
    submitPrompt(username, promptText) {
        if (this.gameState.phase !== 'prompts') {
            return { success: false, message: 'Not accepting prompts at this time.' };
        }
        const player = playerManager.getPlayer(username);
        if (!player || player.state !== 'active' || player.state === 'submittedPrompt' || playerManager.audience[username]) {
            return { success: false, message: 'Player cannot submit prompts.' };
        }
    // Add prompt to game state
    this.addPrompt(promptText, username);
    // Update player's state if necessary
    if (player) {
      player.state = 'submittedPrompt';
    }
    return { success: true };
    }

    // Check if all prompts are received
    // Check if the number of submitted prompts is equal to the number of players/2
    halfPromptsReceived() {
      const totalPlayers = Object.keys(playerManager.players).length;
      const submittedPrompts = this.getPromptCount();

      return Math.round(submittedPrompts/2) >= totalPlayers;
    }

    // Assign prompts to players
    assignPrompts(prompts) {
    const players = Object.keys(playerManager.players);
    const shuffledPrompts = this.shuffleArray(prompts);
    const numPrompts = Math.ceil(players.length / 2);

    for (let i = 0; i < numPrompts; i++) {
        const prompt = shuffledPrompts[i];
        const assignedPlayers = [
          players[i % players.length],
          players[(i + 1) % players.length],
        ];
        const promptId = `prompt_${Date.now()}_${i}`;
      
        this.gameState.activePrompts.push({
          id: promptId,
          text: prompt.text,
          assignedPlayers,
        });
      
        assignedPlayers.forEach((username) => {
          const player = playerManager.getPlayer(username);
          if (player) {
            player.assignedPrompts.push(promptId);
          }
        });
        }
    }

    // Start answer submission phase
    async startAnswerSubmission(io) {
    this.gameState.phase = 'answers';

    // Fetch prompts from API
    let apiPrompts = [];
    try {
        apiPrompts = await apiUtils.getPrompts([], 'en'); // Assuming 'en' as language
    } catch (error) {
        console.error('Error fetching prompts from API:', error);
    }

    const combinedPrompts = [
        ...this.gameState.prompts,
        ...apiPrompts,
    ];

    // Assign prompts to players
    this.assignPrompts(combinedPrompts);
    io.emit('phaseChange', { phase: 'answers' });
    return { success: true };
  }


    // Submit an answer
    submitAnswer(username, promptId, answerText) {
    const player = playerManager.getPlayer(username);

    if (!player || !player.assignedPrompts.includes(promptId)) {
      return { success: false, message: 'Prompt not assigned to you.' };
    }

    if (!this.gameState.answers[promptId]) {
      this.gameState.answers[promptId] = [];
    }

    const existingAnswer = this.gameState.answers[promptId].find(
      (ans) => ans.username === username
    );

    if (existingAnswer) {
      return { success: false, message: 'Answer already submitted.' };
    }

    this.gameState.answers[promptId].push({
      username,
      answerText,
    });

    playerManager.updatePlayerState(username, 'answered');
    return { success: true };
    }

    // Check if all answers are received
    allAnswersReceived() {
    const totalAnswers = Object.values(this.gameState.answers).reduce(
      (acc, answers) => acc + answers.length,
      0
    );
    const totalExpected = Object.keys(playerManager.players).length *
                          (this.gameState.activePrompts.length / 2);
    return totalAnswers >= totalExpected;
    }

    // Start voting phase
    startVoting(io) {
      this.gameState.phase = 'voting';
      io.emit('phaseChange', { phase: 'voting', prompts: this.gameState.activePrompts });
      return { success: true };
    }

    // Submit a vote
    submitVote(username, promptId, selectedAnswerUsername) {
    const voter = playerManager.getPlayer(username) || playerManager.audience[username];
    if (!voter) {
      return { success: false, message: 'User not found.' };
    }

    // Prevent self-voting
    const prompt = this.gameState.activePrompts.find(p => p.id === promptId);
    if (!prompt) {
      return { success: false, message: 'Prompt not found.' };
    }

    if (prompt.assignedPlayers.includes(username)) {
      return { success: false, message: 'You cannot vote on your own prompt.' };
    }

    const answers = this.gameState.answers[prompt.id] || [];
    const selectedAnswer = answers.find(ans => ans.username === selectedAnswerUsername);
    if (!selectedAnswer) {
      return { success: false, message: 'Selected answer does not exist for this prompt.' };
    }

    // Initialize votes for the prompt and answer if not present
    if (!this.gameState.votes[prompt.id]) {
      this.gameState.votes[prompt.id] = {};
    }
    if (!this.gameState.votes[prompt.id][selectedAnswerUsername]) {
      this.gameState.votes[prompt.id][selectedAnswerUsername] = new Set();
    }

    // Check if the voter has already voted for this prompt
    const hasVoted = Object.values(this.gameState.votes[prompt.id]).some(votersSet =>
      votersSet.has(username)
    );
    if (hasVoted) {
      return { success: false, message: 'You have already voted on this prompt.' };
    }

    // Record the vote
    this.gameState.votes[prompt.id][selectedAnswerUsername].add(username);

    // Update voter's state if necessary
    voter.state = 'voted';

    return { success: true };
    }

    // Check if all votes are received
    allVotesReceived() {
    const totalVoters = Object.keys(playerManager.players).length +
                        Object.keys(playerManager.audience).length;
    const totalVotes = Object.values(this.gameState.votes).reduce((acc, promptVotes) => {
      const votesForPrompt = Object.values(promptVotes).reduce((sum, votersSet) => sum + votersSet.size, 0);
      return acc + votesForPrompt;
    }, 0);

    // Each prompt should receive votes from all voters except the players who wrote the answers
    const expectedVotesPerPrompt = totalVoters - 2; // Exclude the two players who wrote answers
    const totalExpectedVotes = this.gameState.activePrompts.length * expectedVotesPerPrompt;

    return totalVotes >= totalExpectedVotes;
    }

    // Calculate round scores
    calculateRoundScores() {
        const roundNumber = this.gameState.roundNumber;
    
        // Initialize round scores
        Object.keys(playerManager.players).forEach(username => {
          const player = playerManager.getPlayer(username);
          player.roundScore = 0;
        });
    
        // For each prompt, calculate scores
        this.gameState.activePrompts.forEach(prompt => {
          const answers = this.gameState.answers[prompt.id] || [];
          const votes = this.gameState.votes[prompt.id] || {};
    
          answers.forEach(answer => {
            const voteCount = votes[answer.username] ? votes[answer.username].size : 0;
            const points = roundNumber * voteCount * 100;
            const player = playerManager.getPlayer(answer.username);
            if (player) {
              player.roundScore += points;
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
        this.gameState.phase = 'results';
    
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
      this.gameState.prompts = [];
      this.gameState.activePrompts = [];
      this.gameState.answers = {};
      this.gameState.votes = {};

      // Reset player states
      Object.values(playerManager.players).forEach(player => {
        player.assignedPrompts = [];
        player.state = 'active';
        player.roundScore = 0;
      });

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