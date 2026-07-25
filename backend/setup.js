const pool = require("./db");

const createTables = async () => {
  const queryText = `
    -- 1. USERS TABLE
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
      license_file_url VARCHAR(255),
      is_verified BOOLEAN DEFAULT false,
      otp VARCHAR(6),
      otp_expires_at TIMESTAMP WITH TIME ZONE,
      company_name VARCHAR(255),
      business_doc_url VARCHAR(255),
      rating_sum INTEGER DEFAULT 0,
      rating_count INTEGER DEFAULT 0
    );

    -- 2. JOBS TABLE
    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      seeker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      origin VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      weight_kg DECIMAL NOT NULL,
      seeker_ask DECIMAL,
      status VARCHAR(50) DEFAULT 'open',
      length_cm NUMERIC(10,2),
      width_cm NUMERIC(10,2),
      height_cm NUMERIC(10,2),
      packaging_type VARCHAR(50) DEFAULT 'Palletized',
      is_fragile BOOLEAN DEFAULT false,
      is_hazmat BOOLEAN DEFAULT false,
      requires_refrigeration BOOLEAN DEFAULT false,
      pickup_window_start TIMESTAMP WITH TIME ZONE,
      pickup_window_end TIMESTAMP WITH TIME ZONE,
      delivery_window_start TIMESTAMP WITH TIME ZONE,
      delivery_window_end TIMESTAMP WITH TIME ZONE,
      requires_liftgate BOOLEAN DEFAULT false,
      requires_loading_dock BOOLEAN DEFAULT false,
      special_instructions TEXT,
      current_location VARCHAR(255),
      actual_pickup_time TIMESTAMP WITH TIME ZONE,
      actual_delivery_time TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 3. BIDS TABLE
    CREATE TABLE IF NOT EXISTS bids (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      provider_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      amount DECIMAL NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- 4. JOB CHAT MESSAGES TABLE
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
      sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS otp VARCHAR(6);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS business_doc_url VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_sum INTEGER DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS seeker_ask DECIMAL;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS length_cm NUMERIC(10,2);
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS width_cm NUMERIC(10,2);
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS height_cm NUMERIC(10,2);
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS packaging_type VARCHAR(50) DEFAULT 'Palletized';
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_hazmat BOOLEAN DEFAULT false;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_refrigeration BOOLEAN DEFAULT false;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pickup_window_start TIMESTAMP WITH TIME ZONE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pickup_window_end TIMESTAMP WITH TIME ZONE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_window_start TIMESTAMP WITH TIME ZONE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_window_end TIMESTAMP WITH TIME ZONE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_liftgate BOOLEAN DEFAULT false;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_loading_dock BOOLEAN DEFAULT false;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS special_instructions TEXT;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_location VARCHAR(255);
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_pickup_time TIMESTAMP WITH TIME ZONE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_delivery_time TIMESTAMP WITH TIME ZONE;
    ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    ALTER TABLE bids ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
    ALTER TABLE bids ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_chat_messages_job_created
      ON chat_messages(job_id, created_at, id);
  `;

  try {
    await pool.query(queryText);
    console.log(
      "Success! All LogiMatch tables created with the definitive Milestone 2 schema.",
    );
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    pool.end();
  }
};

createTables();
