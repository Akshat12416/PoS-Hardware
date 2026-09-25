# CYGNUS-POS hardware record — 25 September 2026

This is the record of the live register test. Use these settings for the devices that passed. Do not treat the cash drawer or the card sale as finished. Those two were not proven.

Register folder:

`C:\Users\CYGNUS-POS\Desktop\southwest-farmers\PoS-Hardware\hardware-service`

The program listens on `http://127.0.0.1:3001`. The card helper listens on `http://127.0.0.1:7001`. Node on that PC was **v24.13.0**. `DEMO_MODE` was blank. Demo mode must stay off.

`config.json` and `.env` are machine files. Do not copy them from GitHub onto a register. GitHub `config.json` once contained another computer's settings, including a private terminal secret. That secret should be rotated.

## Settings that match this register

```json
{
  "printer_name": "EPSON TM-T88V ReceiptE4",
  "scale_serial_path": "COM3",
  "scale_baud_rate": 9600,
  "scale_protocol": "magellan",
  "scale_unit": "lb",
  "cash_drawer_mode": "printer",
  "cash_drawer_serial_path": "",
  "scanner_mode": "auto",
  "scanner_serial_path": "",
  "scanner_allow_keyboard_wedge": false
}
```

`.env` must repeat the printer name, or the program overwrites `config.json` on startup:

```text
PRINTER_NAME=EPSON TM-T88V ReceiptE4
CASH_DRAWER_MODE=printer
CASH_DRAWER_SERIAL_PATH=
SCALE_SERIAL_PATH=COM3
SCANNER_MODE=auto
SCANNER_SERIAL_PATH=
SCANNER_ALLOW_KEYBOARD_WEDGE=false
```

Leave the scale data bits, parity, and stop bits empty in config. The Magellan code then uses **7 data bits, even parity, 1 stop bit** by itself. An empty `SCALE_SERIAL_PATH=` in `.env` does not clear `COM3`, because that value is not applied again after the file is read. `CASH_DRAWER_MODE` and `PRINTER_NAME` are applied again, and they overwrite the file.

If the 9-pin adapter is moved to another USB socket, the COM number can change. Find it again with the Prolific name. Do not guess.

```powershell
Get-PnpDevice -PresentOnly -Class Ports | Where-Object FriendlyName -match 'Prolific'
```

## What each plug is

| Windows name | What it is | Use it |
| --- | --- | --- |
| `EPSON TM-T88V ReceiptE4` on `USB001` | The real receipt printer. Status was Normal. | Yes. Printing. |
| `EPSON TM-T88V Receipt` on `ESDPRT001` | Same driver, but the queue was Offline / NotAvailable. | No. |
| Prolific `PL2303GT` on `COM3` | 9-pin serial adapter from the Magellan to USB. | Yes. Scale. |
| `USB Serial Device` `COM4` and `COM5`, `VID_2FB8` `PID_2367` | Same USB device as the entry named `A35`. | No. Not the scale and not the handheld scanner. |
| `Ingenico Lane3600`, `VID_0B00` `PID_00A2` | The card machine. | Yes, when Elavon values are present. |
| `Ingenico Self7000 (COM22)` | Virtual COM port from that same Ingenico. | No. Do not put it in the scale or scanner settings. |
| Symbol keyboard `VID_05E0` `PID_1200` | Handheld barcode scanner. | Yes, through the keyboard listener. |
| Cherry `VID_046A` | Register keyboard. | Windows only. The program must not capture normal typing. |
| HID touch `VID_0457` | Planar touchscreen. | Windows only. |

`COM4` and `COM5` opened and stayed silent for every scale command. Leaving `scanner_serial_path` set to `COM4` makes startup fail with `Access denied` or attaches the program to the wrong device.

## Scanner — passed

The handheld scanner is a Symbol device:

- vendor `1504` (`0x05E0`)
- product `4608` (`0x1200`)
- name `Symbol Bar Code Scanner::EA`

`node-hid` can open it, then immediately reports `could not read from HID device`. Windows already owns it as a keyboard. The program must close that HID handle and listen for keystrokes instead.

The scanner types the barcode and does **not** press Enter. A real scan of the code `201650053396` produced only these key codes, then stopped:

```text
VK=50 SC=3   2
VK=48 SC=11  0
VK=49 SC=2   1
VK=54 SC=7   6
VK=53 SC=6   5
VK=48 SC=11  0
VK=48 SC=11  0
VK=53 SC=6   5
VK=51 SC=4   3
VK=51 SC=4   3
VK=57 SC=10  9
VK=54 SC=7   6
```

A fake scan sent with `SendKeys` does end in Enter, so a listener that waits for Enter accepts the fake scan and misses the real one.

The working rule is:

- Map Windows virtual-key codes directly. Do not call `ToUnicode` inside the keyboard hook. That call drops real scanner keys.
- Do not write to the console inside the hook callback. Windows removes a slow hook, which is why a scan can work once and then go silent.
- Treat a fast burst as one barcode. Finish it when Enter arrives, or when typing stops for about 150 ms.
- Ignore slow typing so the Cherry keyboard is not saved as a barcode.
- Ignore bursts shorter than 6 characters on the idle finish.

Proven result:

```text
[SCANNER] Keyboard scan received: 201650053396
GET /api/scanner/last
{ "value": "201650053396" }
```

The scale-bed scanner was dead at the start of the day: the red light stayed on and it did not beep. Later in the day it scanned. There is no separate byte log for that scanner. It is not safe to describe a second protocol for it.

Code added for this:

- `scripts/barcode-hook.ps1`
- `src/devices/scanner/scanner.winHook.js`
- `src/devices/scanner/wedgeBuffer.js`
- USB HID read failure starts the Windows hook from `scanner.service.js`

