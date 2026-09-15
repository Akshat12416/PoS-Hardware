import "dotenv/config";
import pkg from "pg";

const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("❌ DATABASE_URL is not set");
}

// ✅ Create pool
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000
});

// ✅ Log pool errors
pool.on("error", (err) => {
  console.error("���� Unexpected PG pool error:", err);
});

// ✅ Query helper (optimized)
export async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error("❌ DB Error:", err.message);
    throw err;
  }
}

// ✅ Init DB (fixes your Render crash)
export async function initDB() {
  console.log("Initializing database...");

  await query(`
    CREATE TABLE IF NOT EXISTS active_terminals (
      id SERIAL PRIMARY KEY,
      store_id VARCHAR(255) UNIQUE NOT NULL,
      terminal_uid VARCHAR(255) NOT NULL,
      hardware_url TEXT,
      agent_secret TEXT,
      last_seen_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_active_terminals_last_seen
    ON active_terminals(last_seen_at);
  `);

  console.log("Database initialized");
}