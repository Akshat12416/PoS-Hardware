# Southwest Farmers hardware agent

Local Windows agent plus optional cloud proxy so the Southwest Farmers POS can print, scan, weigh, open the till, and take Ingenico/Elavon payments.

Local tests talk to `http://127.0.0.1:3001`. They do not need ngrok, Render, or Postgres.

## Start on a register

```powershell
copy config.template.json config.json
copy .env.example .env
npm install
npm test
npm run start:pax-bridge
npm run start:hardware
npm run smoke:local
```

See [docs/HARDWARE_TEST_LADDER.md](docs/HARDWARE_TEST_LADDER.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Future store-server work (offline POS, primary/standby PC, Square fallback) is out of this repo. This agent only owns attached hardware.
