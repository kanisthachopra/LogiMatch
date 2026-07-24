const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const haversine = require("haversine");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());

const priceConfig = {
  dieselPricePerLitre: Number(process.env.PRICE_DIESEL_PER_LITRE || 95),
  fuelEfficiencyKmPerLitre: Number(process.env.PRICE_FUEL_EFFICIENCY || 4),
  kmPerDay: Number(process.env.PRICE_KM_PER_DAY || 300),
  driverCostPerDay: Number(process.env.PRICE_DRIVER_COST_PER_DAY || 1500),
  truckVolumeCm3: Number(process.env.PRICE_TRUCK_VOLUME_CM3 || 40 * 1000000),
  truckMaxPayloadKg: Number(process.env.PRICE_TRUCK_MAX_PAYLOAD_KG || 15000),
  densityKgPerM3: Number(process.env.PRICE_DENSITY_KG_PER_M3 || 250),
  lowRangeMultiplier: Number(process.env.PRICE_LOW_RANGE_MULTIPLIER || 0.9),
  highRangeMultiplier: Number(process.env.PRICE_HIGH_RANGE_MULTIPLIER || 1.15),
};

const packagingSurcharge = {
  Palletized: 0,
  Boxed: 0,
  Crated: 0.03,
  Drums: 0.05,
  Loose: -0.03,
};

const coordinateCache = new Map();

const roundMoney = (value) => Math.round(Number(value || 0));

const formatDateForManifest = (value) => {
  if (!value) return "TBD";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
};

const addManifestRow = (doc, label, value) => {
  doc.font("Helvetica-Bold").text(label, { continued: true });
  doc.font("Helvetica").text(` ${value || "Not specified"}`);
};

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

const emailFrom =
  process.env.EMAIL_FROM || "LogiMatch <onboarding@resend.dev>";

