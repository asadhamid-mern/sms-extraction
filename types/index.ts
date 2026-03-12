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
  created_at?: string;
  updated_at?: string;
}

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
