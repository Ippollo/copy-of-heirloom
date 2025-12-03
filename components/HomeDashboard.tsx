
import React, { useState, useEffect, useMemo } from 'react';
import { JournalEntry } from '../types';
import { ArrowRight, Quote, Calendar, Feather, Sparkles, BookOpen, Mic, Clock, History } from 'lucide-react';
import Recorder from './Recorder';

interface HomeDashboardProps {
  entries: JournalEntry[];
  authorName: string;
  onNavigateToBiographer: () => void;
  onNavigateToJournal: () => void;
  onRecordingComplete: (audioBlob: Blob, duration: number, imageBlob?: Blob, location?: any) => void;
  onTextComplete: (text: string, imageBlob?: Blob, location?: any) => void;
  recorderProps: any; // Pass through recorder props
}

const QUOTES = [
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Life can only be understood backwards; but it must be lived forwards.", author: "Søren Kierkegaard" },
    { text: "What you leave behind is not what is engraved in stone monuments, but what is woven into the lives of others.", author: "Pericles" },
    { text: "The unexamined life is not worth living.", author: "Socrates" },
    { text: "Your story is what you have, what you will always have. It is something to own.", author: "Michelle Obama" },
    { text: "Telling our stories is how we let go of the past and embrace the future.", author: "Unknown" },
];

const HomeDashboard: React.FC<HomeDashboardProps> = ({ 
    entries, 
    authorName, 
    onNavigateToBiographer,
    onNavigateToJournal,
    onRecordingComplete,
    onTextComplete,
    recorderProps
}) => {
  const [quote, setQuote] = useState(QUOTES[0]);

  useEffect(() => {
      setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);

  // --- Logic for Dynamic Cards ---

  // 1. Flashback Logic: Find entry from this day in previous years
  const flashbackEntry = useMemo(() => {
      const today = new Date();
      return entries.find(e => {
          const d = new Date(e.createdAt);
          return d.getDate() === today.getDate() && 
                 d.getMonth() === today.getMonth() && 
                 d.getFullYear() !== today.getFullYear();
      });
  }, [entries]);

  // 2. Chapter Logic: Estimate current "Life Chapter" based on entry count
  const chapterInfo = useMemo(() => {
      const count = entries.length;
      const chapterNum = Math.floor(count / 10) + 1;
      let title = "The Beginning";
      if (count >= 10) title = "Growing Roots";
      if (count >= 30) title = "Coming of Age";
      if (count >= 60) title = "Building a Life";
      if (count >= 100) title = "The Legacy";
      
      return { num: chapterNum, title };
  }, [entries.length]);

  const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 5) return "Good Night";
      if (hour < 12) return "Good Morning";
      if (hour < 18) return "Good Afternoon";
      return "Good Evening";
  };

  return (
    <div className="h-full w-full flex flex-col p-4 md:p-6 lg:p-8 overflow-y-auto lg:overflow-hidden scrollbar-hide">
        <div className="max-w-6xl mx-auto w-full h-full flex flex-col gap-6 lg:gap-8 pb-20 lg:pb-0">
            
            {/* GREETING HEADER */}
            <div className="flex-shrink-0 animate-in fade-in slide-in-from-top-4 duration-700">
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-serif font-bold text-brand-900 tracking-tight">
                    {getGreeting()}, {authorName ? authorName.split(' ')[0] : 'Friend'}.
                </h1>
                <p className="text-brand-400 font-medium mt-2 text-sm uppercase tracking-widest">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 min-h-0 flex flex-col gap-6 lg:gap-8">
                
                {/* HERO: AUDIO STUDIO RECORDER (Flex Grow) */}
                <div className="flex-1 min-h-[350px] shadow-2xl shadow-brand-900/20 rounded-3xl overflow-hidden relative animate-in fade-in zoom-in duration-500">
                    <Recorder 
                        {...recorderProps}
                        onRecordingComplete={onRecordingComplete}
                        onTextComplete={onTextComplete}
                        className="h-full w-full border-none rounded-none"
                        variant="dark"
                    />
                </div>

                {/* BOTTOM GRID (Flex Shrink/Fixed on Desktop, Stacked on Mobile) */}
                <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 gap-6 h-auto lg:h-[240px] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    
                    {/* 1. Biographer Card */}
                    <div 
                        onClick={onNavigateToBiographer}
                        className="bg-white rounded-3xl p-6 lg:p-8 border border-brand-100 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group flex flex-col justify-between min-h-[200px] relative overflow-hidden"
                    >
                        {/* Decorative bg */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                                    <Feather className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold uppercase tracking-widest text-brand-400">Current Chapter</span>
                            </div>
                            
                            <h3 className="text-xl lg:text-2xl font-serif font-bold text-brand-900 mb-1">
                                Chapter {chapterInfo.num}: {chapterInfo.title}
                            </h3>
                            <p className="text-brand-500 text-sm leading-relaxed mt-2 line-clamp-2 lg:line-clamp-none">
                                The story continues. Answer a question to flesh out this period of your life.
                            </p>
                        </div>

                        <div className="mt-4 flex items-center text-xs font-bold text-brand-400 uppercase tracking-wide group-hover:text-brand-600 transition-colors">
                            Continue Writing <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                    </div>

                    {/* 2. Flashback / Inspiration Card */}
                    <div className="bg-[#fdfbf9] rounded-3xl p-6 lg:p-8 border border-brand-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-h-[200px] relative overflow-hidden group">
                        
                        {flashbackEntry ? (
                            /* FLASHBACK STATE */
                            <div onClick={onNavigateToJournal} className="cursor-pointer h-full flex flex-col justify-between relative z-10">
                                <div className="absolute top-0 right-0 -mr-6 -mt-6">
                                    <History className="w-24 h-24 text-brand-100 opacity-50 rotate-12" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                                            <Calendar className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-orange-400">On this day</span>
                                    </div>
                                    
                                    <h3 className="text-xl font-serif font-bold text-brand-900 mb-2 line-clamp-1">
                                        {flashbackEntry.title}
                                    </h3>
                                    <p className="text-brand-500 text-sm italic line-clamp-2">
                                        "{flashbackEntry.summary || flashbackEntry.transcription}"
                                    </p>
                                    <p className="text-xs font-bold text-brand-300 mt-2">
                                        {new Date(flashbackEntry.createdAt).getFullYear()}
                                    </p>
                                </div>

                                <div className="mt-4 flex items-center text-xs font-bold text-brand-400 uppercase tracking-wide group-hover:text-brand-600 transition-colors">
                                    Listen Back <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        ) : (
                            /* QUOTE STATE (Fallback) */
                            <div className="h-full flex flex-col justify-between relative z-10">
                                <div className="absolute -bottom-4 -right-4">
                                    <Quote className="w-32 h-32 text-brand-100 opacity-30 rotate-12" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">Daily Inspiration</span>
                                    </div>
                                    
                                    <blockquote className="font-serif text-lg text-brand-800 italic leading-relaxed line-clamp-3 lg:line-clamp-4">
                                        "{quote.text}"
                                    </blockquote>
                                </div>

                                <cite className="text-xs font-bold text-brand-400 uppercase tracking-widest not-italic mt-4 block">
                                    — {quote.author}
                                </cite>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default HomeDashboard;
