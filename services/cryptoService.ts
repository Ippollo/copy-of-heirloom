
// Generates a random salt for key derivation
export const generateSalt = (): string => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Derives a CryptoKey from the user's passcode and salt using PBKDF2
export const deriveKey = async (passcode: string, salt: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passcode),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const saltBuffer = new Uint8Array(salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

// Encrypts text or JSON data
export const encryptData = async (key: CryptoKey, data: any): Promise<{ iv: string; content: string }> => {
  const enc = new TextEncoder();
  const encoded = enc.encode(JSON.stringify(data));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    encoded
  );

  const encryptedArray = new Uint8Array(encrypted);
  const content = Array.from(encryptedArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const ivString = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');

  return { iv: ivString, content };
};

// Decrypts text or JSON data
export const decryptData = async (key: CryptoKey, ivHex: string, encryptedHex: string): Promise<any> => {
  try {
      const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
      const encryptedArray = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedArray
      );
    
      const dec = new TextDecoder();
      return JSON.parse(dec.decode(decrypted));
  } catch (e) {
      console.error("Decryption failed", e);
      throw new Error("Failed to decrypt data. Key may be incorrect.");
  }
};

// Encrypts binary data (Blobs/ArrayBuffers)
export const encryptBuffer = async (key: CryptoKey, buffer: ArrayBuffer): Promise<{ iv: string; content: ArrayBuffer }> => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        buffer
    );
    const ivString = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
    return { iv: ivString, content: encrypted };
};

// Decrypts binary data
export const decryptBuffer = async (key: CryptoKey, ivHex: string, buffer: ArrayBuffer): Promise<ArrayBuffer> => {
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        buffer
    );
};
