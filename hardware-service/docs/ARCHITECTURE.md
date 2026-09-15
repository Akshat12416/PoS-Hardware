# Hardware vs future store server

This repository is the **per-POS hardware agent**. It must stay transport-neutral.

```
POS app
  -> future dedicated store server (catalog, orders, queue, cloud sync)
  -> this hardware agent on each register
  -> printer / scanner / scale / drawer / Ingenico

Standby POS can later host a second store-server process.
That is not implemented here.
```

## This repo owns

- Local device drivers and truthful diagnostics
- `GET/POST /api/printer|scanner|scale|cash-drawer|payment`
- Optional cloud proxy that forwards to `{hardware_url}/api/...`

## This repo does not own

- Product catalog, carts, or staff login
- Offline checkout or Square fallback
- Multi-terminal primary/standby election
- Store-wide database sync to Render

Local tests talk to `http://127.0.0.1:3001` and do not need ngrok, Render, or Postgres.
The future store server should call those same agent URLs on the LAN.
