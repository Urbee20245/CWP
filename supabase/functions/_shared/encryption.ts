import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

/**
 * NOTE:
 * Many edge functions import this module (Cal.com, Twilio, etc.).
 * We must NOT throw at module import time, otherwise any function that imports it
 * will fail to load and the client will see generic "Unable to load …" errors.
 */

function getEncryptionKey(): string | null {
  // Backwards compatible secret name + safer fallbacks.
  return (
    Deno.env.get('SMTP_ENCRYPTION_KEY') ||
    Deno.env.get('ENCRYPTION_KEY') ||
    Deno.env.get('CWP_ENCRYPTION_KEY') ||
    null
  );
}

// Initialize Supabase Admin client for RPC calls
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = getEncryptionKey();
  if (!key) {
    console.error('[encryption] CRITICAL: Encryption key is missing (SMTP_ENCRYPTION_KEY / ENCRYPTION_KEY / CWP_ENCRYPTION_KEY).');
    throw new Error('Encryption key is missing.');
  }

  const { data, error } = await supabaseAdmin.rpc('encrypt_secret', {
    plaintext,
    key,
  });

  if (error) {
    console.error('[encryption] Encryption failed:', error);
    throw new Error('Encryption failed.');
  }
  return data as string;
}

export async function decryptSecret(ciphertext: string): Promise<string> {
  const key = getEncryptionKey();
  if (!key) {
    console.error('[encryption] CRITICAL: Encryption key is missing (SMTP_ENCRYPTION_KEY / ENCRYPTION_KEY / CWP_ENCRYPTION_KEY).');
    throw new Error('Encryption key is missing.');
  }

  const { data, error } = await supabaseAdmin.rpc('decrypt_secret', {
    ciphertext,
    key,
  });

  if (error) {
    console.error('[encryption] Decryption failed:', error);
    throw new Error('Decryption failed.');
  }
  return data as string;
}

// NOTE: We need to define the RPC functions in SQL for pgcrypto to work.