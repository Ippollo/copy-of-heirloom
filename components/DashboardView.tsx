import React, { useMemo } from 'react';
import { JournalEntry } from '../types';
import { TrendingUp, Hash, Activity, Calendar, Award, Sun, Moon, Sunrise, Sunset, Mic, Type, Clock, Smile, Brain, Sparkles, Zap, Heart } from 'lucide-react';

interface DashboardViewProps {
  entries: JournalEntry[];
  onBack: () => void;
}

// --- HELPERS ---

// Map mood strings to a 1-5 sentiment score
const getMoodScore = (mood: string): number => {
  if (!mood) return 3;
  const m = mood.toLowerCase();
  if (m.includes('ecstatic') || m.includes('joy') || m.includes('excited') || m.includes('wonderful') || m.includes('blessed') || m.includes('proud')) return 5;
  if (m.includes('happy') || m.includes('grateful') || m.includes('hope') || m.includes('energetic') || m.includes('confident') || m.includes('good')) return 4;
  if (m.includes('calm') || m.includes('content') || m.includes('peace') || m.includes('focus') || m.includes('neutral') || m.includes('okay') || m.includes('reflective')) return 3;
  if (m.includes('anxious') || m.includes('tired') || m.includes('nervous') || m.includes('confused') || m.includes('bored') || m.includes('overwhelmed')) return 2;
  if (m.includes('sad') || m.includes('angry') || m.includes('grief') || m.includes('frustrat') || m.includes('depress') || m.includes('lonely') || m.includes('bad')) return 1;
  return 3;
};

const getTimeOfDay = (date: number) => {
    const hour = new Date(date).getHours();
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 22) return 'Evening';
    return 'Night';
};

