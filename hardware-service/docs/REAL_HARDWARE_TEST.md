# Live hardware test on the CYGNUS-POS register

The computer setup is already done. This file is the call script.

You drive the PC. He only plugs, scans, weighs, and watches. After each step, paste the result into the chat. Do not paste `.env` or `agent_secret`.

## Already done

- Project folder: `C:\Users\CYGNUS-POS\Desktop\southwest-farmers\PoS-Hardware\hardware-service`
- `config.json` is the lab file: approved, store `STORE-LAB`, printer `EPSON TM-T88V Receipt`, card helper on, scale port empty, drawer `unconfigured`
- Demo mode is off
- Hardware program is open: `http://127.0.0.1:3001/health` shows OK
- Card helper is open: `http://127.0.0.1:7001/health` shows the Ingenico is seen
- `.env` exists but the four Elavon passwords are still empty. The card test is last
- PowerShell already has the login block loaded. If you close that window, paste this again before any device command:

```powershell
cd C:\Users\CYGNUS-POS\Desktop\southwest-farmers\PoS-Hardware\hardware-service
$cfg = Get-Content .\config.json -Raw | ConvertFrom-Json
$Headers = @{
  "Content-Type" = "application/json"
  "x-terminal-id" = $cfg.terminal_uid
  "x-agent-secret" = $cfg.agent_secret
}
```

Leave these windows open the whole call:

- PowerShell
- POS hardware-agent
- POS pax-bridge

## What Windows already showed

| What you saw | What it means |
| --- | --- |
| `EPSON TM-T88V Receipt` | Receipt printer. This name is already in `config.json`. |
| `EPSON TM-T88V ReceiptE4` | Second Epson name. Use it only if the first name prints nothing. |
| `COM22` Ingenico | Card machine. Do not put this in the scale or scanner settings. |
| `COM4` and `COM5` | Two plugs from the same USB device. One of them may be the scale. |
| `COM3` Prolific | A separate USB-serial cable. This may be the scale or the drawer. |

## 1. Start the call

Ask him: "Stay next to the register. I will tell you what to touch. Tell me what you see."

You run:

```powershell
mkdir C:\pos-test -Force
Invoke-RestMethod http://127.0.0.1:3001/health
```

**Pass:** `status` is OK and `demo` is false.

**Paste to me:** that health output.

**Why:** this confirms the hardware program is still the real one, not demo mode.

## 2. Find the drawer cable

Ask him: "Follow the cash-drawer cable with your hand. Does it plug into the Epson printer, or into a USB stick on the PC?"

- Plugs into the Epson: drawer mode is `printer`.
- Plugs into a USB stick: drawer mode is `serial`. You still need its COM number from step 3.
- He cannot tell: skip the drawer until the end.

**Paste to me:** his answer in one sentence.

**Why:** the drawer will not open until `config.json` matches that cable.

## 3. Find the scale plug

Ask him: "Put one hand on the scale cable. Unplug it, wait 3 seconds, and plug it back in. Tell me when it is back in."

You run this while it is unplugged, then run it again after he plugs it back:

```powershell
powershell -File scripts\list-com-ports.ps1
```

The COM number that disappears and comes back is the scale. It will be `COM3`, `COM4`, or `COM5`. It will not be `COM22`.

**Paste to me:** both lists, and which COM number disappeared.

**Why:** the scale setting is still empty. A wrong number means the weight test cannot work.

## 4. Save the scale and drawer settings

Open `config.json` in Notepad. Change only the lines that step 2 and step 3 proved.

Scale, using the COM number from step 3:

```json
"scale_serial_path": "COM3"
```

Drawer, if the cable goes into the Epson:

```json
"cash_drawer_mode": "printer"
```

Drawer, if the cable goes into a USB stick. Use that COM number, not a guess:

```json
"cash_drawer_mode": "serial",
"cash_drawer_serial_path": "COM5"
```

Save the file. Then close only the **POS hardware-agent** window and start it again:

