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
let chatMessagesTableReady = false;

const normalizeOrigin = (origin) => origin?.replace(/\/$/, "");
const configuredFrontendOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URLS,
]
  .filter(Boolean)
  .flatMap((value) => value.split(","))
  .map((value) => normalizeOrigin(value.trim()))
  .filter(Boolean);

const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://logi-match.vercel.app",
  ...configuredFrontendOrigins,
]);

const isAllowedVercelPreview = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "https:" &&
      hostname.endsWith(".vercel.app") &&
      (hostname === "logi-match.vercel.app" || hostname.startsWith("logi-match-"))
    );
  } catch {
    return false;
  }
};

app.use(
  cors({
    origin(origin, callback) {
      const normalizedOrigin = normalizeOrigin(origin);
      if (
        !normalizedOrigin ||
        allowedOrigins.has(normalizedOrigin) ||
        isAllowedVercelPreview(normalizedOrigin)
      ) {
        return callback(null, true);
      }
      console.error("Blocked by CORS:", normalizedOrigin);
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(express.json());

const ensureChatMessagesTable = async () => {
  if (chatMessagesTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_job_created
      ON chat_messages(job_id, created_at, id);
  `);
  chatMessagesTableReady = true;
};

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

const shortPlace = (place) => String(place || "TBD").split(",")[0].trim();

const manifestText = (value, fallback = "Not specified") =>
  value === undefined || value === null || value === "" ? fallback : String(value);

const drawManifestSectionTitle = (doc, title, x, y, width) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#2563eb")
    .text(title.toUpperCase(), x, y, {
      width,
      characterSpacing: 0.8,
    });
  doc
    .moveTo(x, y + 16)
    .lineTo(x + width, y + 16)
    .strokeColor("#dbeafe")
    .lineWidth(1)
    .stroke();
};

const drawManifestBadge = (doc, text, x, y, options = {}) => {
  const fill = options.fill || "#dcfce7";
  const stroke = options.stroke || "#86efac";
  const color = options.color || "#166534";
  const width = options.width || Math.max(84, String(text).length * 6 + 24);

  doc.roundedRect(x, y, width, 26, 13).fillAndStroke(fill, stroke);
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(color)
    .text(String(text).toUpperCase(), x, y + 8, {
      width,
      align: "center",
      characterSpacing: 0.4,
    });
};

const drawManifestKeyValue = (doc, label, value, x, y, width) => {
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#64748b")
    .text(label.toUpperCase(), x, y, {
      width,
      characterSpacing: 0.5,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#0f172a")
    .text(manifestText(value), x, y + 14, {
      width,
      lineGap: 2,
    });
};

const drawManifestPartyCard = (doc, title, name, company, email, x, y, width) => {
  doc.roundedRect(x, y, width, 88, 10).fillAndStroke("#ffffff", "#e2e8f0");
  doc.circle(x + 28, y + 32, 18).fill("#dbeafe");
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1d4ed8")
    .text(
      String(name || title)
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      x + 10,
      y + 27,
      { width: 36, align: "center" },
    );
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#64748b")
    .text(title.toUpperCase(), x + 56, y + 16, {
      width: width - 70,
      characterSpacing: 0.6,
    });
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#0f172a")
    .text(manifestText(name), x + 56, y + 32, {
      width: width - 70,
      height: 16,
      ellipsis: true,
    });
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#475569")
    .text(company || "Independent operator", x + 56, y + 49, {
      width: width - 70,
      height: 14,
      ellipsis: true,
    })
    .text(email || "No email listed", x + 56, y + 64, {
      width: width - 70,
      height: 14,
      ellipsis: true,
    });
};

const drawManifestTimelineItem = (doc, label, value, x, y, color) => {
  doc.circle(x + 6, y + 8, 5).fill(color);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#64748b")
    .text(label.toUpperCase(), x + 20, y, { width: 190, characterSpacing: 0.4 });
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#0f172a")
    .text(value, x + 20, y + 14, { width: 190 });
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

    // Alert seeker of new bid
    const seekerQuery = `
      SELECT seeker.email, seeker.name, j.origin, j.destination, provider.name AS provider_name
      FROM users seeker
      JOIN jobs j ON seeker.id = j.seeker_id
      JOIN users provider ON provider.id = $2
      WHERE j.id = $1
    `;
    const seekerResult = await pool.query(seekerQuery, [job_id, provider_id]);

    if (seekerResult.rows.length > 0) {
      const seeker = seekerResult.rows[0];
      if (process.env.RESEND_API_KEY) {
        try {
          await sendEmail({
            to: seeker.email,
            subject: `New Bid Received! (₹${numericAmount})`,
            html: `
              <h2>Hello ${seeker.name},</h2>
              <p>You just received a new bid of <b>₹${numericAmount}</b> from <b>${seeker.provider_name}</b> for your cargo from ${seeker.origin} to ${seeker.destination}.</p>
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

    if (process.env.RESEND_API_KEY) {
      try {
        const notificationResult = await pool.query(
          `SELECT
             j.origin, j.destination, j.weight_kg, j.pickup_window_start, j.pickup_window_end,
             j.delivery_window_start, j.delivery_window_end, j.special_instructions,
             b.amount,
             seeker.name AS seeker_name, seeker.email AS seeker_email,
             provider.name AS provider_name, provider.email AS provider_email
           FROM jobs j
           JOIN bids b ON b.job_id = j.id AND b.id = $1
           JOIN users seeker ON seeker.id = j.seeker_id
           JOIN users provider ON provider.id = b.provider_id
           WHERE j.id = $2`,
          [bidId, bid.job_id],
        );

        if (notificationResult.rows.length > 0) {
          const job = notificationResult.rows[0];
          await sendEmail({
            to: job.provider_email,
            subject: `Bid Accepted: ${job.origin} to ${job.destination}`,
            html: `
              <h2>Hello ${job.provider_name},</h2>
              <p>Your bid of <b>₹${job.amount}</b> has been accepted.</p>
              <h3>Shipment Details</h3>
              <p><b>Route:</b> ${job.origin} to ${job.destination}</p>
              <p><b>Weight:</b> ${job.weight_kg} kg</p>
              <p><b>Pickup Window:</b> ${formatDateForManifest(job.pickup_window_start)} - ${formatDateForManifest(job.pickup_window_end)}</p>
              <p><b>Delivery Window:</b> ${formatDateForManifest(job.delivery_window_start)} - ${formatDateForManifest(job.delivery_window_end)}</p>
              <p><b>Special Instructions:</b> ${job.special_instructions || "None"}</p>
              <h3>Seeker Contact</h3>
              <p><b>Name:</b> ${job.seeker_name}</p>
              <p><b>Email:</b> ${job.seeker_email}</p>
              <p>Please log in to LogiMatch to view the full dispatch details and download the freight manifest.</p>
            `,
          });
        }
      } catch (emailError) {
        console.error("Bid acceptance email failed:", emailError.message);
      }
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

    if ((status === "delivered" || status === "completed") && process.env.RESEND_API_KEY) {
      try {
        const notificationResult = await pool.query(
          `SELECT
             j.origin, j.destination, j.weight_kg,
             seeker.name AS seeker_name, seeker.email AS seeker_email,
             provider.name AS provider_name, provider.email AS provider_email
           FROM jobs j
           JOIN bids b ON b.job_id = j.id AND b.status = 'accepted'
           JOIN users seeker ON seeker.id = j.seeker_id
           JOIN users provider ON provider.id = b.provider_id
           WHERE j.id = $1`,
          [jobId],
        );

        if (notificationResult.rows.length > 0) {
          const job = notificationResult.rows[0];
          const subject = `Job Completed: ${job.origin} to ${job.destination}`;
          const html = `
            <h2>Shipment Completed</h2>
            <p>The shipment from <b>${job.origin}</b> to <b>${job.destination}</b> has been marked as completed.</p>
            <p><b>Weight:</b> ${job.weight_kg} kg</p>
            <p><b>Seeker:</b> ${job.seeker_name}</p>
            <p><b>Provider:</b> ${job.provider_name}</p>
            <p>Please log in to LogiMatch to review the completed job and update ratings if needed.</p>
          `;

          await Promise.all([
            sendEmail({ to: job.seeker_email, subject, html }),
            sendEmail({ to: job.provider_email, subject, html }),
          ]);
        }
      } catch (emailError) {
        console.error("Completion email failed:", emailError.message);
      }
    }

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
// Route: Job Chat Thread
// ---------------------------------
app.get("/api/jobs/:id/messages", verifyToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    await ensureChatMessagesTable();

    const accessResult = await pool.query(
      `SELECT j.seeker_id, b.provider_id
       FROM jobs j
       JOIN bids b ON b.job_id = j.id AND b.status = 'accepted'
       WHERE j.id = $1`,
      [jobId],
    );

    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: "Chat is available after bid acceptance." });
    }

    const access = accessResult.rows[0];
    const isParticipant =
      Number(access.seeker_id) === Number(req.user.id) ||
      Number(access.provider_id) === Number(req.user.id);

    if (!isParticipant) {
      return res.status(403).json({ error: "You cannot access this job chat." });
    }

    const messagesResult = await pool.query(
      `SELECT
         cm.id, cm.job_id, cm.sender_id, cm.message, cm.created_at,
         u.name AS sender_name, u.role AS sender_role
       FROM chat_messages cm
       JOIN users u ON u.id = cm.sender_id
       WHERE cm.job_id = $1
       ORDER BY cm.created_at ASC, cm.id ASC
       LIMIT 100`,
      [jobId],
    );

    res.status(200).json(messagesResult.rows);
  } catch (error) {
    console.error("Chat fetch error:", error.message);
    res.status(500).json({ error: "Server error fetching chat messages" });
  }
});

app.post("/api/jobs/:id/messages", verifyToken, async (req, res) => {
  try {
    const jobId = req.params.id;
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Message cannot be empty." });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: "Message is too long." });
    }

    await ensureChatMessagesTable();

    const accessResult = await pool.query(
      `SELECT j.seeker_id, b.provider_id
       FROM jobs j
       JOIN bids b ON b.job_id = j.id AND b.status = 'accepted'
       WHERE j.id = $1`,
      [jobId],
    );

    if (accessResult.rows.length === 0) {
      return res.status(404).json({ error: "Chat is available after bid acceptance." });
    }

    const access = accessResult.rows[0];
    const isParticipant =
      Number(access.seeker_id) === Number(req.user.id) ||
      Number(access.provider_id) === Number(req.user.id);

    if (!isParticipant) {
      return res.status(403).json({ error: "You cannot send messages in this chat." });
    }

    const insertResult = await pool.query(
      `INSERT INTO chat_messages (job_id, sender_id, message)
       VALUES ($1, $2, $3)
       RETURNING id, job_id, sender_id, message, created_at`,
      [jobId, req.user.id, message],
    );

    const senderResult = await pool.query(
      "SELECT name AS sender_name, role AS sender_role FROM users WHERE id = $1",
      [req.user.id],
    );

    res.status(201).json({
      ...insertResult.rows[0],
      sender_name: senderResult.rows[0]?.sender_name || "User",
      sender_role: senderResult.rows[0]?.sender_role || req.user.role,
    });
  } catch (error) {
    console.error("Chat send error:", error.message);
    res.status(500).json({ error: "Server error sending chat message" });
  }
});

// ---------------------------------
// Route: Get Current User Profile
// ---------------------------------
app.get("/api/users/me", verifyToken, async (req, res) => {
  try {
    const query = `
      SELECT id, name, email, role, profile_photo, banner_photo, bio, license_file_url, is_public, company_name, business_doc_url, rating_sum, rating_count
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
      const [summaryResult, routeResult, statusResult, recordsResult] =
        await Promise.all([
        pool.query(
          `SELECT
             COUNT(*)::int AS total_jobs,
             COUNT(*) FILTER (WHERE j.status IN ('assigned', 'picked_up', 'delivered', 'completed'))::int AS awarded_jobs,
             COUNT(*) FILTER (WHERE j.status IN ('delivered', 'completed'))::int AS completed_jobs,
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
        pool.query(
          `SELECT
             j.id AS job_id,
             SPLIT_PART(j.origin, ',', 1) AS origin_city,
             SPLIT_PART(j.destination, ',', 1) AS destination_city,
             CONCAT(SPLIT_PART(j.origin, ',', 1), ' to ', SPLIT_PART(j.destination, ',', 1)) AS route,
             j.status,
             COALESCE(j.weight_kg, 0)::numeric AS weight_kg,
             COALESCE(j.seeker_ask, 0)::numeric AS seeker_ask,
             COALESCE(MAX(b.amount) FILTER (WHERE b.status = 'accepted'), 0)::numeric AS accepted_price,
             COALESCE(MIN(b.amount), 0)::numeric AS lowest_bid,
             COUNT(b.id)::int AS bid_count,
             COALESCE(
               ROUND(
                 EXTRACT(EPOCH FROM (j.actual_delivery_time - j.actual_pickup_time)) / 86400,
                 2
               ),
               0
             )::numeric AS transit_days,
             TO_CHAR(j.created_at, 'Mon YYYY') AS created_month,
             TO_CHAR(j.created_at, 'YYYY-MM-DD') AS created_date
           FROM jobs j
           LEFT JOIN bids b ON b.job_id = j.id
           WHERE j.seeker_id = $1
           GROUP BY j.id
           ORDER BY j.created_at DESC, j.id DESC
           LIMIT 100`,
          [req.user.id],
        ),
      ]);

      return res.status(200).json({
        role: "seeker",
        summary: summaryResult.rows[0],
        routes: routeResult.rows,
        statuses: statusResult.rows,
        records: recordsResult.rows,
      });
    }

    const [summaryResult, routeResult, statusResult, recordsResult] =
      await Promise.all([
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
      pool.query(
        `SELECT
           b.id AS bid_id,
           j.id AS job_id,
           SPLIT_PART(j.origin, ',', 1) AS origin_city,
           SPLIT_PART(j.destination, ',', 1) AS destination_city,
           CONCAT(SPLIT_PART(j.origin, ',', 1), ' to ', SPLIT_PART(j.destination, ',', 1)) AS route,
           j.status AS job_status,
           b.status AS bid_status,
           COALESCE(b.amount, 0)::numeric AS bid_amount,
           CASE WHEN b.status = 'accepted' THEN COALESCE(b.amount, 0) ELSE 0 END::numeric AS earnings,
           CASE WHEN b.status = 'accepted' THEN 1 ELSE 0 END::int AS won,
           COALESCE(j.weight_kg, 0)::numeric AS weight_kg,
           TO_CHAR(b.created_at, 'Mon YYYY') AS created_month,
           TO_CHAR(b.created_at, 'YYYY-MM-DD') AS created_date
         FROM bids b
         JOIN jobs j ON j.id = b.job_id
         WHERE b.provider_id = $1
         ORDER BY b.created_at DESC, b.id DESC
         LIMIT 100`,
        [req.user.id],
      ),
    ]);

    res.status(200).json({
      role: "driver",
      summary: summaryResult.rows[0],
      routes: routeResult.rows,
      statuses: statusResult.rows,
      records: recordsResult.rows,
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

    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const margin = 42;
    const contentWidth = pageWidth - margin * 2;
    const left = margin;
    const right = margin + contentWidth;
    const originCity = shortPlace(job.origin);
    const destinationCity = shortPlace(job.destination);
    const statusText = String(job.status || "assigned").replace("_", " ");
    const acceptedBid = `INR ${roundMoney(job.winning_bid).toLocaleString("en-IN")}`;
    const dimensions = `${job.length_cm || "-"} x ${job.width_cm || "-"} x ${job.height_cm || "-"} cm`;
    const equipment = [
      job.requires_liftgate ? "Liftgate" : null,
      job.requires_loading_dock ? "Loading dock" : null,
    ]
      .filter(Boolean)
      .join(", ") || "Standard loading";
    const riskFlags = [
      job.is_fragile ? "Fragile" : null,
      job.is_hazmat ? "Hazmat" : null,
      job.requires_refrigeration ? "Refrigerated" : null,
    ].filter(Boolean);

    doc.rect(0, 0, pageWidth, pageHeight).fill("#f8fafc");

    doc.roundedRect(left, 32, contentWidth, 112, 16).fill("#0f172a");
    doc.circle(left + 42, 72, 24).fill("#2563eb");
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor("#ffffff")
      .text("LM", left + 20, 64, { width: 44, align: "center" });
    doc
      .font("Helvetica-Bold")
      .fontSize(20)
      .fillColor("#ffffff")
      .text("LogiMatch Freight Manifest", left + 82, 54, {
        width: contentWidth - 250,
        lineBreak: false,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#cbd5e1")
      .text("Verified dispatch document for accepted freight movement", left + 84, 82, {
        width: contentWidth - 220,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#93c5fd")
      .text(`MANIFEST #${job.id}`, right - 145, 54, {
        width: 120,
        align: "right",
      });
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#cbd5e1")
      .text(`Generated: ${formatDateForManifest(new Date())}`, right - 190, 76, {
        width: 165,
        align: "right",
      });

    drawManifestBadge(doc, statusText, right - 130, 104, {
      width: 104,
      fill: job.status === "delivered" || job.status === "completed" ? "#dcfce7" : "#dbeafe",
      stroke: job.status === "delivered" || job.status === "completed" ? "#86efac" : "#93c5fd",
      color: job.status === "delivered" || job.status === "completed" ? "#166534" : "#1d4ed8",
    });

    doc.roundedRect(left, 162, contentWidth, 104, 14).fillAndStroke("#ffffff", "#e2e8f0");
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#64748b")
      .text("ROUTE", left + 22, 182, { width: 80, characterSpacing: 0.8 });
    doc
      .font("Helvetica-Bold")
      .fontSize(25)
      .fillColor("#0f172a")
      .text(originCity, left + 22, 204, { width: 170, height: 34, ellipsis: true });
    doc
      .moveTo(left + 204, 220)
      .lineTo(left + 292, 220)
      .strokeColor("#2563eb")
      .lineWidth(3)
      .stroke();
    doc
      .polygon([left + 292, 214], [left + 308, 220], [left + 292, 226])
      .fill("#2563eb");
    doc
      .font("Helvetica-Bold")
      .fontSize(25)
      .fillColor("#0f172a")
      .text(destinationCity, left + 322, 204, {
        width: 82,
        height: 34,
        ellipsis: true,
      });
    doc.roundedRect(right - 122, 184, 96, 58, 12).fill("#f0fdf4");
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#15803d")
      .text("ACCEPTED BID", right - 112, 196, {
        width: 76,
        align: "center",
        characterSpacing: 0.5,
      });
    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#166534")
      .text(acceptedBid, right - 116, 215, { width: 84, align: "center" });

    drawManifestSectionTitle(doc, "Shipment Parties", left, 288, contentWidth);
    drawManifestPartyCard(
      doc,
      "Customer / Seeker",
      job.seeker_name,
      job.seeker_company,
      job.seeker_email,
      left,
      316,
      248,
    );
    drawManifestPartyCard(
      doc,
      "Transporter / Provider",
      job.provider_name,
      job.provider_company,
      job.provider_email,
      left + 272,
      316,
      248,
    );

    drawManifestSectionTitle(doc, "Cargo Snapshot", left, 426, contentWidth);
    doc.roundedRect(left, 454, contentWidth, 96, 12).fillAndStroke("#ffffff", "#e2e8f0");
    drawManifestKeyValue(doc, "Weight", `${manifestText(job.weight_kg, "-")} kg`, left + 20, 474, 110);
    drawManifestKeyValue(doc, "Dimensions", dimensions, left + 150, 474, 120);
    drawManifestKeyValue(doc, "Packaging", job.packaging_type, left + 292, 474, 110);
    drawManifestKeyValue(doc, "Equipment", equipment, left + 416, 474, 90);

    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#64748b")
      .text("RISK FLAGS", left + 20, 522, { width: 90, characterSpacing: 0.5 });
    if (riskFlags.length === 0) {
      drawManifestBadge(doc, "standard cargo", left + 92, 514, {
        width: 112,
        fill: "#f1f5f9",
        stroke: "#cbd5e1",
        color: "#475569",
      });
    } else {
      riskFlags.slice(0, 3).forEach((flag, index) => {
        drawManifestBadge(doc, flag, left + 92 + index * 112, 514, {
          width: 98,
          fill: "#fef3c7",
          stroke: "#fbbf24",
          color: "#92400e",
        });
      });
    }

    drawManifestSectionTitle(doc, "Schedule & Tracking", left, 566, contentWidth);
    doc.roundedRect(left, 592, contentWidth, 90, 12).fillAndStroke("#ffffff", "#e2e8f0");
    doc
      .moveTo(left + 34, 616)
      .lineTo(left + 34, 660)
      .strokeColor("#bfdbfe")
      .lineWidth(2)
      .stroke();
    drawManifestTimelineItem(
      doc,
      "Pickup Window",
      `${formatDateForManifest(job.pickup_window_start)} to ${formatDateForManifest(job.pickup_window_end)}`,
      left + 22,
      608,
      "#2563eb",
    );
    drawManifestTimelineItem(
      doc,
      "Delivery Window",
      `${formatDateForManifest(job.delivery_window_start)} to ${formatDateForManifest(job.delivery_window_end)}`,
      left + 290,
      608,
      "#16a34a",
    );
    drawManifestTimelineItem(
      doc,
      "Actual Pickup",
      formatDateForManifest(job.actual_pickup_time),
      left + 22,
      646,
      "#2563eb",
    );
    drawManifestTimelineItem(
      doc,
      "Actual Delivery",
      formatDateForManifest(job.actual_delivery_time),
      left + 290,
      646,
      "#16a34a",
    );

    doc.roundedRect(left, 700, contentWidth, 60, 12).fillAndStroke("#ffffff", "#e2e8f0");
    drawManifestKeyValue(
      doc,
      "Current Location",
      job.current_location || job.origin,
      left + 20,
      716,
      220,
    );
    doc
      .font("Helvetica-Bold")
      .fontSize(8)
      .fillColor("#64748b")
      .text("SPECIAL INSTRUCTIONS", left + 270, 716, {
        width: 220,
        characterSpacing: 0.5,
      });
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#334155")
      .text(job.special_instructions || "No special instructions provided.", left + 270, 732, {
        width: 230,
        height: 22,
        ellipsis: true,
      });

    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#64748b")
      .text(
        "Generated from LogiMatch job, bid, tracking, and user records. Access is restricted to the job seeker and accepted provider.",
        left,
        778,
        { width: contentWidth, align: "center" },
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
