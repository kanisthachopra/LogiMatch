const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const haversine = require("haversine");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------------------------------
// Middleware: The JWT Bouncer
// ---------------------------------
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ error: "Access denied. No badge provided." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token." });
  }
};

// ---------------------------------
// Nodemailer Transporter Setup
// ---------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// ---------------------------------
// Route: Secure User Registration
// ---------------------------------
app.post("/api/users/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000);

    const newUser = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, otp, otp_expires_at, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING id, name, email, role`,
      [name, email, hashedPassword, role, otp, otpExpiresAt],
    );

    const mailOptions = {
      from: `"LogiMatch Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify your LogiMatch Account",
      html: `
        <h2>Welcome to LogiMatch, ${name}!</h2>
        <p>Your verification code is: <b style="font-size: 24px; color: #2563eb;">${otp}</b></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    };
    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message:
        "Registration successful! Please check your email for the verification code.",
      email: newUser.rows[0].email,
    });
  } catch (error) {
    console.error("Error during registration:", error.message);
    if (error.code === "23505") {
      return res
        .status(400)
        .json({ error: "Email already exists in our system." });
    }
    res.status(500).json({ error: "Server error during registration" });
  }
});

// ---------------------------------
// Route: Verify Email OTP
// ---------------------------------
app.post("/api/users/verify-email", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userResult.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = userResult.rows[0];

    if (user.is_verified)
      return res.status(400).json({ error: "User is already verified" });
    if (user.otp !== otp)
      return res.status(400).json({ error: "Invalid verification code" });
    if (new Date() > new Date(user.otp_expires_at)) {
      return res
        .status(400)
        .json({
          error: "Verification code has expired. Please request a new one.",
        });
    }

    await pool.query(
      "UPDATE users SET is_verified = true, otp = null, otp_expires_at = null WHERE email = $1",
      [email],
    );

    res
      .status(200)
      .json({ message: "Email successfully verified! You can now log in." });
  } catch (error) {
    console.error("Error verifying email:", error.message);
    res.status(500).json({ error: "Server error during verification" });
  }
});

// ---------------------------------
// Route: User Login
// ---------------------------------
app.post("/api/users/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = userResult.rows[0];

    if (!user.is_verified) {
      return res.status(403).json({
        error: "Please verify your email address before logging in.",
        needsVerification: true,
        email: user.email,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" },
    );

    res.status(200).json({
      message: "Login successful!",
      token: token,
      user: { id: user.id, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("Error during login:", error.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

// ---------------------------------
// Route: Forgot Password
// ---------------------------------
app.post("/api/users/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userResult.rows.length === 0) {
      return res
        .status(200)
        .json({ message: "If that email exists, a reset code has been sent." });
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000);

    await pool.query(
      "UPDATE users SET otp = $1, otp_expires_at = $2 WHERE email = $3",
      [otp, otpExpiresAt, email],
    );

    const mailOptions = {
      from: `"LogiMatch Security" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Your recovery code is: <b style="font-size: 24px; color: #dc2626;">${otp}</b></p>
        <p>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
      `,
    };
    await transporter.sendMail(mailOptions);

    res
      .status(200)
      .json({ message: "If that email exists, a reset code has been sent." });
  } catch (error) {
    console.error("Error in forgot password:", error.message);
    res.status(500).json({ error: "Server error processing request" });
  }
});

// ---------------------------------
// Route: Reset Password
// ---------------------------------
app.post("/api/users/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );
    if (userResult.rows.length === 0)
      return res.status(400).json({ error: "Invalid request" });

    const user = userResult.rows[0];

    if (user.otp !== otp)
      return res.status(400).json({ error: "Invalid recovery code" });
    if (new Date() > new Date(user.otp_expires_at))
      return res.status(400).json({ error: "Recovery code has expired." });

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await pool.query(
      "UPDATE users SET password_hash = $1, otp = null, otp_expires_at = null WHERE email = $2",
      [hashedPassword, email],
    );

    res
      .status(200)
      .json({
        message: "Password has been successfully reset! You can now log in.",
      });
  } catch (error) {
    console.error("Error resetting password:", error.message);
    res.status(500).json({ error: "Server error during password reset" });
  }
});

// ---------------------------------
// Route: Post a New Job
// ---------------------------------
app.post("/api/jobs", verifyToken, async (req, res) => {
  try {
    const {
      origin,
      destination,
      weight_kg,
      seeker_ask,
      length_cm,
      length,
      width_cm,
      width,
      height_cm,
      height,
      packaging_type,
      is_fragile,
      is_hazmat,
      requires_refrigeration,
      pickup_window_start,
      pickup_window_end,
      delivery_window_start,
      delivery_window_end,
      requires_liftgate,
      requires_loading_dock,
      special_instructions,
    } = req.body;

    const seeker_id = req.user.id;

    const final_length = length_cm || length || null;
    const final_width = width_cm || width || null;
    const final_height = height_cm || height || null;

    const insertQuery = `
      INSERT INTO jobs (
        seeker_id, origin, destination, weight_kg, seeker_ask, 
        length_cm, width_cm, height_cm, packaging_type, is_fragile, is_hazmat, requires_refrigeration,
        pickup_window_start, pickup_window_end, delivery_window_start, delivery_window_end,
        requires_liftgate, requires_loading_dock, special_instructions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *;
    `;

    const newJob = await pool.query(insertQuery, [
      seeker_id,
      origin,
      destination,
      weight_kg,
      seeker_ask || null,
      final_length,
      final_width,
      final_height,
      packaging_type || "Palletized",
      is_fragile || false,
      is_hazmat || false,
      requires_refrigeration || false,
      pickup_window_start || null,
      pickup_window_end || null,
      delivery_window_start || null,
      delivery_window_end || null,
      requires_liftgate || false,
      requires_loading_dock || false,
      special_instructions || "",
    ]);

    // Mass BCC Email Alert to Drivers
    const drivers = await pool.query(
      `SELECT email FROM users WHERE role = 'driver' AND is_verified = true`,
    );
    const driverEmails = drivers.rows.map((d) => d.email).join(",");

    if (driverEmails) {
      await transporter.sendMail({
        from: `"LogiMatch Market" <${process.env.EMAIL_USER}>`,
        bcc: driverEmails,
        subject: `New Cargo Alert: ${origin} to ${destination}`,
        html: `<p>A new <b>${weight_kg}kg</b> shipment from <b>${origin}</b> to <b>${destination}</b> has just been posted.</p>`,
      });
    }

    res.status(201).json(newJob.rows[0]);
  } catch (error) {
    console.error("Job Creation Error:", error.message);
    res.status(500).json({ error: "Server error during job creation" });
  }
});

// ---------------------------------
// Route: Advanced AI Price Engine
// ---------------------------------
app.post("/api/price-estimate", async (req, res) => {
  try {
    const {
      originCity,
      destCity,
      weight,
      length_cm,
      width_cm,
      height_cm,
      packaging_type,
      is_fragile,
      is_hazmat,
      requires_refrigeration,
      requires_liftgate,
      requires_loading_dock,
    } = req.body;

    const DIESEL_PRICE = 95;
    const FUEL_EFFICIENCY = 4;
    const FUEL_COST_PER_KM = DIESEL_PRICE / FUEL_EFFICIENCY;
    const KM_PER_DAY = 300;
    const DRIVER_COST_PER_DAY = 1500;
    const TRUCK_VOLUME_CM3 = 40 * 1000000;
    const TRUCK_MAX_PAYLOAD_KG = 15000;

    const PACKAGING_SURCHARGE = {
      Palletized: 0.0,
      Boxed: 0.0,
      Crated: 0.03,
      Drums: 0.05,
      Loose: -0.03,
    };

    const getCoords = async (city) => {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${city},India&format=json`,
        { headers: { "User-Agent": "LogiMatch/1.0" } },
      );
      const data = await response.json();
      if (!data || data.length === 0)
        throw new Error(`Location not found: ${city}`);
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    };

    const originCoords = await getCoords(originCity);
    const destCoords = await getCoords(destCity);
    const distanceKm = haversine(originCoords, destCoords, { unit: "km" });

    const fuelCost = FUEL_COST_PER_KM * distanceKm;
    const daysNeeded = Math.ceil(distanceKm / KM_PER_DAY);
    const driverCost = daysNeeded * DRIVER_COST_PER_DAY;

    let cargoVolumeCm3;
    if (length_cm && width_cm && height_cm) {
      cargoVolumeCm3 = length_cm * width_cm * height_cm;
    } else {
      const estimatedM3 = weight / 250;
      cargoVolumeCm3 = estimatedM3 * 1000000;
    }

    const trucksByVolume = Math.ceil(cargoVolumeCm3 / TRUCK_VOLUME_CM3);
    const trucksByWeight = Math.ceil(weight / TRUCK_MAX_PAYLOAD_KG);
    const numTrucks = Math.max(trucksByVolume, trucksByWeight, 1);

    const baseCostPerTruck = fuelCost + driverCost;
    let totalCost = baseCostPerTruck * numTrucks;

    if (is_fragile) totalCost *= 1.1;
    if (is_hazmat) totalCost *= 1.25;
    if (requires_refrigeration) totalCost *= 1.5;
    if (requires_liftgate) totalCost += 3000 * numTrucks;
    if (requires_loading_dock) totalCost += 1500 * numTrucks;

    const packagingSurcharge = PACKAGING_SURCHARGE[packaging_type] || 0;
    totalCost *= 1 + packagingSurcharge;

    res.status(200).json({
      distance: Math.round(distanceKm),
      days: daysNeeded,
      numTrucks: numTrucks,
      price: Math.round(totalCost),
      breakdown: {
        fuelCost: Math.round(fuelCost * numTrucks),
        driverCost: Math.round(driverCost * numTrucks),
        surcharges: Math.round(totalCost - baseCostPerTruck * numTrucks),
      },
    });
  } catch (error) {
    console.error("Price estimate error:", error.message);
    res.status(500).json({ error: "Failed to calculate price estimate" });
  }
});

