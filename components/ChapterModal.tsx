
import React, { useState } from 'react';
import { X, Book, Calendar, Loader2 } from 'lucide-react';
import { Chapter, JournalEntry } from '../types';
import { generateChapter } from '../services/geminiService';

interface ChapterModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
}

const ChapterModal: React.FC<ChapterModalProps> = ({ isOpen, onClose, entries }) => {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'year'>('month');

  const handleGenerate = async () => {
    if (entries.length < 3) {
        alert("You need at least 3 entries to generate a chapter.");
        return;
    }
    setIsGenerating(true);
    try {
        const date = new Date();
        const periodName = selectedPeriod === 'month' ? date.toLocaleString('default', { month: 'long', year: 'numeric' }) : date.getFullYear().toString();
        const result = await generateChapter(entries.slice(0, 30), periodName);
        setChapter(result);
    } catch (err) { alert("Failed to write chapter."); } finally { setIsGenerating(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-brand-900/50 backdrop-blur-md">
      <div className="bg-paper-50 rounded-3xl shadow-2xl max-w-2xl w-full h-[85vh] flex flex-col border border-paper-300 overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-paper-200 p-6 border-b border-paper-300 flex justify-between items-center">
            <div className="flex items-center gap-3"><div className="p-2 bg-brand-800 text-white rounded-lg shadow-sm"><Book className="w-5 h-5" /></div><h2 className="text-xl font-serif font-bold text-brand-900">Life Chapters</h2></div>
            <button onClick={onClose} className="p-2 text-brand-400 hover:text-brand-800 rounded-full hover:bg-black/5 transition-colors"><X className="w-6 h-6" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 sm:p-12 custom-scrollbar">
            {!chapter ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <Book className="w-24 h-24 text-brand-200" />
                    <div className="max-w-md">
                        <h3 className="text-xl font-serif font-bold text-brand-800 mb-2">Write your story</h3>
                        <p className="text-brand-500 mb-8">Analyze your journal entries to write a cohesive biography chapter, finding themes you might have missed.</p>
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <button onClick={() => setSelectedPeriod('month')} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${selectedPeriod === 'month' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-600 border-paper-300'}`}>This Month</button>
                            <button onClick={() => setSelectedPeriod('year')} className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${selectedPeriod === 'year' ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-600 border-paper-300'}`}>This Year</button>
                        </div>
                        <button onClick={handleGenerate} disabled={isGenerating} className="w-full py-3 bg-brand-800 text-white rounded-xl hover:bg-brand-900 transition-all shadow-lg disabled:opacity-70 flex items-center justify-center gap-2 font-medium">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}{isGenerating ? "Writing Chapter..." : "Synthesize Chapter"}</button>
                    </div>
                </div>
            ) : (
                <article className="prose prose-stone prose-lg mx-auto">
                    <span className="block text-center text-xs font-bold uppercase tracking-[0.2em] text-brand-400 mb-4">Chapter: {chapter.period}</span>
                    <h1 className="text-3xl sm:text-4xl font-serif font-bold text-center text-brand-900 mb-8 !leading-tight">{chapter.title}</h1>
                    <div className="text-justify font-serif text-brand-800 leading-loose whitespace-pre-wrap">{chapter.content}</div>
                    <div className="mt-12 pt-8 border-t border-paper-300 text-center"><button onClick={() => setChapter(null)} className="text-brand-500 hover:text-brand-800 text-sm underline">Write another chapter</button></div>
                </article>
            )}
        </div>
      </div>
    </div>
  );
};

export default ChapterModal;
