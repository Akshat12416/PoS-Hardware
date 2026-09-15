/**
 * Elavon Commerce Web Services (CWS) HTTP client.
 * @see https://developer.elavon.com/products/commerce-sdk/v1/cws
 */

import https from "https";
import { randomUUID } from "crypto";

const DEFAULT_URL = "https://localhost:9790/rest/command";

function parseCwsUrl(raw) {
  const url = new URL(raw || DEFAULT_URL);
  if (url.protocol !== "https:") {
    throw new Error(`CWS URL must be https (got ${url.protocol})`);
  }
  return {
    hostname: url.hostname,
    port: Number(url.port || 443),
    path: url.pathname || "/rest/command"
  };
}

function postJson(target, body, timeoutMs) {
  const payload = JSON.stringify(body);
  const { hostname, port, path } = target;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        port,
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        },
        rejectUnauthorized: false
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if (!raw) {
            reject(new Error("Empty response from CWS"));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (err) {
            reject(new Error(`Invalid JSON from CWS: ${err.message}`));
          }
        });
      }
    );

    const timer = setTimeout(() => {
      req.destroy(new Error(`CWS request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    req.on("close", () => clearTimeout(timer));
    req.write(payload);
    req.end();
  });
}

export function newRequestId(prefix = "req") {
  return `${prefix}-${randomUUID()}`;
}

export function commandBlock(response) {
  const data = response?.data;
  if (!data || typeof data !== "object") return null;
  return (
    data.paymentGatewayCommand ||
    data.cardReaderCommand ||
    data.printerCommand ||
    data
  );
}

export function isCommandCompleted(response) {
  return commandBlock(response)?.completed === true;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CwsClient {
  constructor(options = {}) {
    this.target = parseCwsUrl(options.baseUrl || process.env.CWS_BASE_URL);
    this.pollIntervalMs = Number(
      options.pollIntervalMs || process.env.CWS_POLL_INTERVAL_MS || 750
    );
    this.requestTimeoutMs = Number(
      options.requestTimeoutMs || process.env.CWS_REQUEST_TIMEOUT_MS || 30000
    );
    this.transactionTimeoutMs = Number(
      options.transactionTimeoutMs ||
        process.env.CWS_TRANSACTION_TIMEOUT_MS ||
        120000
    );
  }

  buildCommand({ method, targetType, parameters, requestId, version = "1.0" }) {
    const cmd = {
      method,
      requestId: requestId || newRequestId(method),
      targetType,
      version
    };
    if (parameters && Object.keys(parameters).length > 0) {
      cmd.parameters = parameters;
    }
    return cmd;
  }

  async send(command, { timeoutMs } = {}) {
    return postJson(this.target, command, timeoutMs ?? this.requestTimeoutMs);
  }

  async sendUntilComplete(command, { timeoutMs, onProgress } = {}) {
    const deadline = Date.now() + (timeoutMs ?? this.transactionTimeoutMs);
    let lastResponse = null;

    while (Date.now() < deadline) {
      lastResponse = await this.send(command, { timeoutMs: this.requestTimeoutMs });
      if (onProgress) onProgress(lastResponse);
      if (isCommandCompleted(lastResponse)) {
        return lastResponse;
      }
      await sleep(this.pollIntervalMs);
    }

    const err = new Error("CWS command timed out before completion");
    err.code = "CWS_TIMEOUT";
    err.lastResponse = lastResponse;
    throw err;
  }

  async pollPaymentStatus({ paymentGatewayId, chanId, requestId }) {
    return this.sendUntilComplete(
      this.buildCommand({
        method: "getPaymentTransactionStatus",
        targetType: "paymentGatewayConverge",
        requestId: requestId || newRequestId("pay-status"),
        parameters: { paymentGatewayId, chanId }
      })
    );
  }

  async pollCardReaderStatus({ requestId, chanId }) {
    const parameters = {};
    if (chanId) parameters.chanId = chanId;
    return this.sendUntilComplete(
      this.buildCommand({
        method: "getCommandStatusOnCardReader",
        targetType: "cardReader",
        requestId: requestId || newRequestId("reader-status"),
        parameters: Object.keys(parameters).length ? parameters : undefined
      })
    );
  }
}