const sendEmail = async ({ to, bcc, subject, html }) => {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const payload = {
    from: emailFrom,
    subject,
    html,
  };

  if (to) payload.to = Array.isArray(to) ? to : [to];
  if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend email failed (${response.status}): ${errorText}`);
  }

  return response.json();
};

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// ---------------------------------
// Route: Secure User Registration
// ---------------------------------
app.post("/api/users/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ error: "Name, email, password, and role are required." });
    }

    if (!["seeker", "driver"].includes(role)) {
      return res.status(400).json({ error: "Invalid user role." });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 15 * 60000);

    const existingUser = await pool.query(
      "SELECT id, is_verified FROM users WHERE email = $1",
      [email],
    );

    let userEmail = email;
    if (existingUser.rows.length > 0) {
      if (existingUser.rows[0].is_verified) {
        return res
          .status(400)
          .json({ error: "Email already exists in our system." });
      }

      const updatedUser = await pool.query(
        `UPDATE users
         SET name = $1, password_hash = $2, role = $3, otp = $4, otp_expires_at = $5
         WHERE email = $6
         RETURNING email`,
        [name, hashedPassword, role, otp, otpExpiresAt, email],
      );
      userEmail = updatedUser.rows[0].email;
    } else {
      const newUser = await pool.query(
        `INSERT INTO users (name, email, password_hash, role, otp, otp_expires_at, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, false)
         RETURNING email`,
        [name, email, hashedPassword, role, otp, otpExpiresAt],
      );
      userEmail = newUser.rows[0].email;
    }

    const mailOptions = {
      to: email,
      subject: "Verify your LogiMatch Account",
      html: `
        <h2>Welcome to LogiMatch, ${name}!</h2>
        <p>Your verification code is: <b style="font-size: 24px; color: #2563eb;">${otp}</b></p>
        <p>This code will expire in 15 minutes.</p>
      `,
    };
    try {
      await sendEmail(mailOptions);
    } catch (mailError) {
      console.error("Error sending verification email:", mailError.message);
      return res.status(502).json({
        error:
          "Account saved, but verification email could not be sent. Please try again in a minute.",
      });
    }

    res.status(201).json({
      message:
        "Registration successful! Please check your email for the verification code.",
      email: userEmail,
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
      to: email,
      subject: "Password Reset Request",
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Your recovery code is: <b style="font-size: 24px; color: #dc2626;">${otp}</b></p>
        <p>This code will expire in 15 minutes. If you did not request this, please ignore this email.</p>
      `,
    };
    await sendEmail(mailOptions);

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
    if (req.user.role !== "seeker") {
      return res.status(403).json({ error: "Only seekers can post jobs." });
    }
    if (!origin || !destination || Number(weight_kg) <= 0) {
      return res.status(400).json({
        error: "Origin, destination, and a positive cargo weight are required.",
      });
    }

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
    const driverEmails = drivers.rows.map((d) => d.email);

    if (driverEmails.length > 0 && process.env.RESEND_API_KEY) {
      try {
        await Promise.all(
          driverEmails.map((driverEmail) =>
            sendEmail({
              to: driverEmail,
              subject: `New Cargo Alert: ${origin} to ${destination}`,
              html: `<p>A new <b>${weight_kg}kg</b> shipment from <b>${origin}</b> to <b>${destination}</b> has just been posted.</p>`,
            }),
          ),
        );
      } catch (emailError) {
        console.error("Driver alert email failed:", emailError.message);
      }
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

    const numericWeight = Number(weight);
    const dimensions = [length_cm, width_cm, height_cm].map((value) =>
      value === "" || value === undefined || value === null ? null : Number(value),
    );

    if (!originCity || !destCity) {
      return res
        .status(400)
        .json({ error: "Origin and destination cities are required." });
    }

    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      return res
        .status(400)
        .json({ error: "Cargo weight must be a positive number." });
    }

    if (
      dimensions.some((value) => value !== null && (!Number.isFinite(value) || value <= 0))
    ) {
      return res
        .status(400)
        .json({ error: "Cargo dimensions must be positive numbers." });
    }

    if (!packagingSurcharge.hasOwnProperty(packaging_type || "Palletized")) {
      return res.status(400).json({ error: "Unsupported packaging type." });
    }

    const getCoords = async (city) => {
      const normalizedCity = city.trim().toLowerCase();
      if (coordinateCache.has(normalizedCity)) {
        return coordinateCache.get(normalizedCity);
      }

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)},India&format=json&limit=1`,
        { headers: { "User-Agent": "LogiMatch/1.0" } },
      );
      const data = await response.json();
      if (!data || data.length === 0)
        throw new Error(`Location not found: ${city}`);
      const coords = {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
      coordinateCache.set(normalizedCity, coords);
      return coords;
    };

    const originCoords = await getCoords(originCity);
    const destCoords = await getCoords(destCity);
    const distanceKm = haversine(originCoords, destCoords, { unit: "km" });

    const fuelCostPerKm =
      priceConfig.dieselPricePerLitre / priceConfig.fuelEfficiencyKmPerLitre;
    const fuelCost = fuelCostPerKm * distanceKm;
    const daysNeeded = Math.max(Math.ceil(distanceKm / priceConfig.kmPerDay), 1);
    const driverCost = daysNeeded * priceConfig.driverCostPerDay;

    let cargoVolumeCm3;
    if (dimensions.every((value) => value !== null)) {
      cargoVolumeCm3 = dimensions[0] * dimensions[1] * dimensions[2];
    } else {
      const estimatedM3 = numericWeight / priceConfig.densityKgPerM3;
      cargoVolumeCm3 = estimatedM3 * 1000000;
    }

    const trucksByVolume = Math.ceil(cargoVolumeCm3 / priceConfig.truckVolumeCm3);
    const trucksByWeight = Math.ceil(numericWeight / priceConfig.truckMaxPayloadKg);
    const numTrucks = Math.max(trucksByVolume, trucksByWeight, 1);

    const baseCostPerTruck = fuelCost + driverCost;
    const baseCost = baseCostPerTruck * numTrucks;
    let totalCost = baseCost;
    let riskMultiplier = 1;
    let equipmentCost = 0;

    if (is_fragile) riskMultiplier *= 1.1;
    if (is_hazmat) riskMultiplier *= 1.25;
    if (requires_refrigeration) riskMultiplier *= 1.5;
    totalCost *= riskMultiplier;

    if (requires_liftgate) equipmentCost += 3000 * numTrucks;
    if (requires_loading_dock) equipmentCost += 1500 * numTrucks;
    totalCost += equipmentCost;

    const packagingRate = packagingSurcharge[packaging_type || "Palletized"];
    totalCost *= 1 + packagingRate;
    const low = totalCost * priceConfig.lowRangeMultiplier;
    const high = totalCost * priceConfig.highRangeMultiplier;

    res.status(200).json({
      distance: Math.round(distanceKm),
      days: daysNeeded,
      numTrucks: numTrucks,
      price: Math.round(totalCost),
      recommendedRange: {
        low: Math.round(low),
        fair: Math.round(totalCost),
        high: Math.round(high),
      },
      breakdown: {
        fuelCost: roundMoney(fuelCost * numTrucks),
        driverCost: roundMoney(driverCost * numTrucks),
        baseCost: roundMoney(baseCost),
        riskSurcharge: roundMoney(baseCost * riskMultiplier - baseCost),
        equipmentCost: roundMoney(equipmentCost),
        packagingSurcharge: roundMoney(totalCost - (baseCost * riskMultiplier + equipmentCost)),
        totalSurcharges: roundMoney(totalCost - baseCost),
      },
    });
  } catch (error) {
    console.error("Price estimate error:", error.message);
    const isLocationError = error.message.includes("Location not found");
    res
      .status(isLocationError ? 404 : 500)
      .json({ error: isLocationError ? error.message : "Failed to calculate price estimate" });
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
    const numericAmount = Number(amount);

    if (req.user.role !== "driver") {
      return res.status(403).json({ error: "Only providers can submit bids." });
    }
    if (!job_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "A positive bid amount is required." });
    }

    const jobResult = await pool.query(
      "SELECT seeker_id, status FROM jobs WHERE id = $1",
      [job_id],
    );
    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: "Job not found." });
    }
    if (jobResult.rows[0].seeker_id === provider_id) {
      return res.status(403).json({ error: "You cannot bid on your own job." });
    }
    if (jobResult.rows[0].status !== "open") {
      return res.status(400).json({ error: "Job is no longer open." });
    }

    const newBid = await pool.query(
      "INSERT INTO bids (job_id, provider_id, amount) VALUES ($1, $2, $3) RETURNING *",
      [job_id, provider_id, numericAmount],
    );

    // 🚀 RESTORED: Alert Seeker of New Bid
    const seekerQuery = `SELECT u.email, u.name, j.origin, j.destination FROM users u JOIN jobs j ON u.id = j.seeker_id WHERE j.id = $1`;
    const seekerResult = await pool.query(seekerQuery, [job_id]);

    if (seekerResult.rows.length > 0) {
      const seeker = seekerResult.rows[0];
      if (process.env.RESEND_API_KEY) {
        try {
          await sendEmail({
            to: seeker.email,
            subject: `New Bid Received! (₹${numericAmount})`,
            html: `
              <h2>Hello ${seeker.name},</h2>
              <p>You just received a new bid of <b>₹${numericAmount}</b> for your cargo from ${seeker.origin} to ${seeker.destination}.</p>
              <p>Log in to your Profile to review and accept the offer.</p>
            `,
          });
        } catch (emailError) {
          console.error("Bid alert email failed:", emailError.message);
        }
      }
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
    const bidResult = await pool.query(
      `SELECT b.id, b.job_id, b.provider_id, b.amount, j.seeker_id, j.status AS job_status
       FROM bids b
       JOIN jobs j ON b.job_id = j.id
       WHERE b.id = $1`,
      [bidId],
    );
    if (bidResult.rows.length === 0) {
      return res.status(404).json({ error: "Bid not found." });
    }

    const bid = bidResult.rows[0];
    if (bid.seeker_id !== req.user.id) {
      return res.status(403).json({ error: "Only the job seeker can accept this bid." });
    }
    if (bid.job_status !== "open") {
      return res.status(400).json({ error: "Job is no longer open." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const jobUpdate = await client.query(
        "UPDATE jobs SET status = $1, current_location = COALESCE(current_location, origin) WHERE id = $2 AND status = 'open'",
        ["assigned", bid.job_id],
      );
      if (jobUpdate.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Job is no longer open." });
      }
      await client.query(
        "UPDATE bids SET status = CASE WHEN id = $1 THEN 'accepted' ELSE 'rejected' END WHERE job_id = $2",
        [bidId, bid.job_id],
      );
      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK");
      throw transactionError;
    } finally {
      client.release();
    }

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

// ---------------------------------
// Route: History Analysis & Market Insights
// ---------------------------------
app.get("/api/insights/summary", verifyToken, async (req, res) => {
  try {
    if (req.user.role === "seeker") {
      const [summaryResult, routeResult, statusResult] = await Promise.all([
        pool.query(
          `SELECT
             COUNT(*)::int AS total_jobs,
             COUNT(*) FILTER (WHERE j.status IN ('assigned', 'picked_up', 'delivered'))::int AS awarded_jobs,
             COUNT(*) FILTER (WHERE j.status = 'delivered')::int AS completed_jobs,
             COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'accepted'), 0)::numeric AS total_spend,
             COALESCE(AVG(b.amount) FILTER (WHERE b.status = 'accepted'), 0)::numeric AS average_accepted_price
           FROM jobs j
           LEFT JOIN bids b ON b.job_id = j.id
           WHERE j.seeker_id = $1`,
          [req.user.id],
        ),
        pool.query(
          `SELECT
             j.origin,
             j.destination,
             COUNT(*)::int AS job_count,
             COALESCE(AVG(b.amount) FILTER (WHERE b.status = 'accepted'), 0)::numeric AS average_price
           FROM jobs j
           LEFT JOIN bids b ON b.job_id = j.id
           WHERE j.seeker_id = $1
           GROUP BY j.origin, j.destination
           ORDER BY job_count DESC, average_price DESC
           LIMIT 6`,
          [req.user.id],
        ),
        pool.query(
          `SELECT status, COUNT(*)::int AS count
           FROM jobs
           WHERE seeker_id = $1
           GROUP BY status
           ORDER BY count DESC`,
          [req.user.id],
        ),
      ]);

      return res.status(200).json({
        role: "seeker",
        summary: summaryResult.rows[0],
        routes: routeResult.rows,
        statuses: statusResult.rows,
      });
    }

    const [summaryResult, routeResult, statusResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(*)::int AS total_bids,
           COUNT(*) FILTER (WHERE b.status = 'accepted')::int AS won_bids,
           COALESCE(SUM(b.amount) FILTER (WHERE b.status = 'accepted'), 0)::numeric AS total_earnings,
           COALESCE(AVG(b.amount), 0)::numeric AS average_bid,
           COALESCE(
             ROUND(
               100.0 * COUNT(*) FILTER (WHERE b.status = 'accepted') / NULLIF(COUNT(*), 0),
               1
             ),
             0
           )::numeric AS win_rate
         FROM bids b
         WHERE b.provider_id = $1`,
        [req.user.id],
      ),
      pool.query(
        `SELECT
           j.origin,
           j.destination,
           COUNT(*)::int AS bid_count,
           COUNT(*) FILTER (WHERE b.status = 'accepted')::int AS won_count,
           COALESCE(AVG(b.amount), 0)::numeric AS average_bid
         FROM bids b
         JOIN jobs j ON j.id = b.job_id
         WHERE b.provider_id = $1
         GROUP BY j.origin, j.destination
         ORDER BY won_count DESC, bid_count DESC
         LIMIT 6`,
        [req.user.id],
      ),
      pool.query(
        `SELECT b.status, COUNT(*)::int AS count
         FROM bids b
         WHERE b.provider_id = $1
         GROUP BY b.status
         ORDER BY count DESC`,
        [req.user.id],
      ),
    ]);

    res.status(200).json({
      role: "driver",
      summary: summaryResult.rows[0],
      routes: routeResult.rows,
      statuses: statusResult.rows,
    });
  } catch (error) {
    console.error("Insights error:", error.message);
    res.status(500).json({ error: "Server error fetching insights" });
  }
});

