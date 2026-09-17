# Southwest Farmers hardware agent

Local Windows agent plus optional cloud proxy so the Southwest Farmers POS can print, scan, weigh, open the till, and take Ingenico/Elavon payments.

Local tests talk to `http://127.0.0.1:3001`. They do not need ngrok, Render, or Postgres.

## Start on a register

## Software demo (no hardware)

```powershell
npm test
npm run demo
```

This starts the agent with `DEMO_MODE=true`, runs scan → weigh → pay → print → drawer using fake devices, then stops. Demo payments are labeled and are not sent to Elavon.

On this Mac/Linux computer that is the right first check. Real Epson/Zebra/Magellan/Ingenico still needs a Windows POS.

See [docs/HARDWARE_TEST_LADDER.md](docs/HARDWARE_TEST_LADDER.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Future store-server work (offline POS, primary/standby PC, Square fallback) is out of this repo. This agent only owns attached hardware.
