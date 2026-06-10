const pool = require('./db');

const createTables = async () => {
  const queryText = `
    -- 1. USERS TABLE (Upgraded with Roles and Rich Profiles)
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      profile_photo VARCHAR(255),
      banner_photo VARCHAR(255),
      bio TEXT,
      is_public BOOLEAN DEFAULT true,
      license_file_url VARCHAR(255)
    );

    -- 2. JOBS TABLE (Upgraded with Professional Freight Parameters)
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      seeker_id INTEGER REFERENCES users(id),
      origin VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      weight_kg DECIMAL NOT NULL,
      status VARCHAR(50) DEFAULT 'open',
      
      -- Dimensions & Volume
      length_cm NUMERIC(10, 2),
      width_cm NUMERIC(10, 2),
      height_cm NUMERIC(10, 2),
      
      -- Packaging & Cargo Risk
      packaging_type VARCHAR(50),
      is_fragile BOOLEAN DEFAULT false,
      is_hazmat BOOLEAN DEFAULT false,
      requires_refrigeration BOOLEAN DEFAULT false,
      
      -- Scheduling Windows
      pickup_window_start TIMESTAMP WITH TIME ZONE,
      pickup_window_end TIMESTAMP WITH TIME ZONE,
      delivery_window_start TIMESTAMP WITH TIME ZONE,
      delivery_window_end TIMESTAMP WITH TIME ZONE,
      
      -- Equipment & Notes
      requires_liftgate BOOLEAN DEFAULT false,
      requires_loading_dock BOOLEAN DEFAULT false,
      special_instructions TEXT
    );

    -- 3. BIDS TABLE (The Auction Engine)
    CREATE TABLE IF NOT EXISTS bids (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id),
      provider_id INTEGER REFERENCES users(id),
      amount DECIMAL NOT NULL,
      status VARCHAR(50) DEFAULT 'pending'
    );
  `;

  try {
    // This sends the SQL instructions across our db.js bridge
    await pool.query(queryText);
    console.log('Success! All LogiMatch tables created with the latest professional schema.');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    // This safely closes the bridge so the script can finish
    pool.end(); 
  }
};

createTables();