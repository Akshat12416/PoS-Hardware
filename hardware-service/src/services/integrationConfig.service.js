/**
 * Integration config service: resolves store/terminal/agent credentials for clients
 * that need to set x-store-id, x-terminal-id, x-agent-secret (e.g. PAX Android, Laravel).
 */
import { getActiveTerminalForStore } from "../utils/hardwareRegistry.js";

/**
 * Returns integration headers for a store so clients can use them in subsequent API calls.
 * @param {string} storeId - Store UUID
 * @returns {Promise<{ store_id: string, terminal_id: string, agent_secret: string } | null>}
 *   Header values for the store's active terminal, or null if none
 */
export async function getIntegrationConfigForStore(storeId) {
  if (!storeId || typeof storeId !== "string") {
    return null;
  }
  const terminal = await getActiveTerminalForStore(storeId.trim());
  if (!terminal) {
    return null;
  }
  return {
    store_id: storeId.trim(),
    terminal_id: terminal.terminal_uid,
    agent_secret: terminal.agent_secret
  };
}