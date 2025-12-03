
import { JournalEntry } from '../types';
import { encryptData, decryptData, encryptBuffer, decryptBuffer } from './cryptoService';

const DB_NAME = 'VocalJournalDB';
const DB_VERSION = 8; 
const ENTRY_STORE = 'entries';
const AUDIO_STORE = 'audio_files';
const IMAGE_STORE = 'images'; 

// Key Management for DB operations
let currentCryptoKey: CryptoKey | null = null;

export const setDbEncryptionKey = (key: CryptoKey | null) => {
    currentCryptoKey = key;
};

export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        db.createObjectStore(ENTRY_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE);
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onblocked = () => {
       console.warn("Database upgrade blocked.");
    };

    request.onerror = (event) => {
      console.error("Database error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveEntry = async (entry: JournalEntry): Promise<void> => {
  const db = await openDB();
  return new Promise(async (resolve, reject) => {
    try {
        const storeNames = Array.from(db.objectStoreNames);
        const storesToUse = [ENTRY_STORE, AUDIO_STORE, IMAGE_STORE].filter(name => storeNames.includes(name));
        const transaction = db.transaction(storesToUse, 'readwrite');
        
        // --- 1. ENTRY METADATA ---
        const entryStore = transaction.objectStore(ENTRY_STORE);
        const { audioBlob, snapshotBlob, generatedImageBlob, ...metaData } = entry;
        
        let dataToSave = metaData;
        
        // ENCRYPTION
        if (currentCryptoKey) {
            // We keep ID and createdAt visible for sorting/indexing, but encrypt the rest
            const sensitiveData = {
                transcription: metaData.transcription,
                summary: metaData.summary,
                title: metaData.title,
                mood: metaData.mood,
                tags: metaData.tags,
                insights: metaData.insights,
                location: metaData.location,
                prompt: metaData.prompt,
                inputType: metaData.inputType
            };
            const encrypted = await encryptData(currentCryptoKey, sensitiveData);
            
            dataToSave = {
                id: metaData.id,
                createdAt: metaData.createdAt,
                isProcessing: metaData.isProcessing,
                isEncrypted: true,
                iv: encrypted.iv,
                cipherText: encrypted.content
            } as any;
        }

        entryStore.put(dataToSave);
        
        // --- 2. AUDIO BLOB ---
        if (audioBlob && storesToUse.includes(AUDIO_STORE)) {
          const audioStore = transaction.objectStore(AUDIO_STORE);
          if (currentCryptoKey) {
              const buffer = await audioBlob.arrayBuffer();
              const encBuffer = await encryptBuffer(currentCryptoKey, buffer);
              audioStore.put({ iv: encBuffer.iv, data: encBuffer.content, type: audioBlob.type, isEncrypted: true }, entry.id);
          } else {
              audioStore.put(audioBlob, entry.id);
          }
        }

        // --- 3. IMAGES ---
        if (storesToUse.includes(IMAGE_STORE)) {
            const imageStore = transaction.objectStore(IMAGE_STORE);
            
            const processImage = async (blob: Blob, key: string) => {
                if (currentCryptoKey) {
                    const buffer = await blob.arrayBuffer();
                    const encBuffer = await encryptBuffer(currentCryptoKey, buffer);
                    imageStore.put({ iv: encBuffer.iv, data: encBuffer.content, type: blob.type, isEncrypted: true }, key);
                } else {
                    imageStore.put(blob, key);
                }
            };

            if (snapshotBlob) await processImage(snapshotBlob, `${entry.id}_snapshot`);
            if (generatedImageBlob) await processImage(generatedImageBlob, `${entry.id}_art`);
        }

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    } catch (err) {
        reject(err);
    }
  });
};

export const getAllEntries = async (): Promise<JournalEntry[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(ENTRY_STORE)) {
        resolve([]);
        return;
    }
    const transaction = db.transaction(ENTRY_STORE, 'readonly');
    const store = transaction.objectStore(ENTRY_STORE);
    const request = store.getAll();

    request.onsuccess = async () => {
      const results = request.result;

      // PARALLEL DECRYPTION OPTIMIZATION
      // Instead of decrypting sequentially in a for-loop, we map to promises and execute in parallel.
      const processingPromises = results.map(async (item: any) => {
          if (item.isEncrypted) {
              if (currentCryptoKey) {
                  try {
                      const decryptedData = await decryptData(currentCryptoKey, item.iv, item.cipherText);
                      return {
                          id: item.id,
                          createdAt: item.createdAt,
                          isProcessing: item.isProcessing,
                          ...decryptedData
                      } as JournalEntry;
                  } catch (e) {
                      console.error(`Failed to decrypt entry ${item.id}`, e);
                      // Return placeholder
                      return {
                          ...item,
                          title: "Locked Memory",
                          transcription: "Decryption failed. Please check your passcode.",
                          tags: [],
                          insights: [],
                          mood: "Locked"
                      } as JournalEntry;
                  }
              } else {
                  // Key missing
                  return {
                       id: item.id,
                       createdAt: item.createdAt,
                       isProcessing: false,
                       title: "Encrypted Entry",
                       transcription: "This entry is encrypted.",
                       mood: "Locked",
                       tags: [],
                       insights: []
                  } as JournalEntry;
              }
          } else {
              return item as JournalEntry;
          }
      });

      const decryptedResults = await Promise.all(processingPromises);
      
      // Sort descending by date
      decryptedResults.sort((a, b) => b.createdAt - a.createdAt);
      resolve(decryptedResults);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getEntryAudio = async (id: string): Promise<Blob | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        resolve(undefined);
        return;
    }
    const transaction = db.transaction(AUDIO_STORE, 'readonly');
    const store = transaction.objectStore(AUDIO_STORE);
    const request = store.get(id);
    request.onsuccess = async () => {
        const result = request.result;
        if (!result) { resolve(undefined); return; }

        if (result.isEncrypted && result.data && result.iv) {
            if (currentCryptoKey) {
                try {
                    const decBuffer = await decryptBuffer(currentCryptoKey, result.iv, result.data);
                    resolve(new Blob([decBuffer], { type: result.type || 'audio/webm' }));
                } catch(e) {
                    console.error("Audio decrypt failed", e);
                    resolve(undefined);
                }
            } else {
                resolve(undefined); 
            }
        } else if (result instanceof Blob) {
            resolve(result);
        } else {
            resolve(undefined);
        }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getEntryImage = async (id: string, type: 'snapshot' | 'art'): Promise<Blob | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        resolve(undefined);
        return;
    }
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    const store = transaction.objectStore(IMAGE_STORE);
    const request = store.get(`${id}_${type}`);
    request.onsuccess = async () => {
        const result = request.result;
        if (!result) { resolve(undefined); return; }

        if (result.isEncrypted && result.data && result.iv) {
             if (currentCryptoKey) {
                try {
                    const decBuffer = await decryptBuffer(currentCryptoKey, result.iv, result.data);
                    resolve(new Blob([decBuffer], { type: result.type || 'image/jpeg' }));
                } catch(e) {
                    resolve(undefined);
                }
             } else {
                 resolve(undefined);
             }
        } else if (result instanceof Blob) {
            resolve(result);
        } else {
            resolve(undefined);
        }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteEntry = async (id: string): Promise<void> => {
  try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        try {
            if (!db.objectStoreNames.contains(ENTRY_STORE)) {
                resolve();
                return;
            }
            const storeNames = Array.from(db.objectStoreNames);
            const storesToUse = [ENTRY_STORE, AUDIO_STORE, IMAGE_STORE].filter(name => storeNames.includes(name));
            if (storesToUse.length === 0) { resolve(); return; }

            const transaction = db.transaction(storesToUse, 'readwrite');
            storesToUse.forEach(storeName => {
                const store = transaction.objectStore(storeName);
                if (storeName === ENTRY_STORE || storeName === AUDIO_STORE) {
                    store.delete(id);
                } else if (storeName === IMAGE_STORE) {
                    store.delete(`${id}_snapshot`);
                    store.delete(`${id}_art`);
                }
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        } catch (error) {
            reject(error);
        }
      });
  } catch (err) {
      throw err;
  }
};

export const deleteEntryImage = async (id: string, type: 'snapshot' | 'art'): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(IMAGE_STORE)) { resolve(); return; }
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    store.delete(`${id}_${type}`);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

