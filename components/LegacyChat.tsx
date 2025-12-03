
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { JournalEntry, LegacyConfig } from '../types';
import { Mic, X, Volume2, Square, Loader2, Fingerprint, Settings } from 'lucide-react';
import AudioDeviceSelector from './AudioDeviceSelector';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/audioUtils';

interface LegacyChatProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  config: LegacyConfig;
  selectedInputId: string;
  selectedOutputId?: string;
  setSelectedOutputId?: (id: string) => void;
  matchedVoiceName?: string;
  authorName: string;
}

const LegacyChat: React.FC<LegacyChatProps> = ({ 
    isOpen, 
    onClose, 
    entries, 
    config, 
    selectedInputId,
    selectedOutputId,
    setSelectedOutputId,
    matchedVoiceName, 
    authorName 
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  useEffect(() => {
    if (!isOpen) cleanup();
    return () => cleanup();
  }, [isOpen]);

  const cleanup = () => {
    if (sessionRef.current) {
        sessionRef.current.then((session: any) => { try { session.close(); } catch(e){} }).catch(() => {});
        sessionRef.current = null;
    }
    if (audioContextRef.current) { audioContextRef.current.close(); audioContextRef.current = null; }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setIsActive(false);
    setIsConnecting(false);
    setError(null);
  };

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const constraints: MediaStreamConstraints = { audio: { deviceId: selectedInputId ? { exact: selectedInputId } : undefined } };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      if (selectedOutputId && (audioContext as any).setSinkId) { try { await (audioContext as any).setSinkId(selectedOutputId); } catch (e) {} }
      audioContextRef.current = audioContext;
      
      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
      const source = inputAudioContext.createMediaStreamSource(stream);
      const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
      source.connect(scriptProcessor);
      const mute = inputAudioContext.createGain();
      mute.gain.value = 0;
      scriptProcessor.connect(mute);
      mute.connect(inputAudioContext.destination);

      const contextText = entries.map(e => `Date: ${new Date(e.createdAt).toDateString()}\nTitle: ${e.title}\nSummary: ${e.summary || ''}\nTranscription: ${e.transcription}`).join('\n\n');
      const systemInstruction = `You are the digital voice and memory of ${authorName}. Speaking with a visitor. Knowledge base:\n${contextText}\nInstructions: Answer warmly and naturally as the author.`;

      const isPersonalVoice = config.voiceName === 'Personal';
      const voiceName = isPersonalVoice ? (matchedVoiceName || 'Aoede') : (config.voiceName || 'Kore');

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then((session) => { session.sendRealtimeInput({ media: pcmBlob }); });
            };
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const bytes = base64ToUint8Array(base64Audio);
              if (!audioContextRef.current) return;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, audioContextRef.current.currentTime);
              const audioBuffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(audioContextRef.current.destination);
              source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => { setIsActive(false); },
          onerror: (e) => { setError("Connection interrupted."); setIsActive(false); }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
          systemInstruction: systemInstruction,
        },
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      setError("Failed to access microphone or start session.");
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-brand-900 text-white flex flex-col">
      <div className="p-6 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-bold">Conversing with {authorName || 'Journal'}</h2>
          <p className="text-brand-300 text-sm flex items-center gap-2">Live Audio Mode {config.voiceName === 'Personal' && <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 text-xs font-bold border border-green-800/50"><Fingerprint className="w-3 h-3 mr-1" /> Personal Voice</span>}</p>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><Settings className="w-5 h-5" /></button>
            <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"><X className="w-6 h-6" /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {isActive && (
          <><div className="absolute w-64 h-64 bg-rose-500/20 rounded-full animate-ping duration-1000"></div><div className="absolute w-96 h-96 bg-rose-500/10 rounded-full animate-pulse delay-75"></div></>
        )}
        <div className="z-10 relative">
            {isConnecting ? (
                <div className="flex flex-col items-center"><Loader2 className="w-16 h-16 text-brand-300 animate-spin mb-4" /><p className="text-brand-200">Establishing connection...</p></div>
            ) : isActive ? (
                <div className="w-32 h-32 bg-gradient-to-br from-rose-400 to-brand-500 rounded-full shadow-[0_0_40px_rgba(225,29,72,0.4)] flex items-center justify-center animate-pulse"><Volume2 className="w-12 h-12 text-white" /></div>
            ) : (
                <div className="text-center space-y-6 max-w-md">
                    <p className="text-lg text-brand-100 leading-relaxed">Tap the microphone to start a voice conversation with the journal entries.</p>
                    {error && <div className="bg-red-500/20 border border-red-500/50 p-3 rounded text-red-200 text-sm">{error}</div>}
                </div>
            )}
        </div>
      </div>

      <div className="p-12 flex justify-center">
        {!isActive && !isConnecting ? (
             <button onClick={startSession} className="group flex items-center justify-center w-20 h-20 bg-white text-brand-900 rounded-full shadow-lg hover:scale-105 transition-all"><Mic className="w-8 h-8 group-hover:text-rose-600 transition-colors" /></button>
        ) : (
            <button onClick={cleanup} className="flex items-center justify-center w-20 h-20 bg-rose-600 text-white rounded-full shadow-lg hover:bg-rose-700 hover:scale-105 transition-all"><Square className="w-8 h-8 fill-current" /></button>
        )}
      </div>

      {isSettingsOpen && <AudioDeviceSelector selectedOutputId={selectedOutputId} setSelectedOutputId={setSelectedOutputId} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
};

export default LegacyChat;
