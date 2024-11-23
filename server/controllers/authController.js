// authController.js
'use strict';

const express = require('express');
const router = express.Router();
const axios = require('axios');

// Use the Azure endpoint
const BACKEND_ENDPOINT = process.env.BACKEND || 'http://localhost:8181';

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
        // Make a POST request to the backend API and wait for the response
        const response = await axios.post(`${BACKEND_ENDPOINT}/player/register`, { username, password });
        console.log('Backend API response:', response.data);
        res.json(response.data);
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
        // Make a POST request to the backend API and wait for the response
        const response = await axios.post(`${BACKEND_ENDPOINT}/player/login`, { username, password });
        console.log('Backend API response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Error during login:', error.message);
        res.status(500).json({ result: false, msg: 'Internal server error' });
    }
});

module.exports = router;