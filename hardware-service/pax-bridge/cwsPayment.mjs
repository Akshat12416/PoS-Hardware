/**
 * CWS payment gateway session + countertop transaction orchestration.
 */

import {
  CwsClient,
  commandBlock,
  isCommandCompleted,
  newRequestId,
  sleep
} from "./cwsClient.mjs";

function formatAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("amount must be a positive number");
  }
  return n.toFixed(2);
}

function readConvergeCredentials() {
  return {
    merchantId:
      process.env.CONVERGE_SSL_MERCHANT_ID ||
      process.env.CONVERGE_SSL_ACCOUNT_ID ||
      "",
    userId: process.env.CONVERGE_SSL_USER_ID || "",
    pin: process.env.CONVERGE_SSL_PIN || "",
    vendorId: process.env.CONVERGE_SSL_VENDOR_ID || ""
  };
}

function gatewayResult(response) {
  return commandBlock(response)?.openPaymentGatewayData?.result || null;
}

function paymentGatewayIdFrom(response) {
  const block = commandBlock(response);
  return (
    block?.openPaymentGatewayData?.paymentGatewayId ||
    block?.paymentGatewayId ||
    response?.data?.paymentGatewayId ||
    null
  );
}

function transactionDataFrom(response) {
  return commandBlock(response)?.paymentTransactionData || null;
}

function normalizeTransactionResult(txData) {
  if (!txData) {
    return {
      status: "unknown",
      approved: false,
      message: "No transaction data in CWS response"
    };
  }

  const result = String(txData.result || txData.status || "").toUpperCase();
  const approved = result === "APPROVED" || result === "SUCCESS";

  return {
    status: result.toLowerCase() || "unknown",
    approved,
    message: txData.responseMessage || txData.result || txData.message || result,
    transactionId:
      txData.transactionId ||
      txData.transId ||
      txData.ssl_txn_id ||
      txData.referenceNumber ||
      null,
    authCode: txData.authCode || txData.authorizationCode || null,
    amount: txData.amount || txData.transAmount || null,
    cardBrand: txData.cardBrand || txData.cardType || null,
    last4: txData.maskedPan || txData.last4 || null,
    raw: txData
  };
}

function resolveTerminalType() {
  return String(process.env.PAYMENT_TERMINAL_TYPE || "ingenico").toLowerCase();
}

export class CwsPaymentService {
  constructor(options = {}) {
    this.client = options.client || new CwsClient(options);
    this.credentials = options.credentials || readConvergeCredentials();
    this.terminalType = options.terminalType || resolveTerminalType();
    this.terminalModel =
      options.terminalModel || process.env.PAYMENT_TERMINAL_MODEL || "";
    this.terminalSerial =
      options.terminalSerial || process.env.PAYMENT_TERMINAL_SERIAL || "";
    this.terminalIp = options.terminalIp || process.env.PAX_TERMINAL_IP || "";
    this.terminalPort =
      options.terminalPort || process.env.PAX_TERMINAL_PORT || "10009";
    // IP-based reader config is for network terminals (legacy PAX path only).
    this.autoConfigureReader =
      this.terminalType === "pax" &&
      String(process.env.CWS_AUTO_CONFIGURE_READER || "true").toLowerCase() !==
        "false";
    this.paymentGatewayId = null;
    this.gatewayError = null;
    this.activeChanId = null;
    this.lastTransaction = null;
    this.readerConfigured = false;
  }

  vendorIdConfigured() {
    return Boolean(String(this.credentials.vendorId || "").trim());
  }

  convergeConfigured() {
    const { merchantId, userId, pin } = this.credentials;
    return Boolean(merchantId && userId && pin);
  }

  async ping() {
    const response = await this.client.sendUntilComplete(
      this.client.buildCommand({
        method: "getEnvironmentInfo",
        targetType: "api",
        requestId: newRequestId("env")
      }),
      { timeoutMs: 15000 }
    );
    return {
      ok: true,
      cws: response?.data?.cwsInfo || null,
      convergeConnect: response?.data?.conconInfo || null,
      completed: isCommandCompleted(response)
    };
  }

