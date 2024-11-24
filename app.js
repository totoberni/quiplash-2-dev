'use strict';

// Setup dotenv
require('dotenv').config();

// Set up express
const express = require('express');
const app = express();

// Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);

// Import socketUtils and initialize sockets
const socketUtils = require('./server/utils/socketUtils');
socketUtils.initializeSocket(io);

// Middleware to parse JSON request bodies
app.use(express.json());

// Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

// Use authController routes
const authController = require('./server/controllers/authController');
app.use(authController);

// Handle client interface on /
app.get('/', (req, res) => {
  res.render('client');
});

// Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('display');
});

// URL of the backend API
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://127.0.0.1:7071/api/';

// Start the server
function startServer() {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

// Start server
if (module === require.main) {
  startServer();
}

module.exports = server;