const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db'); 
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); 

// ---------------------------------
// Middleware: The JWT Bouncer
// ---------------------------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No badge provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Attach decoded user (id, role) to the request
    next(); 
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// ---------------------------------
// Route: Secure User Registration
// ---------------------------------
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashedPassword, role]
    );

    res.status(201).json({ 
      message: 'User securely registered!', 
      user: newUser.rows[0] 
    });
  } catch (error) {
    console.error('Error during registration:', error.message);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ---------------------------------
// Route: User Login
// ---------------------------------
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '1h' } 
    );

    res.status(200).json({ 
      message: 'Login successful!',
      token: token, 
      user: { id: user.id, name: user.name, role: user.role } 
    });
  } catch (error) {
    console.error('Error during login:', error.message);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ---------------------------------
// Route: Post a New Job Request (SECURED)
// ---------------------------------
app.post('/api/jobs', verifyToken, async (req, res) => {
  try {
    const { origin, destination, weight_kg } = req.body;
    const seeker_id = req.user.id; // Pulled securely from the token

    const newJob = await pool.query(
      'INSERT INTO jobs (seeker_id, origin, destination, weight_kg) VALUES ($1, $2, $3, $4) RETURNING *',
      [seeker_id, origin, destination, weight_kg]
    );

    res.status(201).json(newJob.rows[0]);
  } catch (error) {
    console.error('Job Creation Error:', error.message);
    res.status(500).json({ error: 'Server error during job creation' });
  }
});

// ---------------------------------
// Route: Get All Open Jobs (PUBLIC)
// ---------------------------------
app.get('/api/jobs', async (req, res) => {
  try {
    const allJobs = await pool.query("SELECT * FROM jobs WHERE status = 'open' ORDER BY id DESC");
    res.status(200).json(allJobs.rows);
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    res.status(500).json({ error: 'Server error while fetching jobs' });
  }
});

// ---------------------------------
// Route: Get Bids for a Specific Seeker (SECURED)
// ---------------------------------
app.get('/api/seeker/bids', verifyToken, async (req, res) => {
  try {
    const seekerId = req.user.id; // Pulled securely from the token
    
    const query = `
      SELECT jobs.origin, jobs.destination, jobs.weight_kg, bids.amount, bids.status, bids.id AS bid_id
      FROM jobs 
      JOIN bids ON jobs.id = bids.job_id 
      WHERE jobs.seeker_id = $1
    `;
    
    const myBids = await pool.query(query, [seekerId]); 
    res.status(200).json(myBids.rows);
  } catch (error) {
    console.error('Error fetching seeker bids:', error.message);
    res.status(500).json({ error: 'Server error while fetching bids' });
  }
});

// ---------------------------------
// Route: Post a New Bid (SECURED)
// ---------------------------------
app.post('/api/bids', verifyToken, async (req, res) => {
  try {
    const { job_id, amount } = req.body;
    const provider_id = req.user.id; // Pulled securely from the token

    const newBid = await pool.query(
      'INSERT INTO bids (job_id, provider_id, amount) VALUES ($1, $2, $3) RETURNING *',
      [job_id, provider_id, amount]
    );

    res.status(201).json(newBid.rows[0]);
  } catch (error) {
    console.error('Bid Creation Error:', error.message);
    res.status(500).json({ error: 'Server error during bid creation' });
  }
});

// ---------------------------------
// Route: Accept a Bid (SECURED)
// ---------------------------------
app.put('/api/bids/:id/accept', verifyToken, async (req, res) => {
  try {
    const bidId = req.params.id;

    await pool.query('UPDATE bids SET status = $1 WHERE id = $2', ['accepted', bidId]);

    const bidResult = await pool.query('SELECT job_id FROM bids WHERE id = $1', [bidId]);
    const jobId = bidResult.rows[0].job_id;

    await pool.query('UPDATE jobs SET status = $1 WHERE id = $2', ['assigned', jobId]);

    res.status(200).json({ message: 'Bid accepted and job assigned!' });
  } catch (error) {
    console.error('Error accepting bid:', error.message);
    res.status(500).json({ error: 'Server error while accepting bid' });
  }
});

// Test Route
app.get('/api/status', (req, res) => {
  res.json({ message: 'LogiMatch backend server is running smoothly!' });
});

app.listen(PORT, () => {
  console.log(`Server is operating on port ${PORT}`);
});