// scripts/migrate.mjs
// Run: node scripts/migrate.mjs
import pkg from "pg";
const { Pool } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is not set.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const migrations = [
    {
        name: "create_active_terminals",
        sql: `
      CREATE TABLE IF NOT EXISTS active_terminals (
        store_id      TEXT PRIMARY KEY,
        terminal_uid  TEXT        NOT NULL,
        hardware_url  TEXT        NOT NULL,
        agent_secret  TEXT        NOT NULL,
        last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    }
];

async function run() {
    const client = await pool.connect();
    try {
        for (const m of migrations) {
            console.log(`▶ Running migration: ${m.name}`);
            await client.query(m.sql);
            console.log(`✅ Done: ${m.name}`);
        }
        console.log("✅ All migrations complete.");
    } catch (err) {
        console.error("❌ Migration failed:", err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
