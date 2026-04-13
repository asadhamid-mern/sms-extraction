export function generateTransactionId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  )
    .toUpperCase()
    .slice(0, 16);
}

/** VAS guide recommends UUID for adAgencyCampaignTransactionId. */
export function newVasTransactionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return generateTransactionId();
}

/**
 * Masks middle digits of an MSISDN.
 * Input:  "96550670656"
 * Output: "+965 50XXX656"
 */
export function maskMsisdn(msisdn: string): string {
  if (!msisdn) return '';
  const local = msisdn.startsWith('965') ? msisdn.slice(3) : msisdn;
  if (local.length < 4) return `+965 ${local}`;
  const first = local.slice(0, 2);
  const last = local.slice(-3);
  const midLen = Math.max(local.length - 5, 1);
  const mid = 'X'.repeat(midLen);
  return `+965 ${first}${mid}${last}`;
}