```powershell
node src\hardware-service.js
```

Leave the card-helper window alone. When the new hardware window says it is running, go back to the first PowerShell and paste the login block again.

**Paste to me:** the two lines you changed. Do not paste the whole file.

**Why:** the program reads those lines only when it starts.

## 5. Save the status report

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/terminal/diagnostics -Headers $Headers | ConvertTo-Json -Depth 8 | Tee-Object C:\pos-test\diagnostics.json
```

**Paste to me:** the whole output.

**Why:** this shows whether the program now sees the scale, scanner, printer, and drawer.

## 6. Test the scanner

Ask him: "Scan this barcode once with the handheld scanner. Read me the number printed under the bars."

You run:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/scanner/last -Headers $Headers | ConvertTo-Json | Tee-Object C:\pos-test\scanner.json
```

**Pass:** `value` is the same number he read.

**Paste to me:** his number and the command output.

**Why:** this proves the scanner reached our program.

## 7. Test the scale

Ask him: "Put the item on the scale. Read me the number on the small customer display."

You run:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/scale/weight -Headers $Headers | ConvertTo-Json | Tee-Object C:\pos-test\scale.json
```

**Pass:** `connected` is true, and `weight` is close to the number he read.

**Paste to me:** his number and the command output.

**Why:** this proves the scale reached our program.

## 8. Test the printer

Ask him: "Watch the Epson printer."

You run:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/printer/print -Headers $Headers -Method POST -ContentType "application/json" -Body '{"items":[{"name":"TEST APPLE","qty":1,"price":1}],"total":1}' | ConvertTo-Json | Tee-Object C:\pos-test\printer.json
```

Ask him: "Did paper come out? Does it say TEST APPLE?"

**Pass:** yes. Take a photo of the paper.

**Paste to me:** his answer, the command output, and the photo.

**Why:** a success message on screen is not proof. The paper is the proof.

If nothing prints, say so and stop. The next try uses the other printer name, `EPSON TM-T88V ReceiptE4`.

## 9. Test the cash drawer

Skip this if step 2 did not find the cable.

Ask him: "Keep a hand on the cash drawer."

You run:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/cash-drawer/open -Headers $Headers -Method POST -ContentType "application/json" | ConvertTo-Json | Tee-Object C:\pos-test\drawer.json
```

Ask him: "Did the drawer pop open?"

**Pass:** yes.

**Paste to me:** his answer and the command output.

**Why:** this proves the open command reached the till.

## 10. Test the card machine last

Do this only if someone gives you the four Elavon values. Type them into `.env` on that PC. Do not paste them here.

The four lines are:

- `CONVERGE_SSL_MERCHANT_ID`
- `CONVERGE_SSL_USER_ID`
- `CONVERGE_SSL_PIN`
- `CONVERGE_SSL_VENDOR_ID`

Save `.env`. Close only the **POS pax-bridge** window, then start it again:

```powershell
node pax-bridge\server.mjs
```

Refresh `http://127.0.0.1:7001/health`. You want `ready` to be true.

Ask him: "Watch the card machine. Use the $1 test card when it asks."

You run this and wait up to 2 minutes:

```powershell
Invoke-RestMethod http://127.0.0.1:3001/api/payment/initiate -Headers $Headers -Method POST -ContentType "application/json" -Body '{"amount":1.00,"order_id":"HW-TEST-1"}' -TimeoutSec 130 | ConvertTo-Json -Depth 6 | Tee-Object C:\pos-test\payment.json
```

**Pass:** the card machine asks for a card, and he tells you what the screen says.

**Paste to me:** what he saw and the command output.

**Why:** this is the only test that charges a card. Do not run it twice while the first one is still waiting.

If nobody has the four values, skip this step. The other device tests still count.

## If a step fails

Stop that device. Paste me:

- the step number
- what he did
- what he saw
- the PowerShell output
- the last lines from the hardware-agent window

Then go to the next step.
