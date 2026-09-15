# Ingenico Terminal & Elavon CWS Integration

Countertop payments use **Ingenico Lane/3600** (USB) with **Elavon Commerce Web Services (CWS)** on the POS PC.

> **Note:** PAX A35 was replaced — PAX is not native to Commerce SDK. Ingenico is the supported path.

## Hardware

| Item | Value |
|------|--------|
| **Terminal** | Ingenico Lane/3600 — `LAN360-USPOS16A` |
| **Part #** | TRK7031 |
| **Serial** | 2323673 (update in config if different unit) |
| **Connection** | USB to Windows POS PC |
| **Processor MID** | 8045535591 (on device sticker; demo Converge account: 0022957) |

## Architecture

```
POS app → Cloud API → hardware agent (3001) → pax-bridge (7001) → CWS (9790) → Ingenico → Converge
```

## POS PC setup

1. Install **CommerceWebServicesSetup.exe** ([CWS docs](https://developer.elavon.com/products/commerce-sdk/v1/cws#install-cws))
2. Connect Ingenico via **USB**, power on
3. ConvergeConnect tray → **Refresh Devices** → Reader should show Ingenico
4. Set `.env`: Converge creds + `CONVERGE_SSL_VENDOR_ID` (from Elavon)
5. Start:

```powershell
npm run start:pax-bridge
npm run start:hardware
npm run test:cws
```

## Key environment variables

| Variable | Value |
|----------|--------|
| `PAYMENT_TERMINAL_TYPE` | `ingenico` |
| `PAYMENT_TERMINAL_MODEL` | `LAN360-USPOS16A` |
| `PAYMENT_TERMINAL_SERIAL` | Device serial |
| `PAYMENT_TERMINAL_CONNECTION` | `usb` |
| `CWS_AUTO_CONFIGURE_READER` | `false` (USB — no IP config) |
| `CONVERGE_SSL_VENDOR_ID` | From Elavon (required) |
| `PAX_BRIDGE_URL` | `http://127.0.0.1:7001` |
| `PAX_TIMEOUT_MS` | `120000` |

## API routes

| Route | Description |
|-------|-------------|
| `GET /api/payment/status` | CWS + Ingenico reader status |
| `POST /api/payment/initiate` | Sale (`amount`, `order_id`) |
| `POST /api/payment/cancel` | Cancel in-flight transaction |

## Files

- `pax-bridge/` — CWS bridge (name kept for compatibility)
- `pax-bridge/cwsPayment.mjs` — Ingenico-aware CWS orchestration
- `src/devices/payment/pax.service.js` — Hardware agent → bridge

## Support

- Elavon: 800-377-3962 (option 2, option 2)
- CWS docs: https://developer.elavon.com/products/commerce-sdk/v1/cws
