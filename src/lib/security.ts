export function sanitizeHref(raw: string): string {
  const value = raw.trim();
  if (!value) return 'about:blank';
  if (/[\r\n\t]/.test(value)) return 'about:blank';

  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' || url.protocol === 'tel:') {
      return value;
    }
    return 'about:blank';
  } catch {
    return 'about:blank';
  }
}

export function sanitizeImageSrc(raw: string): string {
  const value = raw.trim();
  if (!value) return 'about:blank';
  if (/[\r\n\t]/.test(value)) return 'about:blank';

  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return value;
    }
    return 'about:blank';
  } catch {
    return 'about:blank';
  }
}

/**
 * Simple AES-GCM encryption for local sensitive config (S3 keys, etc.)
 * Note: The key derivation uses a fixed salt for simplicity in this demo,
 * but in production should use a user-specific salt or master password.
 * Here we use a generated device-specific ID as a weak "key" just to prevent plain text storage.
 */

const ENC_ALGO = { name: 'AES-GCM', length: 256 };

async function getKey(password: string): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
    );
    return window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: enc.encode('betterwriter-salt-v1'), // In real app, store random salt per user
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        ENC_ALGO,
        true,
        ['encrypt', 'decrypt']
    );
}

export async function encryptData(text: string, secret: string): Promise<string> {
    try {
        const key = await getKey(secret);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(text);
        
        const encrypted = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            encoded
        );

        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
        
        return `${ivHex}:${encryptedHex}`;
    } catch (e) {
        console.error('Encryption failed', e);
        return '';
    }
}

export async function decryptData(ciphertext: string, secret: string): Promise<string> {
    try {
        const [ivHex, encryptedHex] = ciphertext.split(':');
        if (!ivHex || !encryptedHex) return '';

        const key = await getKey(secret);
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        const decrypted = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            encrypted
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error('Decryption failed', e);
        return '';
    }
}
