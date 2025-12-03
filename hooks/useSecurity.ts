
import { useState, useEffect } from 'react';
import { generateSalt, deriveKey } from '../services/cryptoService';
import { setDbEncryptionKey } from '../services/dbService';

export function useSecurity() {
  const [isLocked, setIsLocked] = useState(false);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [encryptionSalt, setEncryptionSalt] = useState<string | null>(null);
  const [passcodeValidator, setPasscodeValidator] = useState<string | null>(null);

  useEffect(() => {
    const salt = localStorage.getItem('vocal_journal_salt');
    const validator = localStorage.getItem('vocal_journal_validator');
    
    if (salt && validator) {
        setEncryptionSalt(salt);
        setPasscodeValidator(validator);
        setIsLocked(true);
    }
    setIsAppLoaded(true);
  }, []);

  const handleUnlock = async (code: string) => {
      if (!encryptionSalt || !passcodeValidator) return false;
      
      const enc = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(code + encryptionSalt));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      if (hashHex === passcodeValidator) {
          const key = await deriveKey(code, encryptionSalt);
          setDbEncryptionKey(key);
          setIsLocked(false);
          return true;
      }
      return false;
  };

  const lockApp = () => {
      setDbEncryptionKey(null);
      setIsLocked(true);
  }

  const updatePasscodeConfig = async (newCode: string | null) => {
      if (newCode) {
          const salt = generateSalt();
          const enc = new TextEncoder();
          const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(newCode + salt));
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const validator = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

          localStorage.setItem('vocal_journal_salt', salt);
          localStorage.setItem('vocal_journal_validator', validator);
          
          setEncryptionSalt(salt);
          setPasscodeValidator(validator);
          
          return await deriveKey(newCode, salt);
      } else {
          localStorage.removeItem('vocal_journal_salt');
          localStorage.removeItem('vocal_journal_validator');
          setEncryptionSalt(null);
          setPasscodeValidator(null);
          setDbEncryptionKey(null);
          return null;
      }
  };

  return {
      isLocked,
      isAppLoaded,
      encryptionSalt,
      passcodeValidator,
      handleUnlock,
      lockApp,
      updatePasscodeConfig
  };
}
