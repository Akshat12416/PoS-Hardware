# Postman API reference – POS hardware agent

Use two environments:

1. **Hardware (local)** – `http://127.0.0.1:3001` (no ngrok, no cloud)
2. **Cloud** – `https://pos-7mvx.onrender.com` (or the live Render URL)

## Variables

| Variable | Hardware | Cloud |
|----------|----------|--------|
| `base_url` | `http://127.0.0.1:3001` | Cloud URL |
| `x_terminal_id` | `terminal_uid` from `config.json` | not required for store-scoped proxy |
| `x_agent_secret` | `agent_secret` from `config.json` | required when store auth is on |
| `x_store_id` | not required locally | store id |

Local hardware routes need `x-terminal-id` and `x-agent-secret`. Cloud hardware proxies need `x-store-id` and look up the active terminal from heartbeat.

## Local agent

| Method | Path | Notes |
|--------|------|--------|
| GET | `/health` | No auth |
| GET | `/api/terminal/whoami` | Approval flags, no secrets |
| POST | `/api/terminal/approve` | Body `{ store_id }`, header `x-agent-secret` |
| GET | `/api/terminal/status` | Header `x-agent-secret` |
| GET | `/api/terminal/diagnostics` | Printer/scanner/scale/drawer/payment health |
| GET | `/api/printer/list` | Windows printer names |
| POST | `/api/printer/print` | Optional `printer_name` override |
| GET | `/api/scanner/status` | Real connection and `active_mode` |
| GET | `/api/scanner/last` | Last barcode |
| POST | `/api/scanner/simulate` | Lab only |
| GET | `/api/scale/status` | Real serial state |
| GET | `/api/scale/weight` | Last kg |
| GET | `/api/cash-drawer/status` | Mode from discovery |
| POST | `/api/cash-drawer/open` | serial or printer kick |
| GET | `/api/payment/status` | Ingenico/CWS flags |
| POST | `/api/payment/initiate` | `{ amount, order_id }` — wait up to 120s |
| POST | `/api/payment/cancel` | |
| POST | `/api/payment/void` | `{ ref_num }` |
| POST | `/api/payment/refund` | `{ amount, ref_num? }` |
| GET | `/api/keyboard/status` | OS-managed, not captured |
| GET | `/api/display/status` | Planar + 8300RD are not agent-driven |

Sample print body:

```json
{
  "title": "bill",
  "items": [{ "name": "Apples", "qty": 2, "price": 1.5 }],
  "total": 3
}
```

## Cloud proxy

After the agent heartbeats with `NGROK_URL`:

| Cloud path | Forwards to |
|------------|-------------|
| `GET /api/cloudprinter/list` | `/api/printer/list` |
| `POST /api/cloudprinter/print` | `/api/printer/print` |
| `GET /api/scanner/status` `/last` | scanner |
| `GET /api/scale/status` `/weight` | scale |
| `GET/POST /api/cash-drawer/*` | drawer |
| `GET /api/payment/status` | 8s timeout |
| `POST /api/payment/initiate` (and cancel/void/refund) | 120s timeout |

`POST /api/terminal/cloud-approve` forwards to the agent's `/api/terminal/approve`. It does not write `config.json` on Render.

Hosted browser checkout (`/api/converge-hpp/*`) is cloud-only and does not use the Ingenico.

## Payment naming

Live terminal: **Ingenico Lane/3600 via CWS**. Collection names may still say `pax_*` for env compatibility. Do not send A00/T00 PAX A35 frames.
