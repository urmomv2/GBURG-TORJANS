import React, { useState } from 'react';
import {
  Gamepad2, Wallet, Music, Book, Monitor, MessageCircle,
  Settings, Plus, Search, ArrowLeft, ArrowRight, RefreshCw,
  Lock, Star, User, MoreVertical, Link as LinkIcon, Shield, Wifi, Battery, Clock,
  Home
} from 'lucide-react';
import RainEffect from './components/RainEffect';
import SettingsDropdown from './components/SettingsDropdown';
import LegalModal, { LegalTab } from './components/LegalModal';
import GameLibrary from './components/GameLibrary';

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>(null);
  const [currentView, setCurrentView] = useState<'home' | 'games'>('home');

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0a0a] text-white font-sans">
      <div
        className={`absolute inset-0 z-0 bg-[url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center transition-opacity duration-500 ${currentView === 'games' ? 'opacity-20' : 'opacity-60'}`}
        style={{ filter: 'blur(4px)' }}
      ></div>

      {currentView === 'home' && <RainEffect />}

      <div className="relative z-20 flex h-full">
        <aside className="w-16 flex flex-col items-center py-4 gap-6 border-r border-white/10 bg-black/40 backdrop-blur-md z-30">
          <button
            onClick={() => setCurrentView('home')}
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl transition ${currentView === 'home' ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-400 hover:bg-white/20'}`}
          >
            T
          </button>

          <div className="flex flex-col gap-6 mt-4">
            <button onClick={() => setCurrentView('home')} className={`transition ${currentView === 'home' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}>
              <Home size={22} />
            </button>
            <button onClick={() => setCurrentView('games')} className={`transition ${currentView === 'games' ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}>
              <Gamepad2 size={22} />
            </button>
            <button className="text-gray-400 hover:text-white transition"><Wallet size={22} /></button>
            <button className="text-gray-400 hover:text-white transition"><Music size={22} /></button>
            <button className="text-gray-400 hover:text-white transition"><Book size={22} /></button>
            <button className="text-gray-400 hover:text-white transition"><Monitor size={22} /></button>
            <button className="text-gray-400 hover:text-white transition"><MessageCircle size={22} /></button>
            <button className="text-gray-400 hover:text-white transition"><Settings size={22} /></button>
          </div>
          <div className="mt-auto flex flex-col gap-4 text-gray-400">
            <button className="hover:text-white transition"><Plus size={22} /></button>
            <button className="hover:text-white transition"><User size={22} /></button>
          </div>
        </aside>

        <main className="flex-1 flex flex-col">
          <header className="h-14 flex items-center px-4 gap-4 border-b border-white/10 bg-black/20 backdrop-blur-md z-30">
            <div className="flex gap-2 text-gray-400">
              <button className="hover:text-white"><ArrowLeft size={18} /></button>
              <button className="hover:text-white"><ArrowRight size={18} /></button>
              <button className="hover:text-white"><RefreshCw size={16} /></button>
            </div>

            <div className="flex-1 max-w-xl mx-auto relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={14} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={currentView === 'home' ? "trojans://newtab" : "trojans://games"}
                readOnly
                className="w-full bg-black/40 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-sm text-gray-300 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-4 text-gray-400">
              <Shield size={18} className="text-red-500" />
              <Star size={18} />
              <User size={18} />
              <div className="relative">
                <button
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  className={`hover:text-white transition ${isSettingsOpen ? 'text-white' : ''}`}
                >
                  <MoreVertical size={18} />
                </button>
                <SettingsDropdown isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
              </div>
            </div>
          </header>

          <div className={`flex-1 overflow-y-auto p-8 relative ${currentView === 'home' ? 'flex flex-col items-center justify-center' : ''}`}>
            {currentView === 'home' ? (
              <>
                <div className="absolute top-4 right-4 flex gap-3">
                  <button className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 px-4 py-2 rounded-full text-sm transition backdrop-blur-md">
                    <MessageCircle size={16} /> Discord
                  </button>
                  <button className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/10 px-4 py-2 rounded-full text-sm transition backdrop-blur-md">
                    <LinkIcon size={16} /> Get Links
                  </button>
                </div>

                <div className="flex flex-col items-center w-full max-w-2xl mt-12">
                  <h1 className="text-6xl font-bold mb-8 tracking-wider">Trojans</h1>

                  <div className="w-full relative mb-8">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search size={20} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Search or enter URL..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-full py-4 pl-12 pr-16 text-lg text-white placeholder-gray-400 focus:outline-none focus:border-white/30 backdrop-blur-md shadow-lg transition"
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-xs text-gray-400 bg-white/10 px-2 py-1 rounded">Ctrl+K</span>
                    </div>
                  </div>

                  <div className="flex gap-4 mb-8">
                    {[Gamepad2, Wallet, Music, Book, Monitor, MessageCircle].map((Icon, idx) => (
                      <button
                        key={idx}
                        onClick={() => idx === 0 && setCurrentView('games')}
                        className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition"
                      >
                        <Icon size={20} />
                      </button>
                    ))}
                    <button className="w-12 h-12 rounded-full bg-black/40 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition">
                      <Plus size={20} />
                    </button>
                  </div>

                  <button className="flex items-center gap-2 bg-black/40 border border-white/10 px-4 py-2 rounded-full text-sm hover:bg-white/10 transition">
                    <span>🇺🇸</span> Virginia <span className="text-xs text-gray-400">▼</span>
                  </button>
                </div>
              </>
            ) : (
              <GameLibrary />
            )}
          </div>

          <footer className="h-8 flex items-center justify-between px-4 text-xs text-gray-400 border-t border-white/10 bg-black/40 backdrop-blur-md z-30">
            <div className="flex gap-4">
              <span>1 tab</span>
              <span className="hover:text-white cursor-pointer">Discord</span>
              <button onClick={() => setLegalTab('tos')} className="hover:text-white cursor-pointer transition">ToS</button>
              <button onClick={() => setLegalTab('privacy')} className="hover:text-white cursor-pointer transition">Privacy</button>
              <button onClick={() => setLegalTab('dmca')} className="hover:text-white cursor-pointer transition">DMCA</button>
              <button onClick={() => setLegalTab('credits')} className="hover:text-white cursor-pointer transition">Credits</button>
            </div>
            <div className="flex gap-4 items-center">
              <span className="flex items-center gap-1"><span className="text-yellow-500">🔥</span> Trending</span>
              <span className="flex items-center gap-1"><Shield size={12} /> Secure</span>
              <span className="flex items-center gap-1"><Wifi size={12} /></span>
              <span className="flex items-center gap-1"><Battery size={14} /></span>
              <span className="flex items-center gap-1"><Clock size={12} /> 09:08 PM</span>
            </div>
          </footer>
        </main>
      </div>

      <LegalModal type={legalTab} onClose={() => setLegalTab(null)} />
    </div>
  );
};

export default App;