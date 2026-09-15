# Ingenico Lane/3600 and Elavon CWS

Countertop payments use **Ingenico Lane/3600** (USB) with **Elavon Commerce Web Services (CWS)** on the POS PC.

PAX A35 is a legacy config path only (`PAYMENT_TERMINAL_TYPE=pax`). Ingenico USB is the supported live path.

## Hardware

| Item | Value |
|------|--------|
| Terminal | Ingenico Lane/3600 — `LAN360-USPOS16A` |
| Connection | USB to Windows POS PC |
| Local agent | `http://127.0.0.1:3001` |
| Payment bridge | `http://127.0.0.1:7001` |
| CWS | `https://localhost:9790/rest/command` |

## Architecture

```
POS app or Postman
  -> local hardware agent (:3001)   [no cloud required]
  -> pax-bridge (:7001)
  -> CWS (:9790)
  -> Ingenico USB
  -> Elavon Converge
```

Cloud forwarding is optional:

```
POS app -> Cloud API -> ngrok -> hardware agent -> bridge -> CWS -> Ingenico
```

Card authorization still needs connectivity to Elavon even when the store server is local.

## POS PC setup

1. Install Node 18.
2. Install **CommerceWebServicesSetup.exe** and ConvergeConnect.
3. Connect Ingenico via USB, power on, tray → Refresh Devices.
4. Copy `.env.example` to `.env` and set `CONVERGE_SSL_MERCHANT_ID`, `CONVERGE_SSL_USER_ID`, `CONVERGE_SSL_PIN`, `CONVERGE_SSL_VENDOR_ID`.
5. Copy `config.template.json` to `config.json`. For lab tests set `approved: true` and a `store_id`. Set `pax_enabled: true` and `pax_bridge_url: "http://127.0.0.1:7001"`.
6. Start both processes:

```powershell
npm run start:pax-bridge
npm run start:hardware
npm run test:cws
```

Or double-click `packaging/run-all.bat`.

Do not rely on `pkg` / `pos-hardware-agent.exe` until native `serialport` and `node-hid` are validated on that PC.

## Environment

| Variable | Value |
|----------|--------|
| `PAYMENT_TERMINAL_TYPE` | `ingenico` |
| `PAYMENT_TERMINAL_CONNECTION` | `usb` |
| `CWS_AUTO_CONFIGURE_READER` | `false` |
| `PAX_BRIDGE_URL` | `http://127.0.0.1:7001` |
| `PAX_TIMEOUT_MS` | `120000` |

`pax_*` names are legacy aliases. User-facing logs and diagnostics say payment / Ingenico / CWS.

## Local APIs (headers `x-terminal-id` + `x-agent-secret`)

| Route | Description |
|-------|-------------|
| `GET /api/payment/status` | Bridge, CWS, reader, gateway as separate flags |
| `POST /api/payment/initiate` | Sale (`amount`, `order_id`) — wait up to 120s |
| `POST /api/payment/cancel` | Cancel in-flight transaction |
| `POST /api/payment/void` | Void by `ref_num` |
| `POST /api/payment/refund` | Refund |

Never simulate an approval in this service. Use Elavon-approved test cards and a controlled low-value sale.

## Test order

1. `GET http://127.0.0.1:7001/health` — `cws_reachable`, `reader_detected`
2. `GET http://127.0.0.1:3001/api/payment/status`
3. `POST /api/payment/initiate` with `{"amount":1.00,"order_id":"HW-TEST-1"}`
4. Decline path with a decline test card if available
5. Cancel while the terminal is prompting
6. Void/refund only with approved test procedures

Cloud `POST /api/payment/initiate` uses a 120s forward timeout so the Ingenico prompt is not cut off at 8s.
