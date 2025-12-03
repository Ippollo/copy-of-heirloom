
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2, Camera, MapPin, X, Image as ImageIcon, FileAudio, Send, Quote, PenLine, Keyboard, Mic2, Upload, Bold, Italic, List, Underline } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import { RecorderState, Prompt, LocationData } from '../types';

interface RecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number, imageBlob?: Blob, location?: LocationData) => void;
  onTextComplete: (text: string, imageBlob?: Blob, location?: LocationData) => void;
  recorderState: RecorderState;
  setRecorderState: (state: RecorderState) => void;
  selectedPrompt: Prompt | null;
  selectedInputId: string;
  onInputIdChange: (id: string) => void;
  className?: string;
  variant?: 'default' | 'dark';
}

const Recorder: React.FC<RecorderProps> = ({ 
    onRecordingComplete, 
    onTextComplete,
    recorderState, 
    setRecorderState, 
    selectedPrompt,
    selectedInputId,
    onInputIdChange,
    className = "",
    variant = 'default'
}) => {
  const [mode, setMode] = useState<'audio' | 'text'>('audio');
  const [textEntry, setTextEntry] = useState('');
  
  // Rich Text State
  const [activeFormats, setActiveFormats] = useState({
      bold: false,
      italic: false,
      underline: false,
      list: false
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [timer, setTimer] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  
  // Audio Context for Visualization
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Media State
  const [selectedImage, setSelectedImage] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [locationData, setLocationData] = useState<LocationData | undefined>(undefined);
  
  // Camera State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Input Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Auto-focus logic only if in text mode
  useEffect(() => {
    if (recorderState === RecorderState.Idle && mode === 'text' && !isCameraOpen) {
        setTimeout(() => {
            if (editorRef.current) {
                editorRef.current.focus();
                checkFormats();
            }
        }, 50);
    }
  }, [recorderState, isCameraOpen, selectedPrompt, mode]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        stopCamera();
        cleanupAudioContext();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const cleanupAudioContext = () => {
      if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
      }
      if (analyserRef.current) {
          analyserRef.current.disconnect();
          analyserRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
          audioContextRef.current = null;
      }
  };

  const handleVideoRef = useCallback((node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && streamRef.current) {
          node.srcObject = streamRef.current;
      }
  }, []);

  // --- Camera Logic ---
  const stopCamera = () => {
      if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
      }
      setIsCameraOpen(false);
  };

  // --- File Handling ---
  const handleImageBlob = (blob: Blob) => {
      setSelectedImage(blob);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(URL.createObjectURL(blob));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageBlob(file);
    if (e.target) e.target.value = '';
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRecorderState(RecorderState.Processing);

    try {
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        
        const handleSubmit = () => {
            onRecordingComplete(file, audio.duration || 0, selectedImage || undefined, locationData);
            clearState();
            URL.revokeObjectURL(url);
        };

        audio.onloadedmetadata = handleSubmit;
        
        audio.onerror = () => {
            console.warn("Could not read audio metadata, submitting with 0 duration");
            if (file.type.startsWith('audio/')) {
                 onRecordingComplete(file, 0, selectedImage || undefined, locationData);
                 clearState();
            } else {
                 alert("Invalid audio file format.");
                 setRecorderState(RecorderState.Idle);
            }
            URL.revokeObjectURL(url);
        };
    } catch (err) {
        console.error("Audio import error", err);
        alert("Failed to load audio file.");
        setRecorderState(RecorderState.Idle);
    }
    
    if (e.target) e.target.value = '';
  };

  const clearState = () => {
    setSelectedImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    cleanupAudioContext();
    setTimer(0);
    setTextEntry('');
    if (editorRef.current) editorRef.current.innerHTML = '';
    setActiveFormats({ bold: false, italic: false, underline: false, list: false });
    setLocationData(undefined);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const submitTextEntry = () => {
      if (!textEntry.trim()) return;
      setRecorderState(RecorderState.Processing);
      onTextComplete(textEntry, selectedImage || undefined, locationData);
      clearState();
  };

  // --- Text Formatting (WYSIWYG) ---
  const checkFormats = () => {
      if (!editorRef.current) return;
      setActiveFormats({
          bold: document.queryCommandState('bold'),
          italic: document.queryCommandState('italic'),
          underline: document.queryCommandState('underline'),
          list: document.queryCommandState('insertUnorderedList')
      });
  };

  const execFormat = (command: string) => {
      document.execCommand(command, false);
      if (editorRef.current) {
          editorRef.current.focus();
          setTextEntry(editorRef.current.innerHTML);
          checkFormats();
      }
  };

  const handleTextChange = () => {
      if (editorRef.current) {
          const html = editorRef.current.innerHTML;
          // Clean up empty paragraphs or breaks if needed, but keeping raw HTML is fine for now
          setTextEntry(html === '<br>' ? '' : html);
          checkFormats();
      }
  };

  // --- Recording Logic ---
  const startRecording = async () => {
    try {
      let constraints: MediaStreamConstraints = {
          audio: {
              deviceId: selectedInputId ? { exact: selectedInputId } : undefined,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
          }
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (selectedInputId === 'default' && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
             console.warn("Requested default device ID failed, falling back to browser selection.");
             constraints = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
             stream = await navigator.mediaDevices.getUserMedia(constraints);
        } else {
            throw err;
        }
      }
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048; 
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      startTimeRef.current = Date.now();

      mediaRecorder.onstop = () => {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setTimer(0);
        onRecordingComplete(blob, duration, selectedImage || undefined, locationData);
        stream.getTracks().forEach(track => track.stop());
        clearState();
      };

      mediaRecorder.start();
      setRecorderState(RecorderState.Recording);
      setTimer(0);
      timerIntervalRef.current = window.setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recorderState === RecorderState.Recording) {
      mediaRecorderRef.current.stop();
      setRecorderState(RecorderState.Processing);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  }, [recorderState, setRecorderState]);

  // Strip HTML tags to check if text is truly empty
  const hasText = textEntry.replace(/<[^>]*>/g, '').trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
      // Allow saving with Ctrl+Enter or Cmd+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (hasText) submitTextEntry();
      }
      checkFormats();
  };

  // --- THEME UTILS ---
  const isDarkVariant = variant === 'dark';
  // Switch to light theme for text mode to match Biographer page style
  const isDark = isDarkVariant && mode === 'audio';

  const containerClass = isDark 
    ? 'bg-brand-900 border-brand-800 shadow-brand-900/50' 
    : 'bg-white border-brand-100 shadow-brand-100/50';
  const textColor = isDark ? 'text-white' : 'text-brand-800';
  const subTextColor = isDark ? 'text-brand-300' : 'text-brand-400';
  const visualizerColor = isDark ? '#eaddd7' : '#a18072';
  
  const toolbarBg = isDark ? 'bg-brand-900/90 border-brand-800' : 'bg-white/90 border-brand-100';
  
  const micButtonClass = isDark 
    ? 'bg-white text-brand-900 shadow-2xl shadow-brand-900/50 hover:bg-brand-100'
    : 'bg-brand-600 text-white shadow-2xl shadow-brand-200 hover:bg-brand-700';

  const modeSwitchBg = isDark ? 'bg-brand-800 border-brand-700' : 'bg-brand-50 border-brand-100';
  const modeSwitchActive = isDark ? 'bg-brand-700 text-white shadow-sm' : 'bg-white text-brand-700 shadow-sm';
  const modeSwitchInactive = isDark ? 'text-brand-400 hover:text-brand-200' : 'text-brand-300 hover:text-brand-500';

  // Helper for active toolbar button styles
  const getToolbarBtnClass = (isActive: boolean) => {
      if (isActive) {
          return isDark ? 'bg-white/20 text-white shadow-sm' : 'bg-brand-200 text-brand-800 shadow-sm';
      }
      return isDark ? 'text-brand-300 hover:text-white hover:bg-white/10' : 'text-brand-400 hover:text-brand-600 hover:bg-brand-50';
  };

  return (
    <div className={`
        rounded-3xl shadow-xl overflow-hidden relative flex flex-col transition-all duration-500 border
        ${containerClass}
        ${selectedPrompt ? 'ring-4 ring-brand-50/80' : ''}
        ${className}
    `}>
      
      <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/*" />
      <input type="file" ref={audioInputRef} onChange={handleAudioSelect} className="hidden" accept="audio/*" />

      {/* --- OVERLAYS --- */}

      {recorderState === RecorderState.Processing && (
           <div className={`absolute inset-0 z-50 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-700 ${isDark ? 'bg-brand-900/90 text-white' : 'bg-white/90 text-brand-800'}`}>
                <Loader2 className={`w-12 h-12 animate-spin mb-4 ${isDark ? 'text-brand-300' : 'text-brand-400'}`} />
                <span className="text-xl font-serif">Preserving your story...</span>
           </div>
      )}

      {/* --- PROMPT HEADER --- */}
      {selectedPrompt && (
            <div 
                key={selectedPrompt.id} 
                className={`border-b p-6 relative animate-in slide-in-from-top-4 duration-500 fade-in flex-shrink-0 ${isDark ? 'bg-brand-800/50 border-brand-800' : 'bg-brand-50/50 border-brand-100'}`}
            >
                <div className="relative z-10 text-center">
                    <p className={`font-serif italic text-xl md:text-2xl leading-tight ${textColor}`}>
                        "{selectedPrompt.text}"
                    </p>
                    <div className="mt-2 flex justify-center">
                         <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm ${isDark ? 'bg-brand-800 text-brand-200 border-brand-700' : 'bg-white text-brand-400 border border-brand-100'}`}>
                            {selectedPrompt.category}
                         </span>
                    </div>
                </div>
            </div>
      )}

      {/* --- MAIN INTERFACE --- */}

      <div className={`flex-1 relative flex flex-col h-full overflow-hidden transition-colors duration-500 ease-in-out ${isDark ? 'bg-brand-900' : 'bg-white'}`}>
          
          <div className="flex-1 relative w-full h-full">
              
              {/* AUDIO STUDIO MODE */}
              <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 transition-all duration-500 ease-in-out ${mode === 'audio' ? 'opacity-100 translate-y-0 visible z-10' : 'opacity-0 -translate-y-4 invisible z-0 pointer-events-none'}`}>
                  
                  <div className="absolute inset-0 z-0 opacity-40">
                      <AudioVisualizer isRecording={recorderState === RecorderState.Recording} analyser={analyserRef.current} strokeColor={visualizerColor} mode="wave" />
                  </div>

                  <div className="relative z-10 flex flex-col items-center justify-center space-y-8 w-full">
                        {recorderState === RecorderState.Recording ? (
                            <div className="flex flex-col items-center gap-6">
                                <div className={`text-6xl font-mono font-bold tracking-widest animate-pulse tabular-nums ${textColor}`}>
                                    {formatTime(timer)}
                                </div>
                                <button
                                    onClick={stopRecording}
                                    className="group relative flex items-center justify-center w-24 h-24 bg-red-500/10 rounded-full border-4 border-red-500 hover:bg-red-500/20 hover:scale-105 transition-all duration-300 shadow-xl"
                                >
                                    <Square className="w-8 h-8 text-red-500 fill-current" />
                                </button>
                                <p className={`font-medium uppercase tracking-widest text-xs animate-pulse ${subTextColor}`}>Recording Memory</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-6">
                                <button
                                    onClick={startRecording}
                                    className={`group relative flex items-center justify-center w-32 h-32 rounded-full transition-all duration-300 active:scale-95 ${micButtonClass}`}
                                >
                                    <div className="absolute inset-0 rounded-full border-2 border-white/20 animate-ping opacity-20 group-hover:opacity-40"></div>
                                    <Mic className="w-12 h-12" />
                                </button>
                                <div className="text-center">
                                    <p className={`text-xl font-serif font-bold mb-1 ${textColor}`}>Capture Memory</p>
                                    <p className={`text-xs font-bold uppercase tracking-widest ${subTextColor}`}>Your voice is your legacy</p>
                                </div>

                                <button 
                                    onClick={() => audioInputRef.current?.click()}
                                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${isDark ? 'bg-white/10 text-brand-100 hover:bg-white/20 hover:text-white border border-white/5' : 'bg-brand-100/50 text-brand-600 hover:bg-brand-100 border border-brand-200'}`}
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload Audio File
                                </button>
                            </div>
                        )}
                  </div>
              </div>

              {/* TEXT MODE (WYSIWYG) */}
              <div className={`absolute inset-0 flex flex-col transition-all duration-500 ease-in-out ${mode === 'text' ? 'opacity-100 translate-y-0 visible z-10' : 'opacity-0 translate-y-4 invisible z-0 pointer-events-none'}`}>
                 <div 
                    className="flex-1 relative cursor-text group overflow-hidden flex flex-col p-6" 
                    onClick={() => editorRef.current?.focus()}
                >
                    {!hasText && (
                        <div className={`absolute top-6 left-6 pointer-events-none select-none text-lg md:text-xl font-serif leading-relaxed ${isDark ? 'text-brand-700' : 'text-brand-300'}`}>
                            Write your thoughts...
                        </div>
                    )}
                    <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleTextChange}
                        onKeyDown={handleKeyDown}
                        onMouseUp={checkFormats}
                        onKeyUp={checkFormats}
                        className={`w-full h-full text-lg md:text-xl font-serif bg-transparent border-none outline-none leading-relaxed overflow-y-auto scrollbar-hide [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${isDark ? 'text-white' : 'text-brand-900'}`}
                    />
                </div>
              </div>

          </div>

          {/* Attached Image Preview */}
          {imagePreview && (
            <div className="absolute top-4 right-4 z-20 animate-in fade-in zoom-in duration-500">
                <div className="relative group/preview">
                    <img src={imagePreview} alt="Selected" className="w-20 h-20 object-cover rounded-lg shadow-md border-2 border-white rotate-2 group-hover/preview:rotate-0 transition-transform duration-500" />
                    <button onClick={clearState} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600 transition-colors duration-300">
                        <X className="w-3 h-3" />
                    </button>
                </div>
            </div>
          )}

          {/* BOTTOM TOOLBAR */}
          <div className={`backdrop-blur-md border-t p-4 flex items-center justify-between z-20 transition-colors duration-500 ${toolbarBg}`}>
             
             {/* Left: Formatting Tools (Text Mode Only) */}
             <div className="flex items-center gap-2">
                 <div className={`flex items-center gap-1 transition-all duration-300 ${mode === 'text' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'}`}>
                     <button onMouseDown={(e) => { e.preventDefault(); execFormat('bold'); }} className={`p-2 rounded-lg transition-colors ${getToolbarBtnClass(activeFormats.bold)}`} title="Bold">
                         <Bold className="w-4 h-4" />
                     </button>
                     <button onMouseDown={(e) => { e.preventDefault(); execFormat('italic'); }} className={`p-2 rounded-lg transition-colors ${getToolbarBtnClass(activeFormats.italic)}`} title="Italic">
                         <Italic className="w-4 h-4" />
                     </button>
                     <button onMouseDown={(e) => { e.preventDefault(); execFormat('underline'); }} className={`p-2 rounded-lg transition-colors ${getToolbarBtnClass(activeFormats.underline)}`} title="Underline">
                         <Underline className="w-4 h-4" />
                     </button>
                     <div className={`w-px h-4 mx-1 ${isDark ? 'bg-white/10' : 'bg-brand-200'}`}></div>
                     <button onMouseDown={(e) => { e.preventDefault(); execFormat('insertUnorderedList'); }} className={`p-2 rounded-lg transition-colors ${getToolbarBtnClass(activeFormats.list)}`} title="List">
                         <List className="w-4 h-4" />
                     </button>
                 </div>
             </div>

             {/* Right: Mode Switch & Actions */}
             <div className="flex items-center gap-3">
                 
                 {/* Mode Toggle */}
                 <div className={`flex rounded-lg p-1 border ${modeSwitchBg}`}>
                    <button 
                        onClick={() => setMode('audio')}
                        className={`p-2 rounded-md transition-all ${mode === 'audio' ? modeSwitchActive : modeSwitchInactive}`}
                        title="Audio Mode"
                    >
                        <Mic2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setMode('text')}
                        className={`p-2 rounded-md transition-all ${mode === 'text' ? modeSwitchActive : modeSwitchInactive}`}
                        title="Text Mode"
                    >
                        <Keyboard className="w-4 h-4" />
                    </button>
                 </div>

                 {/* Text Submit Button */}
                 <div className={`transition-all duration-300 ${mode === 'text' && hasText ? 'opacity-100 scale-100 w-auto' : 'opacity-0 scale-90 w-0 overflow-hidden'}`}>
                    <button 
                        onClick={submitTextEntry} 
                        className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2 rounded-lg font-bold shadow-md hover:bg-brand-700 transition-all duration-300 active:scale-95 whitespace-nowrap text-sm"
                        title="Save Entry"
                    >
                        <span>Save</span>
                        <Send className="w-3 h-3" />
                    </button>
                 </div>
             </div>
          </div>
      </div>
    </div>
  );
};

export default Recorder;