## Scale — passed

The customer display reads pounds on its own. That display is not proof that the PC received the weight. `COM3` stays silent until the program asks.

Working port settings:

- 9600 baud
- 7 data bits
- even parity
- 1 stop bit
- DTR on
- RTS on

Wrong settings do nothing useful. 8 data bits and no parity returns garbage. 2400, 4800, and 19200 with 7-even-1 returned nothing during the test.

Ask for the weight by writing this about twice a second:

```text
S11\r
```

Replies end with `\r` only, not `\n`. A reader that splits only on `\n` never sees a line.

Replies seen on this register:

| Reply | Meaning |
| --- | --- |
| `S110001` | Stable weight. `0001` is hundredths of a pound, so **0.01 lb**. |
| `S111040` | Stable weight **10.40 lb**. This matched the box on the display. |
| `S1440001` | Same stable-weight family. |
| `S140` | Not ready. |
| `S141` | Motion. Do not replace the last good weight. |
| `S142` | Under zero. |
| `S143` | Over capacity. |

Proven API result while the box was on the scale:

```json
{
  "weight": 10.4,
  "unit": "lb",
  "status": "stable",
  "connected": true,
  "path": "COM3"
}
```

The log line `Weight received` is printed only when the number changes. The first reading after startup is always printed. A restart is not required to read a new weight. Call `GET /api/scale/weight` again.

Code added for this:

- Magellan parsing in `scale.parser.js`
- CR-only line splits in `scale.buffer.js`
- 7E1, DTR/RTS, and `S11` polling in `scale.service.js`
- `scale_protocol` and `scale_unit` in `config.js`

## Receipt printer — passed

Text printing works only with this exact name:

`EPSON TM-T88V ReceiptE4`

Proven job: a receipt containing `TEST APPLE` came out of the Epson. The API returned `success: true` and `demo: false`.

`EPSON TM-T88V Receipt` looks similar and must not be used. Its port `ESDPRT001` was offline. A job sent there does not print. One test left two jobs stuck in that offline queue: a retained EMF document and a RAW job named `kick`.

The normal print path is the Windows spooler text print, not a raw ESC/POS receipt.

## Cash drawer — not solved

The drawer cable is plugged into the Epson, so the mode is `printer`, not a COM port. `cash_drawer_serial_path` stays empty.

What was tried:

1. Copying the kick bytes to `\\localhost\EPSON TM-T88V ReceiptE4` failed because the printer was not shared.
2. After sharing that printer, the API returned success. The drawer did not move and did not click.
3. A raw Windows print of the kick bytes to `ReceiptE4` reported `KICK_SENT 10`. The drawer still did not move.
4. The same raw kick sent to `EPSON TM-T88V Receipt` also reported `KICK_SENT 10`. That queue is offline, so those bytes could not reach the printer.
5. A raw job that should have printed `DRAWER TEST`, cut the paper, and kicked the drawer reported `SENT 41`. No paper came out and the drawer did not move.

So a normal text receipt reaches the printer, and a raw byte job does not. The drawer pulse is a raw byte job. Sharing the printer does not fix that.

Do not mark the drawer as working. The next attempt has to make raw bytes actually come out of `USB001`, or confirm the cable is in the printer's DK socket and the drawer key is unlocked.

`scripts/raw-print.ps1` and the raw path in `printer.windows.js` are the start of that work. They were not proven on this register.

## Card machine — not finished

The card machine is the **Ingenico Lane 3600**. The helper program is still named `pax-bridge`. That name is old. It is not a PAX sale.

Earlier in the day, `http://127.0.0.1:7001/health` showed Elavon CWS was reachable and the reader was detected. A `$1` sale was not run. `.env` did not contain `CONVERGE_SSL_VENDOR_ID`, or the merchant id, user id, and PIN. The bridge prints `CONVERGE_SSL_VENDOR_ID not set` until all four are filled. Restart only the bridge after editing `.env`. Do not commit `.env`.

`COM22` is only a virtual port created by the Ingenico. Card traffic goes through the bridge to CWS, not through `COM22`.

## How to start this register

Use two windows.

Window A, leave running:

```powershell
cd C:\Users\CYGNUS-POS\Desktop\southwest-farmers\PoS-Hardware\hardware-service
node src\hardware-service.js
```

Window B, for commands:

```powershell
cd C:\Users\CYGNUS-POS\Desktop\southwest-farmers\PoS-Hardware\hardware-service
$cfg = Get-Content .\config.json -Raw | ConvertFrom-Json
$Headers = @{ "Content-Type" = "application/json"; "x-terminal-id" = $cfg.terminal_uid; "x-agent-secret" = $cfg.agent_secret }
```

Window A is healthy when it shows all of these:

- `Connected on COM3 @ 9600 7E1 (magellan)`
- `keyboard wedge capture started`
- no `Opening COM4`
- `Hardware agent running on http://127.0.0.1:3001`

Card helper, only when the four Elavon values are present:

```powershell
node pax-bridge\server.mjs
```

## Git on this register

`config.json` is tracked, and the register's copy is different from GitHub. A pull can replace `COM3`, the printer name, and the drawer mode with another computer's values.

Before a pull, copy `config.json` aside. After the pull, put that copy back. In PowerShell, `stash@{0}` must be quoted. Without quotes PowerShell breaks the command, Git drops the saved copy, and the register settings are lost.

Do not start a second `node src\hardware-service.js` while one is already running. The second one fails with `Port 3001 is already in use` and can also report `Opening COM3: Access denied` because the first one still holds the scale.
