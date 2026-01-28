-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to encrypt secrets using AES-256
CREATE OR REPLACE FUNCTION encrypt_secret(plaintext TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(
    encrypt(
      plaintext::bytea,
      key::bytea,
      'aes'
    ),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt secrets
CREATE OR REPLACE FUNCTION decrypt_secret(ciphertext TEXT, key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN convert_from(
    decrypt(
      decode(ciphertext, 'base64'),
      key::bytea,
      'aes'
    ),
    'utf8'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION encrypt_secret(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_secret(TEXT, TEXT) TO service_role;
