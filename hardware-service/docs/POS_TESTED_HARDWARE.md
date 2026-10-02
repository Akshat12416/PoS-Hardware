# Tested register hardware for the POS

Date of the live test: 25 September 2026, register CYGNUS-POS.

The POS does not open the printer, scanner, or scale itself. A hardware agent already running on that register does. The POS calls the agent over HTTP. Wire in only the three devices below. They were proven on this register with demo mode off.

Do not wire the cash drawer or the card machine from this document. Those two were not proven. See the last section.

## Where to call

The agent listens only on the register:

`http://127.0.0.1:3001`

The POS process has to run on that same PC, or be able to reach that address. There is no separate cloud URL for these device calls.

Every device call needs these two headers. The values are the `terminal_uid` and `agent_secret` already stored in that register's `config.json`. Do not invent them and do not copy them from another computer.

```http
x-terminal-id: <terminal_uid from that register's config.json>
x-agent-secret: <agent_secret from that register's config.json>
Content-Type: application/json
```

`GET /health` does not need those headers. A healthy agent answers:

```json
{ "status": "OK", "role": "hardware-agent", "demo": false, "bind": "127.0.0.1:3001" }
```

`demo` must be `false`. If it is `true`, the agent is not talking to the real devices.

If the headers are missing or wrong, the agent returns `401`. If that register is not approved, device calls are refused (`403` or `423`). Fix the register config before changing the POS.

## Devices you can wire now

| Device | Call | What the POS should do |
| --- | --- | --- |
| Handheld barcode scanner | `GET /api/scanner/status` | Confirm the scanner listener is up before trusting a scan. |
| Handheld barcode scanner | `GET /api/scanner/last` | Read the last barcode and add that item. |
| Magellan scale | `GET /api/scale/status` | Confirm the scale port is open. |
| Magellan scale | `GET /api/scale/weight` | Read the weight for an item sold by the pound. |
| Epson receipt printer | `GET /api/printer/list` | Confirm the working printer name is installed. |
| Epson receipt printer | `POST /api/printer/print` | Print the customer receipt after the sale. |

## Scanner

Proven device: Symbol handheld scanner. A real scan of `201650053396` was stored by the agent and returned by `GET /api/scanner/last`. The scanner does not press Enter. The agent finishes the barcode on its own. The POS only reads the result.

Check first:

`GET /api/scanner/status`

Use the scan only when `connected` is `true`. On this register the working mode is `keyboard_wedge`.

Then poll:

`GET /api/scanner/last`

```json
{
  "success": true,
  "scan": {
    "value": "201650053396",
    "at": "2026-09-25T00:00:00.000Z"
  }
}
```

`scan` is `null` until the first real scan after the agent starts.

Rules for the POS:

- Poll this endpoint. The agent does not push a scan to the POS.
- Add the item when `scan.at` changes. The same `value` stays until the next scan, so adding on every poll will duplicate the line.
- Ignore a response while `connected` is `false`.
- Do not call `POST /api/scanner/simulate` on this register. That writes a fake barcode.

## Scale

Proven device: the Magellan scale. With a box on the platform, `GET /api/scale/weight` returned `10.4` pounds, `status` `stable`, `connected` `true`. The customer-facing scale display is not the value to charge. Use this API.

Check first:

`GET /api/scale/status`

`connected` must be `true` and `unit` must be `lb`.

Then read:

`GET /api/scale/weight`

```json
{
  "success": true,
  "weight": 10.4,
  "unit": "lb",
  "status": "stable",
  "connected": true,
  "demo": false
}
```

`weight` is a number in pounds, already converted. `0.01` means one hundredth of a pound.

Use `weight` only when all of these are true:

- `success` is `true`
- `demo` is `false`
- `connected` is `true`
- `status` is `stable`
- `unit` is `lb`

Other `status` values mean do not price the item yet:

| status | Meaning |
| --- | --- |
| `stable` | Safe to use `weight`. |
| `motion` | The platform is still moving. `weight` may still be the previous number. Wait. |
| `not_ready` | Scale is not ready. Wait. |
| `under_zero` | Below zero. Do not charge. |
| `over_capacity` | Too heavy. Do not charge. |

`weight` can be `null` before the first good reading. Poll again. A new weight does not require an agent restart.

## Receipt printer

Proven device: the Epson queue named exactly:

`EPSON TM-T88V ReceiptE4`

A receipt whose line was `TEST APPLE` came out of that printer. The API returned `success: true` and `demo: false`.

Do not print to `EPSON TM-T88V Receipt`. That queue was offline on this register and the job does not come out.

Confirm the name:

`GET /api/printer/list`

```json
{
  "success": true,
  "configured_printer": "EPSON TM-T88V ReceiptE4",
  "printers": [
    "EPSON TM-T88V ReceiptE4",
    "EPSON TM-T88V Receipt"
  ]
}
```

`printers` is every queue Windows has installed. More than one name will be in that list. `configured_printer` is the queue the agent uses when the body omits `printer_name`. That value must be `EPSON TM-T88V ReceiptE4`.

Print:

`POST /api/printer/print`

```json
{
  "company_name": "Southwest Farmers",
  "items": [
    { "name": "Apples", "qty": 2, "price": 1.5 }
  ],
  "subtotal": 3,
  "tax": 0,
  "total": 3
}
```

Required:

- `items`: at least one row
- each row: `name` (string), `qty` (number), `price` (number)
- `total`: number

Optional: `company_name`, `address_lines` (array of strings), `phone`, `datetime`, `subtotal`, `tax`, `payment`, `printer_name`.

If you send `printer_name`, send `EPSON TM-T88V ReceiptE4`. Any other name on this register is the wrong queue.

Success looks like:

```json
{
  "success": true,
  "job_id": "...",
  "printer_name": "EPSON TM-T88V ReceiptE4",
  "demo": false
}
```

Treat the print as failed unless `success` is `true`, `demo` is `false`, and `printer_name` is `EPSON TM-T88V ReceiptE4`. A `400` means the body is invalid. A `500` means the printer rejected the job. Show that error and let the cashier reprint. Do not mark the receipt printed on a failed response.

`price` on each row is the unit price. The agent prints `qty` and `name` on the left and that unit price on the right.

## How a normal sale should call these

1. Keep polling `GET /api/scanner/last`. When `scan.at` changes, look up `scan.value` and add the item.
2. For an item sold by weight, poll `GET /api/scale/weight` until `status` is `stable`, then use `weight` as the pounds.
3. Take payment in the POS. This document does not cover the card machine.
4. After the sale is saved, `POST /api/printer/print` with the sold lines and the total.
5. If the print call fails, keep the sale and offer a reprint. Do not roll the sale back because paper failed.

## Do not wire these yet

**Cash drawer.** `POST /api/cash-drawer/open` can return `success: true` while the drawer stays closed. On this register the kick bytes reached the printer and the drawer did not move and did not click. Do not open the drawer from the POS, and do not block a cash sale on that call, until a later test shows the drawer physically open.

**Card machine.** The reader is an Ingenico Lane 3600, reached through `POST /api/payment/initiate` on this same agent. The gateway opened on the register. A card sale was not completed. Do not finish a sale from that endpoint until a real approved response has been seen on this register.
