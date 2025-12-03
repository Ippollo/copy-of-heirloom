
import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, Sparkles, Play, Square, User, AlertCircle, Clock, Volume2, Camera, Upload, Image as ImageIcon, Fingerprint } from 'lucide-react';
import { UserVoiceSettings, JournalEntry } from '../types';
import { GoogleGenAI, Modality } from "@google/genai";
import { createVoiceClone, generateSpeech } from '../services/elevenLabsService';
import { getEntryAudio, getUserIdentityImage, saveUserIdentityImage } from '../services/dbService';
import { decodeAudioData, base64ToUint8Array } from '../services/audioUtils';

interface VoiceProfileSettingsProps {
  totalRecordingSeconds: number;
  settings: UserVoiceSettings;
  onUpdateSettings: (settings: UserVoiceSettings) => void;
  entries: JournalEntry[];
}

const VOICES = [
    { id: 'Aoede', label: 'Soprano', desc: 'Bright, Clear, High', gender: 'Female' },
    { id: 'Kore', label: 'Alto', desc: 'Soothing, Calm, Mid-Range', gender: 'Female' },
    { id: 'Puck', label: 'Tenor', desc: 'Soft, Playful, Mid-Range', gender: 'Male' },
    { id: 'Charon', label: 'Baritone', desc: 'Deep, Assertive, Low', gender: 'Male' },
    { id: 'Fenrir', label: 'Bass', desc: 'Resonant, Powerful, Very Low', gender: 'Male' },
] as const;

const REQUIRED_SECONDS = 120;

const VoiceProfileSettings: React.FC<VoiceProfileSettingsProps> = ({ 
  totalRecordingSeconds,
  settings,
  onUpdateSettings,
  entries
}) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'visual'>('visual');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(settings.matchedVoiceName || 'Aoede');
  const [authorName, setAuthorName] = useState(settings.authorName || '');
  
  const [isCloning, setIsCloning] = useState(false);
  const [cloningError, setCloningError] = useState<string | null>(null);
  const [generatedVoiceId, setGeneratedVoiceId] = useState<string | null>(settings.elevenLabsVoiceId || null);
  
  const [identityImage, setIdentityImage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [previewPlayingId, setPreviewPlayingId] = useState<string | null>(null);

  useEffect(() => {
        setGeneratedVoiceId(settings.elevenLabsVoiceId || null);
        if (settings.matchedVoiceName) setSelectedVoiceId(settings.matchedVoiceName);
        setAuthorName(settings.authorName || '');
        loadIdentityImage();
  }, [settings]);

  useEffect(() => {
    return () => {
       stopAllAudio();
       stopCamera();
       if (identityImage) URL.revokeObjectURL(identityImage);
    };
  }, []);

  const loadIdentityImage = async () => {
      try {
          const blob = await getUserIdentityImage();
          if (blob) {
              const url = URL.createObjectURL(blob);
              setIdentityImage(url);
          } else {
              setIdentityImage(null);
          }
      } catch (err) {
          console.error("Failed to load identity image", err);
      }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setAuthorName(newName);
      onUpdateSettings({ ...settings, authorName: newName });
  };

  const stopAllAudio = () => {
    if (sourceRef.current) sourceRef.current.stop();
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    setPreviewPlayingId(null);
  };

  const startCamera = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
          streamRef.current = stream;
          setIsCameraOpen(true);
      } catch (err) { alert("Camera access failed."); }
  };

  const stopCamera = () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setIsCameraOpen(false);
  };

  const capturePhoto = () => {
      if (videoRef.current) {
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              canvas.toBlob(async (blob) => {
                  if (blob) { await saveUserIdentityImage(blob); await loadIdentityImage(); stopCamera(); }
              }, 'image/jpeg', 0.85);
          }
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) { await saveUserIdentityImage(file); await loadIdentityImage(); }
  };

  const prepareSamples = async (): Promise<Blob[]> => {
      const candidates = [...entries].filter(e => (e.duration || 0) > 5).sort((a, b) => b.createdAt - a.createdAt);
      const samples: Blob[] = [];
      let accumulatedDuration = 0;
      for (const entry of candidates) {
          if (accumulatedDuration > 180) break; 
          try {
            const blob = await getEntryAudio(entry.id);
            if (blob) { samples.push(blob); accumulatedDuration += (entry.duration || 0); }
          } catch (e) {}
      }
      return samples;
  };

  const handleCreateClone = async () => {
      if (totalRecordingSeconds < REQUIRED_SECONDS) return;
      setIsCloning(true);
      setCloningError(null);
      stopAllAudio();
      try {
          const samples = await prepareSamples();
          if (samples.length === 0) throw new Error("No audio data found.");
          const voiceId = await createVoiceClone("My Heirloom", samples);
          setGeneratedVoiceId(voiceId);
          onUpdateSettings({ ...settings, isClonedVoiceEnabled: true, useClonedVoiceForMentor: true, elevenLabsVoiceId: voiceId });
      } catch (err: any) {
          setCloningError(err.message || "Failed to create voice clone.");
      } finally {
          setIsCloning(false);
      }
  };

  const playStandardPreview = async (voiceId: string) => {
      if (previewPlayingId === voiceId) { stopAllAudio(); return; }
      stopAllAudio();
      setPreviewPlayingId(voiceId);

      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: "Hello. I am ready to be the voice of your journal." }] }],
            config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceId } } } },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) throw new Error("No audio");

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = audioCtx;
        const bytes = base64ToUint8Array(base64Audio);
        const buffer = await decodeAudioData(bytes, audioCtx, 24000, 1);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => setPreviewPlayingId(null);
        sourceRef.current = source;
        source.start();
      } catch (err) { setPreviewPlayingId(null); }
  };

  const playClonePreview = async () => {
      if (!generatedVoiceId) return;
      if (previewPlayingId === 'clone') { stopAllAudio(); return; }
      stopAllAudio();
      setPreviewPlayingId('clone');
      try {
          const arrayBuffer = await generateSpeech("This is a preview of your custom voice clone.", generatedVoiceId);
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          audioContextRef.current = audioCtx;
          const buffer = await audioCtx.decodeAudioData(arrayBuffer);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.onended = () => setPreviewPlayingId(null);
          sourceRef.current = source;
          source.start();
      } catch (err) { setPreviewPlayingId(null); alert("Could not play preview. Check your API key and connection."); }
  };

  const selectStandardVoice = (voiceId: string) => {
      setSelectedVoiceId(voiceId);
      onUpdateSettings({ ...settings, isClonedVoiceEnabled: false, matchedVoiceName: voiceId as any });
  };

  const progressPercentage = Math.min(100, (totalRecordingSeconds / REQUIRED_SECONDS) * 100);
  const remainingSeconds = Math.max(0, REQUIRED_SECONDS - totalRecordingSeconds);

  return (
    <div className="flex flex-col h-full bg-white">
        <div className="flex border-b border-paper-300 mb-6">
            <button onClick={() => setActiveTab('visual')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'visual' ? 'text-brand-600 border-b-2 border-brand-600 bg-paper-50' : 'text-gray-400 hover:text-gray-600'}`}><ImageIcon className="w-4 h-4" /> Visual</button>
            <button onClick={() => setActiveTab('voice')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'voice' ? 'text-brand-600 border-b-2 border-brand-600 bg-paper-50' : 'text-gray-400 hover:text-gray-600'}`}><Fingerprint className="w-4 h-4" /> Voice</button>
        </div>

        <div className="flex-1 overflow-y-auto px-1">
            {activeTab === 'visual' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div>
                        <label className="block text-xs font-bold text-brand-400 uppercase tracking-widest mb-2">Author Name</label>
                        <input type="text" value={authorName} onChange={handleNameChange} placeholder="Your Name (e.g. Grandma Rose)" className="w-full px-4 py-3 rounded-xl border border-paper-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all bg-white text-brand-900 placeholder-brand-300" />
                    </div>
                    <div className="border-t border-paper-200 pt-6">
                        <div className="text-center mb-4"><h3 className="font-serif font-bold text-gray-800 text-lg mb-2">Visual Identity</h3><p className="text-sm text-gray-500 leading-relaxed">Upload a photo of yourself to include in your generated Memory Scapes.</p></div>
                        <div className="flex flex-col items-center justify-center gap-4">
                            {isCameraOpen ? (
                                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-brand-500 shadow-xl"><video ref={(el) => { videoRef.current = el; if(el && streamRef.current) el.srcObject = streamRef.current; }} autoPlay playsInline muted className="w-full h-full object-cover" /><button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 bg-white rounded-full border-4 border-gray-200 hover:scale-110 transition-transform" /></div>
                            ) : identityImage ? (
                                <div className="relative group"><div className="w-40 h-40 rounded-full overflow-hidden border-4 border-green-500 shadow-xl"><img src={identityImage} alt="Identity" className="w-full h-full object-cover" /></div><div className="absolute -bottom-2 right-4 bg-white p-2 rounded-full shadow-md text-green-600"><CheckCircle2 className="w-5 h-5 fill-current" /></div></div>
                            ) : (
                                <div className="w-40 h-40 rounded-full bg-paper-50 flex items-center justify-center border-4 border-dashed border-paper-300"><User className="w-16 h-16 text-gray-300" /></div>
                            )}
                            <div className="flex gap-3 w-full max-w-xs mt-2">
                                {isCameraOpen ? <button onClick={stopCamera} className="flex-1 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-bold">Cancel</button> : <><button onClick={startCamera} className="flex-1 py-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 text-xs font-bold shadow-sm flex items-center justify-center gap-2"><Camera className="w-3 h-3" /> Selfie</button><button onClick={() => fileInputRef.current?.click()} className="flex-1 py-2 rounded-lg border border-brand-200 text-brand-700 hover:bg-paper-50 text-xs font-bold flex items-center justify-center gap-2"><Upload className="w-3 h-3" /> Upload</button></>}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'voice' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div className="flex bg-paper-100 p-1 rounded-xl">
                        <button onClick={() => { setSelectedVoiceId('Aoede'); const s = {...settings, isClonedVoiceEnabled: false}; onUpdateSettings(s); }} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${!settings.isClonedVoiceEnabled ? 'bg-white shadow-sm text-brand-700' : 'text-gray-400 hover:text-gray-600'}`}>Standard</button>
                        <button onClick={() => { const s = {...settings, isClonedVoiceEnabled: true}; onUpdateSettings(s); }} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${settings.isClonedVoiceEnabled ? 'bg-white shadow-sm text-slate-700' : 'text-gray-400 hover:text-gray-600'}`}>AI Clone</button>
                    </div>
                    {!settings.isClonedVoiceEnabled ? (
                         <div className="space-y-3">
                            {VOICES.map((voice) => (
                                <div key={voice.id} onClick={() => selectStandardVoice(voice.id)} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedVoiceId === voice.id ? 'border-brand-500 bg-paper-50 shadow-sm' : 'border-gray-100 hover:border-paper-300'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedVoiceId === voice.id ? 'border-brand-500' : 'border-gray-300'}`}>
                                            {selectedVoiceId === voice.id && <div className="w-3 h-3 bg-brand-500 rounded-full" />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2"><h4 className="font-bold text-brand-900 text-sm">{voice.id}</h4><span className="text-[10px] px-1.5 py-0.5 bg-paper-100 text-gray-500 rounded uppercase font-bold">{voice.gender}</span></div>
                                            <span className="text-xs text-brand-400">{voice.desc}</span>
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); playStandardPreview(voice.id); }} className={`p-2 rounded-full transition-all ${previewPlayingId === voice.id ? 'bg-brand-600 text-white shadow-md' : 'bg-white text-gray-400 border border-gray-200 hover:text-brand-600 hover:border-brand-200'}`}>{previewPlayingId === voice.id ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}</button>
                                </div>
                            ))}
                         </div>
                    ) : (
                        <div className="space-y-6">
                             <div className={`rounded-xl p-5 border-2 ${generatedVoiceId ? 'border-slate-200 bg-slate-50/50' : 'border-gray-100 bg-gray-50'}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">{generatedVoiceId ? <><CheckCircle2 className="w-4 h-4 text-green-500" /> Clone Active</> : <><Volume2 className="w-4 h-4 text-gray-400" /> No Clone</>}</h3>
                                    {generatedVoiceId && <button onClick={playClonePreview} className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide transition-colors ${previewPlayingId === 'clone' ? 'bg-slate-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>{previewPlayingId === 'clone' ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}{previewPlayingId === 'clone' ? "Stop" : "Preview"}</button>}
                                </div>
                                {generatedVoiceId ? <div className="space-y-4"><p className="text-xs text-gray-600">Your custom voice is ready. Tap 'Standard' above to switch back.</p></div> : <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-2"><h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Audio Samples</h4><span className={`text-[10px] font-bold ${totalRecordingSeconds >= REQUIRED_SECONDS ? 'text-green-600' : 'text-orange-500'}`}>{Math.floor(totalRecordingSeconds)} / {REQUIRED_SECONDS}s</span></div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2"><div className={`h-full transition-all duration-1000 ease-out ${totalRecordingSeconds >= REQUIRED_SECONDS ? 'bg-green-500' : 'bg-orange-400'}`} style={{ width: `${progressPercentage}%` }} /></div>
                                        <p className="text-[10px] text-gray-400 mb-4 flex items-center gap-1"><Clock className="w-3 h-3" />{totalRecordingSeconds >= REQUIRED_SECONDS ? "Ready to generate." : `Record ${Math.ceil(remainingSeconds)} more seconds.`}</p>
                                        {cloningError && <div className="mb-4 p-2 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-xs"><AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />{cloningError}</div>}
                                        <button onClick={handleCreateClone} disabled={totalRecordingSeconds < REQUIRED_SECONDS || isCloning} className={`w-full py-3 rounded-lg font-bold transition-all shadow-sm flex items-center justify-center gap-2 text-xs ${totalRecordingSeconds >= REQUIRED_SECONDS && !isCloning ? 'bg-gradient-to-r from-slate-600 to-slate-800 text-white hover:shadow-lg' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>{isCloning ? <><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Cloning...</> : <><Sparkles className="w-3 h-3" /> Create Voice Clone</>}</button>
                                    </div>
                                }
                             </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
};

export default VoiceProfileSettings;
