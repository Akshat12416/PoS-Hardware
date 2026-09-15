# Hardware test results

## Automated (this repository)

| Check | Result | Notes |
|-------|--------|-------|
| `npm test` | pass (19/19) | receipt, scale parse, scanner buffer/HID decode, config validation, auth headers, fetch timeouts |
| Local agent HTTP smoke | pass (13/13) | `node scripts/smoke-local.mjs` against `http://127.0.0.1:3001` |
| Truthful diagnostics | pass | Scale/scanner `connected: false` with COM open errors; keyboard `agent_integrated: false`; payment `bridge_reachable: false` without CWS |
| Physical Windows POS devices | not run here | Mac/Linux runner has no Epson/Zebra/Magellan/Ingenico |

## Physical ladder (fill in on the POS PC)

| Step | Result | Evidence |
|------|--------|----------|
| Printer list / print | pending | |
| Scanner last barcode | pending | |
| Scale weight | pending | |
| Drawer open mode | pending | serial / printer / fail |
| Payment status (CWS + reader) | pending | |
| $1.00 sale / cancel / decline | pending | |
| Cloud forward after local pass | pending | |
| Reboot recovery | pending | |

Copy request IDs from `npm run smoke:local` into this table. Follow [HARDWARE_TEST_LADDER.md](HARDWARE_TEST_LADDER.md).