// ---------------------------------
// Route: Get All Open Jobs
// ---------------------------------
app.get("/api/jobs", async (req, res) => {
  try {
    // 🚀 RESTORED: Auto-Resolve 24-hour expired jobs
    try {
      await pool.query(`
        WITH expired AS (SELECT id FROM jobs WHERE status = 'open' AND created_at < NOW() - INTERVAL '1 day'),
        lowest_bids AS (SELECT DISTINCT ON (job_id) id, job_id FROM bids WHERE job_id IN (SELECT id FROM expired) ORDER BY job_id, amount ASC)
        UPDATE bids SET status = 'accepted' WHERE id IN (SELECT id FROM lowest_bids);
      `);
      await pool.query(
        `UPDATE jobs SET status = 'assigned' WHERE id IN (SELECT job_id FROM bids WHERE status = 'accepted') AND status = 'open';`,
      );
    } catch (e) {
      console.log("Auto-resolve check skipped or failed:", e.message);
    }

    const query = `
      SELECT 
        j.id, j.seeker_id, j.origin, j.destination, j.weight_kg, j.status,
        j.seeker_ask, 
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
              'provider_photo', u_provider.profile_photo,
              'rating_sum', u_provider.rating_sum,
              'rating_count', u_provider.rating_count
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
    console.error("Error fetching jobs:", error.message);
    res.status(500).json({ error: "Server error while fetching jobs" });
  }
});

// ---------------------------------
// Route: Post a New Bid
// ---------------------------------
app.post("/api/bids", verifyToken, async (req, res) => {
  try {
    const { job_id, amount } = req.body;
    const provider_id = req.user.id;

    const newBid = await pool.query(
      "INSERT INTO bids (job_id, provider_id, amount) VALUES ($1, $2, $3) RETURNING *",
      [job_id, provider_id, amount],
    );

    // 🚀 RESTORED: Alert Seeker of New Bid
    const seekerQuery = `SELECT u.email, u.name, j.origin, j.destination FROM users u JOIN jobs j ON u.id = j.seeker_id WHERE j.id = $1`;
    const seekerResult = await pool.query(seekerQuery, [job_id]);

    if (seekerResult.rows.length > 0) {
      const seeker = seekerResult.rows[0];
      await transporter.sendMail({
        from: `"LogiMatch Market" <${process.env.EMAIL_USER}>`,
        to: seeker.email,
        subject: `New Bid Received! (₹${amount})`,
        html: `
          <h2>Hello ${seeker.name},</h2>
          <p>You just received a new bid of <b>₹${amount}</b> for your cargo from ${seeker.origin} to ${seeker.destination}.</p>
          <p>Log in to your Profile to review and accept the offer.</p>
        `,
      });
    }

    res.status(201).json(newBid.rows[0]);
  } catch (error) {
    console.error("Bid Creation Error:", error.message);
    res.status(500).json({ error: "Server error during bid creation" });
  }
});

// ---------------------------------
// Route: Accept a Bid
// ---------------------------------
app.put("/api/bids/:id/accept", verifyToken, async (req, res) => {
  try {
    const bidId = req.params.id;
    await pool.query("UPDATE bids SET status = $1 WHERE id = $2", [
      "accepted",
      bidId,
    ]);
    const bidResult = await pool.query(
      "SELECT job_id FROM bids WHERE id = $1",
      [bidId],
    );
    const jobId = bidResult.rows[0].job_id;
    await pool.query("UPDATE jobs SET status = $1 WHERE id = $2", [
      "assigned",
      jobId,
    ]);

    res.status(200).json({ message: "Bid accepted and job assigned!" });
  } catch (error) {
    console.error("Error accepting bid:", error.message);
    res.status(500).json({ error: "Server error while accepting bid" });
  }
});

// ---------------------------------
// Route: Update Job Tracking & Lifecycle Milestones
// ---------------------------------
app.put("/api/jobs/:id/track", verifyToken, async (req, res) => {
  try {
    const { location, status } = req.body;
    const jobId = req.params.id;

    let milestoneQuery = "";
    let queryParams = [location, status, jobId];

    if (status === "picked_up") {
      milestoneQuery = `UPDATE jobs SET current_location = $1, status = $2, actual_pickup_time = NOW() WHERE id = $3`;
    } else if (status === "delivered") {
      milestoneQuery = `UPDATE jobs SET current_location = $1, status = $2, actual_delivery_time = NOW() WHERE id = $3`;
    } else {
      milestoneQuery = `UPDATE jobs SET current_location = $1, status = $2 WHERE id = $3`;
    }

    await pool.query(milestoneQuery, queryParams);
    res
      .status(200)
      .json({ message: "Logistics milestone updated successfully." });
  } catch (error) {
    console.error("Tracking milestone error:", error.message);
    res
      .status(500)
      .json({ error: "Server error updating tracking milestone." });
  }
});

// ---------------------------------
// Route: Get Current User Profile
// ---------------------------------
app.get("/api/users/me", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT name, email, role, profile_photo, banner_photo, bio, license_file_url, is_public, company_name, business_doc_url, rating_sum, rating_count
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching profile" });
  }
});

// ---------------------------------
// Route: Update User Profile
// ---------------------------------
app.put("/api/users/profile", verifyToken, async (req, res) => {
  try {
    const {
      bio,
      is_public,
      profile_photo,
      banner_photo,
      business_doc_url,
      company_name,
    } = req.body;
    const userId = req.user.id;

    const updateQuery = `
      UPDATE users 
      SET bio = $1, is_public = $2, profile_photo = $3, banner_photo = $4, business_doc_url = $5, company_name = $6
      WHERE id = $7
      RETURNING id, name, email, role, bio, is_public, profile_photo, banner_photo, business_doc_url, company_name;
    `;

    const updatedUser = await pool.query(updateQuery, [
      bio,
      is_public,
      profile_photo,
      banner_photo,
      business_doc_url,
      company_name,
      userId,
    ]);

    res.status(200).json({
      message: "Profile updated successfully!",
      profile: updatedUser.rows[0],
    });
  } catch (error) {
    console.error("Error updating profile:", error.message);
    res.status(500).json({ error: "Server error while updating profile." });
  }
});

// ---------------------------------
// Route: Change Password
// ---------------------------------
app.put("/api/users/password", verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id],
    );

    const isMatch = await bcrypt.compare(
      currentPassword,
      userResult.rows[0].password_hash,
    );
    if (!isMatch)
      return res.status(401).json({ error: "Incorrect current password" });

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      hashedNewPassword,
      req.user.id,
    ]);

    res.status(200).json({ message: "Password updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Server error updating password" });
  }
});

// ---------------------------------
// Route: Rate a Provider
// ---------------------------------
app.post("/api/users/:id/rate", verifyToken, async (req, res) => {
  try {
    const { score } = req.body;
    await pool.query(
      "UPDATE users SET rating_sum = rating_sum + $1, rating_count = rating_count + 1 WHERE id = $2",
      [score, req.params.id],
    );
    res.status(200).json({ message: "Rated successfully" });
  } catch (error) {
    console.error("Rating error:", error.message);
    res.status(500).json({ error: "Rating error" });
  }
});

// ---------------------------------
// Route: Jobs I Posted
// ---------------------------------
app.get("/api/profile/my-jobs", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        j.id, j.origin, j.destination, j.weight_kg, j.status,
        j.seeker_ask, j.current_location,
        j.actual_pickup_time, j.actual_delivery_time, -- 👈 RESTORED: Timestamps for Profile view
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
              'provider_id', u.id,
              'provider_name', u.name,
              'provider_email', u.email,
              'rating_sum', u.rating_sum,
              'rating_count', u.rating_count
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
    res.status(500).json({ error: "Server error fetching your jobs" });
  }
});

// ---------------------------------
// Route: Active Bids I Placed (For Drivers)
// ---------------------------------
app.get("/api/profile/active-bids", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        j.id AS job_id, j.origin, j.destination, j.weight_kg, j.status,
        b.amount AS my_bid, b.status AS bid_status,
        u.name AS seeker_name
      FROM jobs j
      JOIN bids b ON j.id = b.job_id
      JOIN users u ON j.seeker_id = u.id
      WHERE b.provider_id = $1 AND b.status = 'pending'
      ORDER BY b.id DESC; -- 👈 FIX: Changed from created_at to avoid database missing column errors
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching active bids:", error.message);
    res.status(500).json({ error: "Server error fetching active bids" });
  }
});

// ---------------------------------
// Route: Jobs I Won
// ---------------------------------
app.get("/api/profile/won-jobs", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        j.id AS job_id, j.origin, j.destination, j.weight_kg, j.seeker_ask,
        j.current_location, 
        j.actual_pickup_time, j.actual_delivery_time, -- 👈 RESTORED: Timestamps for Profile view
        j.length_cm, j.width_cm, j.height_cm, j.packaging_type,
        j.is_fragile, j.is_hazmat, j.requires_refrigeration,
        j.pickup_window_start, j.pickup_window_end,
        j.delivery_window_start, j.delivery_window_end,
        j.requires_liftgate, j.requires_loading_dock,
        j.special_instructions, j.status,
        b.amount AS winning_bid,
        u.name AS seeker_name, u.email AS seeker_email, u.id AS seeker_id
      FROM jobs j
      JOIN bids b ON j.id = b.job_id
      JOIN users u ON j.seeker_id = u.id
      WHERE b.provider_id = $1 AND b.status = 'accepted'
      ORDER BY j.id DESC;
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Server error fetching won jobs" });
  }
});

// Test Route
app.get("/api/status", (req, res) => {
  res.json({ message: "LogiMatch backend server is running smoothly!" });
});

app.listen(PORT, () => {
  console.log(`Server is operating on port ${PORT}`);
});
