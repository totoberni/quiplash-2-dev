'use strict';

const express = require('express');
const router = express.Router();

// Import apiUtils
const apiUtils = require('../utils/apiUtils');

// Registration Route
router.post('/player/register', async (req, res) => {
  console.log('Handling registration');
  console.log('Request body:', req.body);

  const { username, password } = req.body;

  // Validate username and password length
  if (username.length < 4 || username.length > 15) {
    return res.json({ result: false, msg: 'Username less than 5 characters or more than 15 characters' });
  }
  if (password.length < 8 || password.length > 15) {
    return res.json({ result: false, msg: 'Password less than 8 characters or more than 15 characters' });
  }

  try {
    // Use apiUtils to register the player
    const responseData = await apiUtils.registerPlayer(username, password);
    console.log('API response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(500).json({ result: false, msg: 'Internal server error' });
  }
});

// Login Route
router.post('/player/login', async (req, res) => {
  console.log('Handling login');
  console.log('Request body:', req.body);

  const { username, password } = req.body;

  try {
    // Use apiUtils to log in the player
    const responseData = await apiUtils.loginPlayer(username, password);
    console.log('API response:', responseData);
    res.json(responseData);
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).json({ result: false, msg: 'Internal server error' });
  }
});

module.exports = router;