  async getCardReaderInfo() {
    const response = await this.client.sendUntilComplete(
      this.client.buildCommand({
        method: "getCardReaderInfo",
        targetType: "api",
        requestId: newRequestId("reader-info")
      }),
      { timeoutMs: 15000 }
    );
    return response?.data?.cardReaderInfo || null;
  }

  async openPaymentGateway(force = false) {
    if (this.paymentGatewayId && !force) {
      return { paymentGatewayId: this.paymentGatewayId, reused: true };
    }

    if (!this.convergeConfigured()) {
      const err = new Error(
        "Converge credentials missing (CONVERGE_SSL_MERCHANT_ID, CONVERGE_SSL_USER_ID, CONVERGE_SSL_PIN)"
      );
      err.code = "CWS_CONVERGE_CREDENTIALS_MISSING";
      throw err;
    }

    if (!this.vendorIdConfigured()) {
      const err = new Error(
        "CONVERGE_SSL_VENDOR_ID is not set — required for CWS openPaymentGateway"
      );
      err.code = "CWS_VENDOR_ID_REQUIRED";
      throw err;
    }

    const { merchantId, userId, pin, vendorId } = this.credentials;
    const response = await this.client.sendUntilComplete(
      this.client.buildCommand({
        method: "openPaymentGateway",
        targetType: "paymentGatewayConverge",
        requestId: newRequestId("open-gw"),
        parameters: { merchantId, userId, pin, vendorId }
      })
    );

    const result = gatewayResult(response);
    if (result && /error/i.test(String(result))) {
      this.gatewayError = result;
      const err = new Error(`CWS openPaymentGateway failed: ${result}`);
      err.code = "CWS_GATEWAY_OPEN_FAILED";
      err.cwsResponse = response;
      throw err;
    }

    const paymentGatewayId = paymentGatewayIdFrom(response);
    if (!paymentGatewayId) {
      const err = new Error("CWS openPaymentGateway did not return paymentGatewayId");
      err.code = "CWS_GATEWAY_OPEN_FAILED";
      err.cwsResponse = response;
      throw err;
    }

    this.paymentGatewayId = paymentGatewayId;
    this.gatewayError = null;
    return { paymentGatewayId, reused: false, response };
  }

  async ensureGateway() {
    if (this.paymentGatewayId) return this.paymentGatewayId;
    const opened = await this.openPaymentGateway();
    return opened.paymentGatewayId;
  }

  async configureCardReaderIfNeeded() {
    if (this.terminalType === "ingenico") {
      const existing = await this.getCardReaderInfo();
      if (existing) {
        this.readerConfigured = true;
        return {
          skipped: true,
          reason: "Ingenico USB — reader detected by CWS",
          reader: existing
        };
      }
      return {
        skipped: true,
        reason:
          "Ingenico USB — connect terminal and refresh devices in ConvergeConnect"
      };
    }

    if (!this.autoConfigureReader || !this.terminalIp) {
      return { skipped: true, reason: "auto configure disabled or no terminal IP" };
    }

    const existing = await this.getCardReaderInfo();
    if (existing) {
      this.readerConfigured = true;
      return { skipped: true, reason: "reader already detected", reader: existing };
    }

    const requestId = newRequestId("reader-config");
    const response = await this.client.sendUntilComplete(
      this.client.buildCommand({
        method: "startCardReaderConfiguration",
        targetType: "cardReader",
        requestId,
        parameters: {
          connectionType: "IP",
          ipAddress: this.terminalIp,
          port: String(this.terminalPort)
        }
      }),
      { timeoutMs: 60000 }
    );

    this.readerConfigured = isCommandCompleted(response);
    return { configured: this.readerConfigured, response };
  }

  async searchCardReaders() {
    const requestId = newRequestId("reader-search");
    await this.client.send(
      this.client.buildCommand({
        method: "startCardReadersSearch",
        targetType: "cardReader",
        requestId
      })
    );

    const deadline = Date.now() + 60000;
    let last = null;
    while (Date.now() < deadline) {
      last = await this.client.send(
        this.client.buildCommand({
          method: "getCardReadersSearchStatus",
          targetType: "cardReader",
          requestId: newRequestId("reader-search-status")
        })
      );
      if (isCommandCompleted(last)) break;
      await sleep(this.client.pollIntervalMs);
    }
    return last;
  }

