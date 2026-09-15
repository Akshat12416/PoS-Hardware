Unused adapters removed from the live import graph.

Active implementations:
- printer: src/devices/printer/printer.windows.js
- scale: src/devices/scale/scale.service.js
- terminal approval: src/routes/localTerminal.routes.js (agent) and src/routes/terminal.routes.js (cloud-approve)
- heartbeat: src/routes/cloudHeartbeat.routes.js

The previous USB/network ESC/POS printer modules, side-effect scale.serial.js, local-agent.js, cloud.routes.js, and register.js are now stubs so they cannot open COM ports or call missing endpoints by accident.
