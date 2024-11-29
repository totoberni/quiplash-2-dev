// game.js

var socket = null;

var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        loggedIn: false,
        username: '',
        password: '',
        sessionId: '',
        messages: [],
        chatmessage: '',
        errorMsg: '',
        successMsg: '',
        suggestionText: '',
        suggestedPrompt: '',
        selectedOptionIndex: null,
        gameState: null, // Contains gameLogic object from the server
        playerInfo: null, // Stores player object 
        showJoinGameForm: false,
        gameCode: '',
        promptText: '', // Captures user input for prompt submission
        answers: [], // Captures user input for answers
        promptInputs: [], // For handling multiple prompts
    },
    methods: {
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
        // Handle suggested prompt from server
        handleSuggestedPrompt(data) {
            this.suggestedPrompt = data.suggestedPrompt;
        },
        submitAnswers() {
            if (socket && this.answers.length > 0) {
                socket.emit('submitAnswers', { answers: this.answers });
                this.answers = [];
            }
        },
        selectOption(index) {
            this.selectedOptionIndex = index;
        },
        submitVote() {
            if (this.selectedOptionIndex !== null) {
                const selectedOption = this.gameState.votingOptions[this.selectedOptionIndex];
                const answerUsername = selectedOption[0];
                if (socket) {
                    socket.emit('submitVote', { answerUsername });
                    this.selectedOptionIndex = null; // Reset selection
                } else {
                    this.errorMsg = 'Not connected to the server.';
                }
            } else {
                this.errorMsg = 'Please select an option to vote.';
            }
        },
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
    }
});

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