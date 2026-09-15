#!/usr/bin/env node

(async () => {
  try {
    await import("./src/hardware-service.js");
  } catch (err) {
    console.error("Failed to start hardware service:", err?.message || err);
    process.exit(1);
  }
})();
