// app.js
'use strict';

// Set up express
const express = require('express');
const app = express();

// Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);

// Import controllers
const chatController = require('./server/controllers/chatController');
chatController(io);

const authController = require('./server/controllers/authController');
const { default: axios } = require('axios');

// Middleware to parse JSON request bodies
app.use(express.json());

// Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

// Use authController routes
app.use('/', authController);

// Handle client interface on /
app.get('/', (req, res) => {
  res.render('client');
});

// Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('display');
});

// URL of the backend API
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://localhost:8181';
// Start the server
function startServer() {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

// test if the server is running
// const PORT = process.env.PORT || 8181;
// app.listen(PORT, '127.0.0.1', () => {
//     console.log(`Backend server listening on http://127.0.0.1:${PORT}`);
// });

// Start server
if (module === require.main) {
  startServer();
}

// Test registration
// Example route
// app.post('/player/register', (req, res) => {
//   const { username, password } = req.body;
//   // Implement your registration logic here
//   if (username === 'testuser' && password === 'testpass') {
//     res.json({ result: true, msg: 'Registration successful!' });
//   } else {
//     res.status(401).json({ result: false, msg: 'Invalid credentials.' });
//   }
// });

module.exports = server;