  extractChanId(response) {
    const chanId = commandBlock(response)?.chanId || response?.data?.chanId || null;
    if (chanId) this.activeChanId = chanId;
    return chanId;
  }

  async runSale({ amount, currency = "USD", orderId }) {
    const paymentGatewayId = await this.ensureGateway();
    await this.configureCardReaderIfNeeded();

    const requestId = newRequestId("sale");
    const parameters = {
      paymentGatewayId,
      transactionType: "SALE",
      amount: formatAmount(amount),
      currencyCode: currency,
      invoiceNumber: orderId || requestId,
      // Required by Elavon / card brands for CSDK certification
      partialApprovalAllowed: "Y"
    };

    const startResponse = await this.client.send(
      this.client.buildCommand({
        method: "startPaymentTransaction",
        targetType: "paymentGatewayConverge",
        requestId,
        parameters
      })
    );

    const chanId = this.extractChanId(startResponse);
    let finalResponse = startResponse;

    if (!isCommandCompleted(startResponse) && chanId) {
      finalResponse = await this.client.pollPaymentStatus({
        paymentGatewayId,
        chanId,
        requestId: newRequestId("sale-status")
      });
    } else if (!isCommandCompleted(startResponse)) {
      finalResponse = await this.client.sendUntilComplete(
        this.client.buildCommand({
          method: "startPaymentTransaction",
          targetType: "paymentGatewayConverge",
          requestId,
          parameters
        })
      );
    }

    const tx = normalizeTransactionResult(transactionDataFrom(finalResponse));
    const payload = {
      success: tx.approved,
      status: tx.status,
      approved: tx.approved,
      message: tx.message,
      transactionId: tx.transactionId,
      authCode: tx.authCode,
      amount: Number(amount),
      currency,
      orderId: orderId || null,
      chanId,
      paymentGatewayId,
      paxResult: tx.raw,
      cws: finalResponse
    };

    this.lastTransaction = payload;
    this.activeChanId = null;

    if (!tx.approved) {
      const err = new Error(tx.message || "Payment declined");
      err.code = tx.status === "declined" ? "PAX_DECLINED" : "CWS_TRANSACTION_FAILED";
      err.paxResult = tx.raw;
      err.response = payload;
      throw err;
    }

    return payload;
  }

  async cancelCurrent() {
    const paymentGatewayId = await this.ensureGateway();
    const parameters = { paymentGatewayId };
    if (this.activeChanId) parameters.chanId = this.activeChanId;

    const response = await this.client.sendUntilComplete(
      this.client.buildCommand({
        method: "cancelPaymentTransaction",
        targetType: "paymentGatewayConverge",
        requestId: newRequestId("cancel"),
        parameters
      })
    );

    this.activeChanId = null;
    return { success: true, cancelled: true, cws: response };
  }

  async voidTransaction({ ref_num, amount }) {
    const paymentGatewayId = await this.ensureGateway();
    const parameters = {
      paymentGatewayId,
      transactionType: "VOID",
      originalTransId: ref_num
    };
    if (amount != null) parameters.amount = formatAmount(amount);

    const requestId = newRequestId("void");
    const startResponse = await this.client.send(
      this.client.buildCommand({
        method: "startPaymentTransaction",
        targetType: "paymentGatewayConverge",
        requestId,
        parameters
      })
    );

    const chanId = this.extractChanId(startResponse);
    let finalResponse = startResponse;
    if (!isCommandCompleted(startResponse) && chanId) {
      finalResponse = await this.client.pollPaymentStatus({
        paymentGatewayId,
        chanId,
        requestId: newRequestId("void-status")
      });
    }

    const tx = normalizeTransactionResult(transactionDataFrom(finalResponse));
    if (!tx.approved) {
      const err = new Error(tx.message || "Void failed");
      err.code = "CWS_VOID_FAILED";
      err.paxResult = tx.raw;
      throw err;
    }
    return { success: true, ...tx, cws: finalResponse };
  }

