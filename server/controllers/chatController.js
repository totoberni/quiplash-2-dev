// chatController.js
'use strict';

module.exports = function(io) {
  // Handle new connection
  io.on('connection', socket => { 
    console.log('New connection');

    // Handle chat message received
    socket.on('chat', message => {
      console.log('Handling chat: ' + message); 
      io.emit('chat', message);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Dropped connection');
    });
  });
};