
import React, { useEffect, useState } from 'react';
import { Prompt, JournalEntry } from '../types';
import { Feather, Sparkles, BookOpenCheck, Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { getBiographerAnalysis } from '../services/geminiService';

interface BiographerProps {
  entries: JournalEntry[];
  selectedPrompt: Prompt | null;
  onSelectPrompt: (prompt: Prompt | null) => void;
  variant?: 'card' | 'sidebar';
  showHeader?: boolean;
}

const STATIC_PROMPTS: Prompt[] = [
    { id: '1', text: "What is your biggest ambition right now?", category: 'intention' },
    { id: '2', text: "What is a challenge you are facing today?", category: 'challenge' },
    { id: '3', text: "What lesson did you learn recently?", category: 'reflection' },
    { id: '4', text: "What is one thing you are grateful for?", category: 'gratitude' },
    { id: '5', text: "What would you tell your younger self today?", category: 'reflection' },
];

const Biographer: React.FC<BiographerProps> = ({ 
    entries, 
    selectedPrompt, 
    onSelectPrompt,
    variant = 'card',
    showHeader = true
}) => {
  const [prompts, setPrompts] = useState<Prompt[]>(STATIC_PROMPTS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadPrompts = async () => {
        if (entries.length >= 2) {
            setIsLoading(true);
            try {
                const bioPrompt = await getBiographerAnalysis(entries);
                setPrompts([bioPrompt, ...STATIC_PROMPTS]);
            } catch (e) {
                console.error("Biographer error", e);
                setPrompts(STATIC_PROMPTS);
            } finally {
                setIsLoading(false);
            }
        } else {
            setPrompts(STATIC_PROMPTS);
        }
    };
    loadPrompts();
  }, [entries.length]);

  const activePrompt = prompts[activeIndex] || STATIC_PROMPTS[0];

  // Auto-select the active prompt when switching to this component if none is selected
  useEffect(() => {
      if (!selectedPrompt && activePrompt) {
          onSelectPrompt(activePrompt);
      }
  }, [activePrompt, selectedPrompt, onSelectPrompt]);

  const handleNext = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const nextIndex = (activeIndex + 1) % prompts.length;
      setActiveIndex(nextIndex);
      onSelectPrompt(prompts[nextIndex]);
  };

  const handlePrev = (e?: React.MouseEvent) => {
      e?.stopPropagation();
      const prevIndex = (activeIndex - 1 + prompts.length) % prompts.length;
      setActiveIndex(prevIndex);
      onSelectPrompt(prompts[prevIndex]);
  };

  const getCategoryColor = (category: string) => {
      switch(category) {
          // Intention: Clay/Earthy Red
          case 'intention': return 'bg-rose-100 text-rose-800 border-rose-200';
          // Challenge: Burnt Sienna
          case 'challenge': return 'bg-orange-100 text-orange-800 border-orange-200';
          // Reflection: Slate Blue
          case 'reflection': return 'bg-slate-100 text-slate-700 border-slate-200';
          // Gratitude: Sage Green
          case 'gratitude': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          // Insight: Muted Teal
          case 'insight': return 'bg-teal-100 text-teal-800 border-teal-200';
          // Biography: Muted Brand/Blue
          case 'biography': return 'bg-brand-100 text-brand-700 border-brand-200';
          default: return 'bg-stone-50 text-stone-500 border-stone-200';
      }
  };

  // --- Sidebar List Variant (Keeping for legacy/chart modes if needed) ---
  if (variant === 'sidebar') {
      return (
          <div className="w-full space-y-4">
              {showHeader && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-brand-400 uppercase tracking-widest flex items-center gap-2">
                        <Feather className="w-3 h-3" />
                        Biographer
                    </span>
                    {isLoading && <Loader2 className="w-3 h-3 animate-spin text-brand-300" />}
                </div>
              )}

              <div className="space-y-3">
                  {prompts.map((prompt) => {
                      const isSelected = selectedPrompt?.id === prompt.id;
                      const isBio = prompt.gapIdentified;
                      
                      return (
                        <button 
                            key={prompt.id}
                            onClick={() => onSelectPrompt(isSelected ? null : prompt)}
                            className={`
                                w-full text-left p-4 rounded-xl border-2 transition-all duration-300 group relative overflow-hidden shadow-sm
                                ${isSelected 
                                    ? 'bg-brand-50 border-brand-500 scale-[1.02]' 
                                    : isBio 
                                        ? 'bg-white border-brand-200 hover:border-brand-400' 
                                        : 'bg-white border-brand-100 hover:border-brand-300 hover:bg-brand-50/50'}
                            `}
                        >
                            {isBio && (
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wide border border-slate-200">
                                        <BookOpenCheck className="w-3 h-3 mr-1" />
                                        {prompt.gapIdentified || "Deep Dive"}
                                    </span>
                                </div>
                            )}
                            
                            <p className={`font-serif text-sm leading-relaxed ${isSelected ? 'text-brand-900 font-medium' : 'text-brand-700'}`}>
                                "{prompt.text}"
                            </p>
                            
                            {!isBio && (
                                <span className={`mt-2 inline-block text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getCategoryColor(prompt.category)}`}>
                                    {prompt.category}
                                </span>
                            )}
                            
                            {isSelected && (
                                <div className="absolute top-2 right-2 text-brand-500">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                            )}
                        </button>
                      );
                  })}
              </div>
          </div>
      );
  }

  // --- Home Card Variant (Carousel) ---
  return (
    <div className="w-full mx-auto h-full flex flex-col justify-center">
      {showHeader && (
        <div className="flex items-center justify-center mb-6">
            <span className="text-xs font-semibold text-brand-400 uppercase tracking-widest flex items-center gap-2">
            <Feather className="w-3 h-3" />
            Biographer
            </span>
        </div>
      )}

      <div className="relative group perspective-1000 flex-1 flex flex-col">
        <div 
          className={`
            relative flex-1 rounded-2xl shadow-lg border-2 bg-white overflow-hidden transition-all duration-500 flex flex-col justify-center min-h-[300px]
            ${selectedPrompt?.id === activePrompt?.id ? 'border-brand-400 shadow-brand-100 ring-4 ring-brand-50' : 'border-brand-100 hover:border-brand-300'}
          `}
        >
           {/* Decorative Background - Muted Slate/Blue tones */}
           <div className="absolute top-0 right-0 -mr-8 -mt-8 w-40 h-40 bg-brand-50 rounded-full blur-3xl opacity-60"></div>
           <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-40 h-40 bg-slate-100 rounded-full blur-3xl opacity-60"></div>

           {isLoading && prompts.length === STATIC_PROMPTS.length ? (
               <div className="flex-1 flex flex-col items-center justify-center p-8 text-brand-400">
                   <Loader2 className="w-8 h-8 animate-spin mb-3" />
                   <span className="text-xs font-bold uppercase tracking-widest">Reading your journal...</span>
               </div>
           ) : (
               <div className="relative z-10 px-16 md:px-24 py-12 flex flex-col items-center justify-center text-center h-full">
                    {activePrompt.gapIdentified ? (
                        <div className="mb-6 inline-flex items-center px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                             <Sparkles className="w-3 h-3 mr-1.5 text-slate-500" />
                             Gap Detected: {activePrompt.gapIdentified}
                        </div>
                    ) : (
                         <div className={`mb-6 inline-flex items-center px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${getCategoryColor(activePrompt.category)}`}>
                             {activePrompt.category}
                        </div>
                    )}
                    
                    <p className="font-serif text-xl md:text-2xl lg:text-3xl text-brand-800 leading-tight">
                        "{activePrompt.text}"
                    </p>
               </div>
           )}
        </div>
        
        {/* Navigation Controls - Overlay on desktop */}
        <button 
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 p-3 rounded-full shadow-md border border-brand-100 text-brand-400 hover:text-brand-600 hover:scale-110 transition-all z-20 backdrop-blur-sm"
        >
            <ChevronLeft className="w-6 h-6" />
        </button>

        <button 
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 p-3 rounded-full shadow-md border border-brand-100 text-brand-400 hover:text-brand-600 hover:scale-110 transition-all z-20 backdrop-blur-sm"
        >
            <ChevronRight className="w-6 h-6" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20">
            {prompts.map((_, idx) => (
                <div 
                    key={idx} 
                    onClick={() => { setActiveIndex(idx); onSelectPrompt(prompts[idx]); }}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${idx === activeIndex ? 'w-6 bg-brand-400' : 'w-1.5 bg-brand-200 hover:bg-brand-300'}`}
                />
            ))}
        </div>

      </div>
    </div>
  );
};

export default Biographer;
