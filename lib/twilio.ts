/**
 * Twilio Verify API wrapper — sends and checks OTP via SMS.
 * Server-side only. Requires env vars:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID
 */

const TWILIO_BASE = 'https://verify.twilio.com/v2';

function getCredentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!sid || !token || !serviceSid) {
    return null;
  }
  return { sid, token, serviceSid };
}

function authHeader(sid: string, token: string): string {
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

export interface TwilioSendResult {
  success: boolean;
  status?: string;
  error?: string;
}

export interface TwilioVerifyResult {
  success: boolean;
  status?: string;   // 'approved' | 'pending' | 'canceled'
  valid?: boolean;
  error?: string;
}

/**
 * Send OTP to a phone number via Twilio Verify.
 * Phone must include country code, e.g. "+19175551234"
 */
export async function twilioSendOTP(phone: string): Promise<TwilioSendResult> {
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  try {
    const res = await fetch(
      `${TWILIO_BASE}/Services/${creds.serviceSid}/Verifications`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader(creds.sid, creds.token),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          Channel: 'sms',
        }),
      }
    );

    const data = await res.json();
    if (res.ok && data.status) {
      console.log('[Twilio] OTP sent to', phone, 'status:', data.status);
      return { success: true, status: data.status };
    }

    console.error('[Twilio] Send OTP error:', data);
    return { success: false, error: data.message || 'Failed to send OTP' };
  } catch (e) {
    console.error('[Twilio] Send OTP exception:', e);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Verify OTP code for a phone number.
 */
export async function twilioVerifyOTP(phone: string, code: string): Promise<TwilioVerifyResult> {
  const creds = getCredentials();
  if (!creds) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  try {
    const res = await fetch(
      `${TWILIO_BASE}/Services/${creds.serviceSid}/VerificationCheck`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader(creds.sid, creds.token),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          Code: code,
        }),
      }
    );

    const data = await res.json();
    if (res.ok) {
      const valid = data.status === 'approved';
      console.log('[Twilio] Verify OTP:', data.status, 'valid:', valid);
      return { success: true, status: data.status, valid };
    }

    console.error('[Twilio] Verify OTP error:', data);
    return { success: false, error: data.message || 'Verification failed' };
  } catch (e) {
    console.error('[Twilio] Verify OTP exception:', e);
    return { success: false, error: 'Network error' };
  }
}
