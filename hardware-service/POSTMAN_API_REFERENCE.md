# Postman API Reference – POS Hardware Agent

Use two **Environments** in Postman:

1. **Cloud** – Base URL: `https://pos-agent-33ky.onrender.com` (or your cloud URL)  
2. **Hardware (local)** – Base URL: `http://localhost:3001`

Set these **variables** in each environment:

| Variable        | Cloud env      | Hardware env (from `config.json`) |
|----------------|----------------|------------------------------------|
| `base_url`     | Cloud URL above| `http://localhost:3001`           |
| `x_store_id`   | Your store ID  | (not needed for hardware)          |
| `x_terminal_id`| (not needed)   | `terminal_uid` from config.json    |
| `x_agent_secret` | (not needed) | `agent_secret` from config.json    |

---

## 0. Integration config (PAX Android / Laravel / clients that can’t set headers)

For PAX on Android or Laravel/web clients that have trouble sending custom headers (`x-store-id`, `x-terminal-id`, `x-agent-secret`), use one of the following.

### 0.1 Fetch header values once

Call this once (e.g. after store login), then use the returned values in subsequent requests (as headers or in body).

| Field   | Value |
|--------|--------|
| Method | `GET` or `POST` |
| URL    | `{{base_url}}/api/integration-config` |
| Headers| `x-store-id`: `{{x_store_id}}` (or send `store_id` in body/query) |
| Optional | If `INTEGRATION_SECRET` is set on server: `x-integration-secret` or `Authorization: Bearer <secret>` |

**Response (200):**

```json
{
  "success": true,
  "store_id": "02b0c3e1-81c9-461e-8e92-1be0ef785b5e",
  "terminal_id": "TERM-ABC123",
  "agent_secret": "<secret>",
  "headers": {
    "x-store-id": "02b0c3e1-...",
    "x-terminal-id": "TERM-ABC123",
    "x-agent-secret": "<secret>"
  }
}
```

Use `headers` or the top-level fields when calling other cloud APIs (see **0.2**).

### 0.2 Sending credentials in body or query (no custom headers)

All cloud APIs accept integration credentials in **body** or **query** if headers are missing:

- **Body (POST):** `store_id`, `terminal_id`, `agent_secret` (or `x_store_id`, `x_terminal_id`, `x_agent_secret`)
- **Query (GET):** `store_id`, `terminal_id`, `agent_secret`

Example (Laravel / PAX): POST to `/api/cloudprinter/print` with body:

```json
{
  "store_id": "02b0c3e1-81c9-461e-8e92-1be0ef785b5e",
  "title": "bill",
  "items": [{"name": "Maggi", "qty": 2, "price": "120.00"}],
  "total": "170"
}
```

Cloud routes only require `store_id`; the server looks up the active terminal. For direct hardware agent calls, include `terminal_id` and `agent_secret` from the integration-config response.

---

## 0.5 Elavon Converge Hosted Payments (cloud — browser checkout)

No `x-store-id` required. Server env: `CONVERGE_SSL_MERCHANT_ID`, `CONVERGE_SSL_USER_ID`, `CONVERGE_SSL_PIN`, `CONVERGE_ENV=production`, `CONVERGE_API_BASE_URL=https://api.convergepay.com`.

| API | Method | URL |
|-----|--------|-----|
| Config | `GET` | `{{base_url}}/api/converge-hpp/config` |
| Checkout session | `POST` | `{{base_url}}/api/converge-hpp/checkout-session` |
| Transaction token | `POST` | `{{base_url}}/api/converge-hpp/transaction-token` |

**POST body** (minimum — add fields required by Elavon for your account): `ssl_amount`, `ssl_invoice_number`, optional `amount` (maps to `ssl_amount`). Credentials can come from env instead of body.