const IDENTITY_KEY = 'user_identity_selfie';

export const saveUserIdentityImage = async (blob: Blob): Promise<void> => {
  const db = await openDB();
  return new Promise(async (resolve, reject) => {
    if (!db.objectStoreNames.contains(IMAGE_STORE)) { reject(new Error("Image store missing")); return; }
    const transaction = db.transaction(IMAGE_STORE, 'readwrite');
    const store = transaction.objectStore(IMAGE_STORE);
    
    if (currentCryptoKey) {
        const buffer = await blob.arrayBuffer();
        const enc = await encryptBuffer(currentCryptoKey, buffer);
        store.put({ iv: enc.iv, data: enc.content, type: blob.type, isEncrypted: true }, IDENTITY_KEY);
    } else {
        store.put(blob, IDENTITY_KEY);
    }
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getUserIdentityImage = async (): Promise<Blob | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(IMAGE_STORE)) { resolve(undefined); return; }
    const transaction = db.transaction(IMAGE_STORE, 'readonly');
    const store = transaction.objectStore(IMAGE_STORE);
    const request = store.get(IDENTITY_KEY);
    request.onsuccess = async () => {
        const result = request.result;
        if (!result) { resolve(undefined); return; }
        
        if (result.isEncrypted && result.data) {
             if (currentCryptoKey) {
                 try {
                     const buf = await decryptBuffer(currentCryptoKey, result.iv, result.data);
                     resolve(new Blob([buf], { type: result.type || 'image/jpeg' }));
                 } catch (e) { resolve(undefined); }
             } else { resolve(undefined); }
        } else if (result instanceof Blob) {
            resolve(result);
        } else {
            resolve(undefined);
        }
    };
    request.onerror = () => reject(request.error);
  });
};

