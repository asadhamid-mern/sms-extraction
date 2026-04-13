/**
 * VAS Platform — universal subscription API (v2 guide).
 * Server-side only. URLs overridable via env for staging.
 */

export const VAS_PIN_REQUEST_URL =
  process.env.VAS_PIN_REQUEST_URL ??
  'https://universal-subscription-api.vclipss.com/pinrequest';

export const VAS_PIN_VERIFY_URL =
  process.env.VAS_PIN_VERIFY_URL ??
  'https://universal-subscription-api.vclipss.com/pinverify';

export interface VasPinRequestBody {
  msisdn?: string;
  userTelcoServiceId: number;
  adAgencyCampaignId: number;
  adAgencyCampaignTransactionId: string;
  userIP: string;
  ua: string;
}

export interface VasApiResponse {
  status: string;
  errorCode: number;
  responseMessage: string;
}

function normalizeVasResponse(raw: Record<string, unknown>): VasApiResponse {
  const ec = raw.errorCode ?? raw.ErrorCode ?? raw.error_code;
  const num = typeof ec === 'number' ? ec : parseInt(String(ec ?? -1), 10);
  return {
    status: String(raw.status ?? raw.Status ?? ''),
    errorCode: Number.isFinite(num) ? num : -1,
    responseMessage: String(
      raw.responseMessage ?? raw.ResponseMessage ?? raw.message ?? ''
    ),
  };
}

export async function vasPinRequest(
  body: VasPinRequestBody
): Promise<VasApiResponse> {
  const payload: Record<string, unknown> = {
    userTelcoServiceId: body.userTelcoServiceId,
    adAgencyCampaignId: body.adAgencyCampaignId,
    adAgencyCampaignTransactionId: body.adAgencyCampaignTransactionId,
    userIP: body.userIP,
    ua: body.ua,
  };
  if (body.msisdn && body.msisdn.replace(/\D/g, '').length >= 6) {
    payload.msisdn = body.msisdn.replace(/^\+/, '');
  }

  const res = await fetch(VAS_PIN_REQUEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      status: 'FAILED',
      errorCode: -1,
      responseMessage: text.slice(0, 200),
    };
  }
  return normalizeVasResponse(raw);
}

export async function vasPinRequestWithRetry(
  body: VasPinRequestBody,
  maxAttempts = 3
): Promise<VasApiResponse> {
  const delays = [1000, 3000, 10000];
  let last: VasApiResponse = {
    status: 'FAILED',
    errorCode: 6,
    responseMessage: 'No response',
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await vasPinRequest(body);
    if (last.errorCode !== 50 && last.errorCode !== 6) return last;
    if (attempt < maxAttempts - 1) {
      await new Promise(r => setTimeout(r, delays[attempt] ?? 3000));
    }
  }
  return last;
}

export async function vasPinVerify(
  adAgencyCampaignTransactionId: string,
  pin: string
): Promise<VasApiResponse> {
  const res = await fetch(VAS_PIN_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adAgencyCampaignTransactionId,
      pin: String(pin).replace(/\D/g, ''),
    }),
  });

  const text = await res.text();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {
      status: 'FAILED',
      errorCode: -1,
      responseMessage: text.slice(0, 200),
    };
  }
  return normalizeVasResponse(raw);
}

/** Flow buckets per VAS guide §5 */
export function vasPinRequestFlow(code: number): 'active' | 'cg' | 'own' | 'pin_ok' | 'blocked' | 'retry_client' {
  if (code === 0) return 'pin_ok';
  if (code === 1 || code === 49) return 'active';
  if (code === 10000 || code === 30000 || code === 40000 || code === 50000) return 'cg';
  if (code === 20000) return 'own';
  if (code === 48 || code === 52 || code === 53) return 'blocked';
  return 'retry_client';
}
