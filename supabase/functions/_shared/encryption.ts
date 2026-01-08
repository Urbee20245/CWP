import CryptoJS from 'https://esm.sh/crypto-js@4.2.0?target=deno';

const ENCRYPTION_KEY = Deno.env.get('SMTP_ENCRYPTION_KEY');

if (!ENCRYPTION_KEY) {
  console.error("[encryption] SMTP_ENCRYPTION_KEY is missing. Encryption/Decryption will fail.");
}

export function encrypt(text: string): string {
  if (!ENCRYPTION_KEY) return text;
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

export function decrypt(cipherText: string): string {
  if (!ENCRYPTION_KEY) return cipherText;
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error("[encryption] Decryption failed:", e);
    return '';
  }
}