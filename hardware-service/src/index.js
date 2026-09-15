import app from "./server.js";
import { initDB } from "./db.js";
import { cleanupStaleTerminals } from "./utils/hardwareRegistry.js";
import { assertCloudProductionSecurity } from "./config/production.js";

const PORT = process.env.PORT || 10000;
const DB_RETRY_MS = 15000;

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error("Unhandled promise rejection:", message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});

async function start() {
  try {
    assertCloudProductionSecurity();
  } catch (err) {
    console.error("Production security check failed:", err.message);
    process.exit(1);
  }

  let dbReady = false;

  async function ensureDbReady() {
    try {
      await initDB();
      if (!dbReady) {
        console.log("Database connection established");
      }
      dbReady = true;
    } catch (err) {
      dbReady = false;
      console.error("Database initialization failed, will retry:", err.message);
    }
  }

  await ensureDbReady();

  const server = app.listen(PORT, () => {
    console.log(`Cloud API running on port ${PORT}`);
  });

  setInterval(async () => {
    if (!dbReady) {
      await ensureDbReady();
    }
  }, DB_RETRY_MS);

  setInterval(async () => {
    try {
      if (!dbReady) {
        return;
      }
      await cleanupStaleTerminals();
    } catch (err) {
      console.error("Failed to clean up stale terminals:", err.message);
      dbReady = false;
    }
  }, 60_000);

  const shutdown = () => server.close();
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Cloud API failed to start:", err.message);
  process.exit(1);
});