// --- MIGRATION UTILS ---

export const migrateToEncrypted = async (key: CryptoKey): Promise<void> => {
    // 1. Load all plain data (currentCryptoKey is null)
    const oldKey = currentCryptoKey;
    currentCryptoKey = null; // Ensure we read plain
    const allEntries = await getAllEntries();
    
    // 2. Set new key
    currentCryptoKey = key;

    // 3. Re-save everything (saveEntry handles encryption based on currentCryptoKey)
    for (const entry of allEntries) {
        // We need to fetch blobs manually because getAllEntries doesn't return them by default for performance in list
        const audioBlob = await getEntryAudio(entry.id);
        const snapshotBlob = await getEntryImage(entry.id, 'snapshot');
        const artBlob = await getEntryImage(entry.id, 'art');
        
        const fullEntry = { ...entry, audioBlob, snapshotBlob, generatedImageBlob: artBlob };
        await saveEntry(fullEntry);
    }
    
    // Also migrate identity image
    currentCryptoKey = null;
    const identity = await getUserIdentityImage();
    if (identity) {
        currentCryptoKey = key;
        await saveUserIdentityImage(identity);
    }
    currentCryptoKey = key;
};

export const migrateToPlain = async (key: CryptoKey): Promise<void> => {
    // 1. Load all encrypted data
    currentCryptoKey = key;
    const allEntries = await getAllEntries();
    
    // 2. Re-save without key
    for (const entry of allEntries) {
        const audioBlob = await getEntryAudio(entry.id);
        const snapshotBlob = await getEntryImage(entry.id, 'snapshot');
        const artBlob = await getEntryImage(entry.id, 'art');
        
        // Temporarily disable key to write plain
        currentCryptoKey = null; 
        const fullEntry = { ...entry, audioBlob, snapshotBlob, generatedImageBlob: artBlob };
        await saveEntry(fullEntry);
        
        // Restore key for next read
        currentCryptoKey = key;
    }

    const identity = await getUserIdentityImage();
    if (identity) {
        currentCryptoKey = null;
        await saveUserIdentityImage(identity);
        currentCryptoKey = key;
    }
    
    currentCryptoKey = null;
};
