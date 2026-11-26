require('dotenv').config();
const { Pool } = require('pg');

// Pull a clean postgres:// address out of the setting, even if stray quotes,
// spaces or a "DATABASE_URL=" prefix were pasted along with it
function cleanDatabaseUrl(raw) {
  const match = String(raw || '').match(/postgres(?:ql)?:\/\/[^\s'"]+/);
  return match ? match[0].replace('sslmode=require', 'sslmode=verify-full') : '';
}

const connectionString = cleanDatabaseUrl(process.env.DATABASE_URL);
if (!connectionString) {
  console.error('DATABASE_URL is missing or is not a postgresql:// address.');
  process.exit(1);
}
try {
  console.log('Database host:', new URL(connectionString).hostname);
} catch {
  console.error('DATABASE_URL could not be read. Re-paste it from Neon.');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Without this, a dropped idle connection could crash the whole server
pool.on('error', (err) => console.error('Database pool error:', err.message));

module.exports = pool;