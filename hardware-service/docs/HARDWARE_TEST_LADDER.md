# Hardware test ladder

Run on one Windows POS with internet available. Local agent tests do not need ngrok.

## 0. Machine prep

1. Install Node 18, Epson driver, Elavon CWS / ConvergeConnect.
2. Connect printer, Zebra scanner, Magellan scale, drawer, Ingenico USB, Cherry keyboard, Planar display.
3. Copy `config.template.json` → `config.json` and `.env.example` → `.env`.
4. For lab use set `approved: true` and a real `store_id`.
5. Rotate the agent secret if it was ever shared: `node scripts/rotate-agent-secret.mjs`.
6. Record actual device identity:

```powershell
powershell -File scripts/list-printers.ps1
powershell -File scripts/list-com-ports.ps1
```

Fill `printer_name`, scale COM, scanner mode/VID-PID or COM, and `cash_drawer_mode` from [CASH_DRAWER_DISCOVERY.md](CASH_DRAWER_DISCOVERY.md).

## 1. Start local processes

```powershell
npm install
npm run start:pax-bridge
npm run test:cws
npm run start:hardware
```

Or `packaging\run-all.bat`.

Pass: `GET http://127.0.0.1:3001/health` returns `approved: true`.  
Pass: `GET http://127.0.0.1:7001/health` returns distinct `cws_reachable` / `reader_detected` flags.

## 2. Diagnostics

Headers: `x-terminal-id`, `x-agent-secret` from `config.json`.

`GET /api/terminal/diagnostics`

Pass: printer/scanner/scale/drawer show real `connected`/`configured` state, not hardcoded true.

## 3. Device tests (physical result required)

| Order | Device | Call | Pass |
|-------|--------|------|------|
| 1 | Scanner | Scan, then `GET /api/scanner/last` | Correct barcode; status `active_mode` is serial or usb_hid, not the Cherry keyboard |
| 2 | Scale | Place item, `GET /api/scale/weight` | Weight updates; `connected: true` |
| 3 | Printer | `POST /api/printer/print` sample items | Receipt on the configured Epson |
| 4 | Drawer | `POST /api/cash-drawer/open` | Till opens via the discovered mode |
| 5 | Keyboard/display | `GET /api/keyboard/status`, `/api/display/status` | `agent_integrated: false` |
| 6 | Ingenico | `POST /api/payment/initiate` `{"amount":1.00,"order_id":"HW-TEST-1"}` | Terminal prompts; approve/decline JSON; no fake approval |

Then one local checkout sequence: scan → weigh → pay → print → open drawer if cash.

## 4. Cloud path (only after local pass)

1. Start ngrok to port 3001 and set `NGROK_URL`.
2. Confirm heartbeat logs success against `cloud_url`.
3. Repeat printer, scanner, scale, drawer, payment through the cloud URL with `x-store-id`.
4. Card sale through cloud must wait for the Ingenico prompt (120s timeout, not 8s).

## 5. Recovery

Reboot the POS, start `run-all.bat`, unplug/replug scale or scanner, and confirm diagnostics recover without a false `connected: true`.
