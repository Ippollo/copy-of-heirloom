import React, { useState, useEffect, useMemo } from 'react';
import { Search, BookOpen, Image as ImageIcon, Calendar, Filter, Sparkles, X, ChevronDown, Play, Pause, MapPin, Hash, Quote, Book } from 'lucide-react';
import { JournalEntry } from '../types';
import EntryList from './EntryList';
import ChapterModal from './ChapterModal';
import { getEntryImage, getEntryAudio } from '../services/dbService';

interface JournalViewProps {
  entries: JournalEntry[];
  onEntryDeleted: (id: string) => void;
  onEntryUpdated?: (entry: JournalEntry) => void;
  autoExpandId?: string | null;
  onBack: () => void;
  isFocusMode: boolean;
  onToggleFocus: () => void;
}

type ViewMode = 'chronicle' | 'gallery' | 'anthology';

const JournalView: React.FC<JournalViewProps> = ({ 
    entries, 
    onEntryDeleted, 
    onEntryUpdated, 
    autoExpandId,
    onBack,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('chronicle');
  const [searchQuery, setSearchQuery] = useState('');
  const [isChapterModalOpen, setIsChapterModalOpen] = useState(false);
  const [heroEntry, setHeroEntry] = useState<JournalEntry | null>(null);

  // --- Hero Logic: Serendipity ---
  useEffect(() => {
    if (entries.length > 0 && !heroEntry) {
        // Filter out processing entries
        const validEntries = entries.filter(e => !e.isProcessing);
        
        if (validEntries.length > 0) {
            // Pick a random entry from the past (older than 24 hours) to rediscover
            const pastEntries = validEntries.filter(e => Date.now() - e.createdAt > 86400000);
            const pool = pastEntries.length > 0 ? pastEntries : validEntries;
            const random = pool[Math.floor(Math.random() * pool.length)];
            setHeroEntry(random);
        }
    }
  }, [entries]);

  // --- Filtering & grouping for Chronicle ---
  const groupedEntries = useMemo(() => {
    const filtered = entries.filter(e => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return e.title.toLowerCase().includes(q) || 
               e.transcription.toLowerCase().includes(q) || 
               e.tags.some(t => t.toLowerCase().includes(q)) || 
               (e.mood && e.mood.toLowerCase().includes(q));
    }).sort((a, b) => b.createdAt - a.createdAt);

    const groups: { [key: string]: JournalEntry[] } = {};
    filtered.forEach(entry => {
        const date = new Date(entry.createdAt);
        const key = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (!groups[key]) groups[key] = [];
        groups[key].push(entry);
    });
    return groups;
  }, [entries, searchQuery]);

  // --- Grouping for Anthology (Themes) ---
  const themes = useMemo(() => {
      const moodCounts: Record<string, JournalEntry[]> = {};
      entries.forEach(e => {
          const mood = e.mood || 'Reflective';
          if (!moodCounts[mood]) moodCounts[mood] = [];
          moodCounts[mood].push(e);
      });
      return Object.entries(moodCounts).sort((a, b) => b[1].length - a[1].length);
  }, [entries]);

  // --- Visual Assets for Gallery ---
  const [galleryItems, setGalleryItems] = useState<{ id: string, url: string, entry: JournalEntry }[]>([]);
  
  useEffect(() => {
      const loadImages = async () => {
          if (viewMode !== 'gallery') return;
          const items = [];
          for (const entry of entries) {
              let blob = entry.snapshotBlob || entry.generatedImageBlob;
              if (!blob) blob = await getEntryImage(entry.id, 'snapshot');
              if (!blob) blob = await getEntryImage(entry.id, 'art');
              
              if (blob) {
                  items.push({ id: entry.id, url: URL.createObjectURL(blob), entry });
              }
          }
          setGalleryItems(items);
      };
      loadImages();
      return () => galleryItems.forEach(i => URL.revokeObjectURL(i.url));
  }, [viewMode, entries]);


  return (
    <div className="flex flex-col h-full overflow-hidden">
        
        {/* --- Top Navigation Bar --- */}
        <div className="flex-shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative">
            
            {/* Left: Title */}
            <div className="flex items-center gap-3 z-10">
                <div className="p-2.5 bg-brand-600 rounded-xl shadow-md">
                    <Book className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h2 className="font-serif font-bold text-brand-900 text-2xl">Journal</h2>
                    <p className="text-brand-400 text-xs font-bold uppercase tracking-widest mt-1">
                        {entries.length} Memories Collected
                    </p>
                </div>
            </div>

            {/* Center: View Toggle Buttons (Absolute centered on desktop) */}
            <div className="flex justify-center w-full md:w-auto order-3 md:order-none md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-0 mt-2 md:mt-0">
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-brand-100 shadow-sm overflow-x-auto">
                    <button 
                        onClick={() => setViewMode('chronicle')} 
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${viewMode === 'chronicle' ? 'bg-brand-600 text-white shadow-md' : 'text-brand-400 hover:bg-brand-50'}`}
                    >
                        <Calendar className="w-3.5 h-3.5" /> Chronicle
                    </button>
                    <button 
                        onClick={() => setViewMode('gallery')} 
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${viewMode === 'gallery' ? 'bg-brand-600 text-white shadow-md' : 'text-brand-400 hover:bg-brand-50'}`}
                    >
                        <ImageIcon className="w-3.5 h-3.5" /> Gallery
                    </button>
                    <button 
                        onClick={() => setViewMode('anthology')} 
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-2 ${viewMode === 'anthology' ? 'bg-brand-600 text-white shadow-md' : 'text-brand-400 hover:bg-brand-50'}`}
                    >
                        <BookOpen className="w-3.5 h-3.5" /> Anthology
                    </button>
                </div>
            </div>
            
            {/* Right: Search */}
            <div className="flex gap-2 w-full md:w-auto justify-end z-10 order-2 md:order-none">
                <div className="relative group flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-300 group-focus-within:text-brand-500 transition-colors" />
                    <input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search memories..."
                        className="pl-10 pr-4 py-2 bg-white border border-brand-100 rounded-xl text-sm font-medium text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all w-full md:w-64 focus:md:w-80"
                    />
                </div>
                <button 
                    onClick={() => setIsChapterModalOpen(true)}
                    className="p-2 bg-brand-50 text-brand-600 rounded-xl border border-brand-100 hover:bg-brand-100 transition-colors flex-shrink-0"
                    title="Generate Chapter"
                >
                    <Sparkles className="w-5 h-5" />
                </button>
            </div>
        </div>

        {/* --- Main Content Area --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative pr-2">
            <div className="max-w-5xl mx-auto pb-24">

                {/* --- HERO: Serendipity (Only in Chronicle mode, when not searching) --- */}
                {viewMode === 'chronicle' && !searchQuery && heroEntry && (
                    <div className="py-4 animate-in fade-in slide-in-from-top-4 duration-700">
                         <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl shadow-brand-100/50 border border-brand-100 relative overflow-hidden group cursor-pointer hover:shadow-2xl transition-all duration-500">
                             <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                                 <Quote className="w-32 h-32 text-brand-500 rotate-12" />
                             </div>
                             <div className="relative z-10 max-w-2xl">
                                 <div className="flex items-center gap-2 mb-4">
                                     <span className="px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-brand-100">
                                        Rediscover
                                     </span>
                                     <span className="text-xs font-bold text-brand-300 uppercase tracking-widest">
                                        {new Date(heroEntry.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                     </span>
                                 </div>
                                 <h3 className="text-3xl md:text-4xl font-serif font-bold text-brand-900 mb-4 leading-tight group-hover:text-brand-700 transition-colors">
                                     {heroEntry.title}
                                 </h3>
                                 <p className="text-brand-600 text-lg font-serif italic leading-relaxed line-clamp-3 mb-6">
                                     "{heroEntry.summary || heroEntry.transcription}"
                                 </p>
                                 <div className="flex items-center gap-4">
                                     <button 
                                        onClick={() => document.getElementById(`entry-${heroEntry.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                        className="text-xs font-bold uppercase tracking-widest text-brand-400 group-hover:text-brand-800 transition-colors flex items-center gap-1"
                                     >
                                         Read Entry <ChevronDown className="w-3 h-3" />
                                     </button>
                                 </div>
                             </div>
                         </div>
                    </div>
                )}

                {/* --- MODE: CHRONICLE --- */}
                {viewMode === 'chronicle' && (
                    <div className="space-y-12">
                        {Object.entries(groupedEntries).map(([period, groupEntries]) => (
                            <div key={period} className="relative pl-8 md:pl-12 border-l-2 border-brand-100 ml-4 md:ml-0">
                                {/* Timeline Dot & Header */}
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-brand-200 border-4 border-[#fdf8f6]"></div>
                                <h3 className="text-xl font-serif font-bold text-brand-800 mb-6 pl-2 inline-block rounded-r-lg">
                                    {period}
                                </h3>
                                
                                <div className="space-y-6">
                                    <EntryList 
                                        entries={groupEntries}
                                        onEntryDeleted={onEntryDeleted}
                                        onEntryUpdated={onEntryUpdated}
                                        autoExpandId={autoExpandId}
                                    />
                                </div>
                            </div>
                        ))}
                        {Object.keys(groupedEntries).length === 0 && (
                            <div className="text-center py-20 opacity-50">
                                <Filter className="w-12 h-12 mx-auto mb-4 text-brand-300" />
                                <p className="font-serif text-brand-400">No memories found for this search.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- MODE: GALLERY --- */}
                {viewMode === 'gallery' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                            {galleryItems.map((item) => (
                                <div key={item.id} className="break-inside-avoid bg-white p-3 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 border border-brand-100 group relative">
                                    <div className="rounded-xl overflow-hidden relative">
                                        <img src={item.url} alt="Memory" className="w-full object-cover rounded-lg" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                            <button 
                                                onClick={() => {
                                                    setViewMode('chronicle');
                                                    setTimeout(() => document.getElementById(`entry-${item.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                                                }}
                                                className="p-3 bg-white text-brand-900 rounded-full hover:scale-110 transition-transform shadow-lg"
                                                title="View Entry"
                                            >
                                                <BookOpen className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-3 px-1">
                                        <p className="font-serif font-bold text-brand-900 text-sm line-clamp-1">{item.entry.title}</p>
                                        <p className="text-[10px] text-brand-400 uppercase tracking-wider font-bold mt-1">
                                            {new Date(item.entry.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {galleryItems.length === 0 && (
                            <div className="text-center py-20">
                                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-brand-200" />
                                <h3 className="font-serif text-xl text-brand-800 font-bold">Your Visual Archive</h3>
                                <p className="text-brand-400 mt-2">Generate art or upload photos to your entries to populate the gallery.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* --- MODE: ANTHOLOGY --- */}
                {viewMode === 'anthology' && (
                    <div className="animate-in fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {themes.map(([mood, themeEntries]) => (
                                <div key={mood} className="bg-white rounded-2xl p-8 shadow-sm border border-brand-100 hover:shadow-lg hover:border-brand-300 transition-all group cursor-pointer relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-10 -mt-10 blur-2xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                    
                                    <div className="relative z-10">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className="text-xs font-bold uppercase tracking-widest text-brand-400 border border-brand-100 px-2 py-1 rounded-md">
                                                Collection
                                            </span>
                                            <span className="text-2xl font-serif font-bold text-brand-200">
                                                {themeEntries.length}
                                            </span>
                                        </div>
                                        
                                        <h3 className="text-3xl font-serif font-bold text-brand-900 mb-2 group-hover:text-brand-600 transition-colors">
                                            {mood}
                                        </h3>
                                        
                                        <div className="space-y-3 mt-6">
                                            {themeEntries.slice(0, 3).map(e => (
                                                <div key={e.id} className="flex items-center gap-3 text-sm text-brand-600 border-b border-brand-50 pb-2 last:border-0">
                                                    <span className="text-brand-300 min-w-[80px] text-xs font-bold uppercase">
                                                        {new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                                                    </span>
                                                    <span className="truncate font-serif italic">{e.title}</span>
                                                </div>
                                            ))}
                                            {themeEntries.length > 3 && (
                                                <p className="text-xs text-brand-400 italic pt-2">+ {themeEntries.length - 3} more memories</p>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => {
                                                setSearchQuery(mood); // Filter by this mood
                                                setViewMode('chronicle');
                                            }}
                                            className="mt-6 w-full py-3 rounded-xl border border-brand-200 text-brand-600 font-bold text-xs uppercase tracking-widest hover:bg-brand-50 transition-colors"
                                        >
                                            Open Collection
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>

        {/* --- Chapter Generator Modal --- */}
        <ChapterModal 
            isOpen={isChapterModalOpen}
            onClose={() => setIsChapterModalOpen(false)}
            entries={entries}
        />
    </div>
  );
};

export default JournalView;