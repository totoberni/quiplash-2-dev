// game.js

var socket = null;

// Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        loggedIn: false,
        username: '',
        password: '',
        sessionId: '',      // Store the session ID
        messages: [],
        chatmessage: '',
        errorMsg: '',
        successMsg: '',
        gameState: null,    // Game state sent from the server
        playerState: null   // Player-specific state sent from the server
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
            console.log('Register method called');
            this.errorMsg = '';
            this.successMsg = '';
            axios.post('/player/register', {
                username: this.username,
                password: this.password
            })
            .then(response => {
                console.log('Registration response:', response.data);
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
            console.log('Login method called');
            this.errorMsg = '';
            this.successMsg = '';
            axios.post('/player/login', {
                username: this.username,
                password: this.password
            })
            .then(response => {
                console.log('Login response:', response.data);
                if (response.data.result) {
                    this.loggedIn = true;
                    this.successMsg = 'Login successful!';
                    // Store the sessionId
                    this.sessionId = response.data.sessionId;
                    // Now connect to socket.io
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
        startGame() {
            if (socket) {
                socket.emit('startGame');
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        },
        joinGame() {
            if (socket) {
                socket.emit('joinGame');
            } else {
                this.errorMsg = 'Not connected to the server.';
            }
        }
    }
});

function connect(sessionId) {
    // Prepare web socket with authentication
    socket = io({
        auth: {
            sessionId: sessionId
        }
    });

    // Connect
    socket.on('connect', function() {
        // Set connected state to true
        app.connected = true;
    });

    // Handle connection error
    socket.on('connect_error', function(error) {
        console.error('Connection error:', error.message);
        alert('Unable to connect: ' + error.message);
    });

    // Handle disconnection
    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
    });

    // Handle incoming chat message
    socket.on('chat', function(data) {
        app.handleChat(data);
    });

    // Handle game state updates from the server
    socket.on('gameStateUpdate', function(data) {
        app.gameState = data.gameState;
        app.playerState = data.playerState;
        app.errorMsg = '';
        app.successMsg = '';
        // Update the UI based on the new state
    });

    // Handle errors from the server
    socket.on('error', function(data) {
        app.errorMsg = data.message;
    });

    // Other event handlers as needed
}