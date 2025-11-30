import { safeStorage } from 'electron';

/**
 * Security utilities for encrypting/decrypting sensitive data
 * Uses Electron's safeStorage which leverages OS-level encryption:
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: Secret Service API / libsecret
 */

/**
 * Check if encryption is available
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Encrypt a string value
 * Returns base64-encoded encrypted buffer
 */
export function encrypt(plaintext: string): string {
  if (!isEncryptionAvailable()) {
    console.warn('Encryption not available on this system. Storing credentials in plaintext (NOT RECOMMENDED)');
    return plaintext;
  }

  try {
    const buffer = safeStorage.encryptString(plaintext);
    return buffer.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded encrypted buffer
 */
export function decrypt(encrypted: string): string {
  if (!isEncryptionAvailable()) {
    console.warn('Encryption not available on this system. Returning plaintext');
    return encrypted;
  }

  try {
    const buffer = Buffer.from(encrypted, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypt an object by converting to JSON first
 */
export function encryptObject<T>(obj: T): string {
  const json = JSON.stringify(obj);
  return encrypt(json);
}

/**
 * Decrypt and parse an encrypted object
 */
export function decryptObject<T>(encrypted: string): T {
  const json = decrypt(encrypted);
  return JSON.parse(json) as T;
}

/**
 * Securely hash a value using SHA-256
 * Useful for comparing values without storing them
 */
export async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random string for IDs, tokens, etc.
 */
export function generateRandomString(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues)
    .map((val) => chars[val % chars.length])
    .join('');
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeForLog(data: string): string {
  if (!data || data.length < 8) {
    return '***';
  }
  // Show first 4 and last 4 characters
  return `${data.substring(0, 4)}...${data.substring(data.length - 4)}`;
}
