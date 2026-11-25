require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Without this, a dropped idle connection could crash the whole server
pool.on('error', (err) => console.error('Database pool error:', err.message));

module.exports = pool;