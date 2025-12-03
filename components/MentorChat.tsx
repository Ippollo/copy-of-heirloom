
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Chat } from '@google/genai';
import { JournalEntry, UserVoiceSettings } from '../types';
import { Mic, Loader2, Send, User, PhoneOff, History, BookPlus, Check, Compass } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { generateSpeech } from '../services/elevenLabsService';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../services/audioUtils';

interface MentorChatProps {
  onClose: () => void;
  entries: JournalEntry[];
  voiceSettings?: UserVoiceSettings;
  selectedInputId: string;
  selectedOutputId?: string;
  setSelectedOutputId?: (id: string) => void;
  onSaveToJournal: (text: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

const MentorChat: React.FC<MentorChatProps> = ({ 
    onClose, 
    entries, 
    voiceSettings, 
    selectedInputId, 
    selectedOutputId,
    onSaveToJournal
}) => {
  const [mode, setMode] = useState<'text' | 'voice'>('text');
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMentorSpeaking, setIsMentorSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  const [isRecordingClone, setIsRecordingClone] = useState(false);
  const [isProcessingClone, setIsProcessingClone] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  const [inputAnalyser, setInputAnalyser] = useState<AnalyserNode | null>(null);
  const [outputAnalyser, setOutputAnalyser] = useState<AnalyserNode | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const speakingTimeoutRef = useRef<number | null>(null);

  const currentVoiceTurnId = useRef<string | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<{user: string, model: string}>({ user: '', model: '' });

  const [isSaved, setIsSaved] = useState(false);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isClonedMode = voiceSettings?.useClonedVoiceForMentor && !!voiceSettings.elevenLabsVoiceId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, mode]);

  useEffect(() => {
    initializeTextChat();
    return () => {
        cleanupVoiceSession();
        setMessages([]);
        setMode('text');
    };
  }, []);

  const getSystemInstruction = (includeRecentChat = false) => {
      const recentEntries = entries.slice(0, 30); 
      const hasHistory = recentEntries.length > 0;

      const contextText = hasHistory ? recentEntries.map(e => {
        return `[${new Date(e.createdAt).toLocaleDateString()}] Title: ${e.title}\nSummary: ${e.summary}\nContent: ${e.transcription.substring(0, 500)}...`;
      }).join('\n---\n') : "No entries yet.";

      let chatHistoryContext = "";
      if (includeRecentChat && messages.length > 1) {
          const recentMessages = messages.slice(-6);
          chatHistoryContext = `\nRECENT CONVERSATION HISTORY:\n${recentMessages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n')}`;
      }

      const personaInstruction = hasHistory 
        ? "You are a thoughtful mentor who knows the user through their journal. Use a natural, conversational tone. Gently reference past entries if relevant."
        : "You are a warm, supportive listener. The user hasn't written much yet, so focus on getting to know them.";

      return `${personaInstruction}\nYOUR KNOWLEDGE BASE:\n${contextText}\n${chatHistoryContext}\nGUIDELINES: Speak naturally. Keep responses concise (2-4 sentences usually).`;
  };

  const initializeTextChat = async () => {
      const systemInstruction = getSystemInstruction();
      chatSessionRef.current = ai.chats.create({
          model: 'gemini-2.5-flash',
          config: { systemInstruction }
      });
      
      const authorName = voiceSettings?.authorName ? voiceSettings.authorName.split(' ')[0] : 'Friend';
      const introText = entries.length > 5 
        ? `Hello, ${authorName}. I've been reading through your journal. What's on your mind?`
        : `Hello, ${authorName}. I'm here to listen. What would you like to talk about today?`;

      setMessages([{ id: 'intro', role: 'model', text: introText }]);
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
      }
  };

  const handleSendMessage = async () => {
      if (!inputText.trim() || !chatSessionRef.current) return;
      
      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: inputText };
      setMessages(prev => [...prev, userMsg]);
      setInputText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setIsTyping(true);

      try {
          const result = await chatSessionRef.current.sendMessageStream({ message: userMsg.text });
          const botMsgId = (Date.now() + 1).toString();
          setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', isStreaming: true }]);
          
          let fullText = '';
          for await (const chunk of result) {
              const text = chunk.text;
              if (text) {
                  fullText += text;
                  setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: fullText } : m));
              }
          }
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, isStreaming: false } : m));

      } catch (err) {
          setMessages(prev => [...prev, { id: 'err', role: 'model', text: "I'm having trouble accessing the archives right now. Please try again." }]);
      } finally {
          setIsTyping(false);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSendMessage();
      }
  };

  const handleSaveConversation = () => {
      const conversationTranscript = messages
          .filter(m => m.id !== 'intro' && m.id !== 'err')
          .map(m => `${m.role === 'user' ? 'Me' : 'Mentor'}: ${m.text}`)
          .join('\n\n');

      if (!conversationTranscript) return;
      onSaveToJournal(`MENTOR SESSION TRANSCRIPT:\n\n${conversationTranscript}`);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
  };

  const cleanupVoiceSession = () => {
    if (sessionRef.current) {
        const sessionPromise = sessionRef.current;
        sessionPromise.then((session: any) => { try { session.close(); } catch(e){} }).catch(() => {});
        sessionRef.current = null;
    }
    
    if (audioContextRef.current) { if (audioContextRef.current.state !== 'closed') audioContextRef.current.close(); audioContextRef.current = null; }
    if (inputAudioContextRef.current) { if (inputAudioContextRef.current.state !== 'closed') inputAudioContextRef.current.close(); inputAudioContextRef.current = null; }
    if (mediaRecorderRef.current) { mediaRecorderRef.current.stop(); mediaRecorderRef.current = null; }
    sourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
    sourcesRef.current.clear();
    
    nextStartTimeRef.current = 0;
    setIsActive(false);
    setIsConnecting(false);
    setIsMentorSpeaking(false);
    setIsRecordingClone(false);
    setIsProcessingClone(false);
    setVoiceError(null);
    setInputAnalyser(null);
    setOutputAnalyser(null);
    setVoiceTranscript({ user: '', model: '' });
    currentVoiceTurnId.current = null;
  };

  const startStandardSession = async () => {
    setIsConnecting(true);
    setVoiceError(null);

    try {
      const constraints: MediaStreamConstraints = { 
          audio: { 
              deviceId: selectedInputId ? { exact: selectedInputId } : undefined,
              echoCancellation: true, noiseSuppression: true, autoGainControl: true
          } 
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
      if (audioContext.state === 'suspended') await audioContext.resume();
      if (selectedOutputId && (audioContext as any).setSinkId) try { await (audioContext as any).setSinkId(selectedOutputId); } catch (e) {}
      audioContextRef.current = audioContext;
      
      const outAnalyser = audioContext.createAnalyser();
      outAnalyser.fftSize = 512;
      setOutputAnalyser(outAnalyser);

      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 16000});
      inputAudioContextRef.current = inputAudioContext;

      const source = inputAudioContext.createMediaStreamSource(stream);
      const inAnalyser = inputAudioContext.createAnalyser();
      inAnalyser.fftSize = 2048;
      source.connect(inAnalyser);
      setInputAnalyser(inAnalyser);

      const scriptProcessor = inputAudioContext.createScriptProcessor(2048, 1, 1);
      inAnalyser.connect(scriptProcessor);
      const muteNode = inputAudioContext.createGain();
      muteNode.gain.value = 0;
      scriptProcessor.connect(muteNode);
      muteNode.connect(inputAudioContext.destination);

      const voiceName = voiceSettings?.matchedVoiceName || 'Charon';
      const systemInstruction = getSystemInstruction(true);

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
            if (message.serverContent?.outputTranscription?.text) {
                const text = message.serverContent.outputTranscription.text;
                setVoiceTranscript(prev => ({ ...prev, model: prev.model + text }));
            } else if (message.serverContent?.inputTranscription?.text) {
                const text = message.serverContent.inputTranscription.text;
                setVoiceTranscript(prev => ({ ...prev, user: prev.user + text }));
            }

            if (message.serverContent?.turnComplete) {
                setVoiceTranscript(current => {
                    const newMessages: ChatMessage[] = [];
                    if (current.user.trim()) newMessages.push({ id: `voice-user-${Date.now()}`, role: 'user', text: current.user });
                    if (current.model.trim()) newMessages.push({ id: `voice-model-${Date.now()}`, role: 'model', text: current.model });
                    if (newMessages.length > 0) setMessages(prev => [...prev, ...newMessages]);
                    return { user: '', model: '' };
                });
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setIsMentorSpeaking(true);
              if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);

              const bytes = base64ToUint8Array(base64Audio);
              if (!audioContextRef.current) return;
              
              if (nextStartTimeRef.current < audioContextRef.current.currentTime) nextStartTimeRef.current = audioContextRef.current.currentTime;

              const audioBuffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
              const source = audioContextRef.current.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outAnalyser).connect(audioContextRef.current.destination);
              
              source.addEventListener('ended', () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) speakingTimeoutRef.current = window.setTimeout(() => setIsMentorSpeaking(false), 300);
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
          },
          onclose: () => { setIsActive(false); setIsMentorSpeaking(false); },
          onerror: (e) => { 
            console.error("Session Error", e);
            setVoiceError("Connection interrupted."); 
            setIsActive(false); 
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
          systemInstruction: systemInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });
      sessionRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setVoiceError("Failed to start session.");
      setIsConnecting(false);
    }
  };

  const handleClonedRecordingStart = async () => {
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedInputId ? { exact: selectedInputId } : undefined } });
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const analyser = audioCtx.createAnalyser();
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
          inputAudioContextRef.current = audioCtx;
          setInputAnalyser(analyser);

          const mediaRecorder = new MediaRecorder(stream);
          mediaRecorderRef.current = mediaRecorder;
          chunksRef.current = [];

          mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data);
          mediaRecorder.onstop = handleClonedRecordingStop;
          mediaRecorder.start();
          setIsRecordingClone(true);
          setIsActive(true);
      } catch (err) {
          setVoiceError("Failed to access microphone");
      }
  };

  const handleClonedRecordingStop = async () => {
      setIsRecordingClone(false);
      setIsProcessingClone(true);
      
      try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
              const base64Audio = (reader.result as string).split(',')[1];
              const recentHistory = messages.slice(-4).map(m => `${m.role}: ${m.text}`).join('\n');
              const systemPrompt = `You are the user's inner voice/mentor. CONTEXT:\n${recentHistory}\nRespond to the audio input naturally.`;

              try {
                  const response = await ai.models.generateContent({
                      model: 'gemini-2.5-flash',
                      contents: { parts: [{ inlineData: { mimeType: 'audio/webm', data: base64Audio } }, { text: systemPrompt }] }
                  });
                  const textResponse = response.text;
                  
                  if (textResponse) {
                      setMessages(prev => [...prev, { id: `cloned-user-${Date.now()}`, role: 'user', text: "[Audio Message]" }, { id: `cloned-model-${Date.now()}`, role: 'model', text: textResponse }]);
                  }

                  if (textResponse && voiceSettings?.elevenLabsVoiceId) {
                      const audioBuffer = await generateSpeech(textResponse, voiceSettings.elevenLabsVoiceId);
                      await playClonedAudio(audioBuffer);
                  }
              } catch (err) {
                  setVoiceError("Processing failed.");
              } finally {
                  setIsProcessingClone(false);
              }
          };
      } catch (err) {
          setIsProcessingClone(false);
      }
  };

  const playClonedAudio = async (arrayBuffer: ArrayBuffer) => {
      setIsMentorSpeaking(true);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      if (selectedOutputId && (audioCtx as any).setSinkId) { try { await (audioCtx as any).setSinkId(selectedOutputId); } catch (e) {} }
      const analyser = audioCtx.createAnalyser();
      setOutputAnalyser(analyser);
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(analyser).connect(audioCtx.destination);
      source.onended = () => { setIsMentorSpeaking(false); };
      source.start();
  };

  const handleToggleVoiceMode = () => {
      if (mode === 'text') {
          setMode('voice');
          if (isClonedMode) handleClonedRecordingStart(); else startStandardSession();
      } else {
          setMode('text');
          
          const pendingMessages: ChatMessage[] = [];
          if (voiceTranscript.user.trim()) pendingMessages.push({ id: `voice-user-end-${Date.now()}`, role: 'user', text: voiceTranscript.user });
          if (voiceTranscript.model.trim()) pendingMessages.push({ id: `voice-model-end-${Date.now()}`, role: 'model', text: voiceTranscript.model });
          if (pendingMessages.length > 0) setMessages(prev => [...prev, ...pendingMessages]);

          cleanupVoiceSession();
          
          const allMessages = [...messages, ...pendingMessages];
          const currentHistory = allMessages.filter(m => m.id !== 'intro' && m.id !== 'err' && !m.isStreaming).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
          
          if (currentHistory.length > 0) {
              chatSessionRef.current = ai.chats.create({
                  model: 'gemini-2.5-flash',
                  config: { systemInstruction: getSystemInstruction() },
                  history: currentHistory
              });
          } else {
              initializeTextChat();
          }
      }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 flex justify-between items-center mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-600 rounded-xl shadow-md"><Compass className="w-6 h-6 text-white" /></div>
            <div>
              <h2 className="text-2xl font-serif font-bold text-brand-900">Mentor</h2>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-400">{entries.length > 0 ? `Reflecting on ${entries.length} memories` : "Ready to listen"}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
              {messages.length > 1 && mode === 'text' && (
                  <button onClick={handleSaveConversation} disabled={isSaved} className={`hidden md:flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border transition-all ${isSaved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-brand-500 border-brand-200 hover:bg-brand-50 hover:text-brand-700 shadow-sm'}`}>
                      {isSaved ? <Check className="w-4 h-4" /> : <BookPlus className="w-4 h-4" />} {isSaved ? "Saved" : "Save to Journal"}
                  </button>
              )}
              <button onClick={onClose} className="md:hidden p-2 text-brand-400 hover:text-brand-600 rounded-full transition-colors"><PhoneOff className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-paper-50 rounded-3xl shadow-sm border border-paper-300 overflow-hidden relative">
            {mode === 'voice' && (
                <div className="absolute inset-0 z-20 bg-[#2a2422] flex flex-col animate-in fade-in duration-700">
                    <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none">
                            <div className={`w-96 h-96 rounded-full blur-3xl transition-all duration-1000 ${isMentorSpeaking ? 'bg-amber-600 scale-110' : 'bg-[#5d453b] scale-100'}`}></div>
                        </div>
                        <div className="relative z-10 flex flex-col items-center space-y-12 w-full max-w-md">
                            {isConnecting || isProcessingClone ? (
                                <div className="flex flex-col items-center text-brand-200">
                                    <Loader2 className="w-12 h-12 animate-spin mb-6 opacity-50" />
                                    <p className="font-serif italic text-lg tracking-wide opacity-80">Consulting the archives...</p>
                                </div>
                            ) : voiceError ? (
                                <div className="text-red-300 text-center bg-red-900/30 p-6 rounded-xl border border-red-800">
                                    <p className="mb-4 font-serif">{voiceError}</p>
                                    <button onClick={isClonedMode ? handleClonedRecordingStart : startStandardSession} className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-sm font-bold transition-all">Reconnect</button>
                                </div>
                            ) : (
                                <>
                                    <div className="w-full h-64 flex items-center justify-center">
                                        <AudioVisualizer isRecording={true} analyser={isMentorSpeaking ? outputAnalyser : inputAnalyser} mode="orb" strokeColor={isMentorSpeaking ? "#fbbf24" : "#a18072"} />
                                    </div>
                                    <div className="text-center space-y-3">
                                        <h3 className="text-2xl font-serif text-[#eaddd7] tracking-wide">{isMentorSpeaking ? "Speaking..." : "Listening..."}</h3>
                                        <p className="text-brand-400 text-sm font-medium uppercase tracking-widest">{isClonedMode ? "Inner Voice" : "Archive Custodian"}</p>
                                        {(voiceTranscript.user || voiceTranscript.model) && <div className="text-white/40 text-xs font-serif italic mt-4 max-w-xs mx-auto line-clamp-2">"{voiceTranscript.model || voiceTranscript.user}"</div>}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="p-8 flex justify-center bg-[#2a2422] border-t border-[#4a372f]">
                        <button onClick={handleToggleVoiceMode} className="flex items-center gap-3 px-8 py-4 bg-white/5 text-brand-200 rounded-full font-bold shadow-lg hover:bg-white/10 hover:text-white transition-all active:scale-95 border border-white/10"><History className="w-5 h-5" /> Return to Text</button>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 custom-scrollbar bg-paper-50">
                {messages.map((msg, index) => {
                    const isUser = msg.role === 'user';
                    return (
                        <div key={msg.id} className={`max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 px-1 ${isUser ? 'text-brand-400' : 'text-brand-500'}`}>
                                {isUser ? <><>You <User className="w-3 h-3" /></></> : <><><Compass className="w-3 h-3" /> Mentor</></>}
                            </div>
                            <div className={`relative text-lg leading-relaxed ${isUser ? 'font-sans text-brand-800 text-left max-w-xl bg-white p-5 rounded-2xl rounded-tr-sm shadow-sm border border-paper-300' : 'font-serif text-brand-900 text-left text-xl px-1 py-1'}`}>
                                {msg.text}
                                {msg.isStreaming && <span className="inline-block w-1.5 h-5 ml-1 align-middle bg-brand-300 animate-pulse"></span>}
                            </div>
                            {!isUser && index < messages.length - 1 && <div className="w-12 h-px bg-paper-300/50 mt-6 mb-2 self-center opacity-50"></div>}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} className="h-12" />
            </div>

            <div className="p-4 sm:p-6 bg-white border-t border-paper-300">
                <div className="max-w-3xl mx-auto flex items-end gap-3">
                    <div className="flex-1 bg-white rounded-3xl border border-paper-300 shadow-sm focus-within:border-[#a18072] focus-within:shadow-md transition-all flex items-center min-h-[3.5rem]">
                        <textarea ref={textareaRef} value={inputText} onChange={handleInput} onKeyDown={handleKeyDown} placeholder="Write or speak with your mentor..." rows={1} className="w-full bg-transparent border-none focus:ring-0 outline-none px-5 text-[#5d453b] placeholder-[#d2bab0] resize-none text-base font-serif leading-relaxed max-h-32 py-3" style={{ height: 'auto' }} />
                    </div>
                    <button onClick={inputText.trim() ? handleSendMessage : handleToggleVoiceMode} disabled={isTyping} className={`flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 border border-transparent ${inputText.trim() ? 'bg-[#8a6a5c] text-white hover:bg-[#725548]' : 'bg-[#a18072] text-white hover:bg-[#8a6a5c] hover:scale-105'}`} title={inputText.trim() ? "Send Message" : "Start Voice Conversation"}>
                        {inputText.trim() ? (isTyping ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6 ml-0.5" />) : <Mic className="w-8 h-8" />}
                    </button>
                </div>
                <div className="text-center mt-3"><span className="text-[9px] font-bold text-[#d2bab0] uppercase tracking-[0.2em]">Private Conversation</span></div>
            </div>
        </div>
    </div>
  );
};

export default MentorChat;
