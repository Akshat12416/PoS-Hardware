# Cash drawer discovery

Do not assume `COM5`. Confirm the cable before setting `cash_drawer_mode`.

## What to look at

1. Follow the cable from the M-S CF-405BX-M-B till.
2. If it plugs into the **Epson TM-T88V RJ11/RJ12 kick port**, use printer kick.
3. If it plugs into a **USB-serial or COM adapter on the PC**, use serial mode.
4. Run `scripts/list-com-ports.ps1` and `scripts/list-printers.ps1` and record the result.

## Config

Printer kick (typical with Epson):

```json
"cash_drawer_mode": "printer",
"printer_name": "EPSON TM-T88V Receipt"
```

Direct serial:

```json
"cash_drawer_mode": "serial",
"cash_drawer_serial_path": "COMx",
"cash_drawer_baud_rate": 9600
```

Leave `cash_drawer_mode` as `unconfigured` until this is confirmed. `POST /api/cash-drawer/open` will refuse to guess.

## Pass/fail

- `GET /api/cash-drawer/status` shows `configured: true` and the chosen mode.
- `POST /api/cash-drawer/open` physically opens the drawer.
- If printer kick fails, confirm the printer is shared / the Windows printer name matches exactly, then retry serial only if a COM device is present.
