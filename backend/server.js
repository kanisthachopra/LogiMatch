const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db'); 
const haversine = require('haversine'); // For distance calculation
const nodemailer = require('nodemailer'); // The Mail Carrier
const crypto = require('crypto');         // For generating secure OTPs
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
// Nodemailer Transporter Setup
// ---------------------------------
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Helper to generate a 6-digit OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// ---------------------------------
// Route: Secure User Registration (UPDATED: Sends OTP)
// ---------------------------------
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate OTP and set expiration (15 minutes from now)
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000); 

    const newUser = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, otp, otp_expires_at, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, role, otp, otpExpiresAt]
    );

    // Send the Verification Email
    const mailOptions = {
      from: `"LogiMatch Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Verify your LogiMatch Account',
      html: `
        <h2>Welcome to LogiMatch, ${name}!</h2>
        <p>Your verification code is: <b style="font-size: 24px; color: #2563eb;">${otp}</b></p>
        <p>This code will expire in 15 minutes.</p>
      `
    };
    await transporter.sendMail(mailOptions);

    res.status(201).json({ 
      message: 'Registration successful! Please check your email for the verification code.', 
      email: newUser.rows[0].email 
    });
  } catch (error) {
    console.error('Error during registration:', error.message);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already exists in our system.' });
    }
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// ---------------------------------
// Route: Verify Email OTP 
// ---------------------------------
app.post('/api/users/verify-email', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = userResult.rows[0];

    if (user.is_verified) return res.status(400).json({ error: 'User is already verified' });
    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid verification code' });
    if (new Date() > new Date(user.otp_expires_at)) return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });

    // Mark as verified and clear the OTP
    await pool.query('UPDATE users SET is_verified = true, otp = null, otp_expires_at = null WHERE email = $1', [email]);

    res.status(200).json({ message: 'Email successfully verified! You can now log in.' });
  } catch (error) {
    console.error('Error verifying email:', error.message);
    res.status(500).json({ error: 'Server error during verification' });
  }
});

// ---------------------------------
// Route: User Login (UPDATED: Blocks unverified users)
// ---------------------------------
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = userResult.rows[0];

    // BLOCK UNVERIFIED USERS
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before logging in.',
        needsVerification: true,
        email: user.email
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' } 
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
// Route: Forgot Password - Request OTP 
// ---------------------------------
app.post('/api/users/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(200).json({ message: 'If that email exists, a reset code has been sent.' });
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000); 

    await pool.query('UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3', [otp, otpExpiresAt, email]);

    const mailOptions = {
      from: `"LogiMatch Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Your recovery code is: <b style="font-size: 24px; color: #dc2626;">${otp}</b></p>
        <p>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
      `
    };
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'If that email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Error in forgot password:', error.message);
    res.status(500).json({ error: 'Server error processing request' });
  }
});

// ---------------------------------
// Route: Reset Password - Use OTP 
// ---------------------------------
app.post('/api/users/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: 'Invalid request' });

    const user = userResult.rows[0];

    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid recovery code' });
    if (new Date() > new Date(user.otp_expires_at)) return res.status(400).json({ error: 'Recovery code has expired.' });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear OTP
    await pool.query('UPDATE users SET password_hash = $1, otp = null, otp_expires_at = null WHERE email = $2', [hashedPassword, email]);

    res.status(200).json({ message: 'Password has been successfully reset! You can now log in.' });
  } catch (error) {
    console.error('Error resetting password:', error.message);
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

// ---------------------------------
// Route: Post a New Job Request (UPDATED: Bulletproof Form Variables)
// ---------------------------------
app.post('/api/jobs', verifyToken, async (req, res) => {
  try {
    const { 
      origin, destination, weight_kg,
      length_cm, length, width_cm, width, height_cm, height,
      packaging_type, is_fragile, is_hazmat, requires_refrigeration,
      pickup_window_start, pickup_window_end,
      delivery_window_start, delivery_window_end,
      requires_liftgate, requires_loading_dock,
      special_instructions
    } = req.body;
    
    const seeker_id = req.user.id; 

    // Safely extract dimensions regardless of frontend payload naming
    const final_length = length_cm || length || null;
    const final_width = width_cm || width || null;
    const final_height = height_cm || height || null;

    const insertQuery = `
      INSERT INTO jobs (
        seeker_id, origin, destination, weight_kg,
        length_cm, width_cm, height_cm,
        packaging_type, is_fragile, is_hazmat, requires_refrigeration,
        pickup_window_start, pickup_window_end,
        delivery_window_start, delivery_window_end,
        requires_liftgate, requires_loading_dock,
        special_instructions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *;
    `;

    const newJob = await pool.query(insertQuery, [
      seeker_id, origin, destination, weight_kg,
      final_length, final_width, final_height,
      packaging_type || 'Palletized', is_fragile || false, is_hazmat || false, requires_refrigeration || false,
      pickup_window_start || null, pickup_window_end || null,
      delivery_window_start || null, delivery_window_end || null,
      requires_liftgate || false, requires_loading_dock || false,
      special_instructions || ''
    ]);

    res.status(201).json(newJob.rows[0]);
  } catch (error) {
    console.error('Job Creation Error:', error.message);
    res.status(500).json({ error: 'Server error during job creation' });
  }
});

// ---------------------------------
// Route: Get All Open Jobs
// ---------------------------------
app.get('/api/jobs', async (req, res) => {
  try {
    const query = `
      SELECT 
        j.id, j.seeker_id, j.origin, j.destination, j.weight_kg, j.status,
        j.length_cm, j.width_cm, j.height_cm, j.packaging_type,
        j.is_fragile, j.is_hazmat, j.requires_refrigeration,
        j.pickup_window_start, j.pickup_window_end,
        j.delivery_window_start, j.delivery_window_end,
        j.requires_liftgate, j.requires_loading_dock,
        j.special_instructions,
        u_seeker.name AS seeker_name,
        u_seeker.profile_photo AS seeker_photo,
        u_seeker.bio AS seeker_bio,
        COALESCE(
          json_agg(
            json_build_object(
              'bid_id', b.id,
              'provider_id', b.provider_id,
              'amount', b.amount,
              'provider_name', u_provider.name,
              'provider_photo', u_provider.profile_photo
            ) ORDER BY b.amount ASC
          ) FILTER (WHERE b.id IS NOT NULL), '[]'
        ) AS bids
      FROM jobs j
      JOIN users u_seeker ON j.seeker_id = u_seeker.id
      LEFT JOIN bids b ON j.id = b.job_id
      LEFT JOIN users u_provider ON b.provider_id = u_provider.id
      WHERE j.status = 'open'
      GROUP BY j.id, u_seeker.name, u_seeker.profile_photo, u_seeker.bio
      ORDER BY j.id DESC;
    `;
    const allJobs = await pool.query(query);
    res.status(200).json(allJobs.rows);
  } catch (error) {
    console.error('Error fetching jobs:', error.message);
    res.status(500).json({ error: 'Server error while fetching jobs' });
  }
});

// ---------------------------------
// Route: Get Bids for a Specific Seeker 
// ---------------------------------
app.get('/api/seeker/bids', verifyToken, async (req, res) => {
  try {
    const seekerId = req.user.id; 
    
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
// Route: Post a New Bid
// ---------------------------------
app.post('/api/bids', verifyToken, async (req, res) => {
  try {
    const { job_id, amount } = req.body;
    const provider_id = req.user.id; 

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
// Route: Accept a Bid
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

// ---------------------------------
// Route: Get Current User Profile 
// ---------------------------------
app.get('/api/users/me', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT name, email, role, profile_photo, banner_photo, bio, license_file_url, is_public 
      FROM users 
      WHERE id = $1
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching profile' });
  }
});

// ---------------------------------
// Route: Update User Profile 
// ---------------------------------
app.put('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const { bio, is_public, profile_photo, banner_photo, license_file_url } = req.body;
    const userId = req.user.id; 

    const updateQuery = `
      UPDATE users 
      SET 
        bio = $1, 
        is_public = $2, 
        profile_photo = $3, 
        banner_photo = $4, 
        license_file_url = $5
      WHERE id = $6
      RETURNING id, name, email, role, bio, is_public, profile_photo, banner_photo, license_file_url;
    `;

    const updatedUser = await pool.query(updateQuery, [
      bio, 
      is_public, 
      profile_photo, 
      banner_photo, 
      license_file_url, 
      userId
    ]);

    res.status(200).json({
      message: "Profile updated successfully!",
      profile: updatedUser.rows[0]
    });

  } catch (error) {
    console.error("Error updating profile:", error.message);
    res.status(500).json({ error: "Server error while updating profile." });
  }
});

// ---------------------------------
// Route: Change Password (Internal)
// ---------------------------------
app.put('/api/users/password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const user = userResult.rows[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedNewPassword, req.user.id]);

    res.status(200).json({ message: 'Password updated successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error updating password' });
  }
});

// ---------------------------------
// Route: Jobs I Posted
// ---------------------------------
app.get('/api/profile/my-jobs', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        j.id, j.origin, j.destination, j.weight_kg, j.status,
        j.length_cm, j.width_cm, j.height_cm, j.packaging_type,
        j.is_fragile, j.is_hazmat, j.requires_refrigeration,
        j.pickup_window_start, j.pickup_window_end,
        j.delivery_window_start, j.delivery_window_end,
        j.requires_liftgate, j.requires_loading_dock,
        j.special_instructions,
        COALESCE(
          json_agg(
            json_build_object(
              'bid_id', b.id,
              'amount', b.amount,
              'status', b.status,
              'provider_name', u.name,
              'provider_email', u.email
            )
          ) FILTER (WHERE b.id IS NOT NULL), '[]'
        ) AS bids
      FROM jobs j
      LEFT JOIN bids b ON j.id = b.job_id
      LEFT JOIN users u ON b.provider_id = u.id
      WHERE j.seeker_id = $1
      GROUP BY j.id
      ORDER BY j.id DESC;
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching your jobs' });
  }
});

// ---------------------------------
// Route: Jobs I Won
// ---------------------------------
app.get('/api/profile/won-jobs', verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        j.id AS job_id, j.origin, j.destination, j.weight_kg,
        j.length_cm, j.width_cm, j.height_cm, j.packaging_type,
        j.is_fragile, j.is_hazmat, j.requires_refrigeration,
        j.pickup_window_start, j.pickup_window_end,
        j.delivery_window_start, j.delivery_window_end,
        j.requires_liftgate, j.requires_loading_dock,
        j.special_instructions,
        b.amount AS winning_bid,
        u.name AS seeker_name, u.email AS seeker_email
      FROM jobs j
      JOIN bids b ON j.id = b.job_id
      JOIN users u ON j.seeker_id = u.id
      WHERE b.provider_id = $1 AND b.status = 'accepted'
      ORDER BY j.id DESC;
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error fetching won jobs' });
  }
});

// ---------------------------------
// Route: Price Recommendation Engine 
// ---------------------------------
app.post('/api/price-estimate', async (req, res) => {
  try {
    const { originCity, destCity, weight } = req.body;

    const getCoords = async (city) => {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?q=${city}&format=json`, {
        method: "GET",
        headers: { "User-Agent": "LogiMatch/1.0" }
      });
      const data = await response.json();
      
      if (!data || data.length === 0) {
        throw new Error(`Location not found: ${city}`);
      }
      
      return { 
        latitude: parseFloat(data[0].lat), 
        longitude: parseFloat(data[0].lon) 
      };
    };

    const originCoords = await getCoords(originCity);
    const destCoords = await getCoords(destCity);
    const distanceInKm = haversine(originCoords, destCoords, { unit: 'km' });
    const baseRate = 2; // ₹2 per kg per km
    const recommendedPrice = Math.round(baseRate * distanceInKm * weight);

    res.status(200).json({ 
      distance: Math.round(distanceInKm),
      price: recommendedPrice 
    });

  } catch (error) {
    console.error('Error calculating price:', error.message);
    res.status(500).json({ error: 'Failed to calculate price estimate' });
  }
});

// Test Route
app.get('/api/status', (req, res) => {
  res.json({ message: 'LogiMatch backend server is running smoothly!' });
});

app.listen(PORT, () => {
  console.log(`Server is operating on port ${PORT}`);
});