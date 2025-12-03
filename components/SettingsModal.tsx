
import React, { useState, useEffect } from 'react';
import { X, Mic, HardDrive, Info, Trash2, RefreshCw, Settings, AlertTriangle, Volume2, ShieldCheck, Lock, Loader2, User } from 'lucide-react';
import { migrateToEncrypted, migrateToPlain } from '../services/dbService';
import VoiceProfileSettings from './VoiceProfileModal'; 
import { HeirloomLogo } from './HeirloomLogo';
import { JournalEntry, UserVoiceSettings } from '../types';

interface SettingsModalProps {
  selectedInputId?: string;
  setSelectedInputId?: (id: string) => void;
  selectedOutputId?: string;
  setSelectedOutputId?: (id: string) => void;
  onClose: () => void;
  passcode?: string | null;
  onUpdatePasscode?: (newCode: string | null) => Promise<CryptoKey | null>;
  entries: JournalEntry[];
  voiceSettings: UserVoiceSettings;
  onUpdateVoiceSettings: (settings: UserVoiceSettings) => void;
  totalRecordingSeconds: number;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  selectedInputId,
  setSelectedInputId,
  selectedOutputId,
  setSelectedOutputId,
  onClose,
  passcode,
  onUpdatePasscode,
  entries,
  voiceSettings,
  onUpdateVoiceSettings,
  totalRecordingSeconds
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'audio' | 'privacy' | 'data' | 'about'>('identity');
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  
  // Privacy Tab State
  const [passcodeInput, setPasscodeInput] = useState('');
  const [confirmInput, setConfirmInput] = useState('');
  const [isSettingPasscode, setIsSettingPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  const getDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputs(devices.filter(d => d.kind === 'audioinput'));
      setOutputs(devices.filter(d => d.kind === 'audiooutput'));
    } catch (err) {
      console.error("Error fetching devices:", err);
    }
  };

  useEffect(() => {
    getDevices();
  }, []);

  const handleClearData = async () => {
      if (!window.confirm("Are you absolutely sure? This will delete ALL your journal entries and settings. This action cannot be undone.")) {
          return;
      }
      setIsDeleting(true);
      try {
          localStorage.clear();
          const req = indexedDB.deleteDatabase('VocalJournalDB');
          req.onsuccess = () => { window.location.reload(); };
          req.onerror = () => { alert("Failed to delete database."); setIsDeleting(false); };
      } catch (e) {
          console.error(e);
          setIsDeleting(false);
      }
  };
  
  const handleSetPasscode = async () => {
      if (passcodeInput.length !== 4) {
          setPasscodeError("Passcode must be 4 digits");
          return;
      }
      if (passcodeInput !== confirmInput) {
          setPasscodeError("Passcodes do not match");
          return;
      }
      
      if (onUpdatePasscode) {
          setIsMigrating(true);
          try {
              const newKey = await onUpdatePasscode(passcodeInput);
              if (newKey) {
                  await migrateToEncrypted(newKey);
              }
              setPasscodeInput('');
              setConfirmInput('');
              setIsSettingPasscode(false);
              setPasscodeError(null);
          } catch (e) {
              console.error(e);
              setPasscodeError("Encryption failed. Please try again.");
              await onUpdatePasscode(null); 
          } finally {
              setIsMigrating(false);
          }
      }
  };

  const executeRemovePasscode = async () => {
      if (!window.confirm("Removing the lock will decrypt your journal. Are you sure?")) return;
      setIsMigrating(true);
      try {
          await migrateToPlain(null as any); 
          if (onUpdatePasscode) await onUpdatePasscode(null);
      } catch (e) {
          console.error("Decryption failed", e);
          alert("Failed to decrypt data.");
      } finally {
          setIsMigrating(false);
      }
  };

  const defaultInputDevice = inputs.find(d => d.deviceId === 'default');
  const otherInputDevices = inputs.filter(d => d.deviceId !== 'default' && d.deviceId !== 'communications');

  const tabs = [
    { id: 'identity', label: 'Identity', icon: User, desc: 'Profile & Voice' },
    { id: 'audio', label: 'Audio', icon: Mic, desc: 'Input & Output' },
    { id: 'privacy', label: 'Privacy', icon: ShieldCheck, desc: 'Security & Lock' },
    { id: 'data', label: 'Data', icon: HardDrive, desc: 'Storage & Reset' },
    { id: 'about', label: 'About', icon: Info, desc: 'App Info' },
  ] as const;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row overflow-hidden border border-brand-200">
        
        {/* Left Sidebar */}
        <aside className="w-full md:w-64 bg-brand-900 text-brand-100 flex-shrink-0 flex flex-row md:flex-col md:border-r border-brand-800">
           <div className="p-6 hidden md:block border-b border-brand-800/50">
              <h2 className="text-xl font-serif font-bold text-white tracking-tight flex items-center gap-2">
                 <Settings className="w-5 h-5 text-brand-400" />
                 Settings
              </h2>
           </div>
           
           <nav className="flex-1 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto scrollbar-hide p-2 md:p-3 gap-1">
              {tabs.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 whitespace-nowrap text-left group
                            ${isActive 
                                ? 'bg-brand-800 text-white shadow-md ring-1 ring-white/10' 
                                : 'text-brand-300 hover:bg-brand-800/50 hover:text-white'}
                        `}
                    >
                        <div className={`p-1.5 rounded-lg ${isActive ? 'bg-brand-700 text-brand-200' : 'bg-brand-900/50 group-hover:bg-brand-700/50'}`}>
                            <Icon className={`w-5 h-5`} />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-sm leading-none">{tab.label}</span>
                            <span className={`text-[10px] mt-1 ${isActive ? 'text-brand-300' : 'text-brand-500 group-hover:text-brand-400'}`}>
                                {tab.desc}
                            </span>
                        </div>
                    </button>
                  );
              })}
           </nav>
           
           <div className="p-4 hidden md:block border-t border-brand-800/50">
               <div className="flex items-center gap-3 opacity-50">
                   <div className="p-1.5 bg-brand-800 rounded-lg text-brand-400">
                       <HeirloomLogo className="w-8 h-8" />
                   </div>
                   <div>
                       <p className="text-xs font-bold text-white">Heirloom</p>
                       <p className="text-[10px] text-brand-400">v1.2.0</p>
                   </div>
               </div>
           </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 bg-white flex flex-col relative min-w-0">
           
           {/* Content Header */}
           <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-20">
              <div>
                  <h3 className="text-2xl font-serif font-bold text-brand-900">
                      {tabs.find(t => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                      {activeTab === 'identity' && "Manage your personal profile and AI voice settings."}
                      {activeTab === 'audio' && "Configure input and output devices."}
                      {activeTab === 'privacy' && "Secure your journal with end-to-end encryption."}
                      {activeTab === 'data' && "Manage local storage and data reset."}
                      {activeTab === 'about' && "About this application."}
                  </p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 text-gray-400 hover:text-brand-800 hover:bg-gray-100 rounded-full transition-colors"
                title="Close Settings"
              >
                 <X className="w-6 h-6" />
              </button>
           </div>

           {/* Scrollable Content Body */}
           <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
               <div className="max-w-3xl mx-auto md:mx-0 space-y-8 pb-12">
                   
                   {activeTab === 'audio' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-brand-50/50 border border-brand-100 rounded-2xl p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-base font-bold text-gray-800 flex items-center gap-2">
                                        <Mic className="w-5 h-5 text-brand-500" /> Microphone Input
                                    </label>
                                    <button onClick={getDevices} className="text-xs font-bold text-brand-500 hover:text-brand-700 bg-white border border-brand-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm flex items-center gap-1">
                                        <RefreshCw className="w-3 h-3" /> Refresh
                                    </button>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedInputId || 'default'} 
                                        onChange={(e) => setSelectedInputId && setSelectedInputId(e.target.value)}
                                        className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-200 outline-none text-sm text-gray-700 transition-all shadow-sm hover:border-brand-300"
                                    >
                                        <option value="default">System Default</option>
                                        {otherInputDevices.map(device => (
                                            <option key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {defaultInputDevice && (
                                    <p className="text-xs text-gray-400 mt-2 ml-1 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                        Active: {defaultInputDevice.label.replace('Default - ', '')}
                                    </p>
                                )}
                            </div>

                            <div className="bg-brand-50/50 border border-brand-100 rounded-2xl p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-base font-bold text-gray-800 flex items-center gap-2">
                                        <Volume2 className="w-5 h-5 text-brand-500" /> Speaker Output
                                    </label>
                                </div>
                                <div className="relative">
                                    <select
                                        value={selectedOutputId || 'default'} 
                                        onChange={(e) => setSelectedOutputId && setSelectedOutputId(e.target.value)}
                                        disabled={outputs.length === 0}
                                        className="w-full p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-200 outline-none text-sm text-gray-700 transition-all shadow-sm hover:border-brand-300 disabled:bg-gray-50 disabled:text-gray-400"
                                    >
                                        {outputs.length > 0 ? (
                                            <>
                                                <option value="default">System Default</option>
                                                {outputs.filter(d => d.deviceId !== 'default').map(device => (
                                                    <option key={device.deviceId} value={device.deviceId}>
                                                        {device.label || `Speaker ${device.deviceId.slice(0, 5)}...`}
                                                    </option>
                                                ))}
                                            </>
                                        ) : (
                                            <option value="">Default System Output</option>
                                        )}
                                    </select>
                                </div>
                                {outputs.length === 0 && (
                                    <p className="text-xs text-brand-400 mt-3 p-3 bg-brand-50 rounded-lg border border-brand-100">
                                        Note: Your browser might handle output switching automatically or it is not supported on this device.
                                    </p>
                                )}
                            </div>
                        </div>
                   )}

                   {activeTab === 'identity' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <VoiceProfileSettings 
                                settings={voiceSettings}
                                onUpdateSettings={onUpdateVoiceSettings}
                                totalRecordingSeconds={totalRecordingSeconds}
                                entries={entries}
                            />
                        </div>
                   )}
            
                   {activeTab === 'privacy' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className={`border rounded-2xl p-6 ${passcode ? 'bg-green-50 border-green-100' : 'bg-brand-50 border-brand-100'}`}>
                                <div className="flex items-start gap-5">
                                    <div className={`p-4 rounded-full shadow-sm ${passcode ? 'bg-white text-green-600' : 'bg-white text-gray-400'}`}>
                                        <Lock className="w-8 h-8" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={`font-bold text-xl mb-1 ${passcode ? 'text-green-900' : 'text-brand-900'}`}>
                                            {passcode ? "Journal is Secured" : "Journal is Unlocked"}
                                        </h4>
                                        <p className={`text-sm leading-relaxed mb-6 ${passcode ? 'text-green-700' : 'text-brand-600'}`}>
                                            {passcode 
                                                ? "Your journal is protected with AES-256 encryption. The key is derived from your passcode. If you lose your passcode, your data is lost forever." 
                                                : "Set a 4-digit passcode to encrypt your data locally."}
                                        </p>
                                        
                                        {isSettingPasscode ? (
                                            <div className="space-y-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                                                {isMigrating && (
                                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                                                        <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-2" />
                                                        <span className="text-sm font-bold text-brand-800">Encrypting Database...</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">New Passcode</label>
                                                    <input 
                                                        type="password" 
                                                        maxLength={4} 
                                                        className="w-full p-3 border border-gray-200 rounded-xl text-center tracking-[1em] font-bold text-2xl text-brand-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                                                        value={passcodeInput}
                                                        onChange={(e) => setPasscodeInput(e.target.value.replace(/\D/g, ''))}
                                                        placeholder="...."
                                                        autoFocus
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Confirm Passcode</label>
                                                    <input 
                                                        type="password" 
                                                        maxLength={4} 
                                                        className="w-full p-3 border border-gray-200 rounded-xl text-center tracking-[1em] font-bold text-2xl text-brand-900 focus:ring-2 focus:ring-brand-500 outline-none" 
                                                        value={confirmInput}
                                                        onChange={(e) => setConfirmInput(e.target.value.replace(/\D/g, ''))}
                                                        placeholder="...."
                                                    />
                                                </div>
                                                {passcodeError && <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded">{passcodeError}</p>}
                                                <div className="flex gap-3 pt-2">
                                                    <button 
                                                        onClick={() => { setIsSettingPasscode(false); setPasscodeInput(''); setConfirmInput(''); setPasscodeError(null); }}
                                                        className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button 
                                                        onClick={handleSetPasscode}
                                                        disabled={isMigrating}
                                                        className="flex-1 py-3 text-sm font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-md transition-all active:scale-95"
                                                    >
                                                        Save & Encrypt
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex gap-3 relative">
                                                {isMigrating && (
                                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                                                        <Loader2 className="w-5 h-5 animate-spin text-brand-600 mr-2" />
                                                        <span className="text-xs font-bold text-brand-800">Processing...</span>
                                                    </div>
                                                )}
                                                {passcode ? (
                                                    <button 
                                                        onClick={executeRemovePasscode}
                                                        className="px-6 py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 hover:border-red-300 shadow-sm transition-all"
                                                    >
                                                        Remove Lock & Decrypt
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => setIsSettingPasscode(true)}
                                                        className="px-6 py-3 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 shadow-md hover:shadow-lg transition-all active:scale-95"
                                                    >
                                                        Set Passcode
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                   )}

                   {activeTab === 'data' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="bg-white border border-red-100 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4 opacity-10">
                                    <AlertTriangle className="w-32 h-32 text-red-500" />
                                </div>
                                <div className="relative z-10">
                                    <h4 className="font-bold text-red-700 flex items-center gap-2 mb-2 text-lg">
                                        <AlertTriangle className="w-5 h-5" /> Danger Zone
                                    </h4>
                                    <p className="text-sm text-gray-600 mb-6 leading-relaxed max-w-md">
                                        Clearing your data will permanently delete all journal entries, audio recordings, and images from your local browser storage. This action cannot be undone.
                                    </p>
                                    <button 
                                        onClick={handleClearData}
                                        disabled={isDeleting}
                                        className="py-3 px-6 bg-red-50 border border-red-200 text-red-700 rounded-xl hover:bg-red-600 hover:text-white font-bold transition-all shadow-sm flex items-center justify-center gap-2 w-full sm:w-auto"
                                    >
                                        {isDeleting ? "Deleting..." : <><Trash2 className="w-4 h-4" /> Delete All Data</>}
                                    </button>
                                </div>
                            </div>
                        </div>
                   )}

                   {activeTab === 'about' && (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="w-24 h-24 bg-gradient-to-br from-brand-100 to-brand-50 rounded-3xl flex items-center justify-center mb-6 text-brand-600 shadow-inner border border-brand-100">
                                <HeirloomLogo className="w-12 h-12" />
                            </div>
                            <h3 className="text-3xl font-serif font-bold text-brand-900 mb-2">Heirloom</h3>
                            <p className="text-brand-400 font-medium mb-8">Version 1.2.0 (Secure)</p>
                            
                            <div className="max-w-md text-gray-500 text-sm leading-relaxed space-y-4">
                                <p>
                                    Heirloom is designed to help you capture your thoughts effortlessly. 
                                    Your data is stored locally in your browser and can be secured with client-side encryption.
                                </p>
                                <p>
                                    Built with Gemini AI for intelligent reflection and ElevenLabs for voice synthesis.
                                </p>
                            </div>
                            
                            <div className="mt-12 flex gap-4">
                                <a href="#" className="text-xs font-bold text-brand-400 hover:text-brand-600 uppercase tracking-widest">Privacy Policy</a>
                                <a href="#" className="text-xs font-bold text-brand-400 hover:text-brand-600 uppercase tracking-widest">Terms of Service</a>
                            </div>
                        </div>
                   )}

               </div>
           </div>
        </main>

      </div>
    </div>
  );
};

export default SettingsModal;