const DashboardView: React.FC<DashboardViewProps> = ({ entries, onBack }) => {
  
  // --- DATA PROCESSING ---
  
  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => a.createdAt - b.createdAt);
  }, [entries]);

  // 1. Mood Data for Chart
  const moodData = useMemo(() => {
    return sortedEntries.map(e => ({
      date: new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: getMoodScore(e.mood),
      mood: e.mood ? e.mood.split(',')[0].trim() : "Neutral",
      title: e.title,
      id: e.id
    }));
  }, [sortedEntries]);

  // 2. Statistics & "Aha" Moments
  const insights = useMemo(() => {
    if (entries.length === 0) return null;

    // A. Word Count & Duration
    const totalWords = entries.reduce((acc, curr) => acc + (curr.transcription?.split(' ').length || 0), 0);
    const totalDuration = entries.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    
    // B. Dominant Mood
    const moodCounts: Record<string, number> = {};
    entries.forEach(e => {
        const m = (e.mood || 'Neutral').split(',')[0].trim(); // Take primary mood
        moodCounts[m] = (moodCounts[m] || 0) + 1;
    });
    const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Neutral';

    // C. Time of Day Patterns (The "Power Hour")
    const timeStats = { Morning: { count: 0, sentimentSum: 0 }, Afternoon: { count: 0, sentimentSum: 0 }, Evening: { count: 0, sentimentSum: 0 }, Night: { count: 0, sentimentSum: 0 } };
    
    entries.forEach(e => {
        const tod = getTimeOfDay(e.createdAt) as keyof typeof timeStats;
        timeStats[tod].count++;
        timeStats[tod].sentimentSum += getMoodScore(e.mood);
    });

    // Find most active time
    let mostActiveTime = 'Morning';
    let maxCount = -1;
    Object.entries(timeStats).forEach(([tod, data]) => {
        if (data.count > maxCount) { maxCount = data.count; mostActiveTime = tod; }
    });

    // Find happiest time (avg sentiment)
    let happiestTime = 'Morning';
    let maxSentiment = -1;
    Object.entries(timeStats).forEach(([tod, data]) => {
        const avg = data.count > 0 ? data.sentimentSum / data.count : 0;
        if (avg > maxSentiment) { maxSentiment = avg; happiestTime = tod; }
    });

    // D. Tags (Obsessions)
    const tagCounts: Record<string, number> = {};
    entries.forEach(e => e.tags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1));
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // E. Modality Preference
    const audioCount = entries.filter(e => e.inputType === 'audio' || !e.inputType).length;
    const textCount = entries.length - audioCount;
    const voicePreference = audioCount > textCount ? 'Voice' : 'Text';

    return {
        totalWords,
        totalDuration,
        dominantMood,
        mostActiveTime,
        happiestTime,
        topTags,
        voicePreference,
        timeStats
    };
  }, [entries]);

  // --- SVG Chart Logic ---
  const Chart = () => {
    if (moodData.length < 2) return (
        <div className="h-64 flex flex-col items-center justify-center text-brand-300 italic text-sm bg-brand-50/50 rounded-3xl border border-brand-100">
            <Activity className="w-8 h-8 mb-2 opacity-50" />
            Need at least 2 entries to visualize your emotional landscape.
        </div>
    );

    const height = 200;
    const width = 800;
    const padding = 20;
    
    // Smooth Curve Logic (Catmull-Rom or similar simple smoothing)
    const points = moodData.map((d, i) => {
        const x = (i / (moodData.length - 1)) * (width - padding * 2) + padding;
        const y = height - padding - ((d.score - 1) / 4) * (height - padding * 2);
        return { x, y, ...d };
    });

    // Build path
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
        // Simple line for now, could be bezier for extra smoothness
        d += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaPath = `${d} L ${points[points.length-1].x} ${height} L ${points[0].x} ${height} Z`;

    return (
      <div className="w-full overflow-x-auto scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[600px] overflow-visible">
          {/* Gradients */}
          <defs>
            <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8a6a5c" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#8a6a5c" stopOpacity="0" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                </feMerge>
            </filter>
          </defs>

          {/* Reference Lines */}
          <line x1={padding} y1={height/2} x2={width-padding} y2={height/2} stroke="#eaddd7" strokeWidth="1" strokeDasharray="4 4" />
          
          {/* Area */}
          <path d={areaPath} fill="url(#chartFill)" />
          
          {/* Line */}
          <path d={d} fill="none" stroke="#8a6a5c" strokeWidth="3" filter="url(#glow)" />

          {/* Points */}
          {points.map((p, i) => (
             <g key={i} className="group cursor-pointer">
                {/* Invisible hit area */}
                <circle cx={p.x} cy={p.y} r="15" fill="transparent" />
                
                {/* Visible dot */}
                <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="4" 
                    fill="white" 
                    stroke="#5d453b" 
                    strokeWidth="2" 
                    className="transition-all duration-300 group-hover:r-6 group-hover:stroke-brand-600"
                />
                
                {/* Tooltip */}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <rect 
                        x={Math.min(width - 120, Math.max(0, p.x - 60))} 
                        y={Math.max(0, p.y - 55)} 
                        width="120" 
                        height="45" 
                        rx="8"
                        fill="#2D241E"
                        filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.2))"
                    />
                    {/* Tooltip Triangle */}
                    <path d={`M ${p.x} ${p.y-10} L ${p.x-6} ${p.y-16} L ${p.x+6} ${p.y-16} Z`} fill="#2D241E" />
                    
                    <text x={Math.min(width - 120, Math.max(0, p.x - 60)) + 60} y={Math.max(0, p.y - 55) + 18} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
                        {p.mood}
                    </text>
                    <text x={Math.min(width - 120, Math.max(0, p.x - 60)) + 60} y={Math.max(0, p.y - 55) + 34} textAnchor="middle" fill="#d2bab0" fontSize="10">
                        {p.date}
                    </text>
                </g>
             </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-brand-600 rounded-xl shadow-md">
            <Activity className="w-6 h-6 text-white" />
        </div>
        <div>
            <h2 className="text-2xl font-serif font-bold text-brand-900">Insights</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-400">Patterns in your story</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
         {!insights ? (
             <div className="h-full flex flex-col items-center justify-center text-brand-300 pb-20">
                 <Brain className="w-16 h-16 mb-4 opacity-20" />
                 <p className="font-serif text-lg text-brand-400">Capture more memories to unlock insights.</p>
             </div>
         ) : (
             <div className="max-w-5xl mx-auto w-full space-y-6 md:space-y-8 pb-24">
                 
                 {/* 1. EMOTIONAL LANDSCAPE (Hero) */}
                 <div className="bg-white rounded-3xl border border-brand-100 shadow-sm p-6 md:p-8 relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>
                     
                     <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
                         <div className="flex items-center gap-2">
                             <div className="p-2 bg-brand-100 text-brand-600 rounded-lg">
                                 <TrendingUp className="w-5 h-5" />
                             </div>
                             <div>
                                <h3 className="text-lg font-serif font-bold text-brand-800">Emotional Landscape</h3>
                                <p className="text-xs text-brand-400">Your sentiment journey over time</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-2 text-xs font-medium text-brand-500 bg-brand-50 px-3 py-1.5 rounded-full border border-brand-100">
                            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                            <span>Recent Trend: <strong>{moodData[moodData.length-1]?.score >= (moodData[moodData.length-2]?.score || 3) ? "Rising" : "Cooling"}</strong></span>
                         </div>
                     </div>

                     <div className="relative z-10">
                         <Chart />
                     </div>
                 </div>

                 {/* 2. THE "AHA" GRID */}
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                     
                     {/* A. Rhythm / Power Hour */}
                     <div className="bg-white rounded-3xl border border-brand-100 shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                             <Clock className="w-24 h-24 text-brand-400" />
                         </div>
                         <div className="relative z-10 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <Zap className="w-4 h-4 text-orange-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-brand-400">Peak Rhythm</span>
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <h4 className="text-3xl font-serif font-bold text-brand-900 mb-1">{insights.mostActiveTime}s</h4>
                                <p className="text-sm text-brand-500 leading-snug">
                                    You are most prolific in the {insights.mostActiveTime.toLowerCase()}. 
                                    {insights.happiestTime === insights.mostActiveTime 
                                        ? " It's also when you feel happiest." 
                                        : ` However, your happiest entries are in the ${insights.happiestTime.toLowerCase()}.`}
                                </p>
                            </div>
                            <div className="mt-4 flex gap-1 h-2">
                                {Object.entries(insights.timeStats).map(([time, rawData]) => {
                                    const data = rawData as { count: number, sentimentSum: number };
                                    const statsValues = Object.values(insights.timeStats) as { count: number }[];
                                    const total = statsValues.reduce((a, b) => a + b.count, 0);
                                    const pct = total > 0 ? (data.count / total) * 100 : 0;
                                    
                                    return (
                                        <div key={time} style={{width: `${pct}%`}} className={`h-full rounded-sm ${time === insights.mostActiveTime ? 'bg-brand-500' : 'bg-brand-100'}`} title={`${time}: ${Math.round(pct)}%`} />
                                    );
                                })}
                            </div>
                         </div>
                     </div>

                     {/* B. Obsessions / Top Tags */}
                     <div className="bg-white rounded-3xl border border-brand-100 shadow-sm p-6 hover:shadow-md transition-shadow relative overflow-hidden group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                             <Hash className="w-24 h-24 text-brand-400" />
                         </div>
                         <div className="relative z-10 h-full flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <Heart className="w-4 h-4 text-rose-400" />
                                <span className="text-xs font-bold uppercase tracking-widest text-brand-400">Core Themes</span>
                            </div>
                            <div className="flex-1 space-y-3">
                                {insights.topTags.slice(0, 3).map(([tag, count], i) => (
                                    <div key={tag} className="flex items-center justify-between">
                                        <span className="font-serif text-brand-800 text-lg">#{tag}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-2 bg-brand-50 rounded-full overflow-hidden">
                                                <div className="h-full bg-brand-300 rounded-full" style={{ width: `${Math.min(100, (count / insights.topTags[0][1]) * 100)}%` }}></div>
                                            </div>
                                            <span className="text-xs font-bold text-brand-400 w-4 text-right">{count}</span>
                                        </div>
                                    </div>
                                ))}
                                {insights.topTags.length === 0 && <p className="text-brand-300 italic text-sm">No themes detected yet.</p>}
                            </div>
                         </div>
                     </div>

                     {/* C. The Core / Summary */}
                     <div className="bg-brand-800 rounded-3xl border border-brand-900 shadow-md p-6 relative overflow-hidden text-white flex flex-col justify-between">
                         <div className="relative z-10">
                             <div className="flex items-center gap-2 mb-4 opacity-80">
                                 <Brain className="w-4 h-4" />
                                 <span className="text-xs font-bold uppercase tracking-widest">The Signal</span>
                             </div>
                             <p className="font-serif text-xl leading-relaxed opacity-90">
                                 "You tend to reflect through <span className="text-brand-200 font-bold">{insights.voicePreference.toLowerCase()}</span>, mostly feeling <span className="text-brand-200 font-bold">{insights.dominantMood.toLowerCase()}</span>."
                             </p>
                         </div>
                         <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex justify-between items-end">
                             <div>
                                 <p className="text-3xl font-serif font-bold">{insights.totalWords.toLocaleString()}</p>
                                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Words Captured</p>
                             </div>
                             <div className="text-right">
                                 <p className="text-xl font-serif font-bold opacity-80">{Math.round(insights.totalDuration / 60)}m</p>
                                 <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Spoken Time</p>
                             </div>
                         </div>
                         {/* Decorative Elements */}
                         <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-brand-600 rounded-full blur-3xl opacity-50"></div>
                     </div>

                 </div>

                 {/* 3. CALENDAR HEATMAP (Minimalist) */}
                 <div className="bg-white rounded-3xl border border-brand-100 shadow-sm p-6 md:p-8">
                     <div className="flex items-center gap-2 mb-6">
                         <Calendar className="w-5 h-5 text-brand-400" />
                         <h3 className="text-lg font-serif font-bold text-brand-800">Consistency</h3>
                     </div>
                     <div className="flex flex-wrap gap-2 justify-center">
                         {Array.from({ length: 28 }).map((_, i) => {
                             // Mock last 4 weeks visual
                             const date = new Date();
                             date.setDate(date.getDate() - (27 - i));
                             const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                             const hasEntry = entries.some(e => new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) === dateStr);
                             
                             return (
                                 <div key={i} className="flex flex-col items-center gap-1 group cursor-default">
                                     <div 
                                        className={`w-8 h-8 rounded-lg transition-all duration-300 ${hasEntry ? 'bg-brand-600 shadow-sm scale-100' : 'bg-brand-50 scale-90'}`}
                                        title={dateStr}
                                     ></div>
                                     <span className="text-[9px] text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity">{date.getDate()}</span>
                                 </div>
                             )
                         })}
                     </div>
                 </div>

             </div>
         )}
      </div>
    </div>
  );
};

export default DashboardView;