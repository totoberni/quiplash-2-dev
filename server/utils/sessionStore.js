// server/utils/sessionStore.js

// In-memory session store
const sessionStore = {};

// Simple function to generate a random session ID
function generateSessionId() {
  return Math.random().toString(36).substr(2, 16);
}

module.exports = { sessionStore, generateSessionId };