// ---------------------------------
// Route: Secure Freight Manifest PDF
// ---------------------------------
app.get("/api/jobs/:id/manifest.pdf", verifyToken, async (req, res) => {
  try {
    const manifestResult = await pool.query(
      `SELECT
         j.*,
         seeker.name AS seeker_name,
         seeker.email AS seeker_email,
         seeker.company_name AS seeker_company,
         provider.id AS provider_id,
         provider.name AS provider_name,
         provider.email AS provider_email,
         provider.company_name AS provider_company,
         b.amount AS winning_bid,
         b.created_at AS accepted_bid_created_at
       FROM jobs j
       JOIN users seeker ON seeker.id = j.seeker_id
       JOIN bids b ON b.job_id = j.id AND b.status = 'accepted'
       JOIN users provider ON provider.id = b.provider_id
       WHERE j.id = $1`,
      [req.params.id],
    );

    if (manifestResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Accepted manifest not found for this job." });
    }

    const job = manifestResult.rows[0];
    const isSeeker = job.seeker_id === req.user.id;
    const isProvider = job.provider_id === req.user.id;
    if (!isSeeker && !isProvider) {
      return res.status(403).json({ error: "You cannot access this manifest." });
    }

    const doc = new PDFDocument({ size: "A4", margin: 48 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="logimatch-manifest-${job.id}.pdf"`,
    );
    doc.pipe(res);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .text("LogiMatch Freight Manifest");
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#555555")
      .text(`Generated on ${formatDateForManifest(new Date())}`);
    doc.moveDown();

    doc
      .fillColor("#111111")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text(`Shipment #${job.id}: ${job.origin} to ${job.destination}`);
    doc.moveDown(0.5);
    addManifestRow(doc, "Status:", job.status);
    addManifestRow(doc, "Accepted Bid:", `INR ${roundMoney(job.winning_bid)}`);
    addManifestRow(doc, "Current Location:", job.current_location || job.origin);
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("Parties");
    doc.fontSize(10);
    addManifestRow(
      doc,
      "Seeker:",
      `${job.seeker_name} (${job.seeker_company || "No company listed"})`,
    );
    addManifestRow(doc, "Seeker Email:", job.seeker_email);
    addManifestRow(
      doc,
      "Provider:",
      `${job.provider_name} (${job.provider_company || "No company listed"})`,
    );
    addManifestRow(doc, "Provider Email:", job.provider_email);
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("Cargo");
    doc.fontSize(10);
    addManifestRow(doc, "Weight:", `${job.weight_kg} kg`);
    addManifestRow(
      doc,
      "Dimensions:",
      `${job.length_cm || "-"} L x ${job.width_cm || "-"} W x ${job.height_cm || "-"} H cm`,
    );
    addManifestRow(doc, "Packaging:", job.packaging_type);
    addManifestRow(doc, "Fragile:", job.is_fragile ? "Yes" : "No");
    addManifestRow(doc, "Hazmat:", job.is_hazmat ? "Yes" : "No");
    addManifestRow(
      doc,
      "Refrigeration:",
      job.requires_refrigeration ? "Required" : "Not required",
    );
    addManifestRow(
      doc,
      "Equipment:",
      [
        job.requires_liftgate ? "Liftgate" : null,
        job.requires_loading_dock ? "Loading dock" : null,
      ]
        .filter(Boolean)
        .join(", ") || "Standard loading",
    );
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("Schedule");
    doc.fontSize(10);
    addManifestRow(
      doc,
      "Pickup Window:",
      `${formatDateForManifest(job.pickup_window_start)} to ${formatDateForManifest(job.pickup_window_end)}`,
    );
    addManifestRow(
      doc,
      "Delivery Window:",
      `${formatDateForManifest(job.delivery_window_start)} to ${formatDateForManifest(job.delivery_window_end)}`,
    );
    addManifestRow(doc, "Actual Pickup:", formatDateForManifest(job.actual_pickup_time));
    addManifestRow(
      doc,
      "Actual Delivery:",
      formatDateForManifest(job.actual_delivery_time),
    );
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("Special Instructions");
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(job.special_instructions || "No special instructions provided.", {
        width: 500,
      });
    doc.moveDown();

    doc
      .fontSize(9)
      .fillColor("#666666")
      .text(
        "This document is generated from LogiMatch job, bid, and user records for operational reference.",
      );

    doc.end();
  } catch (error) {
    console.error("Manifest PDF error:", error.message);
    res.status(500).json({ error: "Server error generating manifest" });
  }
});

// Test Route
app.get("/api/status", (req, res) => {
  res.json({ message: "LogiMatch backend server is running smoothly!" });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is operating on port ${PORT}`);
  });
}

module.exports = app;
