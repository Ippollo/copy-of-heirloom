
import React, { useState, useEffect } from 'react';
import { Lock, Delete } from 'lucide-react';
import { HeirloomLogo } from './HeirloomLogo';

interface LockScreenProps {
  passcode: string | null; // Passcode hash/validator is handled in App, here we just might use it for visual confirmation if needed, but we mainly rely on onUnlock
  onUnlock: (code: string) => void;
  validatorHash?: string | null; // Optional: Used to verify visually before trying to decrypt
}

const LockScreen: React.FC<LockScreenProps> = ({ passcode, onUnlock, validatorHash }) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (input.length === 4) {
      // Simple UI validation if a hash is provided, otherwise pass up to App to try derivation
      // For this implementation, we will pass it up immediately, but let's assume App handles validation.
      onUnlock(input);
      // If validation fails, parent should trigger reset. But for simple flow:
      setTimeout(() => {
          // If input is still there after timeout, it implies failure if parent didn't unmount this component
          if (input.length === 4) {
             setError(true);
             setShake(true);
             setTimeout(() => {
               setInput('');
               setError(false);
               setShake(false);
             }, 500);
          }
      }, 500);
    }
  }, [input, onUnlock]);

  const handleNum = (num: number) => {
    if (input.length < 4) {
      setInput(prev => prev + num.toString());
    }
  };

  const handleBackspace = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#fdf8f6] flex flex-col items-center justify-center animate-in fade-in duration-500">
       <div className="flex flex-col items-center space-y-8 w-full max-w-sm px-8">
          
          <div className="flex flex-col items-center space-y-4">
             <div className="p-4 bg-brand-600 rounded-2xl shadow-xl shadow-brand-200">
                <HeirloomLogo className="w-8 h-8 text-white" />
             </div>
             <h1 className="font-serif text-2xl font-bold text-brand-900">Welcome Back</h1>
             <p className="text-brand-400 text-sm font-medium uppercase tracking-widest flex items-center gap-2">
               <Lock className="w-3 h-3" /> Encrypted Storage
             </p>
          </div>

          {/* Dots Display */}
          <div className={`flex gap-4 my-8 transition-transform duration-200 ${shake ? 'translate-x-[-10px] animate-pulse' : ''}`}>
             {[0, 1, 2, 3].map((idx) => (
                <div 
                  key={idx}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                    idx < input.length 
                      ? error 
                        ? 'bg-red-400 border-red-400' 
                        : 'bg-brand-600 border-brand-600 scale-110' 
                      : 'border-brand-200 bg-transparent'
                  }`}
                />
             ))}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-6 w-full">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                 <button
                    key={num}
                    onClick={() => handleNum(num)}
                    className="w-full aspect-square flex items-center justify-center text-2xl font-serif font-medium text-brand-800 bg-white rounded-full shadow-sm hover:bg-brand-50 active:bg-brand-100 transition-all active:scale-95 border border-brand-100"
                 >
                    {num}
                 </button>
              ))}
              <div /> {/* Spacer */}
              <button
                onClick={() => handleNum(0)}
                className="w-full aspect-square flex items-center justify-center text-2xl font-serif font-medium text-brand-800 bg-white rounded-full shadow-sm hover:bg-brand-50 active:bg-brand-100 transition-all active:scale-95 border border-brand-100"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                className="w-full aspect-square flex items-center justify-center text-brand-400 hover:text-brand-600 active:text-brand-800 transition-colors"
              >
                <Delete className="w-6 h-6" />
              </button>
          </div>

          <p className="text-xs text-brand-300 pt-8">Heirloom Journal</p>
       </div>
    </div>
  );
};

export default LockScreen;
