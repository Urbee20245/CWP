import CryptoJS from 'https://esm.sh/crypto-js@4.2.0?target=deno';

const ENCRYPTION_KEY = Deno.env.get('SMTP_ENCRYPTION_KEY');

if (!ENCRYPTION_KEY) {
  console.error("[encryption] CRITICAL: SMTP_ENCRYPTION_KEY is missing. Decryption will fail.");
}

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption failed: SMTP_ENCRYPTION_KEY is not set in Supabase Secrets.");
  }
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

export function decrypt(cipherText: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("Decryption failed: SMTP_ENCRYPTION_KEY is not set in Supabase Secrets.");
  }
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) {
        // This handles cases where decryption succeeds but results in an empty string (e.g., wrong key)
        throw new Error("Decryption resulted in empty string. Check if the stored password is valid or if SMTP_ENCRYPTION_KEY is correct.");
    }
    return result;
  } catch (e: any) {
    console.error("[encryption] Decryption failed:", e.message);
    throw new Error(`Decryption failed: ${e.message}. Verify SMTP_ENCRYPTION_KEY.`);
  }
}