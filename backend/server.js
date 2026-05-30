const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db'); // Our database bridge
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // Allows server to read incoming JSON

// ---------------------------------
// Route: Register a New User
// ---------------------------------
app.post('/api/users/register', async (req, res) => {
  try {
    // 1. Extract the data the user sent in the request
    const { name, email, password, is_provider } = req.body;

    // 2. Scramble the password (10 rounds of hashing)
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // 3. Send the instruction across the bridge to PostgreSQL
    // We use $1, $2 to prevent SQL Injection attacks
    const newUser = await pool.query(
      'INSERT INTO users (name, email, password_hash, is_provider) VALUES ($1, $2, $3, $4) RETURNING id, name, email, is_provider',
      [name, email, password_hash, is_provider]
    );

    // 4. Send the new user data back to the frontend as a success receipt
    res.status(201).json(newUser.rows[0]);
    
  } catch (error) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ---------------------------------
// Route: Post a New Job Request
// ---------------------------------
app.post('/api/jobs', async (req, res) => {
  try {
    // 1. Extract the cargo details from the request
    const { seeker_id, origin, destination, weight_kg } = req.body;

    // 2. Send the instruction to PostgreSQL
    const newJob = await pool.query(
      'INSERT INTO jobs (seeker_id, origin, destination, weight_kg) VALUES ($1, $2, $3, $4) RETURNING *',
      [seeker_id, origin, destination, weight_kg]
    );

    // 3. Send the saved job receipt back to the frontend
    res.status(201).json(newJob.rows[0]);
    
  } catch (error) {
    console.error('Job Creation Error:', error.message);
    res.status(500).json({ error: 'Server error during job creation' });
  }
});

// ---------------------------------
// Route: Post a New Bid
// ---------------------------------
app.post('/api/bids', async (req, res) => {
  try {
    // 1. Extract the bid details
    const { job_id, provider_id, amount } = req.body;

    // 2. Send the instruction to PostgreSQL
    const newBid = await pool.query(
      'INSERT INTO bids (job_id, provider_id, amount) VALUES ($1, $2, $3) RETURNING *',
      [job_id, provider_id, amount]
    );

    // 3. Send the saved bid receipt back
    res.status(201).json(newBid.rows[0]);
    
  } catch (error) {
    console.error('Bid Creation Error:', error.message);
    res.status(500).json({ error: 'Server error during bid creation' });
  }
});

// Test Route
app.get('/api/status', (req, res) => {
  res.json({ message: 'LogiMatch backend server is running smoothly!' });
});

app.listen(PORT, () => {
  console.log(`Server is operating on port ${PORT}`);
});