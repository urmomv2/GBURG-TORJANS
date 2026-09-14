import React, { useRef, useEffect, useState } from 'react';
import {
  Plus, X, Search, Clock, Puzzle, Bookmark, Code,
  Gamepad2, AppWindow, Brain, Music, Monitor, MessageCircle,
  Settings, Copy, ChevronUp, Globe, Monitor as MonitorIcon
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface ProxyEngine {
  id: string;
  name: string;
  description: string;
  speed: string;
  recommended: boolean;
}

interface BrowserOption {
  id: string;
  name: string;
}

const SettingsDropdown: React.FC<Props> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSettings();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [engines, setEngines] = useState<ProxyEngine[]>([]);
  const [browsers, setBrowsers] = useState<BrowserOption[]>([]);
  const [showEngines, setShowEngines] = useState(false);
  const [showBrowsers, setShowBrowsers] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/proxy/engines')
        .then(res => res.json())
        .then(data => setEngines(data.engines))
        .catch(() => {});
      fetch('/api/browsers')
        .then(res => res.json())
        .then(data => setBrowsers(data.browsers))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleZoomIn = () => updateSettings({ zoom: Math.min(settings.zoom + 10, 200) });
  const handleZoomOut = () => updateSettings({ zoom: Math.max(settings.zoom - 10, 50) });

  const speedColor = (speed: string) => {
    switch (speed) {
      case 'fast': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'slow': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const speedIcon = (speed: string) => {
    switch (speed) {
      case 'fast': return '⚡⚡⚡';
      case 'medium': return '⚡⚡';
      case 'slow': return '⚡';
      default: return '';
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute top-12 right-4 w-80 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden text-sm text-gray-300 backdrop-blur-xl"
    >
      <div className="flex justify-center pt-2 pb-1">
        <ChevronUp size={16} className="text-gray-500" />
      </div>

      {/* Tab Management */}
      <div className="px-2 py-1">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><Plus size={16} /> New Tab</div>
          <span className="text-xs text-gray-500">Tab+T</span>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><X size={16} /> Close Tab</div>
          <span className="text-xs text-gray-500">Tab+W</span>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><X size={16} /> Close All Tabs</div>
        </button>
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Zoom */}
      <div className="px-2 py-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span>Zoom</span>
          <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="hover:text-white p-1"><Search size={14} /></button>
            <span className="w-10 text-center text-xs">{settings.zoom}%</span>
            <button onClick={handleZoomIn} className="hover:text-white p-1"><Search size={14} /></button>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Proxy Engine Selector */}
      <div className="px-2 py-1">
        <button
          onClick={() => { setShowEngines(!showEngines); setShowBrowsers(false); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3"><Globe size={16} /> Proxy Engine</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400">
              {engines.find(e => e.id === settings.proxyEngine)?.name || 'Scramjet'}
            </span>
            <span className="text-xs">{showEngines ? '▲' : '▼'}</span>
          </div>
        </button>

        {showEngines && (
          <div className="mt-1 space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
            {engines.map((engine) => (
              <button
                key={engine.id}
                onClick={() => updateSettings({ proxyEngine: engine.id })}
                className={`w-full text-left px-3 py-2 rounded-lg transition ${
                  settings.proxyEngine === engine.id
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{engine.name}</span>
                  <span className={`text-xs ${speedColor(engine.speed)}`}>
                    {speedIcon(engine.speed)} {engine.speed}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{engine.description}</p>
                {engine.recommended && (
                  <span className="text-xs text-green-400 mt-0.5 inline-block">✦ Recommended</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Browser Selector */}
      <div className="px-2 py-1">
        <button
          onClick={() => { setShowBrowsers(!showBrowsers); setShowEngines(false); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3"><MonitorIcon size={16} /> Browser</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400">
              {browsers.find(b => b.id === settings.browser)?.name || 'Chrome'}
            </span>
            <span className="text-xs">{showBrowsers ? '▲' : '▼'}</span>
          </div>
        </button>

        {showBrowsers && (
          <div className="mt-1 space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
            {browsers.map((browser) => (
              <button
                key={browser.id}
                onClick={() => updateSettings({ browser: browser.id })}
                className={`w-full text-left px-3 py-2 rounded-lg transition ${
                  settings.browser === browser.id
                    ? 'bg-blue-600/20 border border-blue-500/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <span className="text-white">{browser.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Navigation */}
      <div className="px-2 py-1">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><Clock size={16} /> History</div>
          <span className="text-xs text-gray-500">Tab+H</span>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><Puzzle size={16} /> Extensions</div>
          <span className="text-xs text-gray-500">Tab+E</span>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><Bookmark size={16} /> Bookmarks</div>
          <span className="text-xs text-gray-500">Tab+D</span>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><Code size={16} /> Inspect</div>
          <span className="text-xs text-gray-500">Tab+I</span>
        </button>
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Feature Toggles */}
      <div className="px-2 py-1 max-h-48 overflow-y-auto">
        {[
          { key: 'showGames' as const, label: 'Games', icon: Gamepad2 },
          { key: 'showApps' as const, label: 'Apps', icon: AppWindow },
          { key: 'showAI' as const, label: 'AI', icon: Brain },
          { key: 'showMusic' as const, label: 'Music', icon: Music },
          { key: 'showMovies' as const, label: 'Movies', icon: Monitor },
          { key: 'showVM' as const, label: 'VM', icon: Monitor },
          { key: 'showChat' as const, label: 'Chat', icon: MessageCircle },
          { key: 'showTools' as const, label: 'Tools', icon: Settings },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => updateSettings({ [key]: !settings[key] })}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3"><Icon size={16} /> {label}</div>
            <span className={`text-xs ${settings[key] ? 'text-blue-400' : 'text-gray-600'}`}>
              {settings[key] ? 'ON' : 'OFF'}
            </span>
          </button>
        ))}
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      <div className="px-2 py-1 pb-2">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <Copy size={16} /> Copy URL
        </button>
      </div>
    </div>
  );
};

export default SettingsDropdown;
