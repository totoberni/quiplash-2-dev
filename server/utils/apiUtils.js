// server/utils/apiUtils.js

'use strict';

const axios = require('axios');

// Use the Azure endpoint
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://127.0.0.1:7071/api/';

// Optional: Log the BACKEND_ENDPOINT for debugging
console.log('Backend Endpoint:', BACKEND_ENDPOINT);

module.exports = {
  // Registration
  async registerPlayer(username, password) {
    console.log('API: registerPlayer called with:', { username, password });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}player/register`, {
        username,
        password,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have { result: Boolean, msg: String }
    } catch (error) {
      console.error('API registerPlayer Error:', error.message);
      throw error;
    }
  },

  // Login
  async loginPlayer(username, password) {
    console.log('API: loginPlayer called with:', { username, password });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}player/login`, {
        username,
        password,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have { result: Boolean, msg: String }
    } catch (error) {
      console.error('API loginPlayer Error:', error.message);
      throw error;
    }
  },

  // Create Prompt
  async createPrompt(username, text) {
    console.log('API: createPrompt called with:', { username, text });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}prompt/create`, {
        username,
        text,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected response with prompt details
    } catch (error) {
      console.error('API createPrompt Error:', error.message);
      throw error;
    }
  },

  // Get Podium
  async getPodium() {
    console.log('API: getPodium called');
    try {
      const response = await axios.get(`${BACKEND_ENDPOINT}utils/podium`);
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have podium data
    } catch (error) {
      console.error('API getPodium Error:', error.message);
      throw error;
    }
  },

  // Delete Player
  async deletePlayer(username) {
    console.log('API: deletePlayer called with:', { username });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}player/delete`, {
        username,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected response indicating deletion status
    } catch (error) {
      console.error('API deletePlayer Error:', error.message);
      throw error;
    }
  },

  // Edit Player
  async editPlayer(username, add_to_games_played, add_to_score) {
    console.log('API: editPlayer called with:', { username, data });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}player/update`, {
        username,
        add_to_games_played,
        add_to_score
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected response indicating update status
    } catch (error) {
      console.error('API editPlayer Error:', error.message);
      throw error;
    }
  },

  // Delete Prompt
  async deletePrompt(username) {
    console.log('API: deletePrompt called with:', { username });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}prompt/delete`, {
        player: username,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected response indicating deletion status
    } catch (error) {
      console.error('API deletePrompt Error:', error.message);
      throw error;
    }
  },

  // Suggest Prompt
  async suggestPrompt(keyword) {
    console.log('API: suggestPrompt called with:', { keyword });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}prompt/suggest`, {
        keyword,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have a suggestion
    } catch (error) {
      console.error('API suggestPrompt Error:', error.message);
      throw error;
    }
  },

  // Get Prompts
  async getPrompts(players, language) {
    console.log('API: getPrompts called');
    try {
      const response = await axios.get(`${BACKEND_ENDPOINT}utils/get`, {
        params: {
          players: players,
          language : language
        },
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have an array of prompts
    } catch (error) {
      console.error('API getPrompts Error:', error.message);
      throw error;
    }
  },
};
