
import React from 'react';
import { Home, Book, Feather, Infinity, Cog, Lock } from 'lucide-react';
import { HeirloomLogo } from './HeirloomLogo';

type ViewState = 'home' | 'journal' | 'insights' | 'mentor' | 'biographer' | 'legacy';

interface MobileNavigationProps {
    view: ViewState;
    setView: (view: ViewState) => void;
    onOpenSettings: () => void;
}

const MobileNavButton = ({ onClick, icon: Icon, label, active = false }: { onClick: () => void, icon: React.ElementType, label: string, active?: boolean }) => (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-2 rounded-lg flex-1 ${active ? 'text-brand-600' : 'text-brand-400'}`} >
        <Icon className={`w-6 h-6 ${active ? 'fill-current opacity-20' : ''}`} strokeWidth={active ? 2.5 : 2} />
        <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
);

export const MobileHeader: React.FC<{ setView: (v: ViewState) => void, hasSecurity: boolean, onLock: () => void }> = ({ setView, hasSecurity, onLock }) => (
    <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-white/80 backdrop-blur-md border-b border-brand-100 px-4 py-3 flex justify-between items-center">
         <div className="flex items-center gap-2" onClick={() => setView('home')}>
            <div className="p-1.5 bg-brand-600 rounded text-white">
                <HeirloomLogo className="w-4 h-4" />
            </div>
            <span className="font-serif font-bold text-brand-800 text-lg">Heirloom</span>
         </div>
         {hasSecurity && (
             <button onClick={onLock} className="p-2 text-brand-500 hover:text-brand-800">
                 <Lock className="w-5 h-5" />
             </button>
         )}
    </div>
);

export const MobileFooter: React.FC<MobileNavigationProps> = ({ view, setView, onOpenSettings }) => (
    <>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-brand-100 flex justify-around p-2 z-30 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <MobileNavButton onClick={() => setView('biographer')} icon={Feather} label="Biographer" active={view === 'biographer'} />
            <MobileNavButton onClick={() => setView('journal')} icon={Book} label="Journal" active={view === 'journal'} />
            <div className="w-12"></div> {/* Space for Fab */}
            <MobileNavButton onClick={() => setView('legacy')} icon={Infinity} label="Legacy" active={view === 'legacy'} />
            <MobileNavButton onClick={onOpenSettings} icon={Cog} label="Settings" />
        </nav>

        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
            <button 
                onClick={() => setView('home')}
                className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${view === 'home' ? 'bg-brand-600 text-white scale-110' : 'bg-white text-brand-600 border border-brand-200'}`}
            >
                <Home className="w-6 h-6" />
            </button>
        </div>
    </>
);
