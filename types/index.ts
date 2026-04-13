// ── Transaction & Subscription types ──────────────────────────────

export type TransactionStatus =
  | 'initiated'
  | 'pin_requested'
  | 'pin_verified'
  | 'failed';

export interface TransactionLog {
  id?: string;
  transaction_id: string;
  msisdn: string;
  status: TransactionStatus;
  user_ip: string;
  user_agent: string;
  country_code?: string;
  telco_id?: string;
  telco_name?: string;
  flow_type?: string;         // 'dcb' | 'global' | 'kuwait_dcb'
  error_code?: number;
  vas_response?: string;
  created_at?: string;
  updated_at?: string;
}

// ── Kuwait DCB (existing, untouched) ─────────────────────────────

export interface PinRequestPayload {
  MSISDN: string;
  TransactionId: string;
  CampaignURL: string;
  ContentURL: string;
  Headers: string;
  UserId: string;
  Password: string;
  ProductId: string;
  TelcoId: string;
  UserIP: string;
  ShortCode: string;
  ConfirmButtonHTMLId: string;
}

export interface PinRequestResponse {
  Status: string;
  JS: string;
}

export interface PinVerifyPayload {
  TransactionId: string;
  Pin: string;
}

export interface PinVerifyResponse {
  Status: string;
}

export interface GetIPResponse {
  ip: string;
}

// ── Telco (multi-telco VAS) ──────────────────────────────────────

export interface Telco {
  id: string;
  name: string;
  country_code: string;
  country_name: string;
  user_telco_service_id: number;
  ad_agency_campaign_id: number;
  is_enabled: boolean;
  callback_url: string;
  success_page_url: string;
  failure_page_url: string;
  schedule_start: string;      // 'HH:MM'
  schedule_end: string;        // 'HH:MM'
  timezone: string;            // IANA timezone
  priority: number;
  created_at?: string;
  updated_at?: string;
}

// ── Country ──────────────────────────────────────────────────────

export type FlowType = 'dcb' | 'global' | 'disabled';

export interface Country {
  code: string;
  name: string;
  is_enabled: boolean;
  flow_type: FlowType;
  created_at?: string;
  updated_at?: string;
}

// ── Global User (Google Sign-In + Twilio) ────────────────────────

export type SubscriptionStatus = 'none' | 'pending_otp' | 'active' | 'expired';

export interface GlobalUser {
  id: string;
  google_id: string | null;
  email: string;
  name: string;
  phone: string;
  phone_verified: boolean;
  country_code: string;
  session_token: string | null;
  subscription_status: SubscriptionStatus;
  created_at?: string;
  updated_at?: string;
}

// ── GeoIP ────────────────────────────────────────────────────────

export interface GeoIPResult {
  countryCode: string;
  countryName: string;
  city?: string;
  isp?: string;
}
