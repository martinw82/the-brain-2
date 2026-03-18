import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) throw new Error('FATAL: API_KEY_ENCRYPTION_SECRET env var not set');
  return scryptSync(secret, 'the-brain-salt', 32);
}

export function encryptApiKey(plaintext) {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `aes:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptApiKey(stored) {
  if (!stored) return null;
  // Backward compatibility: handle old base64 format during migration
  if (stored.startsWith('enc:')) {
    return Buffer.from(stored.slice(4), 'base64').toString();
  }
  if (!stored.startsWith('aes:')) return stored;
  const key = getEncryptionKey();
  const [, ivHex, authTagHex, ciphertextHex] = stored.split(':');
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return decipher.update(ciphertextHex, 'hex', 'utf8') + decipher.final('utf8');
}
