import axios from "axios";
import os from "os";
import fs from "fs";
import { config, CONFIG_PATH } from "./config.js";

// ==============================
// REGISTER TERMINAL WITH CLOUD
// ==============================
export async function registerTerminal() {
  try {
    // ==============================
    // HARD GUARDS
    // ==============================
    if (!config.terminal_uid || !config.agent_secret) {
      throw new Error("Missing terminal identity or agent secret");
    }

    if (!config.cloud_url) {
      throw new Error("cloud_url not configured");
    }

    // Already registered & approved → nothing to do
    if (config.registered && config.approved && config.store_id) {
      console.log("✅ Terminal already registered & approved:", config.terminal_uid);
      return true;
    }

    console.log("���� Registering terminal with cloud...");
    console.log("→ terminal_uid:", config.terminal_uid);
    console.log("→ hostname:", os.hostname());
    console.log("→ platform:", `${os.platform()} ${os.release()}`);

    // ==============================
    // CALL CLOUD API
    // ==============================
    const res = await axios.post(
      `${config.cloud_url}/api/terminals/register`,
      {
        terminal_id: config.terminal_uid,
        agent_secret: config.agent_secret,
        hostname: os.hostname(),
        platform: `${os.platform()} ${os.release()}`,
        arch: os.arch()
      },
      {
        timeout: 8000,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    const data = res.data || {};

    console.log("☁️ Cloud response:", JSON.stringify(data));

    // ==============================
    // UPDATE LOCAL CONFIG
    // ==============================
    const updated = {
      ...config,

      store_id: data.store_id || null,

      registered: true,
      approved: data.status === "approved",

      last_cloud_sync_at: new Date().toISOString()
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
    Object.assign(config, updated);

    // ==============================
    // ENFORCE APPROVAL
    // ==============================
    if (!updated.approved || !updated.store_id) {
      console.log("⛔ Terminal not approved or store not assigned.");
      console.log("→ approved:", updated.approved);
      console.log("→ store_id:", updated.store_id);
      console.log("→ Hardware remains LOCKED.");
      return false;
    }

    console.log("✅ Terminal approved for store:", updated.store_id);
    return true;

  } catch (err) {
    const msg =
      err.response?.data?.message ||
      err.message ||
      "Terminal registration failed";

    console.error("❌ Terminal registration error:", msg);

    // Do NOT mutate config on failure
    return false;
  }
}
