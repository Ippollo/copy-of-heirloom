
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Loader2, Feather, Home } from 'lucide-react';
import Recorder from './components/Recorder';
import HomeDashboard from './components/HomeDashboard';
import LockScreen from './components/LockScreen';
import ChapterModal from './components/ChapterModal';
import { Sidebar } from './components/Sidebar';
import { MobileHeader, MobileFooter } from './components/MobileNavigation';
import { JournalEntry, RecorderState, Prompt, UserVoiceSettings, LocationData } from './types';
import { analyzeEntry } from './services/geminiService';
import { useSecurity } from './hooks/useSecurity';
import { useJournalEntries } from './hooks/useJournalEntries';

// Lazy load heavy view components
const MentorChat = lazy(() => import('./components/MentorChat'));
const Biographer = lazy(() => import('./components/Biographer'));
const JournalView = lazy(() => import('./components/JournalView'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const DashboardView = lazy(() => import('./components/DashboardView'));
const LegacyView = lazy(() => import('./components/LegacyView'));

type ViewState = 'home' | 'journal' | 'insights' | 'mentor' | 'biographer' | 'legacy';

function App() {
  // View State
  const [view, setView] = useState<ViewState>('home');
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.Idle);
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  
  // Selection State
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [autoExpandId, setAutoExpandId] = useState<string | null>(null);
  
  // Audio Settings State
  const [selectedInputId, setSelectedInputId] = useState('default');
  const [selectedOutputId, setSelectedOutputId] = useState('default');

  const [voiceSettings, setVoiceSettings] = useState<UserVoiceSettings>({
    authorName: '',
    isClonedVoiceEnabled: false,
    useClonedVoiceForMentor: false,
    useClonedVoiceForLegacy: false,
    matchedVoiceName: 'Aoede', 
  });

  // Custom Hooks
  const { isLocked, isAppLoaded, encryptionSalt, passcodeValidator, handleUnlock, lockApp, updatePasscodeConfig } = useSecurity();
  const { entries, loadEntries, processNewEntry, deleteEntryState, updateEntryState, addEntryState, totalRecordingSeconds } = useJournalEntries();

  // Init Effects
  useEffect(() => {
      const savedVoice = localStorage.getItem('vocal_journal_voice_settings');
      if (savedVoice) setVoiceSettings(JSON.parse(savedVoice));
  }, []);

  useEffect(() => {
      // Load entries only if unlocked or no security set (handled by useSecurity causing re-render if locked state changes?)
      // Actually, useSecurity handles the initial lock check. 
      // If NOT locked, load entries.
      if (!isLocked && isAppLoaded) {
          loadEntries();
      }
  }, [isLocked, isAppLoaded, loadEntries]);

  // Clear prompt when switching views, unless switching TO biographer
  useEffect(() => {
      if (view !== 'biographer') {
          setSelectedPrompt(null);
      }
  }, [view]);

  const updateVoiceSettings = (newSettings: UserVoiceSettings) => {
      setVoiceSettings(newSettings);
      localStorage.setItem('vocal_journal_voice_settings', JSON.stringify(newSettings));
  };

  const onProcessingStart = () => {
      setView('journal');
      setRecorderState(RecorderState.Processing);
      setSelectedPrompt(null);
  };

  const handleRecordingComplete = async (audioBlob: Blob, duration: number, imageBlob?: Blob, location?: LocationData) => {
      onProcessingStart();
      const promptText = selectedPrompt?.text;
      await processNewEntry(audioBlob, duration, promptText, imageBlob, location);
      // Removed auto-expansion as requested
      // setAutoExpandId(newId);
      setRecorderState(RecorderState.Idle);
  };

  const handleTextComplete = async (text: string, imageBlob?: Blob, location?: LocationData) => {
      onProcessingStart();
      const words = text.split(/\s+/).length;
      const duration = Math.ceil(words / 3);
      const promptText = selectedPrompt?.text;
      await processNewEntry(text, duration, promptText, imageBlob, location);
      // Removed auto-expansion as requested
      // setAutoExpandId(newId);
      setRecorderState(RecorderState.Idle);
  };

  const handleLegacyEntrySave = async (entry: JournalEntry) => {
      // This is a special case for manually creating training entries in Legacy view
      // We assume LegacyView constructs the entry object fully
      await addEntryState(entry);
      // Legacy view often saves audio that needs transcribing, but for now we trust the component logic
      // Ideally, we would run it through analyzeEntry if transcription is missing
      if (entry.inputType === 'audio' && entry.isProcessing && entry.audioBlob) {
          try {
             // Re-use logic or call service directly if needed, but for simplicity:
             const aiData = await analyzeEntry(entry.audioBlob, entry.prompt, undefined, undefined);
             const finalEntry = { ...entry, transcription: aiData.transcription, isProcessing: false };
             await updateEntryState(finalEntry);
          } catch(e) { console.error("Legacy processing failed", e); }
      }
  };

  const ViewFallback = () => (
      <div className="w-full h-full flex flex-col items-center justify-center text-brand-300 animate-in fade-in duration-300">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p className="text-sm font-bold tracking-wide uppercase">Loading...</p>
      </div>
  );

  if (!isAppLoaded) return null;

  return (
    <div className="flex h-screen bg-brand-50/30 text-brand-900 font-sans overflow-hidden">
      
      {isLocked && (
          <LockScreen 
            passcode={null}
            onUnlock={(code) => handleUnlock(code).then(success => { if(!success) alert("Incorrect passcode"); })} 
            validatorHash={passcodeValidator}
          />
      )}

      <Sidebar 
        view={view} 
        setView={setView} 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onLock={lockApp} 
        hasSecurity={!!encryptionSalt} 
      />

      <MobileHeader setView={setView} hasSecurity={!!encryptionSalt} onLock={lockApp} />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative pt-16 md:pt-0 bg-brand-50/30">
          
          <div className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-500">
              
              {/* HOME DASHBOARD - Keep Eager for Fast Load */}
              {view === 'home' && (
                  <HomeDashboard 
                      entries={entries}
                      authorName={voiceSettings.authorName || ''}
                      onNavigateToBiographer={() => setView('biographer')}
                      onNavigateToJournal={() => setView('journal')}
                      onRecordingComplete={handleRecordingComplete}
                      onTextComplete={handleTextComplete}
                      recorderProps={{
                          recorderState: recorderState,
                          setRecorderState: setRecorderState,
                          selectedPrompt: null,
                          selectedInputId: selectedInputId,
                          onInputIdChange: setSelectedInputId
                      }}
                  />
              )}

              {/* Lazy Loaded Views */}
              <Suspense fallback={<ViewFallback />}>
                {view === 'biographer' && (
                    <div className="w-full h-full flex flex-col p-4 md:p-8 overflow-y-auto scrollbar-hide animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Header: Top Left */}
                            <div className="flex items-center gap-3 mb-6 md:mb-12">
                                <div className="p-2.5 bg-brand-600 rounded-xl shadow-md">
                                    <Feather className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className="font-serif font-bold text-brand-900 text-2xl">Biographer</h2>
                                    <p className="text-brand-400 text-xs font-bold uppercase tracking-widest">Helping you build your complete story</p>
                                </div>
                            </div>

                            {/* Split Layout */}
                            <div className="flex flex-col lg:flex-row gap-6 md:gap-12 items-stretch justify-center flex-1 pb-24 lg:pb-0">
                                {/* Left: Prompt Carousel */}
                                <div className="w-full lg:flex-1 lg:max-w-xl lg:h-[600px] flex flex-col">
                                    <Biographer 
                                        entries={entries}
                                        selectedPrompt={selectedPrompt} 
                                        onSelectPrompt={setSelectedPrompt} 
                                        variant="card"
                                        showHeader={false}
                                    />
                                </div>
                                {/* Right: Recorder */}
                                <div className="w-full lg:flex-1 lg:h-[600px] flex flex-col">
                                    <Recorder 
                                        onRecordingComplete={handleRecordingComplete} 
                                        onTextComplete={handleTextComplete}
                                        recorderState={recorderState}
                                        setRecorderState={setRecorderState}
                                        selectedPrompt={null}
                                        selectedInputId={selectedInputId}
                                        onInputIdChange={setSelectedInputId}
                                        className="w-full h-full shadow-2xl shadow-brand-100/50"
                                    />
                                </div>
                            </div>
                    </div>
                )}

                {view === 'legacy' && (
                    <div className="w-full h-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <LegacyView 
                            entries={entries} 
                            onSaveEntry={handleLegacyEntrySave}
                            voiceSettings={voiceSettings}
                            selectedInputId={selectedInputId}
                            selectedOutputId={selectedOutputId}
                        />
                    </div>
                )}

                {view === 'insights' && (
                    <div className="w-full h-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <DashboardView 
                            entries={entries}
                            onBack={() => setView('home')}
                        />
                    </div>
                )}

                {view === 'journal' && (
                    <div className="w-full h-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <JournalView 
                            entries={entries}
                            onEntryDeleted={deleteEntryState}
                            onEntryUpdated={updateEntryState}
                            autoExpandId={autoExpandId}
                            onBack={() => setView('home')}
                            isFocusMode={false} // Force sidebar on in journal
                            onToggleFocus={() => {}}
                        />
                    </div>
                )}

                {view === 'mentor' && (
                    <div className="w-full h-full p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <MentorChat 
                            onClose={() => setView('home')} 
                            entries={entries} 
                            voiceSettings={voiceSettings}
                            selectedInputId={selectedInputId}
                            selectedOutputId={selectedOutputId}
                            setSelectedOutputId={setSelectedOutputId}
                            onSaveToJournal={(text) => handleTextComplete(text, undefined, undefined)}
                        />
                    </div>
                )}
              </Suspense>
          </div>
      </main>

      <MobileFooter view={view} setView={setView} onOpenSettings={() => setIsSettingsOpen(true)} />
      
      {/* GLOBAL MODALS - Lazy Loaded */}
      <Suspense fallback={null}>
        {isSettingsOpen && (
            <SettingsModal 
                selectedInputId={selectedInputId}
                setSelectedInputId={setSelectedInputId}
                selectedOutputId={selectedOutputId}
                setSelectedOutputId={setSelectedOutputId}
                onClose={() => setIsSettingsOpen(false)}
                passcode={passcodeValidator ? 'ENABLED' : null}
                onUpdatePasscode={updatePasscodeConfig}
                entries={entries}
                voiceSettings={voiceSettings}
                onUpdateVoiceSettings={updateVoiceSettings}
                totalRecordingSeconds={totalRecordingSeconds}
            />
        )}
      </Suspense>

      <ChapterModal 
            isOpen={isChapterModalOpen}
            onClose={() => setIsChapterModalOpen(false)}
            entries={entries}
      />
    </div>
  );
}

export default App;
