
import React, { useState, useEffect } from 'react';
import { JournalEntry, LocationData } from '../types';
import { generateAncestralScenario, generateAncestralAdvice } from '../services/geminiService';
import { Users, Loader2, Edit2, CheckCircle2, Mic, RefreshCw, Save, ArrowRight } from 'lucide-react';
import Recorder from './Recorder';
import { v4 as uuidv4 } from 'uuid';

interface AncestorTrainerProps {
  entries: JournalEntry[];
  onSaveEntry: (entry: JournalEntry) => void;
}

const AncestorTrainer: React.FC<AncestorTrainerProps> = ({ entries, onSaveEntry }) => {
  const [step, setStep] = useState<'loading' | 'review' | 'editing' | 'recording' | 'success'>('loading');
  const [scenario, setScenario] = useState<{ topic: string, text: string } | null>(null);
  const [proposedAdvice, setProposedAdvice] = useState('');
  const [userEdit, setUserEdit] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Recorder state for "Retake" option
  const [recorderState, setRecorderState] = useState<any>(0); // 0=Idle
  const [selectedInputId, setSelectedInputId] = useState('default');

  useEffect(() => {
    loadNewScenario();
  }, []);

  const loadNewScenario = async () => {
    setStep('loading');
    try {
        const result = await generateAncestralScenario(entries);
        setScenario({ topic: result.topic, text: result.scenario });
        
        // Immediately generate advice for this scenario
        const advice = await generateAncestralAdvice(result.scenario, entries);
        setProposedAdvice(advice);
        setUserEdit(advice);
        setStep('review');
    } catch (e) {
        console.error(e);
        // Fallback
        setScenario({ topic: "General Wisdom", text: "Your great-grandson feels lost in his career and asks if he should choose money or passion." });
        setStep('review');
    }
  };

  const handleApprove = async () => {
      await saveTrainingEntry(userEdit, 'text');
  };

  const handleSaveEdit = async () => {
      await saveTrainingEntry(userEdit, 'text');
  };

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
      // Create a temporary entry from the recording
      // For this specific flow, we are treating the recording as the "Answer"
      // We need to transcribe it first ideally, but for now we can save the audio as the entry
      // and let the main app logic handle transcription in background if we wanted full consistency.
      // However, to keep this component self-contained, we will rely on the main App's processing or 
      // just save it as an audio entry with the prompt being the scenario.
      
      const newEntry: JournalEntry = {
          id: uuidv4(),
          createdAt: Date.now(),
          duration: duration,
          transcription: "Audio Advice (Processing...)", // Placeholder until processed
          title: `Advice on ${scenario?.topic}`,
          mood: "Wise",
          tags: ["Legacy Training", "Advice", "Ancestor Mode"],
          insights: [],
          isProcessing: true,
          prompt: `Scenario: ${scenario?.text}`,
          audioBlob: audioBlob,
          inputType: 'audio'
      };
      
      // Pass to parent to handle the actual saving/processing pipeline which does transcription
      onSaveEntry(newEntry);
      setStep('success');
  };

  const saveTrainingEntry = async (content: string, type: 'text' | 'audio') => {
      const newEntry: JournalEntry = {
          id: uuidv4(),
          createdAt: Date.now(),
          transcription: content,
          title: `Advice on ${scenario?.topic}`,
          mood: "Wise",
          tags: ["Legacy Training", "Advice", "Ancestor Mode"],
          insights: [],
          summary: `You advised your descendant on ${scenario?.topic}.`,
          isProcessing: false,
          prompt: `Scenario: ${scenario?.text}`,
          inputType: type
      };
      onSaveEntry(newEntry);
      setStep('success');
  };

  if (step === 'loading') {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4 animate-in fade-in">
              <div className="relative">
                  <div className="absolute inset-0 bg-brand-200 rounded-full blur-xl animate-pulse"></div>
                  <Users className="w-16 h-16 text-brand-600 relative z-10" />
              </div>
              <h3 className="text-xl font-serif font-bold text-brand-900">Simulating Future...</h3>
              <p className="text-brand-500 max-w-md">
                  Constructing a hypothetical scenario for your descendants based on your life's journey.
              </p>
              <Loader2 className="w-8 h-8 text-brand-400 animate-spin mt-4" />
          </div>
      );
  }

  if (step === 'success') {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 animate-in zoom-in duration-300">
              <div className="p-4 bg-green-100 rounded-full text-green-600 mb-2">
                  <CheckCircle2 className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-serif font-bold text-brand-900">Wisdom Captured</h3>
              <p className="text-brand-600 max-w-md">
                  Your advice has been saved. The "Digital You" is now better equipped to guide your family.
              </p>
              <button 
                  onClick={loadNewScenario}
                  className="px-8 py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-all font-bold shadow-lg flex items-center gap-2"
              >
                  <RefreshCw className="w-4 h-4" /> Train Another Scenario
              </button>
          </div>
      );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4 md:p-8 overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-brand-100 text-brand-700 rounded-xl shadow-sm">
                <Users className="w-6 h-6" />
            </div>
            <div>
                <h2 className="text-2xl font-serif font-bold text-brand-900">Ancestor Training</h2>
                <p className="text-xs text-brand-500 font-medium uppercase tracking-wide">Refine your legacy simulation</p>
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6">
            
            {/* Scenario Card */}
            <div className="bg-white border border-brand-200 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-400"></div>
                <div className="mb-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-brand-50 text-brand-600 px-2 py-1 rounded border border-brand-100 uppercase tracking-wider">
                        Hypothetical Scenario
                    </span>
                    <span className="text-xs font-bold text-brand-800">{scenario?.topic}</span>
                </div>
                <p className="text-lg md:text-xl font-serif text-brand-900 leading-relaxed">
                    "{scenario?.text}"
                </p>
            </div>

            {/* Editing / Advice Area */}
            <div className="flex-1 bg-brand-50/50 rounded-2xl border border-brand-100 p-6 flex flex-col relative">
                
                <div className="absolute -top-3 left-6 px-3 py-1 bg-white border border-brand-200 text-xs font-bold text-brand-500 rounded-full shadow-sm">
                    Proposed Advice (Based on your journal)
                </div>

                {step === 'recording' ? (
                    <div className="flex-1 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-brand-800">Record Your Answer</h3>
                            <button onClick={() => setStep('review')} className="text-xs text-brand-500 underline hover:text-brand-800">Cancel Recording</button>
                        </div>
                        <div className="flex-1 relative min-h-[300px]">
                            <Recorder 
                                onRecordingComplete={(blob, dur) => handleRecordingComplete(blob, dur)}
                                onTextComplete={(text) => { setUserEdit(text); handleSaveEdit(); }}
                                recorderState={recorderState}
                                setRecorderState={setRecorderState}
                                selectedPrompt={null}
                                selectedInputId={selectedInputId}
                                onInputIdChange={setSelectedInputId}
                                className="h-full shadow-none border-brand-200"
                            />
                        </div>
                    </div>
                ) : (
                    <>
                        <textarea 
                            value={userEdit}
                            onChange={(e) => { setUserEdit(e.target.value); setStep('editing'); }}
                            className="flex-1 w-full bg-transparent border-none resize-none focus:ring-0 text-brand-800 font-serif text-lg leading-relaxed p-0 placeholder-brand-300"
                            placeholder="Type your advice here..."
                        />
                        
                        <div className="mt-6 pt-6 border-t border-brand-100 flex flex-wrap gap-4 justify-between items-center">
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setStep('recording')}
                                    className="flex items-center px-4 py-2 bg-white border border-brand-200 text-brand-600 rounded-lg hover:bg-brand-50 hover:border-brand-300 transition-all text-sm font-bold shadow-sm group"
                                >
                                    <Mic className="w-4 h-4 mr-2 group-hover:text-brand-800" />
                                    Record New Answer
                                </button>
                                <button 
                                    onClick={loadNewScenario}
                                    className="px-4 py-2 text-brand-400 hover:text-brand-600 text-sm font-medium transition-colors"
                                >
                                    Skip
                                </button>
                            </div>

                            <button 
                                onClick={step === 'review' ? handleApprove : handleSaveEdit}
                                className={`
                                    flex items-center px-6 py-3 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all active:scale-95
                                    ${step === 'review' ? 'bg-brand-600 hover:bg-brand-700' : 'bg-green-600 hover:bg-green-700'}
                                `}
                            >
                                {step === 'review' ? (
                                    <> <CheckCircle2 className="w-5 h-5 mr-2" /> Approve Advice </>
                                ) : (
                                    <> <Save className="w-5 h-5 mr-2" /> Save Changes </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>

        </div>
    </div>
  );
};

export default AncestorTrainer;