**Response:** use `checkout_redirect_url` when present to open the hosted payment page in a browser (production entry: [api.convergepay.com/hosted-payments](https://api.convergepay.com/hosted-payments)).

**Hardware:** `GET http://localhost:3001/api/payment/elavon-paths` explains countertop PAX vs hosted checkout.

---

## 1. Cloud API (Render / cloud server)

Base URL: `{{base_url}}` = `https://pos-agent-33ky.onrender.com`

All cloud printer calls need: **Header `x-store-id`** = `{{x_store_id}}`

### 1.1 Printer list (cloud → hardware)

| Field   | Value |
|--------|--------|
| Method | `GET` |
| URL    | `{{base_url}}/api/cloudprinter/list` |
| Headers| `x-store-id`: `{{x_store_id}}` |

**Example:**  
`GET https://pos-agent-33ky.onrender.com/api/cloudprinter/list`  
Header: `x-store-id: 02b0c3e1-81c9-461e-8e92-1be0ef785b5e`

---

### 1.2 Print receipt (cloud → hardware)

| Field   | Value |
|--------|--------|
| Method | `POST` |
| URL    | `{{base_url}}/api/cloudprinter/print` |
| Headers| `x-store-id`: `{{x_store_id}}`<br>`Content-Type`: `application/json` |
| Body   | Raw → JSON (see below) |

**Body (raw JSON):**

```json
{
  "title": "bill",
  "items": [
    {
      "name": "Maggi",
      "qty": 2,
      "price": "120.00"
    }
  ],
  "total": "170"
}
```

`total`, `qty`, and `price` can be numbers or numeric strings.

---

### 1.3 Elavon Payments API (cloud → `api.sandbox.elavonpayments.com`)

No `x-store-id` required. Configure env on the **cloud** server (`ELAVON_*`).  
If `ELAVON_PAYMENTS_SERVER_SECRET` is set, send header **`x-elavon-payments-secret`** (or `Authorization: Bearer` same value) on **`POST /gateway`** only.

| API    | Method | URL | Body |
|--------|--------|-----|------|
| Config | `GET`  | `{{base_url}}/api/elavon-payments/config` | — |
| Gateway| `POST` | `{{base_url}}/api/elavon-payments/gateway` | See below |

**POST /gateway body** (shape only — `path` / `json` must match [Elavon Hosted Payment Page / Payments API reference](https://developer.elavon.com/products/hosted-payment-page/v1/api-reference)):

```json
{
  "method": "POST",
  "path": "/v1/example-from-docs",
  "json": { }
}
```

Set **`ELAVON_PAYMENTS_PATH_PREFIX_ALLOWLIST`** on the server so only documented path prefixes are allowed. If Elavon returns 401, try **`ELAVON_AUTH_MODE=bearer_sk`** in env (see `.env.production.example`).

---

### 1.4 Heartbeat (hardware → cloud)

| Field   | Value |
|--------|--------|
| Method | `POST` |
| URL    | `{{base_url}}/api/cloud/heartbeat` |
| Headers| `x-terminal-id`: `{{x_terminal_id}}`<br>`x-agent-secret`: `{{x_agent_secret}}`<br>`Content-Type`: `application/json` |
| Body   | Raw → JSON |

**Body:**

```json
{
  "store_id": "{{x_store_id}}",
  "hardware_url": "https://your-ngrok-url.ngrok.io"
}
```

---

## 2. Hardware Agent API (local, port 3001)

Base URL: `{{base_url}}` = `http://localhost:3001`

**Common headers for all hardware APIs below (except Health):**  
- `x-terminal-id`: `{{x_terminal_id}}`  
- `x-agent-secret`: `{{x_agent_secret}}`

**Printer** routes also need signed headers (see **2.2**).

---

### 2.1 Health (no auth)

| Field   | Value |
|--------|--------|
| Method | `GET` |
| URL    | `{{base_url}}/health` |
| Headers| None |

---

### 2.2 Printer (need signature headers)

Printer list and print use **cryptographic auth**:  
`X-Terminal-UID`, `X-Timestamp`, `X-Signature`.

**Headers:**

- `X-Terminal-UID`: same as `terminal_uid` in config (e.g. `TERM-2B02D153AF6C`)
- `X-Timestamp`: current time in milliseconds (e.g. `1738580123456`)
- `X-Signature`: HMAC-SHA256 hex of:  
  `terminal_uid + "|" + timestamp + "|" + METHOD + "|" + path`  
  using `agent_secret` as key.

**Option A – Generate signature locally and paste into Postman**

From project root (`hardware-service`):

```bash
node scripts/generate-printer-headers.js GET /api/printer/list
```

For print:

```bash
node scripts/generate-printer-headers.js POST /api/printer/print
```

Copy the printed `X-Terminal-UID`, `X-Timestamp`, and `X-Signature` into Postman headers (create new headers with these names). Re-run the script for each request (timestamp must be within ±30s).

**Option B – Postman Pre-request script (signature)**

In the request’s **Pre-request Script** tab, set:

- **Request method** and **path** to match the request (e.g. GET, `/api/printer/list`).

If your Postman has `pm.variables.replaceIn()` and you can run `crypto` (e.g. Postman Node sandbox), you can compute the signature there; otherwise use Option A.

---

#### 2.2.1 Printer list

| Field   | Value |
|--------|--------|
| Method | `GET` |
| URL    | `{{base_url}}/api/printer/list` |
| Headers| As in **2.2** (signature or x-terminal-id + x-agent-secret) |

---

#### 2.2.2 Print receipt

| Field   | Value |
|--------|--------|
| Method | `POST` |
| URL    | `{{base_url}}/api/printer/print` |
| Headers| As in **2.2**<br>`Content-Type`: `application/json` |
| Body   | Raw → JSON (same shape as **1.2**) |

**Body:**

```json
{
  "title": "bill",
  "items": [
    { "name": "Maggi", "qty": 2, "price": "120.00" }
  ],
  "total": "170"
}
```

---

### 2.3 Scanner (Zebra DS2278)

Headers: `x-terminal-id`, `x-agent-secret` (no signature).

| API    | Method | URL | Body |
|--------|--------|-----|------|
| Status | `GET`  | `{{base_url}}/api/scanner/status` | — |
| Last scan | `GET`  | `{{base_url}}/api/scanner/last` | — |
| Simulate scan | `POST` | `{{base_url}}/api/scanner/simulate` | Raw JSON below |

**Body for Simulate:**

```json
{
  "value": "5901234123457"
}
```

---

### 2.4 Scale (Datalogic / Remote Weight)

Headers: `x-terminal-id`, `x-agent-secret`.

| API    | Method | URL | Body |
|--------|--------|-----|------|
| Status | `GET`  | `{{base_url}}/api/scale/status` | — |
| Weight | `GET`  | `{{base_url}}/api/scale/weight` | — |

---

### 2.5 Cash drawer (M-S CF-405BX-M-B)

Headers: `x-terminal-id`, `x-agent-secret`.

| API  | Method | URL | Body |
|------|--------|-----|------|
| Status | `GET`  | `{{base_url}}/api/cash-drawer/status` | — |
| Open | `POST` | `{{base_url}}/api/cash-drawer/open` | — (no body) |

---

### 2.6 Payment (PAX A35 via bridge)

Headers: `x-terminal-id`, `x-agent-secret`.

| API     | Method | URL | Body |
|---------|--------|-----|------|
| Elavon config | `GET` | `{{base_url}}/api/payment/elavon-config` | — |
| Status  | `GET`  | `{{base_url}}/api/payment/status` | — |
| Initiate| `POST` | `{{base_url}}/api/payment/initiate` | `amount`, `currency`, `order_id` (pax-bridge → CWS; requires `CONVERGE_SSL_VENDOR_ID`) |
| Cancel  | `POST` | `{{base_url}}/api/payment/cancel` | — |

---

### 2.6a Terminal diagnostics

Headers: `x-terminal-id`, `x-agent-secret`.

| API | Method | URL | Body |
|-----|--------|-----|------|
| Summary | `GET` | `{{base_url}}/api/terminal/diagnostics` | — |

---

### 2.7 Keyboard (Cherry SPOS)

| Field   | Value |
|--------|--------|
| Method | `GET` |
| URL    | `{{base_url}}/api/keyboard/status` |
| Headers| `x-terminal-id`, `x-agent-secret` |

---

### 2.8 Display (Touchscreen / Remote Weight screen)

| Field   | Value |
|--------|--------|
| Method | `GET` |
| URL    | `{{base_url}}/api/display/status` |
| Headers| `x-terminal-id`, `x-agent-secret` |

---

## Quick copy-paste (Cloud)

**Printer list:**  
`GET` `https://pos-agent-33ky.onrender.com/api/cloudprinter/list`  
Header: `x-store-id: YOUR_STORE_ID`

**Print:**  
`POST` `https://pos-agent-33ky.onrender.com/api/cloudprinter/print`  
Headers: `x-store-id: YOUR_STORE_ID`, `Content-Type: application/json`  
Body (raw JSON):

```json
{
  "title": "bill",
  "items": [ { "name": "Maggi", "qty": 2, "price": "120.00" } ],
  "total": "170"
}
```

---

## Quick copy-paste (Hardware – local)

Use `http://localhost:3001` and set headers:  
`x-terminal-id`: value of `terminal_uid` from `config.json`  
`x-agent-secret`: value of `agent_secret` from `config.json`

- Scanner last: `GET` `http://localhost:3001/api/scanner/last`
- Scanner simulate: `POST` `http://localhost:3001/api/scanner/simulate` → Body: `{"value":"5901234123457"}`
- Scale weight: `GET` `http://localhost:3001/api/scale/weight`
- Cash drawer status: `GET` `http://localhost:3001/api/cash-drawer/status`
- Cash drawer open: `POST` `http://localhost:3001/api/cash-drawer/open`
- Payment status: `GET` `http://localhost:3001/api/payment/status`
- Terminal diagnostics: `GET` `http://localhost:3001/api/terminal/diagnostics`
- Keyboard status: `GET` `http://localhost:3001/api/keyboard/status`
- Display status: `GET` `http://localhost:3001/api/display/status`

Printer list/print on hardware need the same signature as in **2.2** (or only the two headers if your app doesn’t use `verifyAgent` for printer).
