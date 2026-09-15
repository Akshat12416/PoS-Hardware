import axios from "axios";
import { config } from "./config.js";

export async function registerWithCloud(publicUrl) {
  try {
    await axios.post(
      `${config.cloud_url}/api/terminals/register`,
      {
        terminal_id: config.terminal_uid,
        agent_secret: config.agent_secret,
        hardware_url: publicUrl
      },
      { timeout: 8000 }
    );

    console.log("✅ Hardware agent registered with cloud:", publicUrl);
  } catch (err) {
    console.error("❌ Failed to register agent:", err.message);
  }
}
