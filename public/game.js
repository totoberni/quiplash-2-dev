// public/game.js
var socket = null;

// Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        loggedIn: false,
        username: '',
        password: '',
        messages: [],
        chatmessage: '',
        errorMsg: '',
        successMsg: ''
    },
    methods: {
        handleChat(message) {
            if (this.messages.length + 1 > 10) {
                this.messages.pop();
            }
            this.messages.unshift(message);
        },
        chat() {
            socket.emit('chat', this.chatmessage);
            this.chatmessage = '';
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
                    // Now connect to socket.io
                    connect();
                } else {
                    this.errorMsg = response.data.msg;
                }
            })
            .catch(error => {
                console.error('Login error:', error);
                this.errorMsg = 'An error occurred during login.';
            });
        }
    }
});

function connect() {
    // Prepare web socket
    socket = io();

    // Connect
    socket.on('connect', function() {
        // Set connected state to true
        app.connected = true;
    });

    // Handle connection error
    socket.on('connect_error', function(message) {
        alert('Unable to connect: ' + message);
    });

    // Handle disconnection
    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
    });

    // Handle incoming chat message
    socket.on('chat', function(message) {
        app.handleChat(message);
    });
}