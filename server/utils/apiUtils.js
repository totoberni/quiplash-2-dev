// server/utils/apiUtils.js

'use strict';

const axios = require('axios');

// Use the Azure endpoint
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://127.0.0.1:7071/a pi/';

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
      return {msg : error.response?.data?.msg || 'Unknown error occurred'}; // Handling errors __gracefully__
    }
  },

  // Login
  async loginPlayer(username, password) {
    console.log('API Player Login called with:', { username, password });
    try {
      const response = await axios.post(`${BACKEND_ENDPOINT}player/login`, {
        username,
        password,
      });
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have { result: Boolean, msg: String }
    } catch (error) {
      console.error('API loginPlayer Error:', error.message);
      return {msg : error.response?.data?.msg || 'Unknown error occurred'};
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
      return {msg : error.response?.data?.msg || 'Unknown error occurred'};
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
      return {msg : error.response?.data?.msg || 'Unknown error occurred'};
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
      return {msg : error.response?.data?.msg || 'Unknown error occurred'};
    }
  },

  // Edit Player TODO: streamline the code.
  async editPlayer(username, add_to_games_played, add_to_score) {
    console.log('API: editPlayer called with:', { username, add_to_games_played, add_to_score });
    try {
      const response = await axios.put(`${BACKEND_ENDPOINT}player/update`, {
        username,
        add_to_games_played,
        add_to_score
      });

      console.log('Backend API response:', response.data);

      // Check for response status code 200
      if (response.status !== 200) {
        console.error(`API editPlayer Error: Received status code ${response.status}`);
        throw new Error(`API editPlayer Error: Received status code ${response.status}`);
      }
      // Check if response indicates success
      if (!response.data.result) {
        console.error(`API editPlayer Error: ${response.data.msg}`);
        throw new Error(`API editPlayer Error: ${response.data.msg}`);
      }
      // Success
      return response.data;
    } catch (error) {
      if (error.response) {
        // The request was made, and the server responded with a status code outside of 2xx
        console.error(`API editPlayer Error: ${error.response.status} - ${error.response.data.msg || error.response.statusText}`);
        throw new Error(`API editPlayer Error: ${error.response.status} - ${error.response.data.msg || error.response.statusText}`);
      } else if (error.request) {
        // The request was made, but no response was received
        console.error('API editPlayer Error: No response received from server');
        throw new Error('API editPlayer Error: No response received from server');
      } else {
        // Something else happened
        console.error(`API editPlayer Error: ${error.message}`);
        return {msg : error.response?.data?.msg || 'Unknown error occurred'};
      }
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
      return {msg : error.response?.data?.msg || 'Unknown error occurred'};
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
      return {msg : error.response?.data?.msg || 'Unknown error occurred'};
    }
  },

  async getPrompts(players, language) {
    console.log('API: getPrompts called');
    try {
      const response = await axios.post(
        `${BACKEND_ENDPOINT}utils/get`,
        {
          players: players,
          language: language,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      console.log('Backend API response:', response.data);
      return response.data; // Expected to have an array of prompts
    } catch (error) {
      console.error('API getPrompts Error:', error.message);
      return { msg: error.response?.data?.msg || 'Unknown error occurred' };
    }
  },
};
