// utils/playerManager.js

'use strict';

const Player = require('../models/playerModel');

class PlayerManager {
  constructor() {
    this.players = {};   // Active players
    this.audience = {};  // Audience members
  }

  // Add a new player
  addPlayer(username, socketId) {
    if (this.players[username] || this.audience[username]) {
      return false; // Username already taken
    }

    if (Object.keys(this.players).length === 8) {
        this.addAudience(username, socketId);
        return false; // Room is full
    }
    // First player is admin
    const isAdmin = Object.keys(this.players).length === 0;
    const player = new Player(socketId, username, isAdmin);
    this.players[username] = player;
    return true;
  }

  // Add a new audience member
  addAudience(username, socketId) {
    if (this.players[username] || this.audience[username]) {
      return false; // Username already taken
    }

    const audienceMember = {
      socketId,
      username,
      state: 'active',
    };
    this.audience[username] = audienceMember;
    return true;
  }

  // Remove a user by socket ID
  removeUserBySocketId(socketId) {
    const playerEntry = Object.values(this.players).find(
      (p) => p.socketId === socketId
    );

    if (playerEntry) {
      const username = playerEntry.username;
      delete this.players[username];
      this.reassignAdmin();
      return username;
    }

    const audienceEntry = Object.values(this.audience).find(
      (a) => a.socketId === socketId
    );
    if (audienceEntry) {
      const username = audienceEntry.username;
      delete this.audience[username];
      return username;
    }

    return null;
  }

  // Reassign admin if current admin disconnects
  reassignAdmin() {
    const remainingPlayers = Object.values(this.players);
    if (remainingPlayers.length > 0) {
      remainingPlayers[0].isAdmin = true;
    }
  }

  // Get player by username
  getPlayer(username) {
    return this.players[username] || null;
  }

  // Get player by socket ID
  getPlayerBySocketId(socketId) {
    return Object.values(this.players).find(
      (p) => p.socketId === socketId
    ) || null;
  }

  // Check if user is in the game
  isUserInGame(username) {
    return (
      this.players.hasOwnProperty(username) ||
      this.audience.hasOwnProperty(username)
    );
  }

  // Get username by socket ID
  getUsernameBySocketId(socketId) {
    const player = this.getPlayerBySocketId(socketId);
    if (player) return player.username;

    const audienceMember = Object.values(this.audience).find(
      (a) => a.socketId === socketId
    );
    return audienceMember ? audienceMember.username : null;
  }

  // Get total number of players
  getTotalPlayers() {
    return Object.keys(this.players).length;
  }

  // Check if a user is admin
  isAdmin(username) {
    const player = this.getPlayer(username);
    return player ? player.isAdmin : false;
  }

  // Update player's state
  updatePlayerState(username, state) {
    const player = this.getPlayer(username);
    if (player) {
      player.state = state;
    }
  }
}

module.exports = new PlayerManager();