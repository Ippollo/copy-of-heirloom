
import React from 'react';
import { Home, Book, Activity, Feather, Infinity, Compass, Lock, Cog } from 'lucide-react';
import { HeirloomLogo } from './HeirloomLogo';

type ViewState = 'home' | 'journal' | 'insights' | 'mentor' | 'biographer' | 'legacy';

interface SidebarProps {
    view: ViewState;
    setView: (view: ViewState) => void;
    onOpenSettings: () => void;
    onLock: () => void;
    hasSecurity: boolean;
}

const SidebarButton = ({ onClick, icon: Icon, label, active = false }: { onClick: () => void, icon: React.ElementType, label: string, active?: boolean }) => (
    <button 
        onClick={onClick} 
        className={`w-full flex items-center pl-6 pr-3 py-3 rounded-2xl transition-all duration-300 group text-left relative overflow-hidden
            ${active ? 'bg-brand-200 text-brand-900 font-bold shadow-md' : 'text-brand-500 hover:bg-brand-50 hover:text-brand-700 font-medium'}`}
    >
        <div className="flex items-center justify-center w-8 h-8 flex-shrink-0 relative z-10">
            <Icon className={`w-7 h-7 ${active ? 'text-brand-600' : 'text-brand-400 group-hover:text-brand-600'}`} strokeWidth={2} />
        </div>
        
        <div className="overflow-hidden max-w-0 group-hover/sidebar:max-w-xs transition-[max-width] duration-500 ease-in-out">
            <span className="text-base whitespace-nowrap pl-4 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 delay-100 block">
                {label}
            </span>
        </div>
    </button>
  );

export const Sidebar: React.FC<SidebarProps> = ({ view, setView, onOpenSettings, onLock, hasSecurity }) => {
    return (
        <aside 
        className={`
            hidden md:flex flex-col bg-white border-r border-brand-100 h-full shadow-2xl z-30 transition-all duration-300 ease-out overflow-hidden group/sidebar
            w-24 hover:w-72 flex-shrink-0 relative
        `}
      >
        <div className="pl-6 pr-4 py-4 flex items-center gap-2 whitespace-nowrap cursor-pointer h-24 flex-shrink-0" onClick={() => setView('home')}>
            <div className="p-2 bg-brand-600 rounded-xl text-white shadow-md flex-shrink-0 flex items-center justify-center">
              <HeirloomLogo className="w-8 h-8" />
            </div>
            <div className="overflow-hidden max-w-0 group-hover/sidebar:max-w-xs transition-[max-width] duration-500 ease-in-out">
                <h1 className="text-2xl font-serif font-bold text-brand-800 tracking-tight opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-300 delay-100 pl-4">
                    Heirloom
                </h1>
            </div>
        </div>
        
        <nav className="flex-1 px-2 space-y-3 py-6 overflow-y-auto whitespace-nowrap scrollbar-hide">
             <SidebarButton onClick={() => setView('home')} icon={Home} label="Home" active={view === 'home'} />
             <SidebarButton onClick={() => setView('biographer')} icon={Feather} label="Biographer" active={view === 'biographer'} />
             <SidebarButton onClick={() => setView('journal')} icon={Book} label="Journal" active={view === 'journal'} />
             <SidebarButton onClick={() => setView('legacy')} icon={Infinity} label="Legacy" active={view === 'legacy'} />
             <SidebarButton onClick={() => setView('insights')} icon={Activity} label="Insights" active={view === 'insights'} />
             <SidebarButton onClick={() => setView('mentor')} icon={Compass} label="Mentor" active={view === 'mentor'} />
        </nav>

        <div className="px-2 py-4 border-t border-brand-100 bg-brand-50/30 whitespace-nowrap space-y-6 flex-shrink-0">
            {hasSecurity && (
                <button 
                    onClick={onLock}
                    className="w-full flex items-center pl-6 pr-3 py-3 bg-white border border-brand-200 rounded-xl text-brand-600 hover:bg-brand-50 transition-all shadow-sm group/btn relative overflow-hidden"
                    title="Lock Journal"
                >
                    <div className="flex items-center justify-center w-8 h-8 flex-shrink-0 z-10">
                        <Lock className="w-6 h-6" />
                    </div>
                    <div className="overflow-hidden max-w-0 group-hover/sidebar:max-w-xs transition-[max-width] duration-500 ease-in-out">
                        <span className="text-sm font-bold uppercase tracking-wide opacity-0 group-hover/sidebar:opacity-100 transition-all duration-300 delay-100 pl-4 block">
                            Lock Journal
                        </span>
                    </div>
                </button>
            )}
            
            <SidebarButton onClick={onOpenSettings} icon={Cog} label="Settings" />
        </div>
      </aside>
    );
};
