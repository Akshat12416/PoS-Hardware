# Hardware test results

## Automated (this repository)

| Check | Result | Notes |
|-------|--------|-------|
| `npm test` | pending run | node:test unit suite |
| `node --check` on agent/cloud entrypoints | pending run | syntax |
| Physical Windows POS devices | not run in this environment | requires the store register |

## Physical ladder (fill in on the POS PC)

| Step | Result | Evidence |
|------|--------|----------|
| Printer list / print | | |
| Scanner last barcode | | |
| Scale weight | | |
| Drawer open mode | serial / printer / fail | |
| Payment status (CWS + reader) | | |
| $1.00 sale / cancel / decline | | |
| Cloud forward after local pass | | |
| Reboot recovery | | |

Copy request IDs from `npm run smoke:local` into this table.