  async refundTransaction({ amount, ref_num }) {
    const paymentGatewayId = await this.ensureGateway();

    if (ref_num) {
      const response = await this.client.sendUntilComplete(
        this.client.buildCommand({
          method: "linkedRefund",
          targetType: "paymentGatewayConverge",
          requestId: newRequestId("linked-refund"),
          parameters: {
            paymentGatewayId,
            originalTransId: ref_num,
            amount: formatAmount(amount)
          }
        })
      );
      const tx = normalizeTransactionResult(transactionDataFrom(response));
      if (!tx.approved) {
        const err = new Error(tx.message || "Refund failed");
        err.code = "CWS_REFUND_FAILED";
        err.paxResult = tx.raw;
        throw err;
      }
      return { success: true, ...tx, cws: response };
    }

    const requestId = newRequestId("refund");
    const startResponse = await this.client.send(
      this.client.buildCommand({
        method: "startPaymentTransaction",
        targetType: "paymentGatewayConverge",
        requestId,
        parameters: {
          paymentGatewayId,
          transactionType: "REFUND",
          amount: formatAmount(amount)
        }
      })
    );

    const chanId = this.extractChanId(startResponse);
    let finalResponse = startResponse;
    if (!isCommandCompleted(startResponse) && chanId) {
      finalResponse = await this.client.pollPaymentStatus({
        paymentGatewayId,
        chanId,
        requestId: newRequestId("refund-status")
      });
    }

    const tx = normalizeTransactionResult(transactionDataFrom(finalResponse));
    if (!tx.approved) {
      const err = new Error(tx.message || "Refund failed");
      err.code = "CWS_REFUND_FAILED";
      err.paxResult = tx.raw;
      throw err;
    }
    return { success: true, ...tx, cws: finalResponse };
  }

  async getBridgeStatus() {
    let cws = null;
    let reader = null;
    let cwsError = null;

    try {
      cws = await this.ping();
    } catch (err) {
      cwsError = err.message;
    }

    if (cws?.ok) {
      try {
        reader = await this.getCardReaderInfo();
      } catch (err) {
        reader = null;
        cwsError = cwsError || `reader lookup failed: ${err.message}`;
      }
    }

    const cwsReachable = Boolean(cws?.ok);
    const readerDetected = Boolean(reader);
    const credentialsOk = this.convergeConfigured() && this.vendorIdConfigured();
    const gatewayReady = Boolean(this.paymentGatewayId);
    const ready = cwsReachable && readerDetected && credentialsOk;

    let message;
    if (!cwsReachable) {
      message = `CWS unreachable (${cwsError || "ping failed"}). Install Commerce Web Services and confirm https://localhost:9790`;
    } else if (!this.vendorIdConfigured() || !this.convergeConfigured()) {
      message =
        "Set CONVERGE_SSL_MERCHANT_ID, CONVERGE_SSL_USER_ID, CONVERGE_SSL_PIN, and CONVERGE_SSL_VENDOR_ID, then restart the bridge";
    } else if (!readerDetected) {
      message =
        "CWS is up but no card reader is detected. Connect the Ingenico USB terminal and Refresh Devices in ConvergeConnect";
    } else if (gatewayReady) {
      message = "CWS bridge ready — payment gateway open";
    } else {
      message = "CWS reachable with reader detected — gateway opens on first sale";
    }

    return {
      success: true,
      status: this.activeChanId ? "busy" : "idle",
      ready,
      bridge_online: true,
      sdk_integrated: true,
      mode: "cws",
      configured: this.convergeConfigured(),
      credentials_configured: credentialsOk,
      vendor_id_configured: this.vendorIdConfigured(),
      converge_configured: this.convergeConfigured(),
      gateway_open: gatewayReady,
      gateway_ready: gatewayReady,
      payment_gateway_id: this.paymentGatewayId,
      gateway_error: this.gatewayError,
      cws_reachable: cwsReachable,
      cws_error: cwsError,
      reader_detected: readerDetected,
      card_reader: reader,
      terminal_type: this.terminalType,
      terminal_model: this.terminalModel || null,
      terminal_serial: this.terminalSerial || null,
      terminal_connection: this.terminalType === "ingenico" ? "usb" : "network",
      terminal_ip: this.terminalType === "pax" ? this.terminalIp || null : null,
      converge_merchant_id: this.credentials.merchantId || null,
      message
    };
  }
}
