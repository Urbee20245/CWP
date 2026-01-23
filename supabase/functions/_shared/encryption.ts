import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const ENCRYPTION_KEY = Deno.env.get('SMTP_ENCRYPTION_KEY');

if (!ENCRYPTION_KEY) {
    console.error("[encryption] CRITICAL: SMTP_ENCRYPTION_KEY is missing.");
    throw new Error("Encryption key is missing.");
}

// Initialize Supabase Admin client for RPC calls
const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

export async function encryptSecret(plaintext: string): Promise<string> {
    const { data, error } = await supabaseAdmin.rpc('encrypt_secret', {
        plaintext: plaintext,
        key: ENCRYPTION_KEY,
    });

    if (error) {
        console.error("[encryption] Encryption failed:", error);
        throw new Error("Encryption failed.");
    }
    return data as string;
}

export async function decryptSecret(ciphertext: string): Promise<string> {
    const { data, error } = await supabaseAdmin.rpc('decrypt_secret', {
        ciphertext: ciphertext,
        key: ENCRYPTION_KEY,
    });

    if (error) {
        console.error("[encryption] Decryption failed:", error);
        throw new Error("Decryption failed.");
    }
    return data as string;
}

// NOTE: We need to define the RPC functions in SQL for pgcrypto to work.