const pool = require('./db');

const createTables = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_provider BOOLEAN NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id SERIAL PRIMARY KEY,
      seeker_id INTEGER REFERENCES users(id),
      origin VARCHAR(255) NOT NULL,
      destination VARCHAR(255) NOT NULL,
      weight_kg DECIMAL NOT NULL,
      status VARCHAR(50) DEFAULT 'open'
    );

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
    console.log('Success! All LogiMatch tables created.');
  } catch (error) {
    console.error('Error creating tables:', error);
  } finally {
    // This safely closes the bridge so the script can finish
    pool.end(); 
  }
};

createTables();