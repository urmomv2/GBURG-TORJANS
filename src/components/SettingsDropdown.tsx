import React, { useRef, useEffect, useState } from 'react';
import {
  Plus, X, Search, Clock, Puzzle, Bookmark, Code,
  Gamepad2, AppWindow, Brain, Music, Monitor, MessageCircle,
  Settings, Copy, ChevronUp, ChevronDown, Globe, Wifi, Shield,
  Zap, Lock, AlertTriangle, CheckCircle2
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
  longDesc?: string;
  speed: 'fast' | 'medium' | 'slow';
  endpoint: string;
  enabled: boolean;
  recommended?: boolean;
  protocol?: string;
  anonymity?: 'low' | 'medium' | 'high';
  bestFor?: string[];
  limitations?: string[];
}

interface BrowserOption {
  id: string;
  name: string;
  description?: string;
}

const SettingsDropdown: React.FC<Props> = ({ isOpen, onClose }) => {
  const { settings, updateSettings } = useSettings();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [engines, setEngines] = useState<ProxyEngine[]>([]);
  const [browsers, setBrowsers] = useState<BrowserOption[]>([]);
  const [showEngines, setShowEngines] = useState(false);
  const [showBrowsers, setShowBrowsers] = useState(false);
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);

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

  // ---- Style helpers for the engine cards ----
  const speedColor = (speed: string) => {
    switch (speed) {
      case 'fast':   return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      case 'slow':   return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:       return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const speedIcon = (speed: string) => {
    switch (speed) {
      case 'fast':   return '⚡⚡⚡';
      case 'medium': return '⚡⚡';
      case 'slow':   return '⚡';
      default:       return '';
    }
  };

  const anonymityColor = (level?: string) => {
    switch (level) {
      case 'high':   return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'medium': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'low':    return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      default:       return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  const currentEngine = engines.find(e => e.id === settings.proxyEngine);
  const currentBrowser = browsers.find(b => b.id === settings.browser);

  return (
    <div
      ref={dropdownRef}
      className="absolute top-12 right-4 w-96 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden text-sm text-gray-300 backdrop-blur-xl"
    >
      <div className="flex justify-center pt-2 pb-1">
        <ChevronUp size={16} className="text-gray-500" />
      </div>

      {/* ==================== Tab Management ==================== */}
      <div className="px-2 py-1">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><Plus size={16} /> New Tab</div>
          <span className="text-xs text-gray-500">Tab+T</span>
        </button>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <div className="flex items-center gap-3"><X size={16} /> Close Tab</div>
          <span className="text-xs text-gray-500">Tab+W</span>
        </button>
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* ==================== Zoom ==================== */}
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

      {/* ==================== Proxy Connection Picker ==================== */}
      <div className="px-2 py-1">
        <button
          onClick={() => { setShowEngines(!showEngines); setShowBrowsers(false); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <Globe size={16} />
            <span>Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400">
              {currentEngine?.name || 'Scramjet'}
            </span>
            {showEngines ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showEngines && (
          <div className="mt-1 space-y-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
            {engines.map((engine) => {
              const isSelected = settings.proxyEngine === engine.id;
              const isExpanded = expandedEngine === engine.id;

              return (
                <div
                  key={engine.id}
                  className={`rounded-lg border transition ${
                    isSelected
                      ? 'bg-blue-600/15 border-blue-500/40'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/5'
                  }`}
                >
                  {/* Engine header */}
                  <button
                    onClick={() => {
                      updateSettings({ proxyEngine: engine.id });
                      setExpandedEngine(isExpanded ? null : engine.id);
                    }}
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isSelected && (
                          <CheckCircle2 size={14} className="text-blue-400 shrink-0" />
                        )}
                        <span className="font-medium text-white truncate">
                          {engine.name}
                        </span>
                        {engine.recommended && (
                          <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded shrink-0">
                            ✦ Rec
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${speedColor(engine.speed)}`}>
                        {speedIcon(engine.speed)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                      {engine.description}
                    </p>

                    {/* Chips row */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {engine.protocol && (
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                          <Wifi size={9} /> {engine.protocol}
                        </span>
                      )}
                      {engine.anonymity && (
                        <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${anonymityColor(engine.anonymity)}`}>
                          <Shield size={9} /> {engine.anonymity} anonymity
                        </span>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5 mt-1">
                      {engine.longDesc && (
                        <p className="text-xs text-gray-400 leading-relaxed mb-3">
                          {engine.longDesc}
                        </p>
                      )}

                      {engine.bestFor && engine.bestFor.length > 0 && (
                        <div className="mb-2">
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-green-400 mb-1">
                            <Zap size={10} /> Best for
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {engine.bestFor.map((tag, i) => (
                              <span
                                key={i}
                                className="text-[10px] text-green-300 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {engine.limitations && engine.limitations.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-400 mb-1">
                            <AlertTriangle size={10} /> Limitations
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {engine.limitations.map((tag, i) => (
                              <span
                                key={i}
                                className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* ==================== Browser Picker ==================== */}
      <div className="px-2 py-1">
        <button
          onClick={() => { setShowBrowsers(!showBrowsers); setShowEngines(false); }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition"
        >
          <div className="flex items-center gap-3">
            <Monitor size={16} />
            <span>Browser Fingerprint</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-blue-400">
              {currentBrowser?.name || 'Chrome'}
            </span>
            {showBrowsers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        {showBrowsers && (
          <div className="mt-1 space-y-1 max-h-52 overflow-y-auto custom-scrollbar">
            {browsers.map((browser) => {
              const isSelected = settings.browser === browser.id;
              return (
                <button
                  key={browser.id}
                  onClick={() => updateSettings({ browser: browser.id })}
                  className={`w-full text-left px-3 py-2 rounded-lg transition ${
                    isSelected
                      ? 'bg-blue-600/20 border border-blue-500/30'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <CheckCircle2 size={12} className="text-blue-400 shrink-0" />
                    )}
                    <span className="text-white text-xs font-medium">
                      {browser.name}
                    </span>
                  </div>
                  {browser.description && (
                    <p className="text-[11px] text-gray-500 mt-0.5 ml-5">
                      {browser.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* ==================== Navigation ==================== */}
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

      {/* ==================== Feature Toggles ==================== */}
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
        <button className="flex w-full items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition">
          <Copy size={16} /> Copy URL
        </button>
      </div>
    </div>
  );
};

export default SettingsDropdown;