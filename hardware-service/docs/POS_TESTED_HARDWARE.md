# Register hardware for the POS

Date of the live test: 25 September 2026, register CYGNUS-POS.

The POS does not open the devices itself. A hardware agent on the register does. The cloud POS calls the cloud service below. That service forwards the call to the register.

Scanner, scale, receipt printer, and cash drawer were proven on this register with demo mode off. The card machine is included so the POS can be built against it. A card sale was not completed. That section says **Not tested**.

## Base URL

```text
https://pos-7mvx.onrender.com
```

Every path below is that host plus the path. Example: `https://pos-7mvx.onrender.com/api/scanner/last`.

This is the cloud service, checked live: `GET /health` returns `{"status":"OK"}`. It is not `http://127.0.0.1:3001`. That address only exists on the register and cannot be called from the cloud POS.

Send these headers on every device call:

```http
x-store-id: <store_id from that register's config.json>
x-agent-secret: <agent_secret from that register's config.json>
Content-Type: application/json
```

The cloud service looks up the register from `x-store-id`. A missing store id returns `400`. A wrong secret returns `401`. If the register agent is not currently connected, the call returns `404` with `No active terminal`, or `502` with `Hardware agent unreachable`.

Call this from the POS server. Do not call it from the browser page.

`demo` in any device response must be `false`. A `true` value means the agent is not talking to the real device.

## Devices

| Device | Call | Tested on the register | What the POS should do |
| --- | --- | --- | --- |
| Handheld barcode scanner | `GET /api/scanner/status` | Yes | Confirm the scanner listener is up. |
| Handheld barcode scanner | `GET /api/scanner/last` | Yes | Read the last barcode and add that item. |
| Magellan scale | `GET /api/scale/status` | Yes | Confirm the scale is connected. |
| Magellan scale | `GET /api/scale/weight` | Yes | Read the weight for an item sold by the pound. |
| Epson receipt printer | `GET /api/cloudprinter/list` | Yes | Confirm the working printer name is installed. |
| Epson receipt printer | `POST /api/cloud/printer/print` | Yes | Print the customer receipt. |
| Cash drawer | `GET /api/cash-drawer/status` | Yes | Read whether a drawer mode is configured. Mode on this register is `printer`. |
| Cash drawer | `POST /api/cash-drawer/open` | Yes | Open the drawer after a cash sale. The pulse must go to `EPSON RAW`, not the receipt queue. |
| Ingenico Lane 3600 | `GET /api/payment/status` | No | Read whether the card reader is ready. |
| Ingenico Lane 3600 | `POST /api/payment/initiate` | No | Send the amount and wait for the customer. |
| Ingenico Lane 3600 | `POST /api/payment/cancel` | No | Stop the payment while the customer is still at the reader. |
| Ingenico Lane 3600 | `POST /api/payment/void` | No | Void a sale that returned a transaction id. |
| Ingenico Lane 3600 | `POST /api/payment/refund` | No | Refund an amount. |

The card reader is an Ingenico Lane 3600. The path is `/api/payment`. Do not send a different card-terminal protocol.

## Scanner

Proven. A real scan of `201650053396` was stored by the agent and returned by the last-scan call. The scanner does not press Enter. The agent finishes the barcode. The POS only reads the result.

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

Proven. With a box on the platform, the weight call returned `10.4` pounds, `status` `stable`, `connected` `true`. The customer-facing scale display is not the value to charge. Use this API.

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

Proven. The working queue is exactly:

`EPSON TM-T88V ReceiptE4`

A receipt whose line was `TEST APPLE` came out of that printer. The API returned `success: true` and `demo: false`.

Do not print to `EPSON TM-T88V Receipt`. That queue was offline on this register and the job does not come out.

Confirm the name:

`GET /api/cloudprinter/list`

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

`printers` is every queue Windows has installed. More than one name will be in that list. `configured_printer` is the queue used when the body omits `printer_name`. That value must be `EPSON TM-T88V ReceiptE4`.

Print:

`POST /api/cloud/printer/print`

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

## Cash drawer

Proven on 9 October 2026 with the new drawer. A raw job to the queue `EPSON RAW` printed `DRAWER TEST` and the drawer opened. The cable is in the Epson **DK** socket. The key has to be unlocked.

Receipts stay on `EPSON TM-T88V ReceiptE4`. That queue prints text and drops the drawer pulse. The open call has to send the pulse to `EPSON RAW`.

Check:

`GET /api/cash-drawer/status`

