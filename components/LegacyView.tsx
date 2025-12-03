
import React, { useState, useEffect, useRef } from 'react';
import { JournalEntry, Recipient, LegacyConfig, UserVoiceSettings } from '../types';
import { generateAncestralScenario, generateAncestralAdvice } from '../services/geminiService';
import { generateLegacyArchive } from '../services/exportService';
import { Users, Loader2, Edit2, CheckCircle2, Mic, RefreshCw, Save, Heart, Download, Plus, MinusCircle, Mail, Play, Trash2, Square, Infinity, Shield, Quote, Info } from 'lucide-react';
import Recorder from './Recorder';
import AudioVisualizer from './AudioVisualizer';
import { v4 as uuidv4 } from 'uuid';

interface LegacyViewProps {
  entries: JournalEntry[];
  onSaveEntry: (entry: JournalEntry) => void;
  voiceSettings: UserVoiceSettings;
  selectedInputId: string;
  selectedOutputId?: string;
}

const LegacyView: React.FC<LegacyViewProps> = ({ entries, onSaveEntry, voiceSettings, selectedInputId, selectedOutputId }) => {
  const [activeTab, setActiveTab] = useState<'training' | 'setup'>('training');

  return (
    <div className="flex flex-col h-full overflow-hidden">
        <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-12">
            <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-600 rounded-xl shadow-md"><Infinity className="w-6 h-6 text-white" /></div>
                <div><h2 className="font-serif font-bold text-brand-900 text-2xl">Legacy</h2><p className="text-brand-400 text-xs font-bold uppercase tracking-widest">Preserve your wisdom</p></div>
            </div>
            <div className="flex p-1 bg-brand-100/50 rounded-xl self-start md:self-auto">
                <button onClick={() => setActiveTab('training')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === 'training' ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}><Users className="w-4 h-4" />Training</button>
                <button onClick={() => setActiveTab('setup')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${activeTab === 'setup' ? 'bg-white text-brand-800 shadow-sm' : 'text-brand-400 hover:text-brand-600'}`}><Shield className="w-4 h-4" />Recipients</button>
            </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="max-w-[1400px] mx-auto h-full">
                {activeTab === 'training' ? <TrainingSection entries={entries} onSaveEntry={onSaveEntry} selectedInputId={selectedInputId} /> : <ConfigSection entries={entries} voiceSettings={voiceSettings} selectedInputId={selectedInputId} selectedOutputId={selectedOutputId} />}
            </div>
        </div>
    </div>
  );
};

const TrainingSection: React.FC<{ entries: JournalEntry[], onSaveEntry: (e: JournalEntry) => void, selectedInputId: string }> = ({ entries, onSaveEntry, selectedInputId }) => {
    const [step, setStep] = useState<'loading' | 'review' | 'editing' | 'recording' | 'success'>('loading');
    const [scenario, setScenario] = useState<{ topic: string, text: string } | null>(null);
    const [proposedAdvice, setProposedAdvice] = useState('');
    const [userEdit, setUserEdit] = useState('');
    const [recorderState, setRecorderState] = useState<any>(0);
    const [currentInputId, setCurrentInputId] = useState(selectedInputId);
    const MIN_ENTRIES_FOR_AI = 5;
  
    useEffect(() => { loadNewScenario(); }, []);
  
    const loadNewScenario = async () => {
      setStep('loading');
      try {
          const result = await generateAncestralScenario(entries);
          setScenario({ topic: result.topic, text: result.scenario });
          if (entries.length >= MIN_ENTRIES_FOR_AI) { const advice = await generateAncestralAdvice(result.scenario, entries); setProposedAdvice(advice); setUserEdit(advice); } else { setProposedAdvice(''); setUserEdit(''); }
          setStep('review');
      } catch (e) { setScenario({ topic: "General Wisdom", text: "Your descendant is facing a difficult choice between duty and passion." }); setStep('review'); }
    };
  
    const handleSave = async (content: string, type: 'text' | 'audio', blob?: Blob, duration?: number) => {
        const newEntry: JournalEntry = { id: uuidv4(), createdAt: Date.now(), transcription: type === 'text' ? content : "Audio Advice (Processing...)", duration: duration, title: `Advice on ${scenario?.topic}`, mood: "Wise", tags: ["Legacy Training", "Advice", "Ancestor Mode"], insights: [], summary: `You advised your descendant on ${scenario?.topic}.`, isProcessing: type === 'audio', prompt: `Scenario: ${scenario?.text}`, inputType: type, audioBlob: blob };
        onSaveEntry(newEntry);
        setStep('success');
    };
  
    if (step === 'loading') return <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-6"><div className="relative"><div className="absolute inset-0 bg-brand-200 rounded-full blur-xl animate-pulse"></div><Users className="w-16 h-16 text-brand-600 relative z-10" /></div><div><h3 className="text-xl font-serif font-bold text-brand-900">Consulting your history...</h3><p className="text-brand-500 max-w-sm mx-auto mt-2">Simulating a future scenario based on your journal entries.</p></div><Loader2 className="w-8 h-8 text-brand-400 animate-spin" /></div>;
    if (step === 'success') return <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center space-y-8 animate-in zoom-in duration-300"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 shadow-sm"><CheckCircle2 className="w-10 h-10" /></div><div><h3 className="text-2xl font-serif font-bold text-brand-900">Wisdom Captured</h3><p className="text-brand-600 max-w-md mx-auto mt-2">Your advice has been added to the Legacy model. The "Digital You" is now better equipped to guide your family.</p></div><button onClick={loadNewScenario} className="px-8 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-all font-bold shadow-lg flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Train Another Scenario</button></div>;
  
    return (
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 h-full items-stretch">
          <div className="w-full lg:flex-1 lg:max-w-xl flex flex-col">
              <div className="bg-paper-50 rounded-2xl shadow-sm border-2 border-paper-300 p-8 lg:p-12 relative overflow-hidden flex flex-col justify-center flex-1 min-h-[500px]">
                  <div className="relative z-10 flex flex-col h-full justify-center"><div className="mb-6"><span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white border border-paper-300 shadow-sm text-brand-400"><Quote className="w-6 h-6 fill-current" /></span></div><p className="font-serif text-xl md:text-2xl text-brand-900 leading-[2.2] text-justify tracking-wide">{scenario?.text}</p></div>
              </div>
          </div>
          <div className="w-full lg:flex-1 bg-paper-100/50 rounded-2xl border border-paper-300 p-6 flex flex-col relative shadow-inner min-h-[500px]">
              <div className="flex justify-between items-center mb-6"><span className="text-xs font-bold text-brand-400 uppercase tracking-widest">Your Guidance</span>{scenario?.topic && <span className="text-xs font-bold text-brand-600 bg-paper-100 px-3 py-1 rounded-full border border-paper-300">Topic: {scenario.topic}</span>}</div>
              {step === 'recording' ? (
                  <div className="flex-1 flex flex-col"><div className="flex justify-between items-center mb-4"><h3 className="font-bold text-brand-800">Record Your Answer</h3><button onClick={() => setStep('review')} className="text-xs text-brand-500 underline hover:text-brand-800">Cancel</button></div><div className="flex-1 relative"><Recorder onRecordingComplete={(blob, dur) => handleSave("Audio", 'audio', blob, dur)} onTextComplete={(text) => handleSave(text, 'text')} recorderState={recorderState} setRecorderState={setRecorderState} selectedPrompt={null} selectedInputId={currentInputId} onInputIdChange={setCurrentInputId} className="h-full shadow-lg border border-paper-300" /></div></div>
              ) : (
                  <>
                      {entries.length < MIN_ENTRIES_FOR_AI && <div className="mb-4 bg-white/80 border border-paper-300 p-4 rounded-xl flex gap-3 items-start shadow-sm"><div className="p-1.5 bg-paper-100 rounded-full text-brand-600 mt-0.5"><Info className="w-4 h-4" /></div><div><p className="text-xs font-bold text-brand-800 uppercase tracking-wide mb-1">Journal history needed</p><p className="text-xs text-brand-600 leading-relaxed">Heirloom needs at least {MIN_ENTRIES_FOR_AI} entries to start suggesting advice in your voice. For now, please write or record your guidance manually.</p></div></div>}
                      <textarea value={userEdit} onChange={(e) => { setUserEdit(e.target.value); setStep('editing'); }} className="flex-1 w-full bg-white/50 rounded-xl border-none focus:ring-2 focus:ring-brand-200 text-brand-800 font-serif text-lg leading-relaxed p-6 placeholder-brand-300 resize-none transition-all shadow-sm" placeholder="My advice to you is..." />
                      <div className="mt-6 flex flex-wrap gap-4 justify-between items-center">
                          <div className="flex gap-2"><button onClick={() => setStep('recording')} className="flex items-center px-4 py-2.5 bg-white border border-paper-300 text-brand-600 rounded-xl hover:bg-paper-50 hover:border-paper-300 transition-all text-sm font-bold shadow-sm group"><Mic className="w-4 h-4 mr-2 group-hover:text-brand-800" /> Record</button><button onClick={loadNewScenario} className="px-4 py-2.5 text-brand-400 hover:text-brand-600 text-sm font-medium transition-colors">Skip</button></div>
                          <button onClick={() => handleSave(userEdit, 'text')} className={`flex items-center px-6 py-3 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all active:scale-95 ${step === 'review' ? 'bg-brand-600 hover:bg-brand-700' : 'bg-green-600 hover:bg-green-700'}`}>{step === 'review' ? <><CheckCircle2 className="w-5 h-5 mr-2" /> Approve Advice</> : <><Save className="w-5 h-5 mr-2" /> Save Changes</>}</button>
                      </div>
                  </>
              )}
          </div>
      </div>
    );
};

const ConfigSection: React.FC<{ entries: JournalEntry[], voiceSettings: UserVoiceSettings, selectedInputId: string, selectedOutputId?: string }> = ({ entries, voiceSettings, selectedInputId, selectedOutputId }) => {
    const [config, setConfig] = useState<LegacyConfig>({ recipients: [], dedicationMessage: "I wanted to leave these thoughts for you, so you'd always know what was in my heart.", voiceName: 'Kore' });
    const [newRecipient, setNewRecipient] = useState<{name: string, email: string, relationship: string}>({ name: '', email: '', relationship: '' });
    const [isAddingRecipient, setIsAddingRecipient] = useState(false);
    const [dedicationAudio, setDedicationAudio] = useState<Blob | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [timer, setTimer] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const timerIntervalRef = useRef<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => { const saved = localStorage.getItem('vocal_journal_legacy_config'); if (saved) setConfig(JSON.parse(saved)); return () => cleanupAudio(); }, []);
    const updateConfig = (newConfig: LegacyConfig) => { setConfig(newConfig); localStorage.setItem('vocal_journal_legacy_config', JSON.stringify(newConfig)); };
    const cleanupAudio = () => { if (sourceRef.current) sourceRef.current.disconnect(); if (playbackSourceRef.current) playbackSourceRef.current.stop(); if (audioContextRef.current) audioContextRef.current.close(); if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
    const handleAddRecipient = () => { if (!newRecipient.name || !newRecipient.email) return; const r: Recipient = { id: uuidv4(), ...newRecipient }; updateConfig({ ...config, recipients: [...config.recipients, r] }); setNewRecipient({ name: '', email: '', relationship: '' }); setIsAddingRecipient(false); };
    const startRecording = async () => { try { const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedInputId ? { exact: selectedInputId } : undefined } }); const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); const analyser = ctx.createAnalyser(); const source = ctx.createMediaStreamSource(stream); source.connect(analyser); audioContextRef.current = ctx; analyserRef.current = analyser; sourceRef.current = source; const mediaRecorder = new MediaRecorder(stream); mediaRecorderRef.current = mediaRecorder; const chunks: Blob[] = []; mediaRecorder.ondataavailable = e => chunks.push(e.data); mediaRecorder.onstop = () => { setDedicationAudio(new Blob(chunks, { type: 'audio/webm' })); stream.getTracks().forEach(t => t.stop()); cleanupAudio(); }; mediaRecorder.start(); setIsRecording(true); setTimer(0); timerIntervalRef.current = window.setInterval(() => setTimer(t => t + 1), 1000); } catch (e) { alert("Microphone access failed"); } };
    const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
    const playAudio = async () => { if (!dedicationAudio) return; setIsPlaying(true); const ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); audioContextRef.current = ctx; if (selectedOutputId && (ctx as any).setSinkId) await (ctx as any).setSinkId(selectedOutputId); const analyser = ctx.createAnalyser(); analyserRef.current = analyser; const buffer = await dedicationAudio.arrayBuffer(); const decoded = await ctx.decodeAudioData(buffer); const source = ctx.createBufferSource(); source.buffer = decoded; source.connect(analyser); analyser.connect(ctx.destination); source.onended = () => { setIsPlaying(false); cleanupAudio(); }; playbackSourceRef.current = source; source.start(); };
    const handleExport = async () => { if (!voiceSettings.authorName) { alert("Please set your Author Name in settings first."); return; } setIsGenerating(true); try { await generateLegacyArchive(entries, config, voiceSettings.authorName, dedicationAudio || undefined); } catch (e) { alert("Export failed."); } finally { setIsGenerating(false); } };

    return (
        <div className="space-y-8 animate-in fade-in max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl p-6 border border-paper-300 shadow-sm">
                <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-brand-800 flex items-center gap-2"><Mail className="w-5 h-5 text-brand-500" /> Recipients</h3>{!isAddingRecipient && <button onClick={() => setIsAddingRecipient(true)} className="text-xs font-bold text-brand-600 flex items-center gap-1 hover:text-brand-800"><Plus className="w-3 h-3" /> Add New</button>}</div>
                <div className="space-y-3">{config.recipients.map(r => <div key={r.id} className="flex justify-between items-center p-3 bg-paper-50 rounded-lg border border-paper-200"><div><p className="font-bold text-sm text-brand-900">{r.name}</p><p className="text-xs text-brand-500">{r.relationship} • {r.email}</p></div><button onClick={() => updateConfig({...config, recipients: config.recipients.filter(x => x.id !== r.id)})} className="text-brand-300 hover:text-red-500"><MinusCircle className="w-4 h-4" /></button></div>)}{config.recipients.length === 0 && !isAddingRecipient && <p className="text-sm text-brand-300 italic text-center py-4">No recipients added yet.</p>}{isAddingRecipient && <div className="bg-paper-50 p-4 rounded-lg border border-paper-200 space-y-3 animate-in fade-in"><div className="grid grid-cols-2 gap-3"><input value={newRecipient.name} onChange={e => setNewRecipient({...newRecipient, name: e.target.value})} placeholder="Name" className="p-2 rounded text-sm bg-white text-brand-900 border border-paper-300 outline-none focus:ring-1 focus:ring-brand-400 placeholder-brand-300" /><input value={newRecipient.relationship} onChange={e => setNewRecipient({...newRecipient, relationship: e.target.value})} placeholder="Relation" className="p-2 rounded text-sm bg-white text-brand-900 border border-paper-300 outline-none focus:ring-1 focus:ring-brand-400 placeholder-brand-300" /></div><input value={newRecipient.email} onChange={e => setNewRecipient({...newRecipient, email: e.target.value})} placeholder="Email" className="w-full p-2 rounded text-sm bg-white text-brand-900 border border-paper-300 outline-none focus:ring-1 focus:ring-brand-400 placeholder-brand-300" /><div className="flex justify-end gap-2"><button onClick={() => setIsAddingRecipient(false)} className="px-3 py-1 text-xs font-bold text-gray-500 hover:text-gray-700">Cancel</button><button onClick={handleAddRecipient} className="px-3 py-1 bg-brand-600 text-white rounded text-xs font-bold hover:bg-brand-700">Save</button></div></div>}</div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-paper-300 shadow-sm">
                <h3 className="font-bold text-brand-800 flex items-center gap-2 mb-4"><Heart className="w-5 h-5 text-brand-500" /> Dedication</h3><textarea value={config.dedicationMessage} onChange={e => updateConfig({...config, dedicationMessage: e.target.value})} className="w-full p-3 bg-paper-50 rounded-lg border border-paper-200 text-sm text-brand-800 placeholder-brand-300 focus:ring-1 focus:ring-brand-400 outline-none resize-none mb-4" rows={3} placeholder="Write a heartfelt message..." />
                <div className="flex items-center justify-between bg-paper-50 p-3 rounded-lg border border-paper-200 relative overflow-hidden h-14"><div className="flex items-center gap-3 z-10"><div className={`p-2 rounded-full ${isRecording ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-brand-200 text-brand-600'}`}><Mic className="w-4 h-4" /></div><span className="text-xs font-bold text-brand-600">{isRecording ? `Recording ${new Date(timer * 1000).toISOString().substr(14, 5)}` : dedicationAudio ? "Voice Note Recorded" : "Record Voice Note"}</span></div>{(isRecording || isPlaying) && <div className="absolute inset-0 left-32 right-32 opacity-20 pointer-events-none"><AudioVisualizer isRecording={true} analyser={analyserRef.current} strokeColor={isRecording ? "#ef4444" : "#22c55e"} /></div>}<div className="flex items-center gap-2 z-10">{isRecording ? <button onClick={stopRecording} className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600"><Square className="w-3 h-3 fill-current" /></button> : dedicationAudio ? <><button onClick={playAudio} disabled={isPlaying} className="p-1.5 bg-brand-600 text-white rounded-full hover:bg-brand-700"><Play className="w-3 h-3 fill-current" /></button><button onClick={() => setDedicationAudio(null)} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button></> : <button onClick={startRecording} className="px-3 py-1 bg-white border border-paper-300 text-brand-600 text-xs font-bold rounded hover:bg-paper-100">Record</button>}</div></div>
            </div>
            <div className="pt-4 border-t border-paper-300"><button onClick={handleExport} disabled={isGenerating} className="w-full py-4 bg-brand-800 text-white rounded-xl shadow-lg hover:bg-brand-900 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-70">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}{isGenerating ? "Preparing Archive..." : "Download Secure Legacy Archive"}</button><p className="text-center text-xs text-brand-400 mt-3">Generates a self-contained website with all your memories, insights, and voice recordings.</p></div>
        </div>
    );
};

export default LegacyView;
