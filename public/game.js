// game.js

var socket = null;

// Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        loggedIn: false,
        inGame: false,
        username: '',
        password: '',
        sessionId: '',
        messages: [],
        chatmessage: '',
        errorMsg: '',
        successMsg: '',
        gameState: null,
        playerInfo: null,
        showJoinGameForm: false,  // To control the visibility of the join game form
        gameCode: ''              // To store the entered game code
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
        gameCreate() {
            if (socket) {
                socket.emit('gameCreate');
                inGame = true;
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
                this.inGame = true;
                this.showJoinGameForm = false;
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

    // Handle game created event
    socket.on('gameCreated', function(data) {
        app.inGame = true;
        app.gameCode = data.gameCode; // Store the game code
        app.successMsg = `Game created with code: ${data.gameCode}`;
    });

    // Handle game joined event
    socket.on('gameJoined', function(data) {
        app.inGame = true;
        app.gameCode = data.gameCode; // Store the game code
        app.successMsg = `Joined game with code: ${data.gameCode}`;
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

    // Handle errors from the server
    socket.on('error', function(data) {
        app.errorMsg = data.message;
    });

    // Other event handlers as needed
}