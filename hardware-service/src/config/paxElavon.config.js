/**
 * Elavon processor connection overlay for diagnostics and the CWS bridge.
 * Merchant identifiers come from environment variables only — no secrets in source.
 *
 * Override via env: PAX_ELAVON_TID, PAX_ELAVON_MID, PAX_ELAVON_SSL_HOST, etc.
 */

export function getPaxElavonConfig() {
  return {
    pax_elavon_mid:
      process.env.PAX_ELAVON_MID || process.env.CONVERGE_SSL_MERCHANT_ID || "",
    pax_elavon_dba:
      process.env.PAX_ELAVON_DBA || "SOUTHWEST FARMERS MARKET",
    pax_elavon_mcc: process.env.PAX_ELAVON_MCC || "5411",
    pax_elavon_mcc_desc:
      process.env.PAX_ELAVON_MCC_DESC || "GROCERY STORES, SUPERMARKETS",
    pax_elavon_bank_terminal_id:
      process.env.PAX_ELAVON_BANK_TERMINAL_ID || "",
    pax_elavon_tid: process.env.PAX_ELAVON_TID || "",

    pax_elavon_ssl_host:
      process.env.PAX_ELAVON_SSL_HOST || "prodgate02.viaconex.com",
    pax_elavon_ssl_port: Number(process.env.PAX_ELAVON_SSL_PORT || 443),

    pax_elavon_tcp_primary_host:
      process.env.PAX_ELAVON_TCP_PRIMARY_HOST || "nettrans1.novainfo.net",
    pax_elavon_tcp_primary_port: Number(
      process.env.PAX_ELAVON_TCP_PRIMARY_PORT || 8100
    ),
    pax_elavon_tcp_secondary_host:
      process.env.PAX_ELAVON_TCP_SECONDARY_HOST || "nettrans2.novainfo.net",
    pax_elavon_tcp_secondary_port: Number(
      process.env.PAX_ELAVON_TCP_SECONDARY_PORT || 8100
    ),

    pax_elavon_dial_primary:
      process.env.PAX_ELAVON_DIAL_PRIMARY || "800-741-3737",
    pax_elavon_dial_secondary:
      process.env.PAX_ELAVON_DIAL_SECONDARY || "800-972-4608",

    pax_elavon_acquirer: process.env.PAX_ELAVON_ACQUIRER || "Elavon",
    pax_elavon_acquirer_phone:
      process.env.PAX_ELAVON_ACQUIRER_PHONE || "800-377-3962"
  };
}

export function getPaxElavonConnectionPayload() {
  const c = getPaxElavonConfig();
  return {
    tid: String(c.pax_elavon_tid),
    mid: String(c.pax_elavon_mid),
    bankTerminalId: String(c.pax_elavon_bank_terminal_id),
    dba: String(c.pax_elavon_dba),
    sslHost: String(c.pax_elavon_ssl_host),
    sslPort: Number(c.pax_elavon_ssl_port),
    tcpPrimaryHost: String(c.pax_elavon_tcp_primary_host),
    tcpPrimaryPort: Number(c.pax_elavon_tcp_primary_port),
    tcpSecondaryHost: String(c.pax_elavon_tcp_secondary_host),
    tcpSecondaryPort: Number(c.pax_elavon_tcp_secondary_port)
  };
}
