import { config } from "../config.js";

/**
 * ----------------------------------------------------
 * Middleware: requireApprovedTerminal
 * ----------------------------------------------------
 * Blocks all hardware routes unless:
 * 1) Terminal is registered with cloud
 * 2) Terminal is approved by admin
 * 3) Terminal is assigned to a store
 * ----------------------------------------------------
 */
export function requireApprovedTerminal(req, res, next) {
  // 1) Terminal identity must exist
  if (!config.terminal_uid) {
    return res.status(401).json({
      success: false,
      message: "Terminal identity not initialized"
    });
  }

  // 2) Must be registered with cloud
  if (!config.registered) {
    return res.status(401).json({
      success: false,
      message: "Terminal not registered with cloud"
    });
  }

  // 3) Must be approved by admin
  if (!config.approved) {
    return res.status(403).json({
      success: false,
      message: "Terminal not approved by admin"
    });
  }

  // 4) Must be assigned to a store
  if (!config.store_id) {
    return res.status(403).json({
      success: false,
      message: "Terminal not assigned to any store"
    });
  }

  // 5) Attach terminal context for downstream routes
  req.terminal = {
    terminal_uid: config.terminal_uid,
    store_id: config.store_id
  };

  next();
}
