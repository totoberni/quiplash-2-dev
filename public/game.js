// game.js

var socket = null;

var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        loggedIn: false,
        showJoinGameForm: false,
        showNextPhaseButton: false,
        username: '',
        password: '',
        sessionId: '',
        messages: [],
        chatmessage: '',
        errorMsg: '',
        successMsg: '',
        suggestionText: '',
        suggestedPrompt: '',
        gameCode: '',
        promptText: '', // Captures user input for prompt submission
        answers: [],     // Captures user input for answers
        promptInputs: [], // For handling multiple prompts

        // Voting-related states
        currentPromptIndex: 0,   // Tracks which prompt we're currently voting on
        selectedAnswerIndex: null, // Tracks which answer is selected within that prompt

        // Game and player state
        gameState: null,   // Contains gameLogic object
        playerInfo: null,  // Stores player object

        // Timer-related
        timer: 0,
        progressBarWidth: 100,
    },
    methods: {
        // Chat-related
        handleChat(data) {
            const message = data.username + ': ' + data.message;
            if (this.messages.length + 1 > 10) {
                this.messages.pop();
            }
            this.messages.unshift(message);
        },
        chat() {
            if (socket) {
                socket.emit('chat', { message: this.chatmessage });
                this.chatmessage = '';
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        },

        // Registration / Login
        register() {
            this.errorMsg = '';
            this.successMsg = '';
            axios.post('/player/register', {
                username: this.username,
                password: this.password
            })
            .then(response => {
                if (response.data.result) {
                    this.successMsg = 'Registration successful! You can now login.';
                } else {
                    this.errorMsg = response.data.msg;
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                this.errorMsg = 'An error occurred during registration.';
            });
        },
        login() {
            this.errorMsg = '';
            this.successMsg = '';
            axios.post('/player/login', {
                username: this.username,
                password: this.password
            })
            .then(response => {
                if (response.data.result) {
                    this.loggedIn = true;
                    this.successMsg = 'Login successful!';
                    this.sessionId = response.data.sessionId;
                    connect(this.sessionId);
                } else {
                    this.errorMsg = response.data.msg;
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                this.errorMsg = 'An error occurred during login.';
            });
        },

        // Game creation / joining
        gameCreate() {
            if (socket) {
                socket.emit('gameCreate');
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        },
        showJoinGame() {
            this.showJoinGameForm = true;
        },
        submitGameCode() {
            if (socket) {
                socket.emit('gameJoin', { gameCode: this.gameCode });
                this.showJoinGameForm = false;
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        },

        // Prompt submission / generation
        submitPrompt() {
            if (socket && this.promptText.trim() !== '') {
                socket.emit('submitPrompt', { text: this.promptText });
                this.promptText = '';
            }
        },
        generatePromptSuggestion() {
            if (socket) {
                socket.emit('generatePromptSuggestion', { topic: this.suggestionText });
                this.suggestionText = '';
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        },
        handleSuggestedPrompt(data) {
            this.suggestedPrompt = data.suggestedPrompt;
        },

        // Phase progression
        nextPhaseRequest() {
            if (socket) {
                socket.emit('nextPhaseRequest');
                this.showNextPhaseButton = false;
                if (this.gameState.phase === 'nextRound') {
                    this.stopTimer();
                }
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        },

        // Submitting answers for the "answers" phase
        submitAnswers() {
            if (socket && this.answers.length > 0) {
                socket.emit('submitAnswers', { answers: this.answers });
                this.answers = [];
            } else {
                this.errorMsg = 'Type all answers before submitting!';
            }
        },

        // Voting: selecting and submitting
        selectOption(aIndex) {
            this.selectedAnswerIndex = aIndex;
        },
        submitVote() {
            // Submits the vote for the currently selected answer, then advances to the next prompt.
            if (this.currentPrompt && this.selectedAnswerIndex !== null) {
                const selectedAnswer = this.currentPrompt.answers[this.selectedAnswerIndex];
                if (selectedAnswer) {
                    // Emit the selected answer's username
                    socket.emit('submitVote', { answerUsername: selectedAnswer.username });

                    // Move to the next prompt
                    this.currentPromptIndex++;
                    this.selectedAnswerIndex = null;
                }
            } else {
                this.errorMsg = 'Please select an answer to vote!';
            }
        },

        // Displaying the podium
        getPositionClass(position) {
            switch (position) {
                case 1:
                    return 'gold';
                case 2:
                    return 'silver';
                case 3:
                    return 'bronze';
                default:
                    return 'standard';
            }
        },
        getOrdinalSuffix(position) {
            if (position === 1) return 'st';
            if (position === 2) return 'nd';
            if (position === 3) return 'rd';
            return 'th';
        },

        // Timer methods
        startTimer() {
            if (this.gameState.serverTime > 0) {
                const duration = 10000 + this.gameState.serverTime - Date.now();
                this.timerInterval = setInterval(() => {
                    this.updateTimer(duration);
                }, 100); // Update every 100ms for smooth progress bar
            }
        },
        updateTimer(duration) {
            const remaining = duration - (Date.now() - this.gameState.serverTime);
            this.timer = Math.ceil(remaining / 1000); // Convert to seconds, round up
            this.progressBarWidth = (remaining / duration) * 100; // Percentage for progress bar

            if (remaining <= 0) {
                this.stopTimer();
            }
        },
        stopTimer() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },
    },
    watch: {
        'gameState.phase': function(newPhase) {
            // Start or stop the timer depending on the phase
            if (newPhase === 'nextRound') {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        },
    },
    beforeDestroy() {
        this.stopTimer();
    },
    computed: {
        // Returns the currently active prompt (minus the user’s own answers if desired)
        currentPrompt() {
            if (
                !this.gameState ||
                !this.gameState.activePrompts ||
                this.currentPromptIndex >= this.gameState.activePrompts.length
            ) {
                return null;
            }

            const prompt = this.gameState.activePrompts[this.currentPromptIndex];
            const filteredAnswers = prompt.answers.filter(ans => ans.username !== this.username); // Filter out the user's own answers
            return {
                ...prompt,
                answers: filteredAnswers
            };
        },
    },
});

// Function to connect to the server using the session ID
function connect(sessionId) {
    socket = io({
        auth: {
            sessionId: sessionId
        }
    });

    socket.on('connect', function() {
        app.connected = true;
    });

    socket.on('gameCreated', function(data) {
        app.gameCode = data.gameCode;
        app.successMsg = `Game created with code: ${data.gameCode}`;
    });

    socket.on('gameJoined', function(data) {
        app.gameCode = data.gameCode;
        app.successMsg = `Joined game with code: ${data.gameCode}`;
    });

    socket.on('playerInfo', function(data) {
        app.playerInfo = data.playerInfo;
    });

    socket.on('gameStateUpdate', function(data) {
        app.gameState = data.gameState;
        if (app.gameState.phase === 'nextRound') {
            app.startTimer();
        }
        const phasesRequiringNextPhase = [
            'joining',
            'prompts',
            'answers',
            'voting',
            'results',
            'scores',
            'nextRound',
            'endGame'
        ];
        if (app.playerInfo.isAdmin) {
            app.showNextPhaseButton = phasesRequiringNextPhase.includes(app.gameState.phase);
            console.log('Admin:', app.showNextPhaseButton);
        }
    });

    socket.on('suggestedPrompt', function(data) {
        app.handleSuggestedPrompt(data);
    });

    socket.on('assignedPrompts', function(data) {
        app.playerInfo.assignedPrompts = data.assignedPrompts;
        app.answers = new Array(data.assignedPrompts.length).fill('');
    });

    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
    });

    socket.on('chat', function(data) {
        app.handleChat(data);
    });

    socket.on('error', function(data) {
        app.errorMsg = data.message;
    });
}