```json
{
  "success": true,
  "configured": true,
  "mode": "printer",
  "demo": false,
  "printer_name": "EPSON TM-T88V ReceiptE4",
  "last_open_at": null,
  "last_error": null
}
```

`configured: true` only means a drawer mode is saved. On this register the mode is `printer`, because the drawer cable is on the Epson. It does not mean the last open moved the drawer.

Open:

`POST /api/cash-drawer/open`

No body. The response the API returns is:

```json
{
  "success": true,
  "message": "Cash drawer open command sent",
  "mode": "printer",
  "demo": false
}
```

`503` means the drawer mode is not configured. `500` means the open command failed before it was sent. A `200` with `success: true` and `demo: false` means the pulse was sent to the kick queue. On this register that queue is `EPSON RAW`.

For a cash sale, call open after the sale is saved. If this call fails, keep the sale and show the error. Do not roll the sale back because the drawer call failed.

## Card machine

**Not tested.** The reader is an Ingenico Lane 3600 on USB. The payment gateway on the register did open. No card sale, cancel, void, or refund was completed, so there is no proven approval body from this register. Build these calls, and finish a sale only when the response matches the success rule below.

Ready check:

`GET /api/payment/status`

Treat the reader as ready only when `success` is `true`, `ready` is `true`, `cws_reachable` is `true`, and `reader_detected` is `true`. `gateway_ready` means the payment gateway is already open. This shape was not re-checked as a full sale.

Start a sale:

`POST /api/payment/initiate`

```json
{
  "amount": 1.0,
  "currency": "USD",
  "order_id": "ORDER-1001"
}
```

`amount` is required and must be a number greater than 0. `currency` defaults to `USD`. `order_id` is optional.

The customer is at the reader for this whole call. Wait up to **120 seconds**. A shorter client timeout will fail a sale that is still in progress.

The code returns this kind of body after a completed sale. It was not seen on this register:

```json
{
  "success": true,
  "approved": true,
  "status": "approved",
  "transactionId": "TRANSACTION-ID",
  "authCode": "AUTH",
  "amount": 1.0,
  "currency": "USD",
  "order_id": "ORDER-1001"
}
```

Save the sale only when the HTTP status is `200`, `success` is `true`, and `approved` is `true`. Store `transactionId`. Any other result is not a paid sale. A decline comes back as `success: false`. Show that message and leave the sale unpaid.

Cancel the sale currently on the reader:

`POST /api/payment/cancel`

No body. Use this for the Cancel Payment button while initiate is still waiting.

Void a finished sale:

`POST /api/payment/void`

```json
{
  "ref_num": "TRANSACTION-ID"
}
```

`ref_num` is required. Put the `transactionId` from initiate into `ref_num`. An optional `amount` may be sent with it.

Refund:

`POST /api/payment/refund`

```json
{
  "amount": 1.0,
  "ref_num": "TRANSACTION-ID"
}
```

`amount` is required and must be greater than 0. `ref_num` is the `transactionId` from the original sale when you have it.

## How a sale should call these

1. Keep polling `GET /api/scanner/last`. When `scan.at` changes, look up `scan.value` and add the item.
2. For an item sold by weight, poll `GET /api/scale/weight` until `status` is `stable`, then use `weight` as the pounds.
3. Cash: save the sale, then `POST /api/cash-drawer/open`. Keep the sale if the drawer call fails.
4. Card: `POST /api/payment/initiate` and wait up to 120 seconds. Save the sale only when `approved` is `true`. This sale is not tested.
5. After the sale is saved, `POST /api/cloud/printer/print` with the sold lines and the total.
6. If the print call fails, keep the sale and offer a reprint.

## What has to be running

The POS base URL stays `https://pos-7mvx.onrender.com`. Do not call the register tunnel directly.

The cloud service can reach the register only while both of these stay open on CYGNUS-POS:

- The hardware agent, `node src\hardware-service.js`
- The ngrok window forwarding to port 3001

The agent `.env` value `NGROK_URL` must be the https address shown in that ngrok window. Right now that address is:

`https://nonexperimental-dagny-diploic.ngrok-free.dev`

If ngrok is closed and opened again, that address can change. Put the new one in `NGROK_URL` and restart the agent. The POS base URL does not change.

The agent is connected when its window prints `[HEARTBEAT] Cloud response:` with `"success": true`. If the developer gets `No active terminal` or `Hardware agent unreachable`, the agent or ngrok is down. That is not a bug in the POS paths above.
