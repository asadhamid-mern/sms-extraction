import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { TransactionLog, TransactionStatus } from '@/types';

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !key ||
    url === 'your_supabase_url' ||
    key === 'your_supabase_anon_key' ||
    !url.startsWith('http')
  ) {
    console.warn('[Supabase] Missing or placeholder env vars — logging disabled.');
    return null;
  }

  _client = createClient(url, key);
  return _client;
}

export async function logTransaction(
  data: Omit<TransactionLog, 'id' | 'created_at' | 'updated_at'>
) {
  const client = getClient();
  if (!client) return;
  try {
    const { error } = await client
      .from('subscriptions')
      .upsert(
        { ...data, updated_at: new Date().toISOString() },
        { onConflict: 'transaction_id' }
      );

    if (error) console.error('[Supabase] logTransaction error:', error);
  } catch (e) {
    // Never break the user flow if Supabase is unreachable — logging is best-effort only.
    console.error('[Supabase] logTransaction exception:', e);
  }
}

export async function updateTransactionStatus(
  transactionId: string,
  status: TransactionStatus
) {
  const client = getClient();
  if (!client) return;
  try {
    const { error } = await client
      .from('subscriptions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('transaction_id', transactionId);

    if (error) console.error('[Supabase] updateTransactionStatus error:', error);
  } catch (e) {
    console.error('[Supabase] updateTransactionStatus exception:', e);
  }
}
