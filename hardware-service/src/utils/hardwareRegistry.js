// src/utils/hardwareRegistry.js
import { query } from "../db.js";

/**
 * Store or update heartbeat
 */
export async function registerHeartbeat({
  terminal_uid,
  store_id,
  hardware_url,
  agent_secret
}) {
  await query(
    `
    INSERT INTO active_terminals
      (store_id, terminal_uid, hardware_url, agent_secret, last_seen_at)
    VALUES
      ($1, $2, $3, $4, NOW())
    ON CONFLICT (store_id)
    DO UPDATE SET
      terminal_uid = EXCLUDED.terminal_uid,
      hardware_url = EXCLUDED.hardware_url,
      agent_secret = EXCLUDED.agent_secret,
      last_seen_at = NOW()
    `,
    [store_id, terminal_uid, hardware_url, agent_secret]
  );

  return true;
}

export async function cleanupStaleTerminals() {
  try {
    await query(`
      DELETE FROM active_terminals
      WHERE last_seen_at < NOW() - INTERVAL '5 minutes'
    `);
  } catch (err) {
    // Cleanup is best-effort; do not crash the service on transient DB drops.
    console.error("Cleanup stale terminals failed:", err.message);
    return false;
  }

  return true;
}

/**
 * Get active terminal by store_id (5-minute TTL)
 */
export async function getActiveTerminalForStore(store_id) {
  const { rows } = await query(
    `
    SELECT terminal_uid, hardware_url, agent_secret, last_seen_at
    FROM active_terminals
    WHERE store_id = $1
      AND last_seen_at > NOW() - INTERVAL '5 minutes'
    `,
    [store_id]
  );

  return rows[0] || null;
}

/**
 * Get active terminal by terminal_uid (5-minute TTL)
 * Used for cloud-approve before a store_id is assigned.
 */
export async function getTerminalByUid(terminal_uid) {
  const { rows } = await query(
    `
    SELECT terminal_uid, store_id, hardware_url, agent_secret, last_seen_at
    FROM active_terminals
    WHERE terminal_uid = $1
      AND last_seen_at > NOW() - INTERVAL '5 minutes'
    `,
    [terminal_uid]
  );

  return rows[0] || null;
}

/** Lookup without heartbeat TTL — used to prevent store/terminal hijacking. */
export async function getTerminalRecordByStore(store_id) {
  const { rows } = await query(
    `SELECT terminal_uid, store_id, hardware_url, agent_secret, last_seen_at
     FROM active_terminals WHERE store_id = $1`,
    [store_id]
  );
  return rows[0] || null;
}

export async function getTerminalRecordByUid(terminal_uid) {
  const { rows } = await query(
    `SELECT terminal_uid, store_id, hardware_url, agent_secret, last_seen_at
     FROM active_terminals WHERE terminal_uid = $1`,
    [terminal_uid]
  );
  return rows[0] || null;
}
