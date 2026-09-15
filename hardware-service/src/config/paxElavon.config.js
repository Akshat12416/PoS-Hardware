/**
 * PAX Technology Inc. / Elavon processor configuration.
 * Sourced from Elavon terminal setup (e.g. Southwest Farmers Market).
 * Use for PAX SDK or bridge: TID, MID, SSL/TCP hosts and ports.
 *
 * Override via env: PAX_ELAVON_TID, PAX_ELAVON_MID, PAX_ELAVON_SSL_HOST, etc.
 */

/** @type {Record<string, string|number|boolean>} */
const defaults = {
  /** Merchant ID (Visa/MasterCard) */
  pax_elavon_mid: "8045535591",
  /** DBA name */
  pax_elavon_dba: "SOUTHWEST FARMERS MARKET",
  /** MCC / SIC */
  pax_elavon_mcc: "5411",
  pax_elavon_mcc_desc: "GROCERY STORES, SUPERMARKETS",
  /** Bank number / terminal ID (short) */
  pax_elavon_bank_terminal_id: "007542",
  /** Full Terminal ID (TID) - required by processor */
  pax_elavon_tid: "0008045535591949",

  /** SSL (custom TCP/IP over SSL) - Elavon */
  pax_elavon_ssl_host: "prodgate02.viaconex.com",
  pax_elavon_ssl_port: 443,

  /** Custom TCP/IP (non-SSL) - Primary */
  pax_elavon_tcp_primary_host: "nettrans1.novainfo.net",
  pax_elavon_tcp_primary_port: 8100,
  /** Custom TCP/IP - Secondary */
  pax_elavon_tcp_secondary_host: "nettrans2.novainfo.net",
  pax_elavon_tcp_secondary_port: 8100,

  /** Dial-in (fallback) */
  pax_elavon_dial_primary: "800-741-3737",
  pax_elavon_dial_secondary: "800-972-4608",

  /** Acquirer */
  pax_elavon_acquirer: "Elavon",
  pax_elavon_acquirer_phone: "800-377-3962",
};

/**
 * Resolves PAX/Elavon config: defaults from terminal setup, overridable by env.
 * @returns {Record<string, string|number|boolean>}
 */
export function getPaxElavonConfig() {
  return {
    pax_elavon_mid: process.env.PAX_ELAVON_MID ?? defaults.pax_elavon_mid,
    pax_elavon_dba: process.env.PAX_ELAVON_DBA ?? defaults.pax_elavon_dba,
    pax_elavon_mcc: process.env.PAX_ELAVON_MCC ?? defaults.pax_elavon_mcc,
    pax_elavon_mcc_desc:
      process.env.PAX_ELAVON_MCC_DESC ?? defaults.pax_elavon_mcc_desc,
    pax_elavon_bank_terminal_id:
      process.env.PAX_ELAVON_BANK_TERMINAL_ID ??
      defaults.pax_elavon_bank_terminal_id,
    pax_elavon_tid: process.env.PAX_ELAVON_TID ?? defaults.pax_elavon_tid,

    pax_elavon_ssl_host:
      process.env.PAX_ELAVON_SSL_HOST ?? defaults.pax_elavon_ssl_host,
    pax_elavon_ssl_port: Number(
      process.env.PAX_ELAVON_SSL_PORT ?? defaults.pax_elavon_ssl_port
    ),

    pax_elavon_tcp_primary_host:
      process.env.PAX_ELAVON_TCP_PRIMARY_HOST ??
      defaults.pax_elavon_tcp_primary_host,
    pax_elavon_tcp_primary_port: Number(
      process.env.PAX_ELAVON_TCP_PRIMARY_PORT ??
      defaults.pax_elavon_tcp_primary_port
    ),
    pax_elavon_tcp_secondary_host:
      process.env.PAX_ELAVON_TCP_SECONDARY_HOST ??
      defaults.pax_elavon_tcp_secondary_host,
    pax_elavon_tcp_secondary_port: Number(
      process.env.PAX_ELAVON_TCP_SECONDARY_PORT ??
      defaults.pax_elavon_tcp_secondary_port
    ),

    pax_elavon_dial_primary:
      process.env.PAX_ELAVON_DIAL_PRIMARY ?? defaults.pax_elavon_dial_primary,
    pax_elavon_dial_secondary:
      process.env.PAX_ELAVON_DIAL_SECONDARY ??
      defaults.pax_elavon_dial_secondary,

    pax_elavon_acquirer:
      process.env.PAX_ELAVON_ACQUIRER ?? defaults.pax_elavon_acquirer,
    pax_elavon_acquirer_phone:
      process.env.PAX_ELAVON_ACQUIRER_PHONE ??
      defaults.pax_elavon_acquirer_phone,
  };
}

/**
 * Returns a minimal payload for the PAX bridge/SDK: TID, MID, and connection hints.
 * @returns {{ tid: string, mid: string, sslHost: string, sslPort: number, tcpPrimaryHost: string, tcpPrimaryPort: number }}
 */
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
    tcpSecondaryPort: Number(c.pax_elavon_tcp_secondary_port),
  };
}
