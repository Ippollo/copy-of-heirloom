
import React, { useEffect, useMemo, useState } from 'react';
import { Prompt, JournalEntry } from '../types';
import { Sparkles, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { generateContextualPrompts } from '../services/geminiService';

interface PromptSelectorProps {
  entries: JournalEntry[];
  selectedPrompt: Prompt | null;
  onSelectPrompt: (prompt: Prompt | null) => void;
  variant?: 'carousel' | 'list';
}

const STATIC_PROMPTS: Prompt[] = [
  { id: '1', text: "What is your biggest ambition right now?", category: 'intention' },
  { id: '2', text: "What is a challenge you are facing today?", category: 'challenge' },
  { id: '3', text: "What lesson did you learn recently?", category: 'reflection' },
  { id: '4', text: "What is one thing you are grateful for?", category: 'gratitude' },
  { id: '5', text: "How do you want to feel by the end of the day?", category: 'intention' },
  { id: '6', text: "What would you tell your younger self today?", category: 'reflection' },
];

const PromptSelector: React.FC<PromptSelectorProps> = ({ 
    entries, 
    selectedPrompt, 
    onSelectPrompt,
    variant = 'carousel' 
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [aiPrompts, setAiPrompts] = useState<Prompt[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Generate prompts once enough context is available
  useEffect(() => {
    const fetchContextualPrompts = async () => {
        if (entries.length < 3) return; 
        if (aiPrompts.length > 0) return; 
        
        setIsLoadingAi(true);
        try {
            const newPrompts = await generateContextualPrompts(entries);
            setAiPrompts(newPrompts);
        } catch(e) { 
            console.error(e); 
        } finally { 
            setIsLoadingAi(false); 
        }
    };
    
    fetchContextualPrompts();
  }, [entries.length]); 

  // Combine Static and AI prompts
  const allPrompts = useMemo(() => {
    if (aiPrompts.length === 0) return STATIC_PROMPTS;
    const combined = [...STATIC_PROMPTS];
    if (aiPrompts[0]) combined.unshift(aiPrompts[0]);
    if (aiPrompts[1]) combined.splice(3, 0, aiPrompts[1]);
    if (aiPrompts[2]) combined.splice(6, 0, aiPrompts[2]);
    return combined;
  }, [aiPrompts]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % allPrompts.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + allPrompts.length) % allPrompts.length);
  };

  const getCategoryColor = (category: string) => {
      switch(category) {
          // Intention: Clay/Earthy Red (Unique)
          case 'intention': return 'bg-rose-100 text-rose-800 border-rose-200';
          // Challenge: Burnt Sienna (Orange/Brown)
          case 'challenge': return 'bg-orange-100 text-orange-800 border-orange-200';
          // Reflection: Slate Blue (Muted Blue)
          case 'reflection': return 'bg-slate-100 text-slate-700 border-slate-200';
          // Gratitude: Sage Green (Nature)
          case 'gratitude': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
          // Insight: Muted Teal
          case 'insight': return 'bg-teal-100 text-teal-800 border-teal-200';
          default: return 'bg-gray-100 text-gray-700 border-gray-200';
      }
  };

  // --- LIST VARIANT (Desktop Sidebar) ---
  if (variant === 'list') {
      return (
          <div className="w-full space-y-3">
              <div className="flex items-center justify-between mb-4">
                 <span className="text-xs font-semibold text-brand-400 uppercase tracking-widest flex items-center gap-1">
                    {isLoadingAi ? <Sparkles className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    {isLoadingAi ? "Curating..." : "Daily Prompts"}
                </span>
                {selectedPrompt && (
                    <button onClick={() => onSelectPrompt(null)} className="text-[10px] text-gray-400 hover:text-red-500 uppercase font-bold">
                        Clear
                    </button>
                )}
              </div>

              {allPrompts.map((prompt) => {
                  const isSelected = selectedPrompt?.id === prompt.id;
                  return (
                    <button 
                        key={prompt.id}
                        onClick={() => onSelectPrompt(isSelected ? null : prompt)}
                        className={`
                            w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group relative overflow-hidden
                            ${isSelected 
                                ? 'bg-brand-50 border-brand-500 shadow-md scale-[1.02]' 
                                : 'bg-white border-brand-100 hover:border-brand-300 hover:bg-brand-50/50'}
                        `}
                    >
                        {prompt.isGenerated && (
                            <div className="absolute top-0 right-0 p-1.5 bg-slate-100 rounded-bl-lg">
                                <Sparkles className="w-3 h-3 text-slate-600" />
                            </div>
                        )}
                        <p className={`font-serif text-sm font-medium leading-relaxed ${isSelected ? 'text-brand-900' : 'text-brand-700'}`}>
                            {prompt.text}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border ${getCategoryColor(prompt.category)}`}>
                                {prompt.category}
                            </span>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-500" />}
                        </div>
                    </button>
                  );
              })}
          </div>
      );
  }

  // --- CAROUSEL VARIANT (Mobile/Default) ---
  const currentPrompt = allPrompts[currentIndex] || allPrompts[0];

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <div className="flex items-center justify-between mb-2 px-2">
        <span className="text-xs font-semibold text-brand-400 uppercase tracking-widest flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {isLoadingAi ? "Finding Inspiration..." : "Daily Prompts"}
        </span>
      </div>

      <div className="relative group">
        <div 
          onClick={() => onSelectPrompt(currentPrompt)}
          className={`
            relative rounded-xl shadow-sm border-2 bg-white overflow-hidden transition-all duration-300 cursor-pointer
            ${selectedPrompt?.id === currentPrompt.id ? 'border-brand-500 ring-2 ring-brand-100' : 'border-brand-100 hover:border-brand-300'}
          `}
        >
          {/* Generated Banner */}
          {currentPrompt.isGenerated && (
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-300 via-slate-300 to-brand-300" />
          )}

          <div className="p-6 text-center min-h-[120px] flex flex-col items-center justify-center relative">
            
            {/* AI Badge */}
            {currentPrompt.isGenerated && (
                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider opacity-70">
                    <Sparkles className="w-3 h-3" /> For You
                </div>
            )}

            <p className="font-serif text-lg md:text-xl text-brand-700">
              "{currentPrompt.text}"
            </p>
            <div className={`mt-3 text-xs px-2 py-1 rounded-full uppercase tracking-wide font-semibold transition-colors border
                ${getCategoryColor(currentPrompt.category)}
            `}>
                {currentPrompt.category}
            </div>
          </div>
        </div>

        {/* Navigation Buttons */}
        <button 
          onClick={(e) => { e.stopPropagation(); handlePrev(); }}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white p-2 rounded-full shadow-md text-brand-400 hover:text-brand-600 border border-brand-100 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <button 
          onClick={(e) => { e.stopPropagation(); handleNext(); }}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white p-2 rounded-full shadow-md text-brand-400 hover:text-brand-600 border border-brand-100 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Pagination Dots */}
      <div className="flex justify-center gap-2 mt-4">
          {allPrompts.map((_, idx) => (
            <button 
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-brand-400 w-6' : 'bg-brand-200 w-1.5 hover:bg-brand-300'}`}
              aria-label={`Go to prompt ${idx + 1}`}
            />
          ))}
      </div>
    </div>
  );
};

export default PromptSelector;